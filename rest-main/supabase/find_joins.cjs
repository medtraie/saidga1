const fs = require('fs');
const path = require('path');

const embeddedJoins = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') scanDir(full);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      const txt = fs.readFileSync(full, 'utf8');
      
      const matches = txt.matchAll(/\.select\(['"`]([^'`"]*\([^\)]+\)[^'`"]*)['"`]\)/g);
      for (const m of matches) {
        embeddedJoins.push({
          file: full,
          select: m[1]
        });
      }
    }
  }
}

scanDir('rest-main/src');
console.log('Embedded joins found:', embeddedJoins.length);
embeddedJoins.forEach(j => {
  console.log(`${path.basename(j.file)}: ${j.select}`);
});
