import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// GET /api/user/profile — get current user's profile completion status
export async function GET() {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const userDoc = await adminDb.collection('users').doc(session.user.email).get();

        if (!userDoc.exists) {
            return NextResponse.json({ profileComplete: false, user: null });
        }

        const data = userDoc.data();
        const profileComplete = !!(data?.college && (data?.admissionNo || data?.teacherIdNo));

        return NextResponse.json({ profileComplete, user: data });
    } catch (error: any) {
        return NextResponse.json({ error: 'Firestore error', details: error?.message }, { status: 500 });
    }
}

// POST /api/user/profile — save/update user profile
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { role, admissionNo, teacherIdNo, college, contactEmail, department } = body;

    // Validation
    if (!['student', 'teacher'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role. Must be student or teacher.' }, { status: 400 });
    }
    if (role === 'student' && !admissionNo?.trim()) {
        return NextResponse.json({ error: 'Admission number is required for students.' }, { status: 400 });
    }
    if (role === 'teacher' && !teacherIdNo?.trim()) {
        return NextResponse.json({ error: 'Teacher ID number is required.' }, { status: 400 });
    }
    if (!college?.trim()) {
        return NextResponse.json({ error: 'College name is required.' }, { status: 400 });
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const userRef = adminDb.collection('users').doc(session.user.email);
        const userDoc = await userRef.get();

        // Teachers start as 'pending' for admin approval, unless already a teacher/admin
        const existingRole = userDoc.exists ? userDoc.data()?.role : null;
        let finalRole = existingRole;

        if (!existingRole || existingRole === 'student') {
            // If new user selects teacher, mark as pending
            finalRole = role === 'teacher' ? 'pending' : 'student';
        }

        const profileData: Record<string, any> = {
            email: session.user.email,
            name: session.user.name || '',
            image: (session.user as any).image || '',
            role: finalRole || role,
            college: college.trim(),
            contactEmail: contactEmail?.trim() || session.user.email,
            department: department?.trim() || '',
            profileComplete: true,
            updatedAt: new Date().toISOString(),
        };

        if (role === 'student') {
            profileData.admissionNo = admissionNo.trim();
            profileData.requestedRole = 'student';
        } else {
            profileData.teacherIdNo = teacherIdNo.trim();
            profileData.requestedRole = 'teacher';
        }

        if (!userDoc.exists) {
            profileData.createdAt = new Date().toISOString();
        }

        await userRef.set(profileData, { merge: true });

        console.log(`✅ Profile saved for ${session.user.email} — role: ${finalRole}`);

        return NextResponse.json({
            message: 'Profile saved successfully',
            user: profileData,
            pendingApproval: role === 'teacher' && finalRole === 'pending',
        });
    } catch (error: any) {
        console.error('❌ Failed to save user profile:', error);
        return NextResponse.json({ error: 'Failed to save profile', details: error?.message }, { status: 500 });
    }
}
