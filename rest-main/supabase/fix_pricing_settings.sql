-- Fix for pricing_settings: add missing columns for zone pricing
ALTER TABLE public.pricing_settings
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prix_achat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS zone INTEGER DEFAULT 0;

ALTER TABLE public.pricing_settings 
ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
