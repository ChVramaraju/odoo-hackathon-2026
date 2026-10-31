-- Migration: 20261031000002_quotations.sql
-- Description: Core quotations schema for Brightloop (quotations, quotation_lines, atomic RPC)
-- Target: Supabase PostgreSQL (15+)
-- Branch: feature/jashwanth-database

-- ============================================================================
-- 1. Sequences & Auto-generation Helpers
-- ============================================================================

-- Sequence for human-readable quotation numbering (e.g. QUOT-2026-00001)
CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT
SET search_path = public
AS $$
BEGIN
    RETURN 'QUOT-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('quotation_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- 2. Quotations Header Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) NOT NULL UNIQUE DEFAULT generate_quotation_number() CHECK (trim(quotation_number) <> ''),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'cancelled')),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    valid_until DATE,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    internal_notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quotations_dates CHECK (
        (confirmed_at IS NULL OR confirmed_at >= created_at) AND
        (cancelled_at IS NULL OR cancelled_at >= created_at)
    )
);

-- Quotations updated_at trigger
DROP TRIGGER IF EXISTS trg_quotations_updated_at ON quotations;
CREATE TRIGGER trg_quotations_updated_at
BEFORE UPDATE ON quotations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Quotations status timestamp automation trigger
CREATE OR REPLACE FUNCTION handle_quotation_status_transition()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
        IF NEW.confirmed_at IS NULL THEN
            NEW.confirmed_at = now();
        END IF;
    END IF;
    IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
        IF NEW.cancelled_at IS NULL THEN
            NEW.cancelled_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotations_status_transition ON quotations;
CREATE TRIGGER trg_quotations_status_transition
BEFORE UPDATE ON quotations
FOR EACH ROW EXECUTE FUNCTION handle_quotation_status_transition();

