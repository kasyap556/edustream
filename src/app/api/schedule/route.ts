import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET  /api/schedule  — fetch all scheduled meetings for the current user
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const snapshot = await adminDb
            .collection('scheduled_meetings')
            .where('createdBy', '==', session.user.email)
            .orderBy('scheduledAt', 'asc')
            .get();

        const meetings = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ meetings });
    } catch (error) {
        console.error('GET /api/schedule error:', error);
        return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
    }
}

// POST /api/schedule  — create a new scheduled meeting
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, description, roomId, scheduledAt, duration } = body;

        if (!title || !roomId || !scheduledAt) {
            return NextResponse.json({ error: 'Missing required fields: title, roomId, scheduledAt' }, { status: 400 });
        }

        const { adminDb } = await initializeFirebaseAdmin();
        const docRef = await adminDb.collection('scheduled_meetings').add({
            title: title.trim(),
            description: description?.trim() || '',
            roomId: roomId.trim(),
            scheduledAt,           // ISO string
            duration: duration || 60, // minutes
            createdBy: session.user.email,
            createdByName: session.user.name || session.user.email,
            createdAt: new Date().toISOString(),
        });

        return NextResponse.json({ id: docRef.id, message: 'Meeting scheduled successfully' }, { status: 201 });
    } catch (error) {
        console.error('POST /api/schedule error:', error);
        return NextResponse.json({ error: 'Failed to schedule meeting' }, { status: 500 });
    }
}

// DELETE /api/schedule?id=<docId>  — delete a scheduled meeting
export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const docRef = adminDb.collection('scheduled_meetings').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (doc.data()?.createdBy !== session.user.email) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await docRef.delete();
        return NextResponse.json({ message: 'Deleted' });
    } catch (error) {
        console.error('DELETE /api/schedule error:', error);
        return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 });
    }
}
