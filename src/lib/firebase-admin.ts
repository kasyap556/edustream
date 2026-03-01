import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

// Lazy initialization to avoid initialization errors
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

/**
 * Rebuilds a PEM private key correctly from whatever format it arrives in.
 * Handles all edge cases: Windows CRLF, literal \n strings, extra whitespace,
 * or malformed base64 wrapping — which cause "Unparsed DER bytes remain" errors.
 */
function normalizePrivateKey(raw: string): string {
    // 1. Remove carriage returns
    let key = raw.replace(/\r/g, '');
    // 2. Convert literal backslash-n (escaped) into actual newlines
    key = key.replace(/\\n/g, '\n');

    const BEGIN = '-----BEGIN PRIVATE KEY-----';
    const END = '-----END PRIVATE KEY-----';

    const beginIdx = key.indexOf(BEGIN);
    const endIdx = key.indexOf(END);

    if (beginIdx === -1 || endIdx === -1) {
        // Can't parse PEM headers — return as cleaned up as possible
        return key.trim() + '\n';
    }

    // Extract the raw base64 body and strip ALL whitespace
    const rawBase64 = key
        .slice(beginIdx + BEGIN.length, endIdx)
        .replace(/\s+/g, '');

    // Rebuild with clean 64-char line wrapping
    const lines: string[] = [];
    for (let i = 0; i < rawBase64.length; i += 64) {
        lines.push(rawBase64.slice(i, i + 64));
    }

    return `${BEGIN}\n${lines.join('\n')}\n${END}\n`;
}

async function initializeFirebaseAdmin() {
    if (adminDb && adminAuth) {
        return { adminDb, adminAuth };
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!serviceAccount || !projectId) {
        throw new Error('Missing Firebase Admin environment variables (FIREBASE_SERVICE_ACCOUNT_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID)');
    }

    if (!admin.apps.length) {
        try {
            const serviceAccountObj = JSON.parse(serviceAccount);

            if (serviceAccountObj.private_key) {
                serviceAccountObj.private_key = normalizePrivateKey(serviceAccountObj.private_key);
            }

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountObj),
                projectId: projectId,
            });

            console.log('✅ Firebase Admin initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Firebase Admin:', error);
            throw error;
        }
    }

    adminDb = admin.firestore();
    adminAuth = admin.auth();

    return { adminDb, adminAuth };
}

export { initializeFirebaseAdmin };
