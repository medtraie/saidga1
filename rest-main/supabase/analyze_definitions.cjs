const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('rest-main/supabase/openapi_spec.json', 'utf8'));

console.log('Total definitions:', Object.keys(spec.definitions).length);

const summary = {};
for (const [table, def] of Object.entries(spec.definitions)) {
  summary[table] = {
    columns: Object.keys(def.properties || {}),
    required: def.required || [],
    description: def.description || ''
  };
}

console.log('\n--- Checking driver_commission_settings ---');
console.log(summary['driver_commission_settings']);

console.log('\n--- Checking pricing_settings ---');
console.log(summary['pricing_settings']);

console.log('\n--- Checking supply_orders ---');
console.log(summary['supply_orders']);

console.log('\n--- Checking return_orders ---');
console.log(summary['return_orders']);

console.log('\n--- Checking drivers ---');
console.log(summary['drivers']);

console.log('\n--- Checking clients ---');
console.log(summary['clients']);

console.log('\n--- Checking bottle_types ---');
console.log(summary['bottle_types']);
