const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('rest-main/supabase/openapi_spec.json', 'utf8'));

const idTypes = {};
for (const [table, def] of Object.entries(spec.definitions)) {
  const p = def.properties;
  idTypes[table] = {
    id: p?.id?.type || p?.id?.format,
    driver_id: p?.driver_id?.type || p?.driver_id?.format,
    client_id: p?.client_id?.type || p?.client_id?.format,
    truck_id: p?.truck_id?.type || p?.truck_id?.format,
    bottle_type_id: p?.bottle_type_id?.type || p?.bottle_type_id?.format,
    supplier_id: p?.supplier_id?.type || p?.supplier_id?.format,
    user_id: p?.user_id?.type || p?.user_id?.format,
  };
}

console.log('Key tables column types:');
[
  'drivers',
  'clients',
  'trucks',
  'suppliers',
  'bottle_types',
  'supply_orders',
  'return_orders',
  'driver_commission_settings',
  'driver_sector_assignments',
  'empty_bottles_stock',
  'defective_stock',
  'stock_history',
  'factory_invoices'
].forEach(t => {
  console.log(t, idTypes[t]);
});