-- Quotations indexes
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations (status);
CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations (valid_until);
CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations (created_by);
CREATE INDEX IF NOT EXISTS idx_quotations_plan_id ON quotations (plan_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations (created_at DESC);

-- ============================================================================
-- 3. Quotation Lines Detail Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    line_type VARCHAR(20) NOT NULL DEFAULT 'product' CHECK (line_type IN ('product', 'plan')),
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
    line_number INTEGER NOT NULL DEFAULT 1 CHECK (line_number >= 1),
    description TEXT NOT NULL CHECK (trim(description) <> ''),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_quotation_line_item CHECK (
        (line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR
        (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
    )
);

-- Quotation lines updated_at trigger
DROP TRIGGER IF EXISTS trg_quotation_lines_updated_at ON quotation_lines;
CREATE TRIGGER trg_quotation_lines_updated_at
BEFORE UPDATE ON quotation_lines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Quotation line math consistency and line_type synchronization trigger
CREATE OR REPLACE FUNCTION calculate_quotation_line_amounts()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
    v_taxable_base NUMERIC(12, 2);
BEGIN
    -- Synchronize line_type based on referenced entity
    IF NEW.plan_id IS NOT NULL THEN
        NEW.line_type = 'plan';
    ELSIF NEW.product_id IS NOT NULL THEN
        NEW.line_type = 'product';
    END IF;

    -- Calculate gross subtotal: quantity * unit_price
    NEW.subtotal = round(NEW.quantity * NEW.unit_price, 2);
    
    -- Calculate discount if percentage provided and amount not manually specified or if line values changed
    IF NEW.discount_percentage > 0 THEN
        IF NEW.discount_amount IS NULL OR NEW.discount_amount = 0 OR (TG_OP = 'UPDATE' AND (NEW.quantity <> OLD.quantity OR NEW.unit_price <> OLD.unit_price OR NEW.discount_percentage <> OLD.discount_percentage)) THEN
            NEW.discount_amount = round(NEW.subtotal * (NEW.discount_percentage / 100.0), 2);
        END IF;
    ELSIF NEW.discount_amount IS NULL THEN
        NEW.discount_amount = 0.00;
    END IF;
    
    -- Taxable base after discount
    v_taxable_base = greatest(0.00, NEW.subtotal - NEW.discount_amount);
    
    -- Calculate tax if rate provided and tax amount not manually specified or if taxable base changed
    IF NEW.tax_rate > 0 THEN
        IF NEW.tax_amount IS NULL OR NEW.tax_amount = 0 OR (TG_OP = 'UPDATE' AND (NEW.quantity <> OLD.quantity OR NEW.unit_price <> OLD.unit_price OR NEW.tax_rate <> OLD.tax_rate OR NEW.discount_amount <> OLD.discount_amount)) THEN
            NEW.tax_amount = round(v_taxable_base * (NEW.tax_rate / 100.0), 2);
        END IF;
    ELSIF NEW.tax_amount IS NULL THEN
        NEW.tax_amount = 0.00;
    END IF;
    
    -- Final line total
    NEW.line_total = greatest(0.00, v_taxable_base + NEW.tax_amount);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotation_lines_calculate ON quotation_lines;
CREATE TRIGGER trg_quotation_lines_calculate
BEFORE INSERT OR UPDATE ON quotation_lines
FOR EACH ROW EXECUTE FUNCTION calculate_quotation_line_amounts();

-- Quotation parent header totals rollup trigger
-- Correctly handles INSERT, UPDATE (including quotation_id reassignment), and DELETE
CREATE OR REPLACE FUNCTION sync_quotation_totals()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    -- If quotation_id was reassigned in an UPDATE, re-sync the OLD quotation header first
    IF (TG_OP = 'UPDATE' AND OLD.quotation_id IS DISTINCT FROM NEW.quotation_id) THEN
        UPDATE quotations
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(subtotal) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM quotation_lines
            WHERE quotation_id = OLD.quotation_id
        ) lines
        WHERE id = OLD.quotation_id;
    END IF;

    -- Re-sync target quotation header (NEW for INSERT/UPDATE, OLD for DELETE)
    IF (TG_OP = 'DELETE') THEN
        UPDATE quotations
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(subtotal) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM quotation_lines
            WHERE quotation_id = OLD.quotation_id
        ) lines
        WHERE id = OLD.quotation_id;
    ELSE
        UPDATE quotations
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(subtotal) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM quotation_lines
            WHERE quotation_id = NEW.quotation_id
        ) lines
        WHERE id = NEW.quotation_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotation_lines_sync_totals ON quotation_lines;
CREATE TRIGGER trg_quotation_lines_sync_totals
AFTER INSERT OR UPDATE OR DELETE ON quotation_lines
FOR EACH ROW EXECUTE FUNCTION sync_quotation_totals();

