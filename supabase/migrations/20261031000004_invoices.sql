-- Migration: 20261031000004_invoices.sql
-- Description: Core invoices schema for Brightloop (invoices, invoice_lines)
-- Target: Supabase PostgreSQL (15+)
-- Branch: feature/jashwanth-database

-- ============================================================================
-- 1. Sequences & Auto-generation Helpers
-- ============================================================================

-- Sequence for human-readable invoice numbering (e.g. INV-202610-00001)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
SET search_path = public
AS $$
BEGIN
    RETURN 'INV-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- 2. Invoices Header Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(64) NOT NULL UNIQUE DEFAULT generate_invoice_number() CHECK (trim(invoice_number) <> ''),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'paid', 'cancelled', 'overdue')),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL DEFAULT (CURRENT_DATE + 15),
    billing_period_start DATE,
    billing_period_end DATE,
    confirmed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoices_dates CHECK (
        (due_date >= invoice_date) AND
        (billing_period_end IS NULL OR billing_period_start IS NULL OR billing_period_end >= billing_period_start) AND
        (confirmed_at IS NULL OR confirmed_at >= created_at) AND
        (paid_at IS NULL OR paid_at >= created_at) AND
        (cancelled_at IS NULL OR cancelled_at >= created_at)
    )
);

-- Invoices updated_at trigger
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoices status transition automation trigger
CREATE OR REPLACE FUNCTION handle_invoice_status_transition()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status <> 'confirmed') THEN
        IF NEW.confirmed_at IS NULL THEN
            NEW.confirmed_at = now();
        END IF;
    ELSIF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
        IF NEW.paid_at IS NULL THEN
            NEW.paid_at = now();
        END IF;
    ELSIF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
        IF NEW.cancelled_at IS NULL THEN
            NEW.cancelled_at = now();
        END IF;
    END IF;

    -- Clear paid_at if status transitions backwards from paid and value was not modified
    IF OLD.status = 'paid' AND NEW.status <> 'paid' AND NEW.paid_at = OLD.paid_at THEN
        NEW.paid_at = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_status_transition ON invoices;
CREATE TRIGGER trg_invoices_status_transition
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION handle_invoice_status_transition();

-- Invoices indexes & partial uniqueness constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_subscription_billing_period 
ON invoices (subscription_id, billing_period_start, billing_period_end) 
WHERE subscription_id IS NOT NULL 
  AND billing_period_start IS NOT NULL 
  AND billing_period_end IS NOT NULL 
  AND status <> 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_quotation_id 
ON invoices (quotation_id) 
WHERE quotation_id IS NOT NULL 
  AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id ON invoices (quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);

-- ============================================================================
-- 3. Invoice Lines Detail Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_type VARCHAR(20) NOT NULL DEFAULT 'product' CHECK (line_type IN ('product', 'plan')),
    line_number INTEGER NOT NULL DEFAULT 1 CHECK (line_number >= 1),
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
    description VARCHAR(500) NOT NULL CHECK (trim(description) <> ''),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
    discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoice_line_item CHECK (
        (line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR
        (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
    )
);

-- Invoice line math consistency and line_type synchronization trigger
CREATE OR REPLACE FUNCTION calculate_invoice_line_amounts()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
    v_gross NUMERIC(12, 2);
    v_taxable_base NUMERIC(12, 2);
BEGIN
    -- Synchronize line_type based on referenced entity
    IF NEW.plan_id IS NOT NULL THEN
        NEW.line_type = 'plan';
    ELSIF NEW.product_id IS NOT NULL THEN
        NEW.line_type = 'product';
    END IF;

    -- Calculate gross: quantity * unit_price
    v_gross = round(NEW.quantity * NEW.unit_price, 2);
    
    -- Calculate discount if percentage provided and amount not manually specified or if line values changed
    IF NEW.discount_percentage > 0 THEN
        IF NEW.discount_amount IS NULL OR NEW.discount_amount = 0 OR (TG_OP = 'UPDATE' AND (NEW.quantity <> OLD.quantity OR NEW.unit_price <> OLD.unit_price OR NEW.discount_percentage <> OLD.discount_percentage)) THEN
            NEW.discount_amount = round(v_gross * (NEW.discount_percentage / 100.0), 2);
        END IF;
    ELSIF NEW.discount_amount IS NULL THEN
        NEW.discount_amount = 0.00;
    END IF;
    
    -- Taxable base after discount
    v_taxable_base = greatest(0.00, v_gross - NEW.discount_amount);
    
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

DROP TRIGGER IF EXISTS trg_invoice_lines_calculate ON invoice_lines;
CREATE TRIGGER trg_invoice_lines_calculate
BEFORE INSERT OR UPDATE ON invoice_lines
FOR EACH ROW EXECUTE FUNCTION calculate_invoice_line_amounts();

-- Invoice parent header totals rollup trigger
-- Correctly handles INSERT, UPDATE (including invoice_id reassignment), and DELETE
CREATE OR REPLACE FUNCTION sync_invoice_totals()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    -- If invoice_id was reassigned in an UPDATE, re-sync the OLD invoice header first
    IF (TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id) THEN
        UPDATE invoices
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            balance = GREATEST(0.00, COALESCE(lines.agg_total, 0.00) - amount_paid),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM invoice_lines
            WHERE invoice_id = OLD.invoice_id
        ) lines
        WHERE id = OLD.invoice_id;
    END IF;

    -- Re-sync target invoice header (NEW for INSERT/UPDATE, OLD for DELETE)
    IF (TG_OP = 'DELETE') THEN
        UPDATE invoices
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            balance = GREATEST(0.00, COALESCE(lines.agg_total, 0.00) - amount_paid),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM invoice_lines
            WHERE invoice_id = OLD.invoice_id
        ) lines
        WHERE id = OLD.invoice_id;
    ELSE
        UPDATE invoices
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            balance = GREATEST(0.00, COALESCE(lines.agg_total, 0.00) - amount_paid),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM invoice_lines
            WHERE invoice_id = NEW.invoice_id
        ) lines
        WHERE id = NEW.invoice_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_lines_sync_totals ON invoice_lines;
