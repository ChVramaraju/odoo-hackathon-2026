-- Migration: 20261031000001_catalog.sql
-- Description: Core catalog schema for Brightloop (products, product_variants, plans, plan_products)
-- Target: Supabase PostgreSQL (15+)
-- Branch: feature/jashwanth-database

-- ============================================================================
-- 1. Extensions & Shared Functions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Verify if the authenticated caller has admin privileges
-- Checks both JWT claims and public.profiles table (if initialized)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') = 'admin') THEN
        RETURN true;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        );
    END IF;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function: Verify if the authenticated caller has staff or admin privileges
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff')) THEN
        RETURN true;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'staff')
        );
    END IF;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. Core Catalog: Products Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL CHECK (trim(name) <> ''),
    product_type VARCHAR(50) NOT NULL DEFAULT 'service' CHECK (product_type IN ('service', 'consumable', 'storable')),
    sales_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (sales_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    description TEXT,
    internal_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products updated_at trigger
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products (product_type);

-- ============================================================================
-- 3. Core Catalog: Product Variants Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name VARCHAR(100) NOT NULL CHECK (trim(attribute_name) <> ''),
    attribute_value VARCHAR(100) NOT NULL CHECK (trim(attribute_value) <> ''),
    sku VARCHAR(100),
    price_adjustment NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_variant_attribute UNIQUE (product_id, attribute_name, attribute_value)
);

-- Unique SKU index (when sku is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_sku 
ON product_variants (sku) 
WHERE sku IS NOT NULL;

-- Product Variants updated_at trigger
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
CREATE TRIGGER trg_product_variants_updated_at
BEFORE UPDATE ON product_variants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product Variants indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_is_active ON product_variants (is_active);

-- ============================================================================
-- 4. Core Catalog: Plans Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL CHECK (trim(name) <> ''),
    code VARCHAR(50) UNIQUE CHECK (code IS NULL OR trim(code) <> ''),
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
    minimum_quantity INTEGER NOT NULL DEFAULT 1 CHECK (minimum_quantity >= 1),
    start_date DATE,
    end_date DATE,
    end_of_term_behavior VARCHAR(50) NOT NULL DEFAULT 'renew' CHECK (end_of_term_behavior IN ('renew', 'close', 'pause')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_plans_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Plans updated_at trigger
DROP TRIGGER IF EXISTS trg_plans_updated_at ON plans;
CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Plans indexes
CREATE INDEX IF NOT EXISTS idx_plans_status_is_active ON plans (status, is_active);
CREATE INDEX IF NOT EXISTS idx_plans_billing_interval ON plans (billing_interval);

-- ============================================================================
-- 5. Core Catalog: Plan Products Table (Bundled & Optional Items)
-- ============================================================================

CREATE TABLE IF NOT EXISTS plan_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_override NUMERIC(12, 2) CHECK (price_override IS NULL OR price_override >= 0),
    is_optional BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index when variant is specified
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_products_variant_unique 
ON plan_products (plan_id, product_id, product_variant_id) 
WHERE product_variant_id IS NOT NULL;

-- Unique index when variant is NULL (base product)
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_products_base_unique 
ON plan_products (plan_id, product_id) 
WHERE product_variant_id IS NULL;

-- Plan Products indexes
CREATE INDEX IF NOT EXISTS idx_plan_products_plan_id ON plan_products (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_products_product_id ON plan_products (product_id);

-- ============================================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_products ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Products Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow public and customers to read active products"
ON products FOR SELECT
TO anon, authenticated
USING (is_active = true);

CREATE POLICY "Allow staff and admin to read all products"
ON products FOR SELECT
TO authenticated
USING (is_staff_or_admin());

CREATE POLICY "Allow admin to insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to update products"
ON products FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to delete products"
ON products FOR DELETE
TO authenticated
USING (is_admin());

-- ----------------------------------------------------------------------------
-- Product Variants Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow public and customers to read active product variants"
ON product_variants FOR SELECT
TO anon, authenticated
USING (
    is_active = true AND 
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND p.is_active = true)
);

CREATE POLICY "Allow staff and admin to read all product variants"
ON product_variants FOR SELECT
TO authenticated
USING (is_staff_or_admin());

CREATE POLICY "Allow admin to insert product variants"
ON product_variants FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to update product variants"
ON product_variants FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to delete product variants"
ON product_variants FOR DELETE
TO authenticated
USING (is_admin());

-- ----------------------------------------------------------------------------
-- Plans Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow public and customers to read active plans"
ON plans FOR SELECT
TO anon, authenticated
USING (
    is_active = true AND status = 'active' AND
    (start_date IS NULL OR start_date <= CURRENT_DATE) AND
    (end_date IS NULL OR end_date >= CURRENT_DATE)
);

CREATE POLICY "Allow staff and admin to read all plans"
ON plans FOR SELECT
TO authenticated
USING (is_staff_or_admin());

CREATE POLICY "Allow admin to insert plans"
ON plans FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to update plans"
ON plans FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to delete plans"
ON plans FOR DELETE
TO authenticated
USING (is_admin());

-- ----------------------------------------------------------------------------
-- Plan Products Policies
-- ----------------------------------------------------------------------------

CREATE POLICY "Allow public and customers to read active plan products"
ON plan_products FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM plans pl 
        WHERE pl.id = plan_products.plan_id 
          AND pl.is_active = true 
          AND pl.status = 'active'
    )
);

CREATE POLICY "Allow staff and admin to read all plan products"
ON plan_products FOR SELECT
TO authenticated
USING (is_staff_or_admin());

CREATE POLICY "Allow admin to insert plan products"
ON plan_products FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to update plan products"
ON plan_products FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Allow admin to delete plan products"
ON plan_products FOR DELETE
TO authenticated
USING (is_admin());

-- ============================================================================
-- 7. Role Grants
-- ============================================================================

GRANT ALL ON products TO service_role;
GRANT ALL ON product_variants TO service_role;
GRANT ALL ON plans TO service_role;
GRANT ALL ON plan_products TO service_role;

GRANT SELECT ON products TO anon, authenticated;
GRANT SELECT ON product_variants TO anon, authenticated;
GRANT SELECT ON plans TO anon, authenticated;
GRANT SELECT ON plan_products TO anon, authenticated;

