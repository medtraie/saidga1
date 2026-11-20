const { createClient } = require('../node_modules/@supabase/supabase-js');

const supabase = createClient('https://wobaeeyxtkewpbwgwcph.supabase.co', 'sb_publishable_E4h316TMRynbZU6-b0xa8g_izDV-7pJ');

const tables = [
  'accounting_accounts',
  'accounting_entries',
  'accounting_exercices',
  'accounting_expense_codes',
  'accounting_gaz_classes',
  'app_state',
  'bank_transfers',
  'bottle_types',
  'brands',
  'cash_operations',
  'clients',
  'defective_stock',
  'dif_pricing',
  'driver_commission_settings',
  'driver_sector_assignments',
  'drivers',
  'empty_bottles_stock',
  'expenses',
  'factory_invoices',
  'factory_operations',
  'financial_transactions',
  'foreign_bottles',
  'gps_settings',
  'pricing_settings',
  'repairs',
  'reservoirs_pricing',
  'return_orders',
  'role_assignments',
  'sectors_settings',
  'suppliers',
  'supply_orders',
  'trucks',
  'work_methods'
];

async function testSelectAll() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@sftgaz.com',
    password: 'Password123!'
  });

  if (authErr) {
    console.error('Sign-in error:', authErr);
    return;
  }
  console.log('Signed in as:', auth.user.email, '(' + auth.user.id + ')');

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ ${t}: ERROR ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ ${t}: OK (${data.length} rows returned)`);
    }
  }
}

testSelectAll();
