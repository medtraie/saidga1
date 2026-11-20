const fs = require('fs');
const spec = JSON.parse(fs.readFileSync('rest-main/supabase/openapi_spec.json', 'utf8'));

const fks = [];
for (const [table, def] of Object.entries(spec.definitions)) {
  for (const [col, prop] of Object.entries(def.properties || {})) {
    if (prop.description && (prop.description.includes('Foreign Key') || prop.description.includes('references'))) {
      fks.push(table + '.' + col + ' -> ' + prop.description);
    }
  }
}
console.log('Foreign keys detected in OpenAPI descriptions:', fks.length);
fks.forEach(f => console.log(f));
