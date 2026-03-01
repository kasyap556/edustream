
const fs = require('fs');
const path = require('path');

// Manually verify .env.local parsing
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Simple parsing logic to extract FIREBASE_SERVICE_ACCOUNT_KEY
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY='(.*)'/);
if (match) {
    const rawKey = match[1];
    console.log('Found FIREBASE_SERVICE_ACCOUNT_KEY');

    try {
        const parsed = JSON.parse(rawKey);
        console.log('JSON.parse successful');
        console.log('Project ID:', parsed.project_id);
        console.log('Client Email:', parsed.client_email);

        const privateKey = parsed.private_key;
        const hasRealNewlines = privateKey.includes('\n');
        const hasEscapedNewlines = privateKey.includes('\\n');

        console.log('Private Key Check:');
        console.log('- Has real newlines:', hasRealNewlines);
        console.log('- Has escaped newlines (\\n):', hasEscapedNewlines);

        if (hasEscapedNewlines && !hasRealNewlines) {
            console.log('WARNING: Private key has escaped newlines but no real newlines. This might be the issue.');
        } else {
            console.log('Private key format looks likely correct (contains newlines).');
        }

    } catch (e) {
        console.error('JSON.parse FAILED:', e.message);
    }
} else {
    console.error('Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local with expected format');
}
