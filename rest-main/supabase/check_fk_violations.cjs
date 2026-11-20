const { createClient } = require('../node_modules/@supabase/supabase-js');
const supabase = createClient('https://wobaeeyxtkewpbwgwcph.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFKViolations() {
  // Check driver_id in supply_orders vs drivers
  const { data: drivers } = await supabase.from('drivers').select('id');
  const driverIds = new Set((drivers || []).map(d => d.id));

  const { data: so } = await supabase.from('supply_orders').select('id, driver_id, client_id, truck_id');
  const invalidDrivers = (so || []).filter(o => o.driver_id && !driverIds.has(o.driver_id));
  console.log('supply_orders count:', so?.length, 'invalid driver_id:', invalidDrivers.length);

  // Check clients
  const { data: clients } = await supabase.from('clients').select('id');
  const clientIds = new Set((clients || []).map(c => c.id));
  const invalidClients = (so || []).filter(o => o.client_id && !clientIds.has(o.client_id));
  console.log('invalid client_id:', invalidClients.length);

  // Check driver_sector_assignments
  const { data: dsa } = await supabase.from('driver_sector_assignments').select('id, driver_id');
  const invalidDsa = (dsa || []).filter(a => a.driver_id && !driverIds.has(a.driver_id));
  console.log('driver_sector_assignments count:', dsa?.length, 'invalid driver_id:', invalidDsa.length);

  // Check defective_stock
  const { data: bts } = await supabase.from('bottle_types').select('id');
  const btIds = new Set((bts || []).map(b => b.id));
  const { data: def } = await supabase.from('defective_stock').select('id, bottletypeid');
  const invalidDef = (def || []).filter(d => d.bottletypeid && !btIds.has(d.bottletypeid));
  console.log('defective_stock count:', def?.length, 'invalid bottletypeid:', invalidDef.length);

  // Check empty_bottles_stock
  const { data: empty } = await supabase.from('empty_bottles_stock').select('id, bottletypeid');
  const invalidEmpty = (empty || []).filter(e => e.bottletypeid && !btIds.has(e.bottletypeid));
  console.log('empty_bottles_stock count:', empty?.length, 'invalid bottletypeid:', invalidEmpty.length);
}

testFKViolations();
