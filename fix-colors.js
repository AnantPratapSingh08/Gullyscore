const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      processDir(p);
    } else if (p.endsWith('.css') || p.endsWith('.tsx')) {
      let content = fs.readFileSync(p, 'utf8');
      let changed = false;

      if (p.endsWith('.css')) {
        if (content.includes('rgba(31, 41, 55, 0.05)')) {
          content = content.replace(/background:\s*rgba\(31,\s*41,\s*55,\s*0\.05\);/g, 'background: #ffffff;\n  box-shadow: 0 4px 24px rgba(0,0,0,0.04);');
          changed = true;
        }
        if (content.includes('border: 1px solid rgba(31, 41, 55, 0.05);')) {
          content = content.replace(/border:\s*1px\s*solid\s*rgba\(31,\s*41,\s*55,\s*0\.05\);/g, 'border: 1px solid rgba(0,0,0,0.03);');
          changed = true;
        }
      } else if (p.endsWith('.tsx')) {
        if (content.includes("'rgba(31, 41, 55, 0.05)'")) {
          content = content.replace(/'rgba\(31,\s*41,\s*55,\s*0\.05\)'/g, "'#ffffff'");
          changed = true;
        }
        if (content.includes("'rgba(31, 41, 55, 0.02)'")) {
          content = content.replace(/'rgba\(31,\s*41,\s*55,\s*0\.02\)'/g, "'#f8fafc'");
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(p, content, 'utf8');
      }
    }
  }
}

processDir('Frontend/src');
