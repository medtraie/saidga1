const fs = require('fs');
const path = require('path');

const NEW_SUPABASE_URL = 'https://wobaeeyxtkewpbwgwcph.supabase.co/rest/v1/';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const dumpDir = path.resolve(__dirname, '../../../../.gemini/antigravity/brain/e1eb9573-d369-4ba7-a798-497ec4e08117/scratch/old_data_dump');
const fallbackDumpDir = path.resolve(__dirname, 'old_data_dump');

const activeDumpDir = fs.existsSync(dumpDir) ? dumpDir : fallbackDumpDir;

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

const BATCH_SIZE = 500;

async function uploadBatch(tableName, rows) {
  const url = `${NEW_SUPABASE_URL}${tableName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SECRET_KEY,
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
}

async function migrateTable(tableName) {
  const filePath = path.join(activeDumpDir, `${tableName}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] No dump file found for ${tableName}`);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`[START] Migrating ${tableName} (${rows.length} rows)...`);

  let successCount = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await uploadBatch(tableName, batch);
      successCount += batch.length;
      console.log(`  -> Migrated ${successCount}/${rows.length} rows in ${tableName}`);
    } catch (err) {
      console.error(`  [ERROR] Batch ${i}-${i + batch.length} for ${tableName}:`, err.message);
      // Try row-by-row fallback for errors
      for (const row of batch) {
        try {
          await uploadBatch(tableName, [row]);
          successCount++;
        } catch (singleErr) {
          console.error(`    [ROW ERROR] Failed id ${row.id || row.key}:`, singleErr.message);
        }
      }
    }
  }
  console.log(`[DONE] ${tableName}: ${successCount}/${rows.length} rows migrated successfully.\n`);
}

async function main() {
  console.log('Starting data migration to new Supabase (wobaeeyxtkewpbwgwcph)...\n');
  for (const table of tables) {
    await migrateTable(table);
  }
  console.log('All migrations completed!');
}

main().catch(console.error);
