import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/groups — list groups the current user is a member of
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();

        // Get groups where user is a member
        const snapshot = await adminDb.collection('groups')
            .where('memberEmails', 'array-contains', session.user.email)
            .orderBy('createdAt', 'desc')
            .get();

        const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ groups });
    } catch (error: any) {
        console.error('Group fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch groups', details: error?.message }, { status: 500 });
    }
}

// POST /api/groups — create a new group (teachers/admins only)
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const role = (session.user as any)?.role as string;
    if (!['teacher', 'admin'].includes(role)) {
        return NextResponse.json({ error: 'Only teachers and admins can create groups.' }, { status: 403 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { name, description, subject } = body;
    if (!name?.trim()) {
        return NextResponse.json({ error: 'Group name is required.' }, { status: 400 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();

        const groupData = {
            name: name.trim(),
            description: description?.trim() || '',
            subject: subject?.trim() || '',
            createdBy: session.user.email,
            createdByName: session.user.name || '',
            memberEmails: [session.user.email],
            members: [{
                email: session.user.email,
                name: session.user.name || '',
                image: (session.user as any).image || '',
                role,
                joinedAt: new Date().toISOString(),
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: null,
            lastMessageAt: null,
        };

        const docRef = await adminDb.collection('groups').add(groupData);

        return NextResponse.json({ message: 'Group created', group: { id: docRef.id, ...groupData } });
    } catch (error: any) {
        console.error('Create group error:', error);
        return NextResponse.json({ error: 'Failed to create group', details: error?.message }, { status: 500 });
    }
}
