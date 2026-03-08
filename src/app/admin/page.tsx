import { auth } from '@/lib/auth';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export default async function AdminPage() {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session || role !== 'admin') {
        redirect('/?error=admin_only');
    }

    try {
        const { adminDb } = await initializeFirebaseAdmin();
        const snapshot = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
        const initialUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        return <AdminClient initialUsers={initialUsers as any} />;
    } catch (e) {
        console.error('Failed to load admin users', e);
        return <AdminClient initialUsers={[]} />;
    }
}
