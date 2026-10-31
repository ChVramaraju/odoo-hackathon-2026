-- Migration: 20261031000003_subscriptions.sql
-- Description: Core subscriptions schema for Brightloop (subscriptions, subscription_lines)
-- Target: Supabase PostgreSQL (15+)
-- Branch: feature/jashwanth-database

-- ============================================================================
-- 1. Sequences & Auto-generation Helpers
-- ============================================================================

-- Sequence for human-readable subscription numbering (e.g. SUB-202610-00001)
CREATE SEQUENCE IF NOT EXISTS subscription_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION generate_subscription_number()
RETURNS TEXT
SET search_path = public
AS $$
BEGIN
    RETURN 'SUB-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('subscription_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- 2. Subscriptions Header Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_number VARCHAR(64) NOT NULL UNIQUE DEFAULT generate_subscription_number() CHECK (trim(subscription_number) <> ''),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    plan_id UUID REFERENCES plans(id) ON DELETE RESTRICT,
    quotation_id UUID UNIQUE REFERENCES quotations(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'closed', 'cancelled')),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    billing_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_total >= 0),
    tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_total >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    next_billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    paused_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_subscriptions_dates CHECK (
        (end_date IS NULL OR end_date >= start_date) AND
        (paused_at IS NULL OR paused_at >= created_at) AND
        (closed_at IS NULL OR closed_at >= created_at)
    )
);

-- Subscriptions updated_at trigger
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions status timestamp automation trigger
CREATE OR REPLACE FUNCTION handle_subscription_status_transition()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'paused' AND (OLD.status IS NULL OR OLD.status <> 'paused') THEN
        IF NEW.paused_at IS NULL THEN
            NEW.paused_at = now();
        END IF;
    ELSIF NEW.status = 'active' AND OLD.status = 'paused' THEN
        NEW.paused_at = NULL;
    END IF;

    IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status <> 'closed') THEN
        IF NEW.closed_at IS NULL THEN
            NEW.closed_at = now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_status_transition ON subscriptions;
CREATE TRIGGER trg_subscriptions_status_transition
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION handle_subscription_status_transition();

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing_date ON subscriptions (next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_quotation_id ON subscriptions (quotation_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions (created_at DESC);

-- ============================================================================
-- 3. Subscription Lines Detail Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
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
    CONSTRAINT chk_subscription_line_item CHECK (
        (line_type = 'product' AND product_id IS NOT NULL AND plan_id IS NULL) OR
        (line_type = 'plan' AND plan_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
    )
);

-- Subscription line math consistency and line_type synchronization trigger
CREATE OR REPLACE FUNCTION calculate_subscription_line_amounts()
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

DROP TRIGGER IF EXISTS trg_subscription_lines_calculate ON subscription_lines;
CREATE TRIGGER trg_subscription_lines_calculate
BEFORE INSERT OR UPDATE ON subscription_lines
FOR EACH ROW EXECUTE FUNCTION calculate_subscription_line_amounts();

-- Subscription parent header totals rollup trigger
-- Correctly handles INSERT, UPDATE (including subscription_id reassignment), and DELETE
CREATE OR REPLACE FUNCTION sync_subscription_totals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If subscription_id was reassigned in an UPDATE, re-sync the OLD subscription header first
    IF (TG_OP = 'UPDATE' AND OLD.subscription_id IS DISTINCT FROM NEW.subscription_id) THEN
        UPDATE subscriptions
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM subscription_lines
            WHERE subscription_id = OLD.subscription_id
        ) lines
        WHERE id = OLD.subscription_id;
    END IF;

    -- Re-sync target subscription header (NEW for INSERT/UPDATE, OLD for DELETE)
    IF (TG_OP = 'DELETE') THEN
        UPDATE subscriptions
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM subscription_lines
            WHERE subscription_id = OLD.subscription_id
        ) lines
        WHERE id = OLD.subscription_id;
    ELSE
        UPDATE subscriptions
        SET subtotal = COALESCE(lines.agg_subtotal, 0.00),
            discount_total = COALESCE(lines.agg_discount, 0.00),
            tax_total = COALESCE(lines.agg_tax, 0.00),
            total_amount = COALESCE(lines.agg_total, 0.00),
            updated_at = now()
        FROM (
            SELECT 
                SUM(round(quantity * unit_price, 2)) AS agg_subtotal,
                SUM(discount_amount) AS agg_discount,
                SUM(tax_amount) AS agg_tax,
                SUM(line_total) AS agg_total
            FROM subscription_lines
            WHERE subscription_id = NEW.subscription_id
        ) lines
        WHERE id = NEW.subscription_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscription_lines_sync_totals ON subscription_lines;
