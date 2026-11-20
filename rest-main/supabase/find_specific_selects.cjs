const fs = require('fs');
const path = require('path');

const specificSelects = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      const txt = fs.readFileSync(full, 'utf8');
      
      // Match from('xyz').select('...')
      const matches = txt.matchAll(/\.from\(['"]([a-zA-Z0-9_-]+)['"]\)\s*\.select\(['"`]([^'`"]+)['"`]\)/g);
      for (const m of matches) {
        specificSelects.push({
          file: full,
          table: m[1],
          columns: m[2]
        });
      }
    }
  }
}

scanDir('rest-main/src');
console.log('Specific column selects found:', specificSelects.length);
specificSelects.forEach(s => {
  console.log(`${s.table} -> [${s.columns}] in ${path.basename(s.file)}`);
});
