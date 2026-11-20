const NEW_SUPABASE_URL = 'https://wobaeeyxtkewpbwgwcph.supabase.co/rest/v1/';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkCounts() {
  const tables = [
    "bottle_types",
    "empty_bottles_stock",
    "defective_stock",
    "dif_pricing",
    "reservoirs_pricing",
    "driver_sector_assignments",
    "sectors_settings",
    "factory_invoices",
    "stock_history",
    "app_state"
  ];

  for (const t of tables) {
    const res = await fetch(`${NEW_SUPABASE_URL}${t}?select=count`, {
      headers: {
        'apikey': SECRET_KEY,
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Prefer': 'count=exact'
      }
    });
    console.log(`${t}: ${res.headers.get('content-range')}`);
  }
}

checkCounts();
