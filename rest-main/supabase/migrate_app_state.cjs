const fs = require('fs');
const path = require('path');

const NEW_SUPABASE_URL = 'https://wobaeeyxtkewpbwgwcph.supabase.co/rest/v1/';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const filePath = path.join(__dirname, 'old_data_dump', 'app_state.json');
const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Sort by updated_at ascending so latest wins
rows.sort((a, b) => new Date(a.updated_at || 0) - new Date(b.updated_at || 0));

const map = new Map();
rows.forEach(r => {
  const uid = r.user_id || 'null';
  const key = `${r.key}:::${uid}`;
  map.set(key, r);
});

const deduped = Array.from(map.values());
console.log(`Original rows: ${rows.length}, Deduplicated unique (key, user_id): ${deduped.length}`);

async function uploadAppState() {
  let success = 0;
  for (const row of deduped) {
    try {
      const res = await fetch(`${NEW_SUPABASE_URL}app_state`, {
        method: 'POST',
        headers: {
          'apikey': SECRET_KEY,
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: row.key,
          value: row.value,
          updated_at: row.updated_at,
          user_id: row.user_id
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Failed ${row.key}: ${text}`);
      } else {
        success++;
      }
    } catch (e) {
      console.error(`Error ${row.key}: ${e.message}`);
    }
  }
  console.log(`Successfully migrated ${success}/${deduped.length} app_state rows.`);
}

uploadAppState();
