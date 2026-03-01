import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const role = (req.auth as any)?.user?.role as string | undefined;
    const path = req.nextUrl.pathname;

    // All protected routes require login
    const authRequired = ['/lobby', '/room', '/schedule', '/create-meeting', '/teacher', '/admin', '/pending'];
    const needsAuth = authRequired.some((r) => path.startsWith(r));

    if (needsAuth && !isLoggedIn) {
        return NextResponse.redirect(new URL('/login', req.nextUrl));
    }

    // Teacher-only routes: /teacher, /create-meeting, /schedule
    const teacherRoutes = ['/teacher', '/create-meeting', '/schedule'];
    if (teacherRoutes.some((r) => path.startsWith(r))) {
        if (!['teacher', 'admin'].includes(role ?? '')) {
            return NextResponse.redirect(new URL(
                role === 'pending' ? '/pending' : '/?error=teacher_only',
                req.nextUrl
            ));
        }
    }

    // Admin panel — requires role='admin'
    if (path.startsWith('/admin')) {
        if (role !== 'admin') {
            return NextResponse.redirect(new URL('/?error=admin_only', req.nextUrl));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/room/:path*", "/lobby", "/schedule", "/create-meeting", "/teacher/:path*", "/admin/:path*", "/pending"],
};
