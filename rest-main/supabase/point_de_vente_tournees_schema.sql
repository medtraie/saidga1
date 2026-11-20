-- ==============================================================================
-- POINT DE VENTE & TOURNÉES DE DISTRIBUTION FOR SFT GAZ
-- Project ID: wobaeeyxtkewpbwgwcph
-- Features: Tournées, Points de Vente, Circuits, Android Driver Accounts
-- ==============================================================================

-- 1. DRIVER POS ACCOUNTS (Comptes Chauffeurs pour application Android)
CREATE TABLE IF NOT EXISTS public.driver_pos_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id TEXT NOT NULL,
    driver_name TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    device_info TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_pos_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_pos_accounts_all" ON public.driver_pos_accounts;
CREATE POLICY "driver_pos_accounts_all" ON public.driver_pos_accounts FOR ALL USING (true) WITH CHECK (true);

-- 2. TOURNÉES (Bons de Sortie -> Tournées de Distribution)
CREATE TABLE IF NOT EXISTS public.tournees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournee_number TEXT UNIQUE NOT NULL,
    driver_id TEXT,
    driver_name TEXT,
    truck_id TEXT,
    supply_order_id TEXT,
    supply_order_number TEXT,
    status TEXT DEFAULT 'en_cours', -- 'en_cours', 'cloturee', 'validee_retour'
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    initial_load JSONB DEFAULT '[]'::jsonb,
    remaining_load JSONB DEFAULT '[]'::jsonb,
    total_delivered_full INTEGER DEFAULT 0,
    total_collected_empty INTEGER DEFAULT 0,
    total_sales_amount NUMERIC DEFAULT 0,
    total_cash_collected NUMERIC DEFAULT 0,
    total_credit_debt NUMERIC DEFAULT 0,
    notes TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tournees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournees_all" ON public.tournees;
CREATE POLICY "tournees_all" ON public.tournees FOR ALL USING (true) WITH CHECK (true);

-- 3. TOURNÉE STOPS (Arrêts & Ventes aux Points de Vente)
CREATE TABLE IF NOT EXISTS public.tournee_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournee_id UUID REFERENCES public.tournees(id) ON DELETE CASCADE,
    client_id TEXT,
    client_name TEXT,
    pos_name TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    status TEXT DEFAULT 'en_attente', -- 'en_attente', 'livre', 'annule'
    sequence_order INTEGER DEFAULT 1,
    delivered_items JSONB DEFAULT '[]'::jsonb,
    collected_empty JSONB DEFAULT '[]'::jsonb,
    payment_method TEXT DEFAULT 'cash', -- 'cash', 'credit', 'cheque'
    amount_paid NUMERIC DEFAULT 0,
    amount_debt NUMERIC DEFAULT 0,
    delivery_time TIMESTAMPTZ,
    notes TEXT,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tournee_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournee_stops_all" ON public.tournee_stops;
CREATE POLICY "tournee_stops_all" ON public.tournee_stops FOR ALL USING (true) WITH CHECK (true);

-- 4. ADD CLIENT POS COORDINATES & CIRCUITS TO CLIENTS TABLE
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS pos_name TEXT,
ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS circuit_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
