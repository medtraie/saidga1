-- Fix driver_commission_settings columns for daily salary and commissions
ALTER TABLE public.driver_commission_settings
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS sa_j NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sa_v NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS comm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS salaire NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS primes NUMERIC DEFAULT 0;

-- Ensure unique constraint for upsert by (user_id, driver_id)
ALTER TABLE public.driver_commission_settings
DROP CONSTRAINT IF EXISTS driver_commission_settings_user_driver_key;

ALTER TABLE public.driver_commission_settings
ADD CONSTRAINT driver_commission_settings_user_driver_key UNIQUE (user_id, driver_id);
