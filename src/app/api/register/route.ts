import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, password, role } = body;

        // Validation
        if (!name || !email || !password || !role) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            );
        }

        const { adminDb } = await initializeFirebaseAdmin();

        // Check if user already exists
        const usersRef = adminDb.collection('users');
        const existingUsers = await usersRef.where('email', '==', email).limit(1).get();

        if (!existingUsers.empty) {
            return NextResponse.json(
                { message: 'User already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user document in Firestore
        await usersRef.add({
            name,
            email,
            password_hash: hashedPassword,
            role,
            created_at: new Date().toISOString(),
        });

        return NextResponse.json(
            { message: 'User registered successfully' },
            { status: 201 }
        );

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { message: 'Registration failed. Please try again.' },
            { status: 500 }
        );
    }
}
