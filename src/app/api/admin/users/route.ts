import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/admin/users — list all users (admin only)
export async function GET() {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const snapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
        const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        return NextResponse.json({ users });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

// PATCH /api/admin/users — approve or reject a teacher request
export async function PATCH(req: NextRequest) {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const { email, role } = await req.json(); // role: 'teacher' | 'student' | 'admin'
        if (!email || !role) {
            return NextResponse.json({ error: 'Missing email or role' }, { status: 400 });
        }
        const { adminDb } = await initializeFirebaseAdmin();
        await adminDb.collection('users').doc(email).update({
            role,
            pendingRequest: null,
            approvedAt: new Date().toISOString(),
            approvedBy: session?.user?.email ?? '',
        });
        return NextResponse.json({ message: `Role updated to ${role}` });
    } catch {
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
}
