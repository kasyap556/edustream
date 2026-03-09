'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import {
    BsCalendar3, BsClock, BsCameraVideo, BsPeopleFill,
    BsArrowLeft, BsPersonCircle, BsHourglassSplit,
} from 'react-icons/bs';

interface MeetingInfo {
    id: string;
    title: string;
    description: string;
    roomId: string;
    scheduledAt: string;
    duration: number;
    createdByName: string;
}

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        weekday: 'long', month: 'long', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function useCountdown(iso: string) {
    const [diff, setDiff] = useState(new Date(iso).getTime() - Date.now());

    useEffect(() => {
        const tick = setInterval(() => {
            setDiff(new Date(iso).getTime() - Date.now());
        }, 1000);
        return () => clearInterval(tick);
    }, [iso]);

    if (diff <= 0) return null; // meeting time has passed

    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hrs, mins, secs };
}

function CountdownBox({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm shadow-lg">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">
                    {String(value).padStart(2, '0')}
                </span>
            </div>
            <span className="text-xs text-white/60 uppercase tracking-widest font-medium">{label}</span>
        </div>
    );
}

// Wrapper so countdown hook is always called (avoids conditional hook violation)
function MeetingCard({ meeting, authStatus, onJoin }: {
    meeting: MeetingInfo;
    authStatus: string;
    onJoin: () => void;
}) {
    const countdown = useCountdown(meeting.scheduledAt);
    const isMeetingTime = !countdown;

    return (
        <div className="glass-panel rounded-3xl border border-border/50 shadow-2xl overflow-hidden">

            {/* Header strip */}
            <div className="bg-gradient-to-r from-primary/80 to-secondary/80 px-8 py-6">
                <div className="flex items-center gap-3 mb-2">
                    <BsCalendar3 className="text-white/70 text-xl shrink-0" />
                    <span className="text-white/70 text-sm font-medium uppercase tracking-widest">Scheduled Class</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    {meeting.title}
                </h1>
                {meeting.description && (
                    <p className="text-white/70 text-sm mt-2 leading-relaxed">{meeting.description}</p>
                )}
            </div>

            {/* Body */}
            <div className="px-8 py-8 space-y-8">

                {/* Meta info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-border/40">
                        <BsPersonCircle className="text-primary text-xl shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Teacher</p>
                            <p className="font-semibold text-foreground text-sm">{meeting.createdByName}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-border/40">
                        <BsCalendar3 className="text-secondary text-xl shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Date &amp; Time</p>
                            <p className="font-semibold text-foreground text-sm leading-tight">{formatDateTime(meeting.scheduledAt)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-border/40">
                        <BsClock className="text-primary text-xl shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Duration</p>
                            <p className="font-semibold text-foreground text-sm">{meeting.duration} minutes</p>
                        </div>
                    </div>
                </div>

                {/* Countdown or Live badge */}
                {countdown ? (
                    <div className="flex flex-col items-center gap-5 py-4">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <BsHourglassSplit className="text-primary animate-pulse" />
                            <span>Meeting starts in</span>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-5">
                            {countdown.days > 0 && <CountdownBox label="Days" value={countdown.days} />}
                            <CountdownBox label="Hours" value={countdown.hrs} />
                            <CountdownBox label="Mins" value={countdown.mins} />
                            <CountdownBox label="Secs" value={countdown.secs} />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-3 py-4">
                        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 font-semibold text-sm animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#22c55e]" />
                            Meeting is Live!
                        </span>
                    </div>
                )}

                {/* Join Button */}
                <button
                    onClick={onJoin}
                    className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${isMeetingTime
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white scale-100 hover:scale-[1.02]'
                            : 'bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white scale-100 hover:scale-[1.02]'
                        }`}
                >
                    <BsCameraVideo className="text-xl" />
                    {authStatus === 'unauthenticated'
                        ? 'Sign in to Join'
                        : isMeetingTime
                            ? 'Join Meeting Now'
                            : 'Enter Lobby'}
                </button>

                {authStatus === 'unauthenticated' && (
                    <p className="text-center text-xs text-muted-foreground">
                        You need to be signed in to join this class.
                    </p>
                )}

                {!isMeetingTime && countdown && authStatus === 'authenticated' && (
                    <p className="text-center text-xs text-muted-foreground">
                        You can enter the lobby now and wait for the teacher to start the session.
                    </p>
                )}

            </div>
        </div>
    );
}

export default function MeetingInfoPage() {
    const params = useParams();
    const meetingId = params?.meetingId as string;
    const router = useRouter();
    const { data: session, status: authStatus } = useSession();

    const [meeting, setMeeting] = useState<MeetingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!meetingId) return;
        fetch(`/api/meeting/${meetingId}`)
            .then(async (res) => {
                if (!res.ok) throw new Error((await res.json()).error || 'Meeting not found');
                return res.json();
            })
            .then((data) => setMeeting(data))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [meetingId]);

    const handleJoin = () => {
        if (!meeting) return;
        if (authStatus === 'unauthenticated') {
            router.push(`/login?callbackUrl=/meeting/${meetingId}`);
            return;
        }
        router.push(`/lobby?roomId=${meeting.roomId}`);
    };

    // ── Loading State ───────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="student-theme min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-muted-foreground text-sm">Loading meeting details…</p>
                </div>
            </div>
        );
    }

    // ── Error State ─────────────────────────────────────────────────────────────
    if (error || !meeting) {
        return (
            <div className="student-theme min-h-screen flex items-center justify-center bg-background p-4">
                <div className="glass-panel rounded-2xl border border-red-500/30 p-10 text-center max-w-md">
                    <div className="text-5xl mb-4">😕</div>
                    <h1 className="text-xl font-bold text-foreground mb-2">Meeting Not Found</h1>
                    <p className="text-muted-foreground text-sm mb-6">
                        {error || 'This meeting link may be invalid or expired.'}
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary font-medium text-sm transition-colors"
                    >
                        <BsArrowLeft /> Go Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="student-theme min-h-screen bg-background relative overflow-hidden flex flex-col">

            {/* Background blobs */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-15%] w-[700px] h-[700px] bg-primary/20 rounded-full blur-[140px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-15%] w-[700px] h-[700px] bg-secondary/20 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-border/30 backdrop-blur-sm">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <BsArrowLeft />
                    <HiOutlineAcademicCap className="text-2xl text-primary" />
                    <span className="font-bold text-foreground">EduStream</span>
                </button>
                {session?.user && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BsPersonCircle className="text-primary text-lg" />
                        <span>{session.user.name?.split(' ')[0] || session.user.email}</span>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-2xl">

                    {/* Card */}
                    <MeetingCard
                        meeting={meeting}
                        authStatus={authStatus}
                        onJoin={handleJoin}
                    />

                    {/* Participants indicator */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                        <BsPeopleFill className="text-primary" />
                        <span>Share this link with your classmates so everyone can join!</span>
                    </div>

                </div>
            </main>
        </div>
    );
}
