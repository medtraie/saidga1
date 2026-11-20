const fs = require('fs');
const path = require('path');

const tableQueries = {};

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      const txt = fs.readFileSync(full, 'utf8');
      
      const fromMatches = txt.matchAll(/\.from\(['"]([a-zA-Z0-9_-]+)['"]\)/g);
      for (const m of fromMatches) {
        tableQueries[m[1]] = tableQueries[m[1]] || new Set();
        tableQueries[m[1]].add(full);
      }

      const svcMatches = txt.matchAll(/supabaseService\.[a-zA-Z]+\(['"]([a-zA-Z0-9_-]+)['"]/g);
      for (const m of svcMatches) {
        tableQueries[m[1]] = tableQueries[m[1]] || new Set();
        tableQueries[m[1]].add(full);
      }
    }
  }
}

scanDir('rest-main/src');
console.log('Tables accessed by frontend (' + Object.keys(tableQueries).length + '):');
Object.keys(tableQueries).sort().forEach(t => {
  console.log(t + ' (' + tableQueries[t].size + ' files): ' + Array.from(tableQueries[t]).slice(0, 2).join(', '));
});