-- Quotation lines indexes
CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation_id ON quotation_lines (quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_line_type ON quotation_lines (line_type);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_product_id ON quotation_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_variant_id ON quotation_lines (variant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_plan_id ON quotation_lines (plan_id);

-- ============================================================================
-- 4. Atomic Quotation & Lines Creation RPC
-- ============================================================================

-- Function to atomically insert a quotation header and all child lines in a single transaction
CREATE OR REPLACE FUNCTION create_quotation_atomic(
    p_header JSONB,
    p_lines JSONB
)
RETURNS JSONB
SET search_path = public
AS $$
DECLARE
    v_quotation_id UUID;
    v_result JSONB;
    v_line JSONB;
    v_line_number INTEGER := 0;
BEGIN
    -- Enforce business rule: quotation must contain at least one line item
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'Quotation must contain at least one line item.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_quotation_id := COALESCE(NULLIF(trim(p_header->>'id'), '')::UUID, gen_random_uuid());

    -- Insert header
    INSERT INTO quotations (
        id,
        quotation_number,
        customer_id,
        plan_id,
        status,
        currency,
        subtotal,
        discount_total,
        tax_total,
        total_amount,
        valid_until,
        confirmed_at,
        notes,
        internal_notes,
        created_by
    ) VALUES (
        v_quotation_id,
        COALESCE(NULLIF(trim(p_header->>'quotation_number'), ''), generate_quotation_number()),
        NULLIF(trim(p_header->>'customer_id'), '')::UUID,
        NULLIF(trim(p_header->>'plan_id'), '')::UUID,
        COALESCE(NULLIF(trim(p_header->>'status'), ''), 'draft'),
        COALESCE(NULLIF(trim(p_header->>'currency'), ''), 'INR'),
        COALESCE((p_header->>'subtotal')::NUMERIC, 0.00),
        COALESCE((p_header->>'discount_total')::NUMERIC, 0.00),
        COALESCE((p_header->>'tax_total')::NUMERIC, 0.00),
        COALESCE((p_header->>'total_amount')::NUMERIC, 0.00),
        NULLIF(trim(p_header->>'valid_until'), '')::DATE,
        NULLIF(trim(p_header->>'confirmed_at'), '')::TIMESTAMPTZ,
        p_header->>'notes',
        p_header->>'internal_notes',
        NULLIF(trim(p_header->>'created_by'), '')::UUID
    );

    -- Insert child line items
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_number := v_line_number + 1;
        INSERT INTO quotation_lines (
            id,
            quotation_id,
            line_type,
            product_id,
            variant_id,
            plan_id,
            line_number,
            description,
            quantity,
            unit_price,
            discount_percentage,
            discount_amount,
            tax_rate,
            tax_amount,
            line_total
        ) VALUES (
            COALESCE(NULLIF(trim(v_line->>'id'), '')::UUID, gen_random_uuid()),
            v_quotation_id,
            COALESCE(NULLIF(trim(v_line->>'line_type'), ''), CASE WHEN v_line->>'plan_id' IS NOT NULL AND trim(v_line->>'plan_id') <> '' THEN 'plan' ELSE 'product' END),
            NULLIF(trim(v_line->>'product_id'), '')::UUID,
            NULLIF(trim(v_line->>'variant_id'), '')::UUID,
            NULLIF(trim(v_line->>'plan_id'), '')::UUID,
            COALESCE((v_line->>'line_number')::INTEGER, v_line_number),
            COALESCE(v_line->>'description', ''),
            COALESCE((v_line->>'quantity')::NUMERIC, 1.00),
            COALESCE((v_line->>'unit_price')::NUMERIC, 0.00),
            COALESCE((v_line->>'discount_percentage')::NUMERIC, 0.00),
            COALESCE((v_line->>'discount_amount')::NUMERIC, 0.00),
            COALESCE((v_line->>'tax_rate')::NUMERIC, 0.00),
            COALESCE((v_line->>'tax_amount')::NUMERIC, 0.00),
            COALESCE((v_line->>'line_total')::NUMERIC, 0.00)
        );
    END LOOP;

    -- Retrieve complete header record with nested child lines
    SELECT 
        to_jsonb(q.*) || jsonb_build_object(
            'lines', COALESCE(
                (
                    SELECT jsonb_agg(to_jsonb(l.*) ORDER BY l.line_number, l.created_at)
                    FROM quotation_lines l
                    WHERE l.quotation_id = v_quotation_id
                ),
                '[]'::jsonb
            )
        )
    INTO v_result
    FROM quotations q
    WHERE q.id = v_quotation_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Quotations Policies
-- ----------------------------------------------------------------------------

-- Allow staff and admin to view all quotations
CREATE POLICY "Allow staff and admin to view all quotations"
ON quotations FOR SELECT
TO authenticated
USING (is_staff_or_admin());

-- Allow customers to view their own quotations (sent, confirmed, cancelled, or self-created drafts)
CREATE POLICY "Allow customers to view their own quotations"
ON quotations FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid() AND (
        status IN ('sent', 'confirmed', 'cancelled') OR
        created_by = auth.uid()
    )
);

-- Allow staff and admin to insert quotations
CREATE POLICY "Allow staff and admin to insert quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

-- Allow customers to create draft quotations for themselves
CREATE POLICY "Allow customers to create draft quotations"
ON quotations FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = auth.uid() AND
    status = 'draft' AND
    (created_by IS NULL OR created_by = auth.uid())
);

