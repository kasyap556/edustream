// Run this with: node scripts/format-key.js path/to/your-key.json
const fs = require('fs');
const path = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
    console.error('Usage: node scripts/format-key.js <path-to-service-account.json>');
    process.exit(1);
}

const raw = fs.readFileSync(path.resolve(keyPath), 'utf8');
const parsed = JSON.parse(raw);

// Print as a single-line JSON (safe for .env.local)
const oneLine = JSON.stringify(parsed);
console.log('\n✅ Copy this entire line into your .env.local:\n');
console.log(`FIREBASE_SERVICE_ACCOUNT_KEY=${oneLine}`);
console.log('\n');
