
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
    trustHost: true,
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],
    callbacks: {
        async signIn({ user: _user, account: _account }) {
            // No organization restriction — all users are allowed
            return true;
        },
        async jwt({ token, user }) {
            // This config is used ONLY by the Edge middleware to decode the JWT cookie.
            // The full auth.ts jwt callback (Node.js runtime) is the authoritative source
            // that fetches role from Firestore and writes it to the token.
            // We only preserve the id on initial sign-in; we never overwrite role here
            // because user.role is always undefined for Google OAuth JWT payloads.
            if (user) {
                token.id = user.id;
                token.email = user.email;
                // Do NOT set token.role — auth.ts handles that with Firestore lookup
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role as string;
            }
            return session;
        }
    },
    pages: {
        signIn: '/login',
    },
} satisfies NextAuthConfig;
