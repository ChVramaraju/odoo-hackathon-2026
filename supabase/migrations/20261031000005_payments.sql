-- Migration: 20261031000005_payments.sql
-- Description: Core payments schema for Brightloop (payments, overpayment protection, balance triggers)
-- Target: Supabase PostgreSQL (15+)
-- Branch: feature/jashwanth-database

-- ============================================================================
-- 1. Sequences & Auto-generation Helpers
-- ============================================================================

-- Sequence for human-readable payment numbering (e.g. PAY-202610-00001)
CREATE SEQUENCE IF NOT EXISTS payment_number_seq START WITH 1001;

CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS TEXT
SET search_path = public
AS $$
BEGIN
    RETURN 'PAY-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('payment_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ============================================================================
-- 2. Payments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(64) NOT NULL UNIQUE DEFAULT generate_payment_number() CHECK (trim(payment_number) <> ''),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('credit_card', 'debit_card', 'bank_transfer', 'upi', 'cash', 'manual')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_reference VARCHAR(100) UNIQUE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments updated_at trigger
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON payments (transaction_reference) WHERE transaction_reference IS NOT NULL;

-- ============================================================================
-- 3. Invoice Balance & Overpayment Protection Automation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_payment_to_invoice()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
    v_inv_id UUID;
    v_total_amount NUMERIC(12, 2);
    v_current_status VARCHAR(20);
    v_current_paid_at TIMESTAMPTZ;
    v_total_completed NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
    v_new_status VARCHAR(20);
    v_new_paid_at TIMESTAMPTZ;
BEGIN
    -- Determine target invoice id
    IF TG_OP = 'DELETE' THEN
        v_inv_id := OLD.invoice_id;
    ELSE
        v_inv_id := NEW.invoice_id;
    END IF;

    -- If invoice_id reassigned in UPDATE, recalculate OLD invoice first
    IF (TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id) THEN
        SELECT total_amount, status, paid_at
        INTO v_total_amount, v_current_status, v_current_paid_at
        FROM invoices
        WHERE id = OLD.invoice_id
        FOR UPDATE;

        IF FOUND THEN
            SELECT COALESCE(SUM(amount), 0.00)
            INTO v_total_completed
            FROM payments
            WHERE invoice_id = OLD.invoice_id AND status = 'completed';

            v_new_balance := GREATEST(0.00, v_total_amount - v_total_completed);
            v_new_status := CASE 
                WHEN v_new_balance = 0.00 AND v_current_status <> 'cancelled' THEN 'paid'
                WHEN v_new_balance > 0.00 AND v_current_status = 'paid' THEN 'confirmed'
                ELSE v_current_status
            END;
            v_new_paid_at := CASE
                WHEN v_new_status = 'paid' THEN COALESCE(v_current_paid_at, now())
                WHEN v_new_balance > 0.00 AND v_current_status = 'paid' THEN NULL
                ELSE v_current_paid_at
            END;

            UPDATE invoices
            SET amount_paid = v_total_completed,
                balance = v_new_balance,
                status = v_new_status,
                paid_at = v_new_paid_at,
                updated_at = now()
            WHERE id = OLD.invoice_id;
        END IF;
    END IF;

    -- Lock and recalculate primary target invoice
    SELECT total_amount, status, paid_at
    INTO v_total_amount, v_current_status, v_current_paid_at
    FROM invoices
    WHERE id = v_inv_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Calculate total completed payments
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_total_completed
    FROM payments
    WHERE invoice_id = v_inv_id AND status = 'completed';

    -- Guard against overpayment
    IF v_total_completed > v_total_amount THEN
        RAISE EXCEPTION 'Total completed payments (%) exceeds invoice total amount (%) for invoice %',
            v_total_completed, v_total_amount, v_inv_id
            USING ERRCODE = 'check_violation';
    END IF;

    v_new_balance := GREATEST(0.00, v_total_amount - v_total_completed);
    v_new_status := CASE 
        WHEN v_new_balance = 0.00 AND v_current_status <> 'cancelled' THEN 'paid'
        WHEN v_new_balance > 0.00 AND v_current_status = 'paid' THEN 'confirmed'
        ELSE v_current_status
    END;
    v_new_paid_at := CASE
        WHEN v_new_status = 'paid' THEN COALESCE(v_current_paid_at, now())
        WHEN v_new_balance > 0.00 AND v_current_status = 'paid' THEN NULL
        ELSE v_current_paid_at
    END;

    UPDATE invoices
    SET amount_paid = v_total_completed,
        balance = v_new_balance,
        status = v_new_status,
        paid_at = v_new_paid_at,
        updated_at = now()
    WHERE id = v_inv_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payments_apply_to_invoice ON payments;
CREATE TRIGGER trg_payments_apply_to_invoice
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION apply_payment_to_invoice();

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow staff and admin to view all payments
CREATE POLICY "Allow staff and admin to view all payments"
ON payments FOR SELECT
TO authenticated
USING (is_staff_or_admin());

-- Allow customers to view their own payments
CREATE POLICY "Allow customers to view their own payments"
ON payments FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Allow staff and admin to insert payments
CREATE POLICY "Allow staff and admin to insert payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

-- Allow customers to record payments against their own confirmed or overdue invoices
CREATE POLICY "Allow customers to pay own confirmed invoices"
ON payments FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM invoices i 
        WHERE i.id = payments.invoice_id 
          AND i.customer_id = auth.uid()
          AND i.status IN ('confirmed', 'overdue')
    )
);

-- Allow staff and admin to update payments (e.g. reconcile/refund)
CREATE POLICY "Allow staff and admin to update payments"
ON payments FOR UPDATE
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow admin to delete payments
CREATE POLICY "Allow admin to delete payments"
ON payments FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================================================
-- 5. Role Grants & Permissions
-- ============================================================================

GRANT ALL ON payments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE payment_number_seq TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
