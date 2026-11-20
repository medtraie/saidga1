const { createClient } = require('../node_modules/@supabase/supabase-js');

const supabase = createClient('https://wobaeeyxtkewpbwgwcph.supabase.co', 'sb_publishable_E4h316TMRynbZU6-b0xa8g_izDV-7pJ');

const queries = [
  { table: 'dif_pricing', select: 'code, prix_dif', where: null },
  { table: 'reservoirs_pricing', select: 'code, designation, prix', where: null },
  { table: 'factory_operations', select: '*', where: null },
  { table: 'sectors_settings', select: 'id, code, secteurs', where: null },
  { table: 'work_methods', select: '*', where: null },
  { table: 'app_state', select: 'value', where: null },
  { table: 'gps_settings', select: 'api_url,email,password', where: null },
  { table: 'pricing_settings', select: '*', where: null },
  { table: 'driver_sector_assignments', select: 'driver_id, sector_id', where: null },
  { table: 'driver_commission_settings', select: 'driver_id, sa_j, sa_v, comm, salaire, primes', where: null },
  { table: 'driver_sector_assignments', select: 'driver_id, sector_name, sector_code', where: null },
];

async function runTests() {
  const { data: auth } = await supabase.auth.signInWithPassword({
    email: 'admin@sftgaz.com',
    password: 'Password123!'
  });

  console.log('Testing specific selects with authenticated admin user:\n');

  for (const q of queries) {
    let query = supabase.from(q.table).select(q.select).limit(1);
    const { data, error } = await query;
    if (error) {
      console.log(`❌ Table '${q.table}' select('${q.select}'):`);
      console.log(`   ERROR ${error.code}: ${error.message}\n`);
    } else {
      console.log(`✅ Table '${q.table}' select('${q.select}'): OK`);
    }
  }
}

runTests();
