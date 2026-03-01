import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// POST /api/user/init — manually create/sync current user in Firestore
// Call this once after signing in if auto-creation failed
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const userRef = adminDb.collection('users').doc(session.user.email);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            return NextResponse.json({
                message: 'User already exists',
                user: userDoc.data(),
            });
        }

        // Create the user document
        const newUser = {
            email: session.user.email,
            name: session.user.name || '',
            image: (session.user as any).image || '',
            role: 'student',
            createdAt: new Date().toISOString(),
        };

        await userRef.set(newUser);
        console.log('✅ User document created manually:', session.user.email);

        return NextResponse.json({
            message: 'User created successfully',
            user: newUser,
        });
    } catch (error: any) {
        console.error('❌ Failed to create user:', error);
        return NextResponse.json({
            error: 'Failed to create user',
            details: error?.message || String(error),
        }, { status: 500 });
    }
}

// GET /api/user/init — check current user's Firestore status
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const userDoc = await adminDb.collection('users').doc(session.user.email).get();

        return NextResponse.json({
            sessionEmail: session.user.email,
            sessionRole: (session.user as any).role,
            firestoreExists: userDoc.exists,
            firestoreData: userDoc.exists ? userDoc.data() : null,
        });
    } catch (error: any) {
        return NextResponse.json({
            error: 'Firestore error',
            details: error?.message,
        }, { status: 500 });
    }
}
