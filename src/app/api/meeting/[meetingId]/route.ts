import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/meeting/[meetingId]
// Public endpoint — no auth required so any student with the link can view meeting info
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ meetingId: string }> }
) {
    const { meetingId } = await params;
    if (!meetingId) {
        return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const doc = await adminDb.collection('scheduled_meetings').doc(meetingId).get();

        if (!doc.exists) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }

        const data = doc.data()!;
        // Only expose safe, non-sensitive fields
        return NextResponse.json({
            id: doc.id,
            title: data.title,
            description: data.description,
            roomId: data.roomId,
            scheduledAt: data.scheduledAt,
            duration: data.duration,
            createdByName: data.createdByName,
        });
    } catch (error) {
        console.error('GET /api/meeting error:', error);
        return NextResponse.json({ error: 'Failed to fetch meeting' }, { status: 500 });
    }
}