CREATE TRIGGER trg_subscription_lines_sync_totals
AFTER INSERT OR UPDATE OR DELETE ON subscription_lines
FOR EACH ROW EXECUTE FUNCTION sync_subscription_totals();

-- Subscription lines indexes
CREATE INDEX IF NOT EXISTS idx_subscription_lines_sub_id ON subscription_lines (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_lines_product_id ON subscription_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_subscription_lines_variant_id ON subscription_lines (variant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_lines_plan_id ON subscription_lines (plan_id);

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_lines ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Subscriptions Policies
-- ----------------------------------------------------------------------------

-- Allow staff and admin to view all subscriptions
DROP POLICY IF EXISTS "Allow staff and admin to view all subscriptions" ON subscriptions;
CREATE POLICY "Allow staff and admin to view all subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (is_staff_or_admin());

-- Allow customers to view their own subscriptions
DROP POLICY IF EXISTS "Allow customers to view their own subscriptions" ON subscriptions;
CREATE POLICY "Allow customers to view their own subscriptions"
ON subscriptions FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Allow staff and admin to insert subscriptions
DROP POLICY IF EXISTS "Allow staff and admin to insert subscriptions" ON subscriptions;
CREATE POLICY "Allow staff and admin to insert subscriptions"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

-- Allow customers to create subscriptions for themselves
DROP POLICY IF EXISTS "Allow customers to create their own subscriptions" ON subscriptions;
CREATE POLICY "Allow customers to create their own subscriptions"
ON subscriptions FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = auth.uid() AND
    (created_by IS NULL OR created_by = auth.uid())
);

-- Allow staff and admin to update subscriptions
DROP POLICY IF EXISTS "Allow staff and admin to update subscriptions" ON subscriptions;
CREATE POLICY "Allow staff and admin to update subscriptions"
ON subscriptions FOR UPDATE
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow customers to update limited fields on their own subscriptions (e.g. pause/notes)
DROP POLICY IF EXISTS "Allow customers to update their own subscriptions" ON subscriptions;
CREATE POLICY "Allow customers to update their own subscriptions"
ON subscriptions FOR UPDATE
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

-- Allow admin to delete draft or cancelled subscriptions only
DROP POLICY IF EXISTS "Allow admin to delete draft or cancelled subscriptions" ON subscriptions;
CREATE POLICY "Allow admin to delete draft or cancelled subscriptions"
ON subscriptions FOR DELETE
TO authenticated
USING (is_admin() AND status IN ('draft', 'cancelled'));

-- ----------------------------------------------------------------------------
-- Subscription Lines Policies
-- ----------------------------------------------------------------------------

-- Allow callers to view lines of accessible subscriptions
DROP POLICY IF EXISTS "Allow callers to view lines of accessible subscriptions" ON subscription_lines;
CREATE POLICY "Allow callers to view lines of accessible subscriptions"
ON subscription_lines FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subscriptions s 
        WHERE s.id = subscription_lines.subscription_id
    )
);

-- Allow staff and admin to manage subscription lines
DROP POLICY IF EXISTS "Allow staff and admin to manage subscription lines" ON subscription_lines;
CREATE POLICY "Allow staff and admin to manage subscription lines"
ON subscription_lines FOR ALL
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow customers to insert lines on their own newly created subscriptions
DROP POLICY IF EXISTS "Allow customers to insert lines on own subscriptions" ON subscription_lines;
CREATE POLICY "Allow customers to insert lines on own subscriptions"
ON subscription_lines FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subscriptions s 
        WHERE s.id = subscription_lines.subscription_id 
          AND s.customer_id = auth.uid()
    )
);

-- ============================================================================
-- 5. Role Grants & Permissions
-- ============================================================================

GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON subscription_lines TO service_role;
GRANT USAGE, SELECT ON SEQUENCE subscription_number_seq TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscription_lines TO authenticated;