-- Allow staff and admin to update quotations
CREATE POLICY "Allow staff and admin to update quotations"
ON quotations FOR UPDATE
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow customers to update their own draft quotations or confirm sent quotations
CREATE POLICY "Allow customers to update their own quotations"
ON quotations FOR UPDATE
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (
    customer_id = auth.uid() AND (
        -- Editing self-created draft
        (status = 'draft' AND (created_by IS NULL OR created_by = auth.uid())) OR
        -- Confirming a sent quote
        (status = 'confirmed') OR
        -- Cancelling an unconfirmed quote
        (status = 'cancelled')
    )
);

-- Allow admin to delete draft or cancelled quotations only
CREATE POLICY "Allow admin to delete draft or cancelled quotations"
ON quotations FOR DELETE
TO authenticated
USING (is_admin() AND status IN ('draft', 'cancelled'));

-- ----------------------------------------------------------------------------
-- Quotation Lines Policies
-- ----------------------------------------------------------------------------

-- Allow callers to view lines of quotations they have access to
CREATE POLICY "Allow callers to view lines of accessible quotations"
ON quotation_lines FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id
    )
);

-- Allow staff and admin to insert quotation lines on draft quotations
CREATE POLICY "Allow staff and admin to insert quotation lines"
ON quotation_lines FOR INSERT
TO authenticated
WITH CHECK (
    is_staff_or_admin() AND
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.status = 'draft'
    )
);

-- Allow customers to insert lines on their self-created draft quotations
CREATE POLICY "Allow customers to insert lines on own draft"
ON quotation_lines FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.customer_id = auth.uid() 
          AND (q.created_by IS NULL OR q.created_by = auth.uid()) 
          AND q.status = 'draft'
    )
);

-- Allow staff and admin to update quotation lines on draft quotations
CREATE POLICY "Allow staff and admin to update quotation lines"
ON quotation_lines FOR UPDATE
TO authenticated
USING (
    is_staff_or_admin() AND
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.status = 'draft'
    )
)
WITH CHECK (
    is_staff_or_admin() AND
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.status = 'draft'
    )
);

-- Allow customers to update lines on their self-created draft quotations
CREATE POLICY "Allow customers to update lines on own draft"
ON quotation_lines FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.customer_id = auth.uid() 
          AND (q.created_by IS NULL OR q.created_by = auth.uid()) 
          AND q.status = 'draft'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.customer_id = auth.uid() 
          AND (q.created_by IS NULL OR q.created_by = auth.uid()) 
          AND q.status = 'draft'
    )
);

-- Allow staff and admin to delete quotation lines on draft quotations
CREATE POLICY "Allow staff and admin to delete quotation lines"
ON quotation_lines FOR DELETE
TO authenticated
USING (
    is_staff_or_admin() AND
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.status = 'draft'
    )
);

-- Allow customers to delete lines on their self-created draft quotations
CREATE POLICY "Allow customers to delete lines on own draft"
ON quotation_lines FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM quotations q 
        WHERE q.id = quotation_lines.quotation_id 
          AND q.customer_id = auth.uid() 
          AND (q.created_by IS NULL OR q.created_by = auth.uid()) 
          AND q.status = 'draft'
    )
);

-- ============================================================================
-- 6. Role Grants & Permissions
-- ============================================================================

GRANT ALL ON quotations TO service_role;
GRANT ALL ON quotation_lines TO service_role;
GRANT USAGE, SELECT ON SEQUENCE quotation_number_seq TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON quotation_lines TO authenticated;

GRANT EXECUTE ON FUNCTION create_quotation_atomic(JSONB, JSONB) TO authenticated, service_role;
