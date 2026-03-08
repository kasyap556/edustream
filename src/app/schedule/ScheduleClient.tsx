'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import {
    BsCalendar3, BsClock, BsPlusCircle, BsTrash, BsCameraVideo,
    BsClipboard, BsCheck2, BsArrowLeft, BsPeopleFill, BsLink45Deg,
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
    createdByName: string;
    createdAt: string;
}

function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function getCountdown(iso: string) {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Now / Past';
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `in ${days}d ${hrs}h`;
    if (hrs > 0) return `in ${hrs}h ${mins}m`;
    return `in ${mins}m`;
}

function isUpcoming(iso: string) {
    return new Date(iso).getTime() > Date.now();
}

export default function ScheduleClient({ initialMeetings }: { initialMeetings: ScheduledMeeting[] }) {
    const router = useRouter();
    const { data: session, status } = useSession();

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [roomId, setRoomId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Meetings list state
    const [meetings, setMeetings] = useState<ScheduledMeeting[]>(initialMeetings);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

    const fetchMeetings = useCallback(async () => {
        try {
            const res = await fetch('/api/schedule');
            if (res.ok) {
                const data = await res.json();
                setMeetings(data.meetings || []);
            }
        } catch (e) {
            console.error('Failed to load meetings', e);
        }
    }, []);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    const generateRoomId = () => {
        setRoomId(Math.random().toString(36).substring(2, 10));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!scheduledDate || !scheduledTime) {
            setFormError('Please pick a date and time.');
            return;
        }
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        if (new Date(scheduledAt) <= new Date()) {
            setFormError('Scheduled time must be in the future.');
            return;
        }
        const finalRoomId = roomId.trim() || Math.random().toString(36).substring(2, 10);

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, description, roomId: finalRoomId, scheduledAt, duration }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || 'Failed to schedule');
            }
            // Reset form
            setTitle(''); setDescription(''); setRoomId('');
            setScheduledDate(''); setScheduledTime(''); setDuration(60);
            setShowForm(false);
            fetchMeetings();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
            setMeetings((prev) => prev.filter((m) => m.id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    const copyLink = async (roomId: string, id: string) => {
        const link = `${window.location.origin}/lobby?roomId=${roomId}`;
        await navigator.clipboard.writeText(link);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const upcomingMeetings = meetings.filter((m) => isUpcoming(m.scheduledAt));
    const pastMeetings = meetings.filter((m) => !isUpcoming(m.scheduledAt));
    const displayedMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

    // Minimum datetime for the date input (now)
    const minDate = new Date().toISOString().split('T')[0];
    const minTime = scheduledDate === minDate
        ? new Date(Date.now() + 60000).toTimeString().slice(0, 5)
        : '00:00';

    return (
        <div className="teacher-theme min-h-screen bg-background relative overflow-x-hidden">

            {/* Background glows */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[130px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Top Nav */}
            <nav className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border/30 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.push('/')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <BsArrowLeft />
                        <HiOutlineAcademicCap className="text-2xl text-primary" />
                        <span className="font-bold text-foreground">EduStream</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                        <BsPeopleFill className="text-primary" />
                        <span>{session?.user?.name?.split(' ')[0] || session?.user?.email}</span>
                    </div>
                    <Button
                        onClick={() => { setShowForm(true); setFormError(null); }}
                        className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                        size="sm"
                    >
                        <BsPlusCircle className="mr-1.5" />
                        <span className="hidden sm:inline">Schedule Meeting</span>
                        <span className="sm:hidden">Schedule</span>
                    </Button>
                </div>
            </nav>

            <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary">
                        Meeting Schedule
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Plan and manage upcoming classroom sessions</p>
                </div>

                {/* Schedule Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="glass-panel w-full max-w-lg rounded-2xl border border-border/50 shadow-2xl p-8">
                            <h2 className="text-2xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                                Schedule a New Meeting
                            </h2>

                            {formError && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-lg text-sm text-red-400">
                                    {formError}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Meeting Title *</label>
                                    <input
                                        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                        placeholder="e.g., Math Class — Chapter 5"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Description (optional)</label>
                                    <textarea
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                                        placeholder="Topics covered, materials needed…"
                                        rows={2}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                {/* Room ID */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Room ID</label>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
                                            placeholder="Auto-generated if empty"
                                            value={roomId}
                                            onChange={(e) => setRoomId(e.target.value)}
                                        />
                                        <Button type="button" variant="outline" size="sm" onClick={generateRoomId}>
                                            Generate
                                        </Button>
                                    </div>
                                </div>

                                {/* Date & Time */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1">Date *</label>
                                        <input
                                            type="date"
                                            min={minDate}
                                            className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                            value={scheduledDate}
                                            onChange={(e) => setScheduledDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-muted-foreground mb-1">Time *</label>
                                        <input
                                            type="time"
                                            min={minTime}
                                            className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                                            value={scheduledTime}
                                            onChange={(e) => setScheduledTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Duration */}
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                                        Duration: <span className="text-primary font-semibold">{duration} min</span>
                                    </label>
                                    <input
                                        type="range"
                                        min={15} max={180} step={15}
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        className="w-full accent-primary"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>15 min</span><span>1 h</span><span>3 h</span>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="flex-1 border border-border/50"
                                        onClick={() => setShowForm(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                                        isLoading={isSubmitting}
                                    >
                                        <BsCalendar3 className="mr-2" />
                                        Schedule
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl border border-border/40 w-fit">
                    {(['upcoming', 'past'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab === 'upcoming' ? `Upcoming (${upcomingMeetings.length})` : `Past (${pastMeetings.length})`}
                        </button>
                    ))}
                </div>

                {/* Meetings List */}
                {displayedMeetings.length === 0 ? (
                    <div className="glass-panel rounded-2xl border border-border/40 p-16 text-center">
                        <BsCalendar3 className="text-5xl text-primary/40 mx-auto mb-4" />
                        <p className="text-lg font-semibold text-foreground">
                            {activeTab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {activeTab === 'upcoming' ? 'Click "Schedule Meeting" to get started.' : 'Completed meetings will appear here.'}
                        </p>
                        {activeTab === 'upcoming' && (
                            <Button
                                onClick={() => setShowForm(true)}
                                className="mt-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                            >
                                <BsPlusCircle className="mr-2" />
                                Schedule Now
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayedMeetings.map((meeting) => {
                            const upcoming = isUpcoming(meeting.scheduledAt);
                            return (
                                <div
                                    key={meeting.id}
                                    className={`glass-panel rounded-2xl border p-6 transition-all hover:border-primary/40 ${upcoming ? 'border-border/50' : 'border-border/20 opacity-70'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Title row */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-lg font-bold text-foreground truncate">{meeting.title}</h3>
                                                {upcoming && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium border border-primary/30">
                                                        {getCountdown(meeting.scheduledAt)}
                                                    </span>
                                                )}
                                                {!upcoming && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30">
                                                        Ended
                                                    </span>
                                                )}
                                            </div>

                                            {/* Description */}
                                            {meeting.description && (
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{meeting.description}</p>
                                            )}

                                            {/* Meta row */}
                                            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <BsCalendar3 className="text-primary" />
                                                    {formatDateTime(meeting.scheduledAt)}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <BsClock className="text-secondary" />
                                                    {meeting.duration} min
                                                </span>
                                                <span className="flex items-center gap-1.5 font-mono text-xs">
                                                    <BsLink45Deg className="text-primary/70" />
                                                    {meeting.roomId}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions — wrap under title on mobile */}
                                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                            <button
                                                onClick={() => copyLink(meeting.roomId, meeting.id)}
                                                title="Copy meeting link"
                                                className="h-9 w-9 flex items-center justify-center rounded-lg border border-border/50 bg-white/5 hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
                                            >
                                                {copiedId === meeting.id ? <BsCheck2 className="text-green-400" /> : <BsClipboard />}
                                            </button>
                                            {upcoming && (
                                                <button
                                                    onClick={() => router.push(`/lobby?roomId=${meeting.roomId}`)}
                                                    title="Start meeting"
                                                    className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium hover:opacity-90 transition-opacity"
                                                >
                                                    <BsCameraVideo />
                                                    <span>Start</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(meeting.id)}
                                                disabled={deletingId === meeting.id}
                                                title="Delete"
                                                className="h-9 w-9 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 transition-colors text-red-400 disabled:opacity-40"
                                            >
                                                {deletingId === meeting.id
                                                    ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                                    : <BsTrash />
                                                }
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
