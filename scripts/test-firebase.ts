import fs from 'fs';
import path from 'path';

// Manually verify .env.local parsing and load into process.env
const envPath = path.resolve(process.cwd(), '.env.local');
let serviceAccountKey = '';
let projectId = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
            const match = line.match(/^([^=]+)='?(.*?)'?$/);
            if (match) {
                const key = match[1];
                let value = match[2];
                if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }
                if (key === 'FIREBASE_SERVICE_ACCOUNT_KEY') serviceAccountKey = value;
                if (key === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID') projectId = value;
            }
        }
    }
}

async function debugFirebase() {
    console.log('Debugging Firebase Credential...');
    try {
        const admin = await import('firebase-admin');

        if (!serviceAccountKey) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not found');
        }

        console.log('Parsing service account key...');
        const serviceAccountObj = JSON.parse(serviceAccountKey);

        console.log('Original private_key length:', serviceAccountObj.private_key.length);
        console.log('Contains escaped newlines (\\n):', serviceAccountObj.private_key.includes('\\n'));
        console.log('Contains real newlines:', serviceAccountObj.private_key.includes('\n'));

        // Apply fix
        if (serviceAccountObj.private_key) {
            serviceAccountObj.private_key = serviceAccountObj.private_key.replace(/\\n/g, '\n');
        }

        console.log('Fixed private_key length:', serviceAccountObj.private_key.length);
        console.log('Fixed contains real newlines:', serviceAccountObj.private_key.includes('\n'));

        console.log('Attempting admin.initializeApp...');
        if (!admin.default.apps.length) {
            admin.default.initializeApp({
                credential: admin.default.credential.cert(serviceAccountObj),
                projectId: projectId,
            });
            console.log('Firebase Admin Initialized Successfully!');
        } else {
            console.log('Firebase Admin already initialized.');
        }

    } catch (error) {
        console.error('DEBUG FAILED:', error);
    }
}

debugFirebase();
