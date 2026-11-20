-- ==============================================================================
-- SFT GAZ - Comprehensive Database Schema, Relations & RLS Fix
-- Target Project: wobaeeyxtkewpbwgwcph
-- ==============================================================================

-- 1. DRIVER_COMMISSION_SETTINGS
ALTER TABLE public.driver_commission_settings 
    ALTER COLUMN bottle_type_id DROP NOT NULL;

ALTER TABLE public.driver_commission_settings 
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS sa_j NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sa_v NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comm NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS salaire NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS primes NUMERIC DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'driver_commission_settings_user_driver_key'
    ) THEN
        ALTER TABLE public.driver_commission_settings 
            ADD CONSTRAINT driver_commission_settings_user_driver_key UNIQUE (user_id, driver_id);
    END IF;
END $$;

ALTER TABLE public.driver_commission_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_commission_settings_all" ON public.driver_commission_settings;
CREATE POLICY "driver_commission_settings_all" ON public.driver_commission_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. PRICING_SETTINGS
ALTER TABLE public.pricing_settings 
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS designation TEXT,
    ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prix_achat NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS zone TEXT;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_settings_all" ON public.pricing_settings;
CREATE POLICY "pricing_settings_all" ON public.pricing_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. SUPPLY_ORDERS (Add aliases to prevent any PGRST204 errors)
ALTER TABLE public.supply_orders 
    ADD COLUMN IF NOT EXISTS taxrate NUMERIC,
    ADD COLUMN IF NOT EXISTS taxamount NUMERIC,
    ADD COLUMN IF NOT EXISTS ordernumber TEXT,
    ADD COLUMN IF NOT EXISTS driverid TEXT,
    ADD COLUMN IF NOT EXISTS drivername TEXT,
    ADD COLUMN IF NOT EXISTS clientid TEXT,
    ADD COLUMN IF NOT EXISTS clientname TEXT,
    ADD COLUMN IF NOT EXISTS truckid TEXT;

ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_orders_all" ON public.supply_orders;
CREATE POLICY "supply_orders_all" ON public.supply_orders FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. RETURN_ORDERS (Add aliases to prevent any PGRST204 errors)
ALTER TABLE public.return_orders 
    ADD COLUMN IF NOT EXISTS ordernumber TEXT,
    ADD COLUMN IF NOT EXISTS supplyorderid TEXT,
    ADD COLUMN IF NOT EXISTS supplyordernumber TEXT,
    ADD COLUMN IF NOT EXISTS driverid TEXT,
    ADD COLUMN IF NOT EXISTS drivername TEXT,
    ADD COLUMN IF NOT EXISTS clientid TEXT,
    ADD COLUMN IF NOT EXISTS clientname TEXT,
    ADD COLUMN IF NOT EXISTS paymentcash NUMERIC,
    ADD COLUMN IF NOT EXISTS paymentcheque NUMERIC,
    ADD COLUMN IF NOT EXISTS paymentmygaz NUMERIC,
    ADD COLUMN IF NOT EXISTS paymenttotal NUMERIC,
    ADD COLUMN IF NOT EXISTS paymentdebt NUMERIC;

ALTER TABLE public.return_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_orders_all" ON public.return_orders;
CREATE POLICY "return_orders_all" ON public.return_orders FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. DRIVERS (Add missing fields & aliases)
ALTER TABLE public.drivers 
    ADD COLUMN IF NOT EXISTS last_rc_update TEXT,
    ADD COLUMN IF NOT EXISTS lastrcupdate TEXT,
    ADD COLUMN IF NOT EXISTS rc_history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS aidelivreurs TEXT,
    ADD COLUMN IF NOT EXISTS codeal TEXT,
    ADD COLUMN IF NOT EXISTS ncin TEXT,
    ADD COLUMN IF NOT EXISTS npermis TEXT;

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drivers_all" ON public.drivers;
CREATE POLICY "drivers_all" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. CLIENTS, TRUCKS, SUPPLIERS, WORK_METHODS
ALTER TABLE public.clients 
    ADD COLUMN IF NOT EXISTS datedeb TEXT,
    ADD COLUMN IF NOT EXISTS datefin TEXT;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_all" ON public.clients;
CREATE POLICY "clients_all" ON public.clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trucks_all" ON public.trucks;
CREATE POLICY "trucks_all" ON public.trucks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_all" ON public.suppliers;
CREATE POLICY "suppliers_all" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.work_methods
    ADD COLUMN IF NOT EXISTS driver_id TEXT,
    ADD COLUMN IF NOT EXISTS aide_livreur TEXT,
    ADD COLUMN IF NOT EXISTS sector_id TEXT,
    ADD COLUMN IF NOT EXISTS product_ids JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.work_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_methods_all" ON public.work_methods;
CREATE POLICY "work_methods_all" ON public.work_methods FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. EMPTY_BOTTLES_STOCK & DEFECTIVE_STOCK (Add snake_case alias column)
ALTER TABLE public.empty_bottles_stock 
    ADD COLUMN IF NOT EXISTS bottle_type_id TEXT;
