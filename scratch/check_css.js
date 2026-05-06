
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\20340007337\\Desktop\\Antigravity\\Finto\\Finto\\style.css', 'utf8');

let braceLevel = 0;
let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let char of line) {
        if (char === '{') braceLevel++;
        if (char === '}') braceLevel--;
    }
    if (braceLevel < 0) {
        console.log(`Potential error at line ${i + 1}: Negative brace level`);
        braceLevel = 0;
    }
}
if (braceLevel > 0) {
    console.log(`End of file reached with brace level ${braceLevel}`);
}
