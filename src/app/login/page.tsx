'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { HiOutlineAcademicCap } from 'react-icons/hi';

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await signIn('google', { callbackUrl: '/' });
        } catch (err) {
            console.error('Google sign in error:', err);
            setError('Failed to sign in with Google. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-x-hidden">

            {/* Animated Background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-primary/20 rounded-full blur-[140px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-secondary/20 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
            </div>

            {/* Card */}
            <div className="relative z-10 w-full max-w-sm p-10 glass-panel rounded-3xl shadow-2xl border border-border/50 flex flex-col items-center gap-8">

                {/* Logo */}
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                        <HiOutlineAcademicCap className="text-3xl text-white" />
                    </div>
                    <span className="text-2xl font-extrabold tracking-tight text-foreground">EduStream</span>
                    <p className="text-sm text-muted-foreground text-center">
                        Sign in to access your virtual classroom
                    </p>
                </div>

                {/* Divider */}
                <div className="w-full border-t border-border/40" />

                {/* Error message */}
                {error && (
                    <div className="w-full p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-sm text-red-400 text-center">
                        {error}
                    </div>
                )}

                {/* Google Sign-In Button */}
                <button
                    id="google-signin-btn"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border/60 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all duration-200 font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    ) : (
                        /* Official Google "G" SVG */
                        <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                            <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                    )}
                    <span>{isLoading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
                </button>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                    By continuing, you agree to EduStream's terms. <br />
                    Your account is linked securely via Google.
                </p>
            </div>
        </div>
    );
}