UPDATE public.empty_bottles_stock SET bottle_type_id = bottletypeid WHERE bottle_type_id IS NULL;

ALTER TABLE public.defective_stock 
    ADD COLUMN IF NOT EXISTS bottle_type_id TEXT;
UPDATE public.defective_stock SET bottle_type_id = bottletypeid WHERE bottle_type_id IS NULL;

-- ------------------------------------------------------------------------------
-- 8. RELATIONS (FOREIGN KEYS with ON DELETE SET NULL / CASCADE)
DO $$
BEGIN
    -- supply_orders -> drivers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_orders_driver') THEN
        ALTER TABLE public.supply_orders 
            ADD CONSTRAINT fk_supply_orders_driver 
            FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;

    -- supply_orders -> clients
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_orders_client') THEN
        ALTER TABLE public.supply_orders 
            ADD CONSTRAINT fk_supply_orders_client 
            FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;

    -- supply_orders -> trucks
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_supply_orders_truck') THEN
        ALTER TABLE public.supply_orders 
            ADD CONSTRAINT fk_supply_orders_truck 
            FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE SET NULL;
    END IF;

    -- return_orders -> supply_orders
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_return_orders_supply_order') THEN
        ALTER TABLE public.return_orders 
            ADD CONSTRAINT fk_return_orders_supply_order 
            FOREIGN KEY (supply_order_id) REFERENCES public.supply_orders(id) ON DELETE SET NULL;
    END IF;

    -- return_orders -> drivers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_return_orders_driver') THEN
        ALTER TABLE public.return_orders 
            ADD CONSTRAINT fk_return_orders_driver 
            FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;
    END IF;

    -- return_orders -> clients
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_return_orders_client') THEN
        ALTER TABLE public.return_orders 
            ADD CONSTRAINT fk_return_orders_client 
            FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
    END IF;

    -- driver_sector_assignments -> drivers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dsa_driver') THEN
        ALTER TABLE public.driver_sector_assignments 
            ADD CONSTRAINT fk_dsa_driver 
            FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;
    END IF;

    -- truck_assignments -> drivers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ta_driver') THEN
        ALTER TABLE public.truck_assignments 
            ADD CONSTRAINT fk_ta_driver 
            FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;
    END IF;

    -- truck_assignments -> trucks
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ta_truck') THEN
        ALTER TABLE public.truck_assignments 
            ADD CONSTRAINT fk_ta_truck 
            FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE CASCADE;
    END IF;

    -- factory_invoices -> suppliers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_factory_invoices_supplier') THEN
        ALTER TABLE public.factory_invoices 
            ADD CONSTRAINT fk_factory_invoices_supplier 
            FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;

    -- defective_stock -> bottle_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_defective_stock_bottle_type') THEN
        ALTER TABLE public.defective_stock 
            ADD CONSTRAINT fk_defective_stock_bottle_type 
            FOREIGN KEY (bottletypeid) REFERENCES public.bottle_types(id) ON DELETE SET NULL;
    END IF;

    -- empty_bottles_stock -> bottle_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_empty_bottles_bottle_type') THEN
        ALTER TABLE public.empty_bottles_stock 
            ADD CONSTRAINT fk_empty_bottles_bottle_type 
            FOREIGN KEY (bottletypeid) REFERENCES public.bottle_types(id) ON DELETE SET NULL;
    END IF;

    -- stock_history -> bottle_types
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_history_bottle_type') THEN
        ALTER TABLE public.stock_history 
            ADD CONSTRAINT fk_stock_history_bottle_type 
            FOREIGN KEY (bottle_type_id) REFERENCES public.bottle_types(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_supply_orders_driver_id ON public.supply_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_client_id ON public.supply_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_user_id ON public.supply_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_supply_orders_date ON public.supply_orders(date);

CREATE INDEX IF NOT EXISTS idx_return_orders_supply_order_id ON public.return_orders(supply_order_id);
CREATE INDEX IF NOT EXISTS idx_return_orders_driver_id ON public.return_orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_return_orders_client_id ON public.return_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_return_orders_user_id ON public.return_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_return_orders_date ON public.return_orders(date);

CREATE INDEX IF NOT EXISTS idx_stock_history_bottle_type_id ON public.stock_history(bottle_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_date ON public.stock_history(date);

CREATE INDEX IF NOT EXISTS idx_driver_comm_driver_id ON public.driver_commission_settings(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_comm_user_id ON public.driver_commission_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON public.drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_trucks_user_id ON public.trucks(user_id);
CREATE INDEX IF NOT EXISTS idx_defective_stock_user_id ON public.defective_stock(user_id);
CREATE INDEX IF NOT EXISTS idx_empty_bottles_user_id ON public.empty_bottles_stock(user_id);

-- ------------------------------------------------------------------------------
-- 10. ENSURE PERMISSIVE RLS FOR ALL TABLES
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_all_policy', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true);', t || '_all_policy', t);
    END LOOP;
END $$;
