import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import TeacherClient from './TeacherClient';

export default async function TeacherDashboardWrapper() {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session) {
        redirect('/login');
    }

    if (role === 'pending') {
        redirect('/pending');
    }

    if (!['teacher', 'admin'].includes(role)) {
        redirect('/?error=teacher_only');
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const snapshot = await adminDb
            .collection('scheduled_meetings')
            .where('createdBy', '==', session.user.email)
            .get();

        const initialMeetings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return <TeacherClient initialMeetings={initialMeetings as any} />;
    } catch (error) {
        console.error('Failed to load meetings for Teacher Dashboard', error);
        return <TeacherClient initialMeetings={[]} />;
    }
}
