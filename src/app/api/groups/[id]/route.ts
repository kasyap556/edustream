import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/groups/[id] — group details + member list
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const doc = await adminDb.collection('groups').doc(id).get();

        if (!doc.exists) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

        const group = { id: doc.id, ...doc.data() } as any;

        // Check membership
        if (!group.memberEmails?.includes(session.user.email)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        return NextResponse.json({ group });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to fetch group', details: error?.message }, { status: 500 });
    }
}

// PATCH /api/groups/[id] — add/remove members, update group info
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const { id } = await params;

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const docRef = adminDb.collection('groups').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        const group = doc.data() as any;

        // Only creator or admin can modify
        const role = (session.user as any)?.role as string;
        if (group.createdBy !== session.user.email && role !== 'admin') {
            return NextResponse.json({ error: 'Only the group creator can modify this group.' }, { status: 403 });
        }

        const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

        if (body.name) updates.name = body.name.trim();
        if (body.description !== undefined) updates.description = body.description.trim();
        if (body.subject !== undefined) updates.subject = body.subject.trim();

        // Handle adding a member by email
        if (body.addMemberEmail) {
            const email = body.addMemberEmail.trim().toLowerCase();
            if (!group.memberEmails?.includes(email)) {
                // Fetch user details
                const userDoc = await adminDb.collection('users').doc(email).get();
                if (!userDoc.exists) {
                    return NextResponse.json({ error: `No user registered with ${email}` }, { status: 400 });
                }
                const userData = userDoc.data();
                const newMember = {
                    email,
                    name: userData?.name || email,
                    image: userData?.image || '',
                    role: userData?.role || 'student',
                    joinedAt: new Date().toISOString(),
                };
                updates.memberEmails = [...(group.memberEmails || []), email];
                updates.members = [...(group.members || []), newMember];

                // Send notification email
                try {
                    await fetch(`${process.env.NEXTAUTH_URL}/api/notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: userData?.contactEmail || email,
                            subject: `You've been added to group: ${group.name}`,
                            type: 'group_invite',
                            groupName: group.name,
                            invitedBy: session.user.name || session.user.email,
                        }),
                    });
                } catch { /* ignore email errors */ }
            }
        }

        // Handle removing a member
        if (body.removeMemberEmail) {
            const email = body.removeMemberEmail.trim().toLowerCase();
            updates.memberEmails = (group.memberEmails || []).filter((e: string) => e !== email);
            updates.members = (group.members || []).filter((m: any) => m.email !== email);
        }

        await docRef.update(updates);
        return NextResponse.json({ message: 'Group updated' });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to update group', details: error?.message }, { status: 500 });
    }
}

// DELETE /api/groups/[id] — delete a group (creator/admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    const { id } = await params;

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const docRef = adminDb.collection('groups').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        const group = doc.data() as any;
        const role = (session.user as any)?.role as string;

        if (group.createdBy !== session.user.email && role !== 'admin') {
            return NextResponse.json({ error: 'Only the creator can delete this group.' }, { status: 403 });
        }

        await docRef.delete();
        return NextResponse.json({ message: 'Group deleted' });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to delete group', details: error?.message }, { status: 500 });
    }
}
