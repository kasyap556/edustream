
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            // On Google sign-in: create user doc in Firestore if first time
            if (account?.provider === 'google' && user?.email) {
                try {
                    const { initializeFirebaseAdmin } = await import("@/lib/firebase-admin");
                    const { adminDb } = await initializeFirebaseAdmin();
                    const userRef = adminDb.collection('users').doc(user.email);
                    const userDoc = await userRef.get();

                    if (!userDoc.exists) {
                        await userRef.set({
                            email: user.email,
                            name: user.name || '',
                            image: user.image || '',
                            role: 'student',           // default role
                            createdAt: new Date().toISOString(),
                        });
                    }
                } catch (err) {
                    console.error('Error creating user in Firestore:', err);
                }
            }
            return true;
        },

        async jwt({ token, user, account }) {
            // Always refresh role from Firestore so admin role changes
            // take effect without requiring a sign-out / sign-in.
            const email = (user?.email ?? token?.email) as string | undefined;
            if (email) {
                try {
                    const { initializeFirebaseAdmin } = await import("@/lib/firebase-admin");
                    const { adminDb } = await initializeFirebaseAdmin();
                    const userDoc = await adminDb.collection('users').doc(email).get();
                    token.role = userDoc.exists ? (userDoc.data()?.role ?? 'student') : 'student';
                } catch {
                    // Keep existing role if Firestore is unreachable
                    if (!token.role) token.role = 'student';
                }
            }
            // Set id only on initial sign-in
            if (account && user) {
                token.id = user.id;
                token.email = user.email;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role as string;
            }
            return session;
        },
    },
});