CREATE TRIGGER trg_invoice_lines_sync_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_lines
FOR EACH ROW EXECUTE FUNCTION sync_invoice_totals();

-- Invoice lines indexes
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_product_id ON invoice_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_variant_id ON invoice_lines (variant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_plan_id ON invoice_lines (plan_id);

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Invoices Policies
-- ----------------------------------------------------------------------------

-- Allow staff and admin to view all invoices
CREATE POLICY "Allow staff and admin to view all invoices"
ON invoices FOR SELECT
TO authenticated
USING (is_staff_or_admin());

-- Allow customers to view their own invoices
CREATE POLICY "Allow customers to view their own invoices"
ON invoices FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Allow staff and admin to insert invoices
CREATE POLICY "Allow staff and admin to insert invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

-- Allow customers to create draft invoices for themselves
CREATE POLICY "Allow customers to create draft invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = auth.uid() AND
    status = 'draft' AND
    (created_by IS NULL OR created_by = auth.uid())
);

-- Allow staff and admin to update invoices
CREATE POLICY "Allow staff and admin to update invoices"
ON invoices FOR UPDATE
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow customers to cancel their own draft invoices
CREATE POLICY "Allow customers to update own draft invoices"
ON invoices FOR UPDATE
TO authenticated
USING (customer_id = auth.uid() AND status = 'draft')
WITH CHECK (customer_id = auth.uid() AND status IN ('draft', 'cancelled'));

-- Allow admin to delete draft or cancelled invoices only
CREATE POLICY "Allow admin to delete draft or cancelled invoices"
ON invoices FOR DELETE
TO authenticated
USING (is_admin() AND status IN ('draft', 'cancelled'));

-- ----------------------------------------------------------------------------
-- Invoice Lines Policies
-- ----------------------------------------------------------------------------

-- Allow callers to view lines of accessible invoices
CREATE POLICY "Allow callers to view lines of accessible invoices"
ON invoice_lines FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.id = invoice_lines.invoice_id
    )
);

-- Allow staff and admin to manage invoice lines
CREATE POLICY "Allow staff and admin to manage invoice lines"
ON invoice_lines FOR ALL
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow customers to insert lines on their own draft invoices
CREATE POLICY "Allow customers to insert lines on own draft invoices"
ON invoice_lines FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.id = invoice_lines.invoice_id 
          AND i.customer_id = auth.uid()
          AND i.status = 'draft'
    )
);

-- ============================================================================
-- 5. Role Grants & Permissions
-- ============================================================================

GRANT ALL ON invoices TO service_role;
GRANT ALL ON invoice_lines TO service_role;
GRANT USAGE, SELECT ON SEQUENCE invoice_number_seq TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_lines TO authenticated;
