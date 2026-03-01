'use client';

import { signOut, useSession } from 'next-auth/react';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { BsClock, BsEnvelope } from 'react-icons/bs';
import { Button } from '@/components/ui/Button';

export default function PendingPage() {
    const { data: session } = useSession();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-x-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[130px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md p-10 glass-panel rounded-3xl border border-border/50 shadow-2xl flex flex-col items-center gap-6 text-center">

                {/* Logo */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                    <HiOutlineAcademicCap className="text-3xl text-white" />
                </div>

                {/* Animated clock */}
                <div className="w-20 h-20 rounded-full border-2 border-primary/40 flex items-center justify-center bg-primary/10">
                    <BsClock className="text-4xl text-primary animate-pulse" />
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-foreground">Approval Pending</h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        Your teacher access request has been received. <br />
                        An administrator will review and approve your account shortly.
                    </p>
                </div>

                {/* User info */}
                <div className="w-full p-4 bg-white/5 rounded-xl border border-border/50 flex items-center gap-3">
                    {session?.user?.image && (
                        <img src={session.user.image} alt="avatar" className="w-10 h-10 rounded-full" />
                    )}
                    <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">{session?.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                    </div>
                    <span className="ml-auto text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">
                        Pending
                    </span>
                </div>

                {/* Steps */}
                <div className="w-full space-y-3 text-left">
                    {[
                        { step: '1', label: 'Request submitted', done: true },
                        { step: '2', label: 'Admin reviews your profile', done: false },
                        { step: '3', label: 'Access granted — sign in again', done: false },
                    ].map(({ step, label, done }) => (
                        <div key={step} className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-white/5 text-muted-foreground border border-border/50'}`}>
                                {done ? '✓' : step}
                            </div>
                            <span className={`text-sm ${done ? 'text-green-400' : 'text-muted-foreground'}`}>{label}</span>
                        </div>
                    ))}
                </div>

                <div className="w-full flex items-center gap-2 p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <BsEnvelope className="text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        You'll be notified once approved. Sign out and back in to refresh your access.
                    </p>
                </div>

                <div className="flex gap-3 w-full">
                    <Button
                        variant="ghost"
                        className="flex-1 border border-border/50"
                        onClick={() => window.location.href = '/'}
                    >
                        Go Home
                    </Button>
                    <Button
                        variant="ghost"
                        className="flex-1 border border-border/50"
                        onClick={() => signOut({ callbackUrl: '/' })}
                    >
                        Sign Out & Refresh
                    </Button>
                </div>
            </div>
        </div>
    );
}
