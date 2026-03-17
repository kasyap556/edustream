import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/groups/[id]/messages — get messages (paginated, 50 at a time)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const { id } = await params;
    const url = new URL(req.url);
    const before = url.searchParams.get('before'); // ISO timestamp for pagination
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    try {
        const { adminDb } = await initializeFirebaseAdmin();

        // Verify membership
        const groupDoc = await adminDb.collection('groups').doc(id).get();
        if (!groupDoc.exists) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        const group = groupDoc.data() as any;
        if (!group.memberEmails?.includes(session.user.email)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        let query = adminDb.collection('groups').doc(id).collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (before) {
            const beforeDate = new Date(before);
            query = query.startAfter(beforeDate.toISOString());
        }

        const snapshot = await query.get();
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();

        return NextResponse.json({ messages, hasMore: snapshot.docs.length === limit });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch messages', details: error?.message }, { status: 500 });
    }
}

// POST /api/groups/[id]/messages — send a message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const { id } = await params;

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { text, type = 'text', fileUrl, fileName, fileSize, fileType, scheduledMeetingId } = body;

    if (type === 'text' && !text?.trim()) {
        return NextResponse.json({ error: 'Message text is required.' }, { status: 400 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();

        // Verify membership
        const groupRef = adminDb.collection('groups').doc(id);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        const group = groupDoc.data() as any;
        if (!group.memberEmails?.includes(session.user.email)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const userDoc = await adminDb.collection('users').doc(session.user.email).get();
        const userData = userDoc.data();

        const now = new Date().toISOString();
        const message: Record<string, any> = {
            type,
            senderEmail: session.user.email,
            senderName: session.user.name || '',
            senderImage: (session.user as any).image || '',
            senderRole: (session.user as any)?.role || 'student',
            createdAt: now,
        };

        if (type === 'text') message.text = text.trim();
        if (type === 'file' || fileUrl) {
            message.fileUrl = fileUrl;
            message.fileName = fileName;
            message.fileSize = fileSize;
            message.fileType = fileType;
            if (text?.trim()) message.text = text.trim();
        }
        if (type === 'schedule' && scheduledMeetingId) {
            message.scheduledMeetingId = scheduledMeetingId;
        }

        const msgRef = await groupRef.collection('messages').add(message);

        // Update group's last message
        await groupRef.update({
            lastMessage: type === 'file' ? `📎 ${fileName}` : type === 'schedule' ? '📅 Scheduled a meeting' : text?.trim(),
            lastMessageAt: now,
            lastMessageBy: session.user.name || session.user.email,
            updatedAt: now,
        });

        // Notify group members via email if it's an important message
        if (type === 'schedule' || group.memberEmails?.length <= 10) {
            const memberEmails: string[] = (group.memberEmails || []).filter((e: string) => e !== session.user.email).slice(0, 10);
            
            const notifyEmails: string[] = [];
            for (const email of memberEmails) {
                try {
                    const uDoc = await adminDb.collection('users').doc(email).get();
                    const uData = uDoc.data();
                    const notifyEmail = uData?.contactEmail || uData?.email;
                    if (notifyEmail) notifyEmails.push(notifyEmail);
                } catch { /* ignore individual fetch errors */ }
            }

            if (notifyEmails.length > 0) {
                try {
                    await fetch(`${process.env.NEXTAUTH_URL}/api/notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: notifyEmails,
                            subject: `New message in ${group.name}`,
                            type: 'group_message',
                            groupName: group.name,
                            senderName: session.user.name || session.user.email,
                            preview: type === 'file' ? `📎 ${fileName}` : type === 'schedule' ? '📅 Scheduled a meeting' : text?.slice(0, 100),
                        }),
                    });
                } catch { /* email errors non-critical */ }
            }
        }

        return NextResponse.json({ message: { id: msgRef.id, ...message } });
    } catch (error: any) {
        console.error('Send message error:', error);
        return NextResponse.json({ error: 'Failed to send message', details: error?.message }, { status: 500 });
    }
}
