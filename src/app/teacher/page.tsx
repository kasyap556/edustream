'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import {
    BsCalendar3, BsCameraVideo, BsClock, BsPeopleFill, BsPlusCircle,
    BsClipboard, BsCheck2, BsTrash, BsLink45Deg, BsGrid3X3Gap,
    BsPersonBadge, BsChevronRight, BsArrowRepeat,
} from 'react-icons/bs';
import { HiOutlineAcademicCap } from 'react-icons/hi';

interface ScheduledMeeting {
    id: string;
    title: string;
    description: string;
    roomId: string;
    scheduledAt: string;
    duration: number;
    createdBy: string;
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function getCountdown(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `in ${days}d ${hrs}h`;
    if (hrs > 0) return `in ${hrs}h ${mins}m`;
    return `in ${mins}m`;
}

/* ─── Schedule Form Modal ─────────────────────────────────── */
function ScheduleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [roomId, setRoomId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const minDate = new Date().toISOString().split('T')[0];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!date || !time) { setError('Please pick a date and time.'); return; }
        const scheduledAt = new Date(`${date}T${time}`).toISOString();
        if (new Date(scheduledAt) <= new Date()) { setError('Scheduled time must be in the future.'); return; }
        const finalRoomId = roomId.trim() || Math.random().toString(36).substring(2, 10);

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, roomId: finalRoomId, scheduledAt, duration }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed');
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-panel w-full max-w-lg rounded-2xl border border-border/50 shadow-2xl p-8">
                <h2 className="text-xl font-bold mb-5 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    Schedule a New Class
                </h2>
                {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-lg text-sm text-red-400">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Class Title *</label>
                        <input className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" placeholder="e.g., Physics — Chapter 5" value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                        <textarea className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none" placeholder="Topics, materials, notes…" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Room ID</label>
                        <div className="flex gap-2">
                            <input className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono" placeholder="Auto-generated if empty" value={roomId} onChange={e => setRoomId(e.target.value)} />
                            <Button type="button" variant="outline" size="sm" onClick={() => setRoomId(Math.random().toString(36).substring(2, 10))}>Generate</Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                            <input type="date" min={minDate} className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Time *</label>
                            <input type="time" className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" value={time} onChange={e => setTime(e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Duration: <span className="text-primary font-semibold">{duration} min</span></label>
                        <input type="range" min={15} max={180} step={15} value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full accent-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="ghost" className="flex-1 border border-border/50" onClick={onClose}>Cancel</Button>
                        <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90" isLoading={isSubmitting}>
                            <BsCalendar3 className="mr-2" /> Schedule
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Teacher Dashboard ──────────────────────────────── */
export default function TeacherDashboard() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = (session?.user as any)?.role as string;

    const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchMeetings = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/schedule');
            if (res.ok) setMeetings((await res.json()).meetings || []);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated') {
            if (role === 'pending') router.push('/pending');
            else if (!['teacher', 'admin'].includes(role)) router.push('/?error=teacher_only');
            else fetchMeetings();
        }
    }, [status, role, router, fetchMeetings]);

    const upcomingMeetings = meetings
        .filter(m => new Date(m.scheduledAt) > new Date())
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    const copyLink = async (roomId: string, id: string) => {
        await navigator.clipboard.writeText(`${window.location.origin}/lobby?roomId=${roomId}`);
        setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    };

    const deleteMeeting = async (id: string) => {
        setDeletingId(id);
        await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
        setMeetings(prev => prev.filter(m => m.id !== id));
        setDeletingId(null);
    };

    const startInstant = () => router.push(`/lobby?roomId=${Math.random().toString(36).substring(2, 10)}`);

    if (status === 'loading') return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <svg className="w-8 h-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
        </div>
    );

    return (
        <div className="teacher-theme min-h-screen bg-background relative overflow-x-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] teacher-glow-1 opacity-15 rounded-full blur-[130px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] teacher-glow-2 opacity-10 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Schedule Modal */}
            {showModal && <ScheduleModal onClose={() => setShowModal(false)} onSuccess={fetchMeetings} />}

            {/* ── Top Nav ── */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/30 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-3">
                    <HiOutlineAcademicCap className="text-2xl text-primary" />
                    <span className="text-lg font-bold text-foreground">EduStream</span>
                    <span className="hidden sm:flex text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-medium items-center gap-1">
                        <BsPersonBadge /> Teacher Portal
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {session?.user?.image && (
                        <img src={session.user.image} alt="avatar" className="w-8 h-8 rounded-full border border-border/50" />
                    )}
                    <span className="hidden md:block text-sm text-muted-foreground">{session?.user?.name}</span>
                    {role === 'admin' && (
                        <Button size="sm" variant="outline" onClick={() => router.push('/admin')}>
                            Admin Panel
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</Button>
                </div>
            </nav>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-8">

                {/* ── Welcome Banner ── */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary">
                            Welcome back, {session?.user?.name?.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowModal(true)}
                        className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                    >
                        <BsPlusCircle className="mr-2" /> Schedule Class
                    </Button>
                </div>

                {/* ── Stats Row ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: <BsCalendar3 />, label: 'Total Scheduled', value: meetings.length, color: 'text-primary', bg: 'bg-primary/10' },
                        { icon: <BsClock />, label: 'Upcoming', value: upcomingMeetings.length, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                        { icon: <BsCameraVideo />, label: 'Past Classes', value: meetings.length - upcomingMeetings.length, color: 'text-green-400', bg: 'bg-green-400/10' },
                        { icon: <BsPeopleFill />, label: 'Role', value: role === 'admin' ? 'Admin' : 'Teacher', color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    ].map(({ icon, label, value, color, bg }) => (
                        <div key={label} className="glass-panel rounded-2xl p-5 border border-border/40 flex items-center gap-4">
                            <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center ${color} text-xl`}>{icon}</div>
                            <div>
                                <p className="text-2xl font-extrabold text-foreground">{value}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Quick Actions ── */}
                <div>
                    <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { icon: <BsPlusCircle className="text-2xl" />, label: 'Schedule Class', sub: 'Plan a future session', action: () => setShowModal(true), gradient: 'from-primary to-secondary' },
                            { icon: <BsCameraVideo className="text-2xl" />, label: 'Instant Meeting', sub: 'Start class right now', action: startInstant, gradient: 'from-blue-600 to-blue-400' },
                            { icon: <BsCalendar3 className="text-2xl" />, label: 'Full Schedule', sub: 'View all meetings', action: () => router.push('/schedule'), gradient: 'from-purple-600 to-purple-400' },
                            { icon: <BsGrid3X3Gap className="text-2xl" />, label: 'Create Meeting', sub: 'Generate link & QR', action: () => router.push('/create-meeting'), gradient: 'from-emerald-600 to-emerald-400' },
                        ].map(({ icon, label, sub, action, gradient }) => (
                            <button key={label} onClick={action}
                                className="glass-panel p-5 rounded-2xl border border-border/40 hover:border-primary/40 text-left group transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
                                    {icon}
                                </div>
                                <p className="font-semibold text-sm text-foreground">{label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                                <BsChevronRight className="text-muted-foreground mt-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Upcoming Classes ── */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-foreground">Upcoming Classes</h2>
                        <button onClick={fetchMeetings} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                            <BsArrowRepeat className={isLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="w-6 h-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        </div>
                    ) : upcomingMeetings.length === 0 ? (
                        <div className="glass-panel rounded-2xl border border-border/40 py-12 text-center">
                            <BsCalendar3 className="text-4xl text-primary/30 mx-auto mb-3" />
                            <p className="text-muted-foreground text-sm">No upcoming classes scheduled</p>
                            <Button onClick={() => setShowModal(true)} className="mt-4 bg-gradient-to-r from-primary to-secondary hover:opacity-90" size="sm">
                                <BsPlusCircle className="mr-2" /> Schedule Now
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingMeetings.slice(0, 5).map(meeting => {
                                const countdown = getCountdown(meeting.scheduledAt);
                                return (
                                    <div key={meeting.id} className="glass-panel rounded-2xl border border-border/50 hover:border-primary/40 transition-all p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-semibold text-foreground">{meeting.title}</h3>
                                                    {countdown && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                                            {countdown}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1"><BsCalendar3 className="text-primary" />{formatDateTime(meeting.scheduledAt)}</span>
                                                    <span className="flex items-center gap-1"><BsClock className="text-secondary" />{meeting.duration} min</span>
                                                    <span className="flex items-center gap-1 font-mono"><BsLink45Deg />{meeting.roomId}</span>
                                                </div>
                                                {meeting.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meeting.description}</p>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button onClick={() => copyLink(meeting.roomId, meeting.id)}
                                                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/50 bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground">
                                                    {copiedId === meeting.id ? <BsCheck2 className="text-green-400" /> : <BsClipboard />}
                                                </button>
                                                <button onClick={() => router.push(`/lobby?roomId=${meeting.roomId}`)}
                                                    className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-medium hover:opacity-90 transition-opacity">
                                                    <BsCameraVideo /> Start
                                                </button>
                                                <button onClick={() => deleteMeeting(meeting.id)} disabled={deletingId === meeting.id}
                                                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 transition-colors text-red-400 disabled:opacity-40">
                                                    {deletingId === meeting.id
                                                        ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                                        : <BsTrash />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {upcomingMeetings.length > 5 && (
                                <button onClick={() => router.push('/schedule')}
                                    className="w-full py-3 text-sm text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-2">
                                    View all {upcomingMeetings.length} upcoming meetings <BsChevronRight />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
