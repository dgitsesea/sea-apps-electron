const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');
code = code.replace(/\\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('main.js', code);
