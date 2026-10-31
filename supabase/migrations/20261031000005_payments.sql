-- Migration: 20261031000005_payments.sql
-- Description: Core payments schema for Brightloop (payments, atomic settlement RPC, overpayment protection, balance triggers)
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
    payment_method VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('card', 'bank_transfer', 'upi', 'net_banking', 'manual', 'cash')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'pending', 'failed', 'refunded')),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_reference VARCHAR(100),
    idempotency_key VARCHAR(100),
    notes TEXT,
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments updated_at trigger
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payments indexes & unique constraints
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments (payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref ON payments (transaction_reference) WHERE transaction_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 3. Invoice Balance & Overpayment Protection Automation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_payment_to_invoice()
RETURNS TRIGGER
SECURITY DEFINER
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

    -- If invoice_id was reassigned in UPDATE, recalculate OLD invoice first
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
            WHERE invoice_id = OLD.invoice_id AND payment_status = 'completed';

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
    WHERE invoice_id = v_inv_id AND payment_status = 'completed';

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
-- 4. Atomic Payment Settlement RPC (record_payment_atomic)
-- ============================================================================

CREATE OR REPLACE FUNCTION record_payment_atomic(p_payment JSONB)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_id UUID;
    v_payment_number TEXT;
    v_invoice_id UUID;
    v_customer_id UUID;
    v_amount NUMERIC(12, 2);
    v_currency VARCHAR(3);
    v_payment_method VARCHAR(50);
    v_payment_status VARCHAR(20);
    v_payment_date TIMESTAMPTZ;
    v_transaction_reference VARCHAR(100);
    v_idempotency_key VARCHAR(100);
    v_notes TEXT;
    v_recorded_by UUID;
    
    v_inv_total NUMERIC(12, 2);
    v_inv_paid NUMERIC(12, 2);
    v_inv_balance NUMERIC(12, 2);
    v_inv_status VARCHAR(20);
    v_inv_currency VARCHAR(3);
    v_inv_customer UUID;
    
    v_existing_payment RECORD;
    v_result JSONB;
BEGIN
    -- 1. Extract and validate parameters from JSON
    v_invoice_id := (p_payment->>'invoice_id')::UUID;
    v_amount := round((p_payment->>'amount')::NUMERIC, 2);
    v_currency := COALESCE(NULLIF(trim(p_payment->>'currency'), ''), 'INR');
    v_payment_method := COALESCE(NULLIF(trim(p_payment->>'payment_method'), ''), 'manual');
    v_payment_status := COALESCE(NULLIF(trim(p_payment->>'payment_status'), ''), 'completed');
    v_transaction_reference := NULLIF(trim(p_payment->>'transaction_reference'), '');
    v_idempotency_key := NULLIF(trim(p_payment->>'idempotency_key'), '');
    v_notes := NULLIF(trim(p_payment->>'notes'), '');
    
    IF p_payment ? 'id' AND NULLIF(trim(p_payment->>'id'), '') IS NOT NULL THEN
        v_payment_id := (p_payment->>'id')::UUID;
    ELSE
        v_payment_id := gen_random_uuid();
    END IF;

    IF p_payment ? 'payment_number' AND NULLIF(trim(p_payment->>'payment_number'), '') IS NOT NULL THEN
        v_payment_number := trim(p_payment->>'payment_number');
    ELSE
        v_payment_number := generate_payment_number();
    END IF;

    IF p_payment ? 'payment_date' AND NULLIF(trim(p_payment->>'payment_date'), '') IS NOT NULL THEN
        v_payment_date := (p_payment->>'payment_date')::TIMESTAMPTZ;
    ELSE
        v_payment_date := now();
    END IF;

    IF p_payment ? 'recorded_by' AND NULLIF(trim(p_payment->>'recorded_by'), '') IS NOT NULL THEN
        v_recorded_by := (p_payment->>'recorded_by')::UUID;
    ELSE
        v_recorded_by := auth.uid();
    END IF;

    -- Validate positive amount
    IF v_amount IS NULL OR v_amount <= 0.00 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 2. Idempotency Check
    IF v_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_payment
        FROM payments
        WHERE idempotency_key = v_idempotency_key;

        IF FOUND THEN
            -- Check for matching parameters (idempotent replay)
            IF v_existing_payment.invoice_id = v_invoice_id 
               AND v_existing_payment.amount = v_amount 
               AND upper(v_existing_payment.currency) = upper(v_currency) THEN
                RETURN jsonb_build_object(
                    'id', v_existing_payment.id,
                    'payment_number', v_existing_payment.payment_number,
                    'invoice_id', v_existing_payment.invoice_id,
                    'customer_id', v_existing_payment.customer_id,
                    'amount', v_existing_payment.amount,
                    'currency', v_existing_payment.currency,
                    'payment_method', v_existing_payment.payment_method,
                    'payment_status', v_existing_payment.payment_status,
                    'payment_date', v_existing_payment.payment_date,
                    'transaction_reference', v_existing_payment.transaction_reference,
                    'idempotency_key', v_existing_payment.idempotency_key,
                    'notes', v_existing_payment.notes,
                    'recorded_by', v_existing_payment.recorded_by,
                    'created_at', v_existing_payment.created_at,
                    'updated_at', v_existing_payment.updated_at
                );
            ELSE
                RAISE EXCEPTION 'Idempotency key has already been used with different payment parameters'
                    USING ERRCODE = 'unique_violation';
            END IF;
        END IF;
    END IF;

    -- 3. Lock parent invoice row for update (serialization & concurrency safety)
    SELECT total_amount, amount_paid, balance, status, currency, customer_id
    INTO v_inv_total, v_inv_paid, v_inv_balance, v_inv_status, v_inv_currency, v_inv_customer
    FROM invoices
    WHERE id = v_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found', v_invoice_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Validate invoice state
    IF v_inv_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot record payment against a cancelled invoice'
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_inv_status = 'paid' OR v_inv_balance <= 0.00 THEN
        RAISE EXCEPTION 'Invoice is already paid in full'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Validate currency match
    IF upper(v_currency) <> upper(v_inv_currency) THEN
        RAISE EXCEPTION 'Payment currency (%) does not match invoice currency (%)', v_currency, v_inv_currency
            USING ERRCODE = 'check_violation';
    END IF;

    -- Validate customer matches or inherits
    IF p_payment ? 'customer_id' AND NULLIF(trim(p_payment->>'customer_id'), '') IS NOT NULL THEN
        v_customer_id := (p_payment->>'customer_id')::UUID;
    ELSE
        v_customer_id := v_inv_customer;
    END IF;

    -- Validate overpayment
    IF v_amount > v_inv_balance THEN
        RAISE EXCEPTION 'Payment amount (%) exceeds outstanding invoice balance (%)', v_amount, v_inv_balance
            USING ERRCODE = 'check_violation';
    END IF;

    -- 4. Insert Payment Record (triggers trg_payments_apply_to_invoice to update invoice totals)
    INSERT INTO payments (
        id,
        payment_number,
        invoice_id,
        customer_id,
        amount,
        currency,
        payment_method,
        payment_status,
        payment_date,
        transaction_reference,
        idempotency_key,
        notes,
        recorded_by,
        created_at,
        updated_at
    ) VALUES (
        v_payment_id,
        v_payment_number,
        v_invoice_id,
        v_customer_id,
        v_amount,
        v_currency,
        v_payment_method,
        v_payment_status,
        v_payment_date,
        v_transaction_reference,
        v_idempotency_key,
        v_notes,
        v_recorded_by,
        now(),
        now()
    );

    -- 5. Construct return JSON payload
    SELECT jsonb_build_object(
        'id', p.id,
        'payment_number', p.payment_number,
        'invoice_id', p.invoice_id,
        'customer_id', p.customer_id,
        'amount', p.amount,
        'currency', p.currency,
        'payment_method', p.payment_method,
        'payment_status', p.payment_status,
        'payment_date', p.payment_date,
        'transaction_reference', p.transaction_reference,
        'idempotency_key', p.idempotency_key,
        'notes', p.notes,
        'recorded_by', p.recorded_by,
        'created_at', p.created_at,
        'updated_at', p.updated_at
    ) INTO v_result
    FROM payments p
    WHERE p.id = v_payment_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow staff and admin to view all payments
DROP POLICY IF EXISTS "Allow staff and admin to view all payments" ON payments;
CREATE POLICY "Allow staff and admin to view all payments"
ON payments FOR SELECT
TO authenticated
USING (is_staff_or_admin());

-- Allow customers to view their own payments
DROP POLICY IF EXISTS "Allow customers to view their own payments" ON payments;
CREATE POLICY "Allow customers to view their own payments"
ON payments FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Allow staff and admin to insert payments
DROP POLICY IF EXISTS "Allow staff and admin to insert payments" ON payments;
CREATE POLICY "Allow staff and admin to insert payments"
ON payments FOR INSERT
TO authenticated
WITH CHECK (is_staff_or_admin());

-- Allow customers to record payments against their own confirmed or overdue invoices
DROP POLICY IF EXISTS "Allow customers to pay own confirmed invoices" ON payments;
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
DROP POLICY IF EXISTS "Allow staff and admin to update payments" ON payments;
CREATE POLICY "Allow staff and admin to update payments"
ON payments FOR UPDATE
TO authenticated
USING (is_staff_or_admin())
WITH CHECK (is_staff_or_admin());

-- Allow admin to delete payments
DROP POLICY IF EXISTS "Allow admin to delete payments" ON payments;
CREATE POLICY "Allow admin to delete payments"
ON payments FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================================================
-- 6. Role Grants & Permissions
-- ============================================================================

GRANT ALL ON payments TO service_role;
GRANT USAGE, SELECT ON SEQUENCE payment_number_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_payment_atomic(JSONB) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO authenticated;
