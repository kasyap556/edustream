import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/user/role — get current user's role
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const doc = await adminDb.collection('users').doc(session.user.email).get();
        const role = doc.exists ? (doc.data()?.role ?? 'student') : 'student';
        return NextResponse.json({ role, user: doc.data() });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
    }
}

// POST /api/user/role — request teacher access (sets role to 'pending')
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const body = await req.json();
        const { requestedRole, institution, reason } = body;

        if (requestedRole !== 'teacher') {
            return NextResponse.json({ error: 'Only teacher role requests are supported' }, { status: 400 });
        }

        const { adminDb } = await initializeFirebaseAdmin();
        const userRef = adminDb.collection('users').doc(session.user.email);
        const userDoc = await userRef.get();

        const currentRole = userDoc.data()?.role ?? 'student';
        if (['teacher', 'admin'].includes(currentRole)) {
            return NextResponse.json({ error: 'Already has elevated role' }, { status: 400 });
        }

        await userRef.update({
            role: 'pending',
            pendingRequest: {
                requestedRole: 'teacher',
                institution: institution || '',
                reason: reason || '',
                requestedAt: new Date().toISOString(),
            },
        });

        return NextResponse.json({ message: 'Teacher access request submitted' });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }
}
