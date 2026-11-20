-- ==============================================================================
-- MASTER SUPABASE SCHEMA MIGRATION FOR SFT GAZ (rest-main)
-- Project ID: wobaeeyxtkewpbwgwcph
-- Generated for full migration: All 50 tables, functions, RLS & seed data
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. APP_STATE (Key-Value Store)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_state_key_user ON public.app_state(key, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_state_all" ON public.app_state;
CREATE POLICY "app_state_all" ON public.app_state FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. BOTTLE_TYPES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bottle_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    capacity TEXT,
    code TEXT,
    color TEXT,
    unit_price NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    purchaseprice NUMERIC DEFAULT 0,
    total_quantity NUMERIC DEFAULT 0,
    totalquantity NUMERIC DEFAULT 0,
    distributed_quantity NUMERIC DEFAULT 0,
    distributedquantity NUMERIC DEFAULT 0,
    remaining_quantity NUMERIC DEFAULT 0,
    remainingquantity NUMERIC DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bottle_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bottle_types_all" ON public.bottle_types;
CREATE POLICY "bottle_types_all" ON public.bottle_types FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. EMPTY_BOTTLES_STOCK
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empty_bottles_stock (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    bottletypeid TEXT,
    bottletypename TEXT,
    quantity NUMERIC DEFAULT 0,
    lastupdated TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.empty_bottles_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empty_bottles_stock_all" ON public.empty_bottles_stock;
CREATE POLICY "empty_bottles_stock_all" ON public.empty_bottles_stock FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. DEFECTIVE_STOCK
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.defective_stock (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    bottletypeid TEXT,
    bottletypename TEXT,
    quantity NUMERIC DEFAULT 0,
    date TEXT,
    returnorderid TEXT,
    lastupdated TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.defective_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "defective_stock_all" ON public.defective_stock;
CREATE POLICY "defective_stock_all" ON public.defective_stock FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. STOCK_HISTORY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT,
    bottletypeid TEXT,
    bottletypename TEXT,
    bottle_type_id TEXT,
    bottle_type_name TEXT,
    stocktype TEXT,
    changetype TEXT,
    change_type TEXT,
    quantity NUMERIC DEFAULT 0,
    previousquantity NUMERIC DEFAULT 0,
    previous_quantity NUMERIC DEFAULT 0,
    newquantity NUMERIC DEFAULT 0,
    next_quantity NUMERIC DEFAULT 0,
    note TEXT,
    userid TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_history_all" ON public.stock_history;
CREATE POLICY "stock_history_all" ON public.stock_history FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. DIF_PRICING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dif_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT,
    designation TEXT,
    qte_dif NUMERIC(10,2) DEFAULT 0,
    prix_dif NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.dif_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dif_pricing_all" ON public.dif_pricing;
CREATE POLICY "dif_pricing_all" ON public.dif_pricing FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. RESERVOIRS_PRICING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservoirs_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT,
    designation TEXT,
    prix NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.reservoirs_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservoirs_pricing_all" ON public.reservoirs_pricing;
CREATE POLICY "reservoirs_pricing_all" ON public.reservoirs_pricing FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. DRIVER_SECTOR_ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_sector_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id TEXT NOT NULL,
    sector_id TEXT NOT NULL,
    sector_code TEXT,
    sector_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.driver_sector_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_sector_assignments_all" ON public.driver_sector_assignments;
CREATE POLICY "driver_sector_assignments_all" ON public.driver_sector_assignments FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. DRIVER_COMMISSION_SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_commission_settings (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID,
    driver_id TEXT NOT NULL,
    bottle_type_id TEXT,
    commission_per_bottle NUMERIC DEFAULT 0,
    sa_j NUMERIC DEFAULT 0,
    sa_v NUMERIC DEFAULT 0,
    comm NUMERIC DEFAULT 0,
    salaire NUMERIC DEFAULT 0,
    primes NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT driver_commission_settings_user_driver_key UNIQUE (user_id, driver_id)
);
ALTER TABLE public.driver_commission_settings
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS sa_j NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sa_v NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS salaire NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS primes NUMERIC DEFAULT 0;
ALTER TABLE public.driver_commission_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_commission_settings_all" ON public.driver_commission_settings;
CREATE POLICY "driver_commission_settings_all" ON public.driver_commission_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 10. SECTORS_SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sectors_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    secteurs TEXT,
    ville TEXT,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sectors_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sectors_settings_all" ON public.sectors_settings;
CREATE POLICY "sectors_settings_all" ON public.sectors_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 11. PRICING_SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    designation TEXT,
    prix_unitaire NUMERIC DEFAULT 0,
    prix_achat NUMERIC DEFAULT 0,
    zone INTEGER DEFAULT 0,
    pricing_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prix_achat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS zone INTEGER DEFAULT 0;
ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pricing_settings_all" ON public.pricing_settings;
CREATE POLICY "pricing_settings_all" ON public.pricing_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 12. WORK_METHODS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.work_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "work_methods_all" ON public.work_methods;
CREATE POLICY "work_methods_all" ON public.work_methods FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 13. GPS_SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gps_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    api_url TEXT NOT NULL,
    email TEXT NOT NULL,
    password TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.gps_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gps_settings_all" ON public.gps_settings;
CREATE POLICY "gps_settings_all" ON public.gps_settings FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 14. CLIENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT,
    localite TEXT,
    region TEXT,
    categorie TEXT,
    repr TEXT,
    date_deb TEXT,
    date_fin TEXT,
    datedeb TEXT,
    datefin TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_all" ON public.clients;
CREATE POLICY "clients_all" ON public.clients FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 15. DRIVERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drivers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT,
    aide_livreurs TEXT,
    aidelivreurs TEXT,
    code_al TEXT,
    codeal TEXT,
    adresse TEXT,
    ville TEXT,
    telephone TEXT,
    n_cin TEXT,
    ncin TEXT,
    vehicule TEXT,
    n_permis TEXT,
    npermis TEXT,
    debt NUMERIC DEFAULT 0,
    advances NUMERIC DEFAULT 0,
    avance NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    debt_threshold NUMERIC DEFAULT 0,
    foreign_bottles_threshold NUMERIC DEFAULT 0,
    total_foreign_bottles NUMERIC DEFAULT 0,
    is_closed_due_debt BOOLEAN DEFAULT FALSE,
    is_closed_due_foreign BOOLEAN DEFAULT FALSE,
    is_unavailable BOOLEAN DEFAULT FALSE,
    remaining_bottles JSONB DEFAULT '{}'::jsonb,
    transactions JSONB DEFAULT '[]'::jsonb,
    last_rc_update TEXT,
    rc_history JSONB DEFAULT '[]'::jsonb,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drivers_all" ON public.drivers;
CREATE POLICY "drivers_all" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 16. TRUCKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trucks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    matricule TEXT NOT NULL,
    driver_id TEXT,
    driverid TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    current_load JSONB DEFAULT '[]'::jsonb,
    next_return_date TEXT,
    repos_reason TEXT,
    tech_status TEXT DEFAULT 'operational',
    truck_type TEXT DEFAULT 'camion',
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trucks_all" ON public.trucks;
CREATE POLICY "trucks_all" ON public.trucks FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 17. SUPPLIERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    bank_account_name TEXT,
    bankaccountname TEXT,
    debts JSONB DEFAULT '[]'::jsonb,
    transaction_count INTEGER DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_all" ON public.suppliers;
CREATE POLICY "suppliers_all" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 18. BRANDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brands_all" ON public.brands;
CREATE POLICY "brands_all" ON public.brands FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 19. SUPPLY_ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number TEXT NOT NULL,
    ordernumber TEXT,
    reference TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    driver_id TEXT,
    driverid TEXT,
    driver_name TEXT,
    drivername TEXT,
    client_id TEXT,
    clientid TEXT,
    client_name TEXT,
    clientname TEXT,
    truck_id TEXT,
    truckid TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_rate NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_orders_all" ON public.supply_orders;
CREATE POLICY "supply_orders_all" ON public.supply_orders FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 20. RETURN_ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number TEXT NOT NULL,
    ordernumber TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supply_order_id TEXT,
    supplyorderid TEXT,
    supply_order_number TEXT,
    supplyordernumber TEXT,
    driver_id TEXT,
    driverid TEXT,
    driver_name TEXT,
    drivername TEXT,
    client_id TEXT,
    clientid TEXT,
    client_name TEXT,
    clientname TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    expenses JSONB DEFAULT '[]'::jsonb,
    payment_cash NUMERIC NOT NULL DEFAULT 0,
    payment_cheque NUMERIC NOT NULL DEFAULT 0,
    payment_mygaz NUMERIC NOT NULL DEFAULT 0,
    payment_total NUMERIC NOT NULL DEFAULT 0,
    payment_debt NUMERIC NOT NULL DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.return_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_orders_all" ON public.return_orders;
CREATE POLICY "return_orders_all" ON public.return_orders FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 21. FACTORY_OPERATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.factory_operations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier_id TEXT NOT NULL,
    supplierid TEXT,
    supplier_name TEXT NOT NULL,
    suppliername TEXT,
    truck_id TEXT NOT NULL,
    truckid TEXT,
    truck_matricule TEXT NOT NULL,
    truckmatricule TEXT,
    driver_id TEXT NOT NULL,
    driverid TEXT,
    driver_name TEXT NOT NULL,
    drivername TEXT,
    bottles JSONB NOT NULL DEFAULT '[]'::jsonb,
    invoice_id TEXT,
    invoiceid TEXT,
    bl_reference TEXT,
    blreference TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.factory_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "factory_operations_all" ON public.factory_operations;
CREATE POLICY "factory_operations_all" ON public.factory_operations FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 22. FACTORY_INVOICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.factory_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    supplier_id TEXT,
    supplierid TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bl_references JSONB NOT NULL DEFAULT '[]'::jsonb,
    blreferences JSONB DEFAULT '[]'::jsonb,
    total_sent NUMERIC NOT NULL DEFAULT 0,
    totalsent NUMERIC DEFAULT 0,
    total_received NUMERIC NOT NULL DEFAULT 0,
    totalreceived NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    totalamount NUMERIC DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    paymentmethod TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.factory_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "factory_invoices_all" ON public.factory_invoices;
CREATE POLICY "factory_invoices_all" ON public.factory_invoices FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 23. DEBT_SETTLEMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_settlements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supplier_id TEXT,
    supplier_name TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,
    invoice_id TEXT,
    note TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.debt_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debt_settlements_all" ON public.debt_settlements;
CREATE POLICY "debt_settlements_all" ON public.debt_settlements FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 24. EXPENSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    date TEXT NOT NULL,
    note TEXT,
    supplier_id TEXT,
    supplierid TEXT,
    supplier_bank_name TEXT,
    supplierbankname TEXT,
    account_details TEXT,
    accountdetails TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 25. REPAIRS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.repairs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    truck_id TEXT,
    truckid TEXT,
    type TEXT,
    total_cost NUMERIC DEFAULT 0,
    totalcost NUMERIC DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    paidamount NUMERIC DEFAULT 0,
    debt_amount NUMERIC DEFAULT 0,
    debtamount NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    remarks TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "repairs_all" ON public.repairs;
CREATE POLICY "repairs_all" ON public.repairs FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 26. CASH_OPERATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_operations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    name TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT,
    account_affected TEXT,
    accountaffected TEXT,
    account_details TEXT,
    accountdetails TEXT,
    status TEXT DEFAULT 'pending',
    validated_at TEXT,
    validatedat TEXT,
    validated_by TEXT,
    validatedby TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cash_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_operations_all" ON public.cash_operations;
CREATE POLICY "cash_operations_all" ON public.cash_operations FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 27. BANK_TRANSFERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    type TEXT,
    source_account TEXT,
    sourceaccount TEXT,
    destination_account TEXT,
    destinationaccount TEXT,
    account_details TEXT,
    accountdetails TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    status TEXT DEFAULT 'pending',
    validated_at TEXT,
    validatedat TEXT,
    validated_by TEXT,
    validatedby TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_transfers_all" ON public.bank_transfers;
CREATE POLICY "bank_transfers_all" ON public.bank_transfers FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 28. FINANCIAL_TRANSACTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    type TEXT,
    description TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    source_account TEXT,
    sourceaccount TEXT,
    destination_account TEXT,
    destinationaccount TEXT,
    account_details TEXT,
    accountdetails TEXT,
    status TEXT DEFAULT 'pending',
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_transactions_all" ON public.financial_transactions;
CREATE POLICY "financial_transactions_all" ON public.financial_transactions FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 29. REVENUES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenues (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    total_cheque NUMERIC DEFAULT 0,
    total_bank NUMERIC DEFAULT 0,
    total_cash NUMERIC DEFAULT 0,
    total_debt NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    description TEXT,
    payment_method TEXT,
    cash_amount NUMERIC DEFAULT 0,
    check_amount NUMERIC DEFAULT 0,
    mygaz_amount NUMERIC DEFAULT 0,
    related_order_id TEXT,
    related_order_type TEXT,
    driver_name TEXT,
    source TEXT,
    amount NUMERIC DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "revenues_all" ON public.revenues;
CREATE POLICY "revenues_all" ON public.revenues FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 30. EXCHANGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchanges (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    company_name TEXT NOT NULL,
    companyname TEXT,
    client_name TEXT,
    clientname TEXT,
    bottle_type TEXT,
    bottletype TEXT,
    quantity_given NUMERIC DEFAULT 0,
    quantitygiven NUMERIC DEFAULT 0,
    quantity_received NUMERIC DEFAULT 0,
    quantityreceived NUMERIC DEFAULT 0,
    price_difference NUMERIC DEFAULT 0,
    pricedifference NUMERIC DEFAULT 0,
    date TEXT NOT NULL,
    is_paid_by_us BOOLEAN DEFAULT FALSE,
    ispaidbyus BOOLEAN DEFAULT FALSE,
    paid_by TEXT,
    paidby TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exchanges_all" ON public.exchanges;
CREATE POLICY "exchanges_all" ON public.exchanges FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 31. FOREIGN_BOTTLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.foreign_bottles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    return_order_id TEXT,
    returnorderid TEXT,
    company_name TEXT NOT NULL,
    companyname TEXT,
    bottle_type TEXT,
    bottletype TEXT,
    quantity NUMERIC DEFAULT 0,
    type TEXT DEFAULT 'normal',
    date TEXT NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.foreign_bottles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "foreign_bottles_all" ON public.foreign_bottles;
CREATE POLICY "foreign_bottles_all" ON public.foreign_bottles FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 32. TRUCK_ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.truck_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    truck_id TEXT NOT NULL,
    truckid TEXT,
    driver_id TEXT NOT NULL,
    driverid TEXT,
    assigned_at TEXT NOT NULL,
    assignedat TEXT,
    unassigned_at TEXT,
    unassignedat TEXT,
    assigned_by TEXT,
    assignedby TEXT,
    reason TEXT,
    end_date TEXT,
    enddate TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.truck_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "truck_assignments_all" ON public.truck_assignments;
CREATE POLICY "truck_assignments_all" ON public.truck_assignments FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 33. FUEL_PURCHASES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    quantity_liters NUMERIC DEFAULT 0,
    quantityliters NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fuel_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_purchases_all" ON public.fuel_purchases;
CREATE POLICY "fuel_purchases_all" ON public.fuel_purchases FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 34. FUEL_CONSUMPTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_consumptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    liters NUMERIC DEFAULT 0,
    driver TEXT,
    truck TEXT,
    mileage_km NUMERIC DEFAULT 0,
    mileagekm NUMERIC DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fuel_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_consumptions_all" ON public.fuel_consumptions;
CREATE POLICY "fuel_consumptions_all" ON public.fuel_consumptions FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 35. FUEL_DRAINS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fuel_drains (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    quantity_liters NUMERIC DEFAULT 0,
    quantityliters NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.fuel_drains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_drains_all" ON public.fuel_drains;
CREATE POLICY "fuel_drains_all" ON public.fuel_drains FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 36. OIL_PURCHASES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oil_purchases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    quantity_liters NUMERIC DEFAULT 0,
    quantityliters NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.oil_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_purchases_all" ON public.oil_purchases;
CREATE POLICY "oil_purchases_all" ON public.oil_purchases FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 37. OIL_CONSUMPTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oil_consumptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    liters NUMERIC DEFAULT 0,
    driver TEXT,
    truck TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.oil_consumptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_consumptions_all" ON public.oil_consumptions;
CREATE POLICY "oil_consumptions_all" ON public.oil_consumptions FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 38. OIL_DRAINS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oil_drains (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    quantity_liters NUMERIC DEFAULT 0,
    quantityliters NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    payment_method TEXT,
    paymentmethod TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.oil_drains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oil_drains_all" ON public.oil_drains;
CREATE POLICY "oil_drains_all" ON public.oil_drains FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 39. ROLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_all" ON public.roles;
CREATE POLICY "roles_all" ON public.roles FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 40. ROLE_ASSIGNMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    role_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.role_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_assignments_all" ON public.role_assignments;
CREATE POLICY "role_assignments_all" ON public.role_assignments FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 41. EXPENSE_TYPES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.expense_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_types_all" ON public.expense_types;
CREATE POLICY "expense_types_all" ON public.expense_types FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 42. INVENTORY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    bottle_type_id TEXT,
    bottletypeid TEXT,
    quantity NUMERIC DEFAULT 0,
    last_updated TEXT,
    lastupdated TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_all" ON public.inventory;
CREATE POLICY "inventory_all" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 43. SUPPLIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supplies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    truck_id TEXT,
    truckid TEXT,
    driver_id TEXT,
    driverid TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    totalamount NUMERIC DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supplies_all" ON public.supplies;
CREATE POLICY "supplies_all" ON public.supplies FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 44. SUPPLY_RETURNS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.supply_returns (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    supply_id TEXT,
    supplyid TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.supply_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "supply_returns_all" ON public.supply_returns;
CREATE POLICY "supply_returns_all" ON public.supply_returns FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 45. TRANSACTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    truck_id TEXT,
    truckid TEXT,
    driver_id TEXT,
    driverid TEXT,
    bottle_types JSONB DEFAULT '[]'::jsonb,
    total_value NUMERIC DEFAULT 0,
    totalvalue NUMERIC DEFAULT 0,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transactions_all" ON public.transactions;
CREATE POLICY "transactions_all" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 46. ACCOUNTING_ACCOUNTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT,
    name TEXT NOT NULL,
    type TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_accounts_all" ON public.accounting_accounts;
CREATE POLICY "accounting_accounts_all" ON public.accounting_accounts FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 47. ACCOUNTING_ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT NOT NULL,
    account_id TEXT,
    description TEXT,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_entries_all" ON public.accounting_entries;
CREATE POLICY "accounting_entries_all" ON public.accounting_entries FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 48. ACCOUNTING_EXERCICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_exercices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounting_exercices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_exercices_all" ON public.accounting_exercices;
CREATE POLICY "accounting_exercices_all" ON public.accounting_exercices FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 49. ACCOUNTING_EXPENSE_CODES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_expense_codes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    category TEXT,
    workflow_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounting_expense_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_expense_codes_all" ON public.accounting_expense_codes;
CREATE POLICY "accounting_expense_codes_all" ON public.accounting_expense_codes FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 50. ACCOUNTING_GAZ_CLASSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_gaz_classes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounting_gaz_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_gaz_classes_all" ON public.accounting_gaz_classes;
CREATE POLICY "accounting_gaz_classes_all" ON public.accounting_gaz_classes FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- SEED DATA: DIF_PRICING
-- ------------------------------------------------------------------------------
INSERT INTO public.dif_pricing (code, designation, qte_dif, prix_dif) VALUES
('6003', 'TISSIR GAZ CHARGES 3 KG', 0, 0.50),
('6006', 'TISSIR GAZ CHANGES 6 KGS', 0, 0.50),
('6012', 'TISSIR GAZ CHARGES 12 KGS', 40, 1.50),
('6022', 'BNG TISSIR RECHARGE 12KG', 0, 1.00),
('6026', 'TISSIR GAZ CHARGE 6 KG ROBINE', 0, 0.50),
('6035', 'TISSIR GAZ CHARGES PROPANE 3!', 0, 0.00),
('6103', 'AFRIQUIA GAZ CHARGES 3 KG', 0, 0.50),
('6106', 'AFRIQUIA GAZ CHARGES 6 KGS', 0, 0.50),
('6112', 'AFRIQUIA GAZ CHARGES 12 KGS', 0, 1.50),
('6122', 'RECHARGE BNG AFRIQUIA 12KG', 0, 1.00),
('6126', 'AFRIQUIA GAZ CHARGE 6 KG ROBI', 40, 20.00),
('6135', 'AFRIQUIA GAZ CHARGE PROPANE', 0, 0.00),
('6203', 'CMH GAZ CHARGES 3 KGS', 0, 0.00),
('6206', 'CMHGAZ CHARGES 6 KGS', 0, 0.00)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA: RESERVOIRS_PRICING
-- ------------------------------------------------------------------------------
INSERT INTO public.reservoirs_pricing (code, designation, prix) VALUES
('9003', 'TISSIR GAZ RESERVOIRS 03 KGS', 30.00),
('9012', 'TISSIR GAZ RESERVOIRS 12KGS', 80.00),
('9035', 'TISSIR GAZ RESERVOIRS 35 KGS', 500.00),
('9103', 'AFRIQUIA GAZ RESERVOIRS 3 KGS', 30.00),
('9112', 'AFRIQUIA GAZ RESERVOIRS 12KGS', 80.00),
('9203', 'CMH GAZ RESERVOIRS 3 KGS', 30.00),
('9212', 'CMH GAZ RESERVOIRS 12 KGS', 70.00),
('9135', 'AFRIQUIA GAZ RESERVOIRS 35 KGS', 500.00),
('9303', 'DRAGON GAZ RESERVOIRS 3 KGS', 30.00),
('9306', 'DRAGON GAZ RESERVOIRS 6 KGG', 35.35),
('9312', 'DRAGON GAZ RESERVOIRS 12 KGS', 70.00),
('9403', 'ZIZ GAZ RESERVOIRS 3 KGS', 30.00),
('9406', 'ZIZ GAZ RESERVOIRS 6 KGS', 36.00),
('9412', 'RESERVOIRS ZIZ GAZ 12 KGS', 56.25),
('9503', 'TOTAL GAZ 3 KGS RESERVOIRS', 30.00),
('9512', 'TOTAL GAZ 12 KGS RESERVOIRS', 45.45),
('9603', 'BUTA GAZ 3 KGS RESERVOIRS', 30.00),
('9612', 'BUTA GAZ 12 KGS RESERVOIRS', 75.00),
('9703', 'DIMA GAZ 3 KG SRESERVOIRS', 30.00),
('9706', 'DIMA 6 KGS RESERVOIRS', 42.00),
('9106', 'AFRIQUIA GAZ RESERVOIRS 6 KGS', 40.00),
('9712', 'DIMA GAZ 12 KGS RESERVOIRS', 44.00),
('9803', 'PETROM GAZ 3 KGS RESERVOIRS', 25.25),
('9812', 'PETROM GAZ 12 KGS RESERVOIRS', 40.40),
('9903', 'SAADA GAZ 3 KGS RESERVOIRS', 30.00),
('9912', 'SAADA GAZ 12 KGS RESERVOIRS', 45.45),
('9206', 'CMH GAZ RESERVOIRS 6 KGS', 40.00)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- SEED DATA: ROLES
-- ------------------------------------------------------------------------------
INSERT INTO public.roles (id, name, permissions) VALUES
('admin', 'Admin', '["*"]'::jsonb),
('manager', 'Gestionnaire', '["dashboard","inventory","trucks","drivers","supply-return","defective-stock","exchanges","transfer","factory","fuel-management","repairs","expenses","depenses-copt","revenue","reports","live-map"]'::jsonb),
('chauffeur', 'Chauffeur', '["dashboard","live-map"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- ------------------------------------------------------------------------------
-- SEED DATA: EXPENSE_TYPES
-- ------------------------------------------------------------------------------
INSERT INTO public.expense_types (name) VALUES
('bureau'), ('salaire'), ('cnss'), ('loyer'), ('charger dépôt'), ('équipement'), ('électricité'), ('transport'), ('autre')
ON CONFLICT (name) DO NOTHING;
