'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Registration is now handled automatically via Google Sign-In.
 * This page simply redirects users to the login page.
 */
export default function RegisterPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/login');
    }, [router]);

    return null;
}
