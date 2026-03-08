import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session || !['admin', 'teacher'].includes(role)) {
        redirect('/?error=teacher_only');
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const snapshot = await adminDb
            .collection('scheduled_meetings')
            .where('createdBy', '==', session.user.email)
            .orderBy('scheduledAt', 'asc')
            .get();

        const initialMeetings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return <ScheduleClient initialMeetings={initialMeetings as any} />;
    } catch (e) {
        console.error('Failed to load scheduled meetings', e);
        return <ScheduleClient initialMeetings={[]} />;
    }
}
