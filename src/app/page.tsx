'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  BsCameraVideo, BsKeyboard, BsCalendar3, BsPersonBadge,
  BsShieldCheck, BsPeopleFill, BsClockHistory, BsLightningChargeFill,
  BsArrowRight, BsBoxArrowRight, BsBell, BsGrid1X2Fill,
  BsPlay, BsLink45Deg, BsChevronRight,
} from 'react-icons/bs';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { useRouter } from 'next/navigation';

/* ─────────────────────────────────────────────────────────────────
   Role-based theme definitions
───────────────────────────────────────────────────────────────── */
const THEMES = {
  student: {
    label: 'Student',
    /** Sidebar active bg */
    sidebarActive: 'bg-violet-600/20 text-violet-400',
    sidebarDot: 'bg-violet-500',
    /** Logo gradient */
    logo: 'from-violet-600 to-indigo-500',
    /** Greeting name gradient */
    greeting: 'from-violet-400 to-indigo-400',
    /** Background orb colors */
    orb1: 'bg-violet-600/15',
    orb2: 'bg-indigo-600/10',
    /** Role badge */
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    /** Avatar */
    avatar: 'from-violet-600 to-indigo-500',
    /** Stat card accent (instant meeting) */
    instantGrad: 'from-violet-600 to-indigo-500',
    /** Instant action card */
    actionInstant: 'from-violet-600/20 to-indigo-500/20 border-violet-500/30',
    /** Join button */
    joinBtn: '',
  },
  teacher: {
    label: 'Teacher',
    sidebarActive: 'bg-emerald-600/20 text-emerald-400',
    sidebarDot: 'bg-emerald-500',
    logo: 'from-emerald-600 to-teal-500',
    greeting: 'from-emerald-400 to-teal-300',
    orb1: 'bg-emerald-600/15',
    orb2: 'bg-teal-600/10',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    avatar: 'from-emerald-600 to-teal-500',
    instantGrad: 'from-emerald-600 to-teal-500',
    actionInstant: 'from-emerald-600/20 to-teal-500/20 border-emerald-500/30',
    joinBtn: 'bg-emerald-600 hover:bg-emerald-500',
  },
  admin: {
    label: 'Admin',
    sidebarActive: 'bg-rose-600/20 text-rose-400',
    sidebarDot: 'bg-rose-500',
    logo: 'from-rose-600 to-orange-500',
    greeting: 'from-rose-400 to-orange-400',
    orb1: 'bg-rose-600/15',
    orb2: 'bg-orange-600/10',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    avatar: 'from-rose-600 to-orange-500',
    instantGrad: 'from-rose-600 to-orange-500',
    actionInstant: 'from-rose-600/20 to-orange-500/20 border-rose-500/30',
    joinBtn: 'bg-rose-600 hover:bg-rose-500',
  },
  pending: {
    label: 'Pending',
    sidebarActive: 'bg-amber-600/20 text-amber-400',
    sidebarDot: 'bg-amber-500',
    logo: 'from-amber-600 to-yellow-500',
    greeting: 'from-amber-400 to-yellow-300',
    orb1: 'bg-amber-600/15',
    orb2: 'bg-yellow-600/10',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    avatar: 'from-amber-600 to-yellow-500',
    instantGrad: 'from-amber-600 to-yellow-500',
    actionInstant: 'from-amber-600/20 to-yellow-500/20 border-amber-500/30',
    joinBtn: 'bg-amber-600 hover:bg-amber-500',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

function getTheme(role?: string) {
  const key = (['student', 'teacher', 'admin', 'pending'] as ThemeKey[])
    .find(k => k === role) ?? 'student';
  return THEMES[key];
}

/* ─────────────────────────────────────────────────────────────────
   Data types & helpers
───────────────────────────────────────────────────────────────── */
interface ScheduledMeeting {
  id: string;
  title: string;
  description?: string;
  roomId: string;
  scheduledAt: string;
  duration: number;
  createdByName: string;
}

function formatRelativeTime(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  const hrs = Math.round(diff / 3600000);
  const days = Math.round(diff / 86400000);
  if (mins < 0) return 'Started';
  if (mins < 60) return `in ${mins}m`;
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${days}d`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isSoon(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return diff > 0 && diff < 15 * 60 * 1000;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */
export default function Home() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const router = useRouter();
  const theme = getTheme(role);

  const [roomId, setRoomId] = useState('');
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Teacher request modal
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [institution, setInstitution] = useState('');
  const [reason, setReason] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestDone, setRequestDone] = useState(false);

  const canTeach = ['teacher', 'admin'].includes(role ?? '');
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const avatarInitials = (session?.user?.name ?? 'G').substring(0, 2).toUpperCase();

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoadingMeetings(true);
    fetch('/api/schedule')
      .then(r => r.json())
      .then(data => {
        const upcoming = (data.meetings ?? [])
          .filter((m: ScheduledMeeting) => new Date(m.scheduledAt) > new Date(Date.now() - 3600000))
          .slice(0, 5);
        setMeetings(upcoming);
      })
      .catch(() => { })
      .finally(() => setLoadingMeetings(false));
  }, [status]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) router.push(`/lobby?roomId=${roomId.trim()}`);
  };

  const handleInstantMeeting = () =>
    router.push(`/lobby?roomId=${Math.random().toString(36).substring(2, 10)}`);

  const handleRequestTeacher = async () => {
    setIsRequesting(true);
    try {
      const res = await fetch('/api/user/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedRole: 'teacher', institution, reason }),
      });
      if (res.ok) { setRequestDone(true); setTimeout(() => router.push('/pending'), 1500); }
    } finally { setIsRequesting(false); }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin border-violet-500" />
          <p className="text-muted-foreground text-sm">Loading EduStream…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">

      {/* ── Themed background orbs ──────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className={`absolute -top-32 -left-32 w-[600px] h-[600px] ${theme.orb1} rounded-full blur-[120px] transition-colors duration-1000`} />
        <div className={`absolute -bottom-32 -right-32 w-[500px] h-[500px] ${theme.orb2} rounded-full blur-[120px] transition-colors duration-1000`} />
        {/* Extra role-specific accent orb */}
        {role === 'admin' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-rose-800/8 rounded-full blur-[80px]" />
        )}
        {role === 'teacher' && (
          <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-emerald-700/10 rounded-full blur-[60px]" />
        )}
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-border/40 bg-card/30 backdrop-blur-md p-5 gap-6 fixed left-0 top-0 bottom-0 z-20">
        {/* Logo — themed */}
        <div className="flex items-center gap-2.5 px-1">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${theme.logo} flex items-center justify-center transition-all duration-700`}>
            <HiOutlineAcademicCap className="text-white text-base" />
          </div>
          <span className="text-lg font-bold tracking-tight">EduStream</span>
        </div>

        {/* Role indicator strip */}
        {role && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${theme.badge} text-xs font-medium transition-all duration-700`}>
            <span className={`w-1.5 h-1.5 rounded-full ${theme.sidebarDot}`} />
            {role === 'admin' ? '🛡️ Administrator' : role === 'teacher' ? '🎓 Teacher' : role === 'pending' ? '⏳ Pending Approval' : '🎒 Student'}
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1">Menu</p>
          <SideLink icon={<BsGrid1X2Fill />} label="Dashboard" active activeClass={theme.sidebarActive} />
          <SideLink icon={<BsCameraVideo />} label="Create Meeting" onClick={() => router.push('/create-meeting')} locked={!canTeach} />
          <SideLink icon={<BsCalendar3 />} label="Schedule" onClick={() => router.push('/schedule')} locked={!canTeach} />
          {canTeach && (
            <SideLink icon={<BsPeopleFill />} label="Teacher Dashboard" onClick={() => router.push('/teacher')} />
          )}
          {role === 'admin' && (
            <SideLink icon={<BsShieldCheck />} label="Admin Panel" onClick={() => router.push('/admin')} />
          )}
        </nav>

        {/* User card */}
        {status === 'authenticated' && (
          <div className="border-t border-border/40 pt-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${theme.avatar} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-all duration-700`}>
                {avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session?.user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{theme.label}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Sign out"
              >
                <BsBoxArrowRight className="text-base" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-[1200px]">

        {/* Top bar */}
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              {getGreeting()},&nbsp;
              <span className={`bg-clip-text text-transparent bg-gradient-to-r ${theme.greeting} transition-all duration-700`}>
                {firstName}
              </span>
              &nbsp;👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {role === 'student' && (
              <Button variant="ghost" size="sm" className="border border-border/50 hidden sm:flex"
                onClick={() => setShowTeacherModal(true)}>
                <BsPersonBadge className="mr-1.5" /> Apply as Teacher
              </Button>
            )}
            {role === 'admin' && (
              <Button variant="ghost" size="sm"
                className="border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hidden sm:flex"
                onClick={() => router.push('/admin')}>
                <BsShieldCheck className="mr-1.5" /> Admin Panel
              </Button>
            )}
            {role === 'teacher' && (
              <Button variant="ghost" size="sm"
                className="border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hidden sm:flex"
                onClick={() => router.push('/teacher')}>
                <BsPeopleFill className="mr-1.5" /> Teacher Dashboard
              </Button>
            )}
            <button className="relative p-2.5 rounded-xl bg-card/60 border border-border/40 hover:bg-white/10 transition-colors">
              <BsBell className="text-muted-foreground" />
              {meetings.some(m => isSoon(m.scheduledAt)) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* ── Stats row ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<BsCameraVideo />}
            label="Instant Meeting"
            value="Start Now"
            gradient={theme.instantGrad}
            onClick={handleInstantMeeting}
            clickable
          />
          <StatCard
            icon={<BsCalendar3 />}
            label="Scheduled"
            value={`${meetings.length} upcoming`}
            gradient={canTeach ? 'from-emerald-600 to-teal-500' : 'from-slate-600 to-slate-500'}
            onClick={canTeach ? () => router.push('/schedule') : undefined}
            clickable={canTeach}
          />
          <StatCard
            icon={role === 'admin' ? <BsShieldCheck /> : role === 'teacher' ? <BsPeopleFill /> : <BsPersonBadge />}
            label="Your Role"
            value={theme.label}
            gradient={
              role === 'admin' ? 'from-rose-600 to-orange-500' :
                role === 'teacher' ? 'from-emerald-600 to-teal-500' :
                  role === 'pending' ? 'from-amber-600 to-yellow-500' :
                    'from-violet-600 to-indigo-500'
            }
          />
          <StatCard
            icon={<BsClockHistory />}
            label="Server"
            value="Online"
            gradient="from-sky-500 to-blue-600"
          />
        </div>

        {/* ── Two-column body ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left — actions + join */}
          <div className="lg:col-span-3 flex flex-col gap-6">

            <section className="glass-panel rounded-2xl p-6 border border-border/40">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <BsLightningChargeFill className="text-amber-400" /> Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ActionCard
                  icon={<BsCameraVideo className="text-xl" />}
                  title="Instant Meeting"
                  desc="Jump into a new room instantly"
                  gradient={theme.actionInstant}
                  onClick={handleInstantMeeting}
                />
                <ActionCard
                  icon={<BsLink45Deg className="text-xl" />}
                  title="Create & Share"
                  desc="Generate a link with QR code"
                  gradient={canTeach ? 'from-emerald-500/20 to-teal-400/20 border-emerald-500/30' : 'from-white/5 to-white/5 border-white/10'}
                  onClick={canTeach ? () => router.push('/create-meeting') : undefined}
                  locked={!canTeach}
                />
                <ActionCard
                  icon={<BsCalendar3 className="text-xl" />}
                  title="Schedule Class"
                  desc="Plan a future session"
                  gradient={canTeach ? 'from-amber-500/20 to-orange-400/20 border-amber-500/30' : 'from-white/5 to-white/5 border-white/10'}
                  onClick={canTeach ? () => router.push('/schedule') : undefined}
                  locked={!canTeach}
                />
                <ActionCard
                  icon={role === 'admin'
                    ? <BsShieldCheck className="text-xl" />
                    : <BsPeopleFill className="text-xl" />}
                  title={role === 'admin' ? 'Admin Panel' : 'Teacher Dashboard'}
                  desc={role === 'admin' ? 'Manage roles & users' : 'View your sessions'}
                  gradient={
                    role === 'admin'
                      ? 'from-rose-500/20 to-orange-400/20 border-rose-500/30'
                      : canTeach
                        ? 'from-sky-500/20 to-blue-400/20 border-sky-500/30'
                        : 'from-white/5 to-white/5 border-white/10'
                  }
                  onClick={role === 'admin'
                    ? () => router.push('/admin')
                    : canTeach ? () => router.push('/teacher') : undefined}
                  locked={!canTeach && role !== 'admin'}
                />
              </div>
            </section>

            {/* Join with code */}
            <section className="glass-panel rounded-2xl p-6 border border-border/40">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <BsKeyboard className="text-muted-foreground" /> Join a Class
              </h2>
              <form onSubmit={handleJoin} className="flex gap-3">
                <Input
                  placeholder="Enter room code  e.g. bio-101"
                  value={roomId}
                  onChange={e => setRoomId(e.target.value)}
                  className="flex-1 tracking-wider"
                />
                <Button type="submit" disabled={!roomId.trim()} className={`px-5 gap-2 whitespace-nowrap ${theme.joinBtn}`}>
                  Join <BsArrowRight />
                </Button>
              </form>
            </section>
          </div>

          {/* Right — upcoming meetings */}
          <div className="lg:col-span-2">
            <section className="glass-panel rounded-2xl p-6 border border-border/40 flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <BsCalendar3 className={
                    role === 'admin' ? 'text-rose-400' :
                      role === 'teacher' ? 'text-emerald-400' :
                        'text-violet-400'
                  } />
                  Upcoming
                </h2>
                {canTeach && (
                  <button onClick={() => router.push('/schedule')}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    View all <BsChevronRight className="text-[10px]" />
                  </button>
                )}
              </div>

              {loadingMeetings ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className={`w-7 h-7 border-2 border-t-transparent rounded-full animate-spin
                    ${role === 'admin' ? 'border-rose-500' : role === 'teacher' ? 'border-emerald-500' : 'border-violet-500'}`} />
                </div>
              ) : meetings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center
                    ${role === 'admin' ? 'bg-rose-500/10' : role === 'teacher' ? 'bg-emerald-500/10' : 'bg-violet-500/10'}`}>
                    <BsCalendar3 className={`text-2xl
                      ${role === 'admin' ? 'text-rose-400/50' : role === 'teacher' ? 'text-emerald-400/50' : 'text-violet-400/50'}`} />
                  </div>
                  <p className="text-sm text-muted-foreground">No upcoming meetings</p>
                  {canTeach && (
                    <Button size="sm" variant="ghost" className="border border-border/50 text-xs"
                      onClick={() => router.push('/schedule')}>
                      Schedule one
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 overflow-y-auto max-h-[420px] pr-1">
                  {meetings.map(m => (
                    <MeetingCard
                      key={m.id}
                      meeting={m}
                      role={role}
                      onJoin={() => router.push(`/lobby?roomId=${m.roomId}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="mt-12 text-center text-xs text-muted-foreground/40">
          © 2025 EduStream Academic Platform · Secure & Encrypted
        </footer>
      </main>

      {/* ── Teacher Request Modal ──────────────────────────────── */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-8">
            <h2 className="text-xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
              Request Teacher Access
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Fill in your details. An admin will review and approve your request.
            </p>
            {requestDone ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <BsPersonBadge className="text-3xl text-green-400" />
                </div>
                <p className="font-semibold">Request Submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecting…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Institution / College Name</label>
                  <input
                    className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                    placeholder="e.g., AJCE, MG University"
                    value={institution}
                    onChange={e => setInstitution(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Why do you need teacher access?</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm resize-none"
                    rows={3}
                    placeholder="I am a faculty member teaching…"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1 border border-border/50" onClick={() => setShowTeacherModal(false)}>Cancel</Button>
                  <Button className="flex-1" isLoading={isRequesting} onClick={handleRequestTeacher}>Submit Request</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────── */

function SideLink({ icon, label, active, activeClass, onClick, locked }: {
  icon: React.ReactNode; label: string; active?: boolean;
  activeClass?: string; onClick?: () => void; locked?: boolean;
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left
        ${active ? (activeClass ?? 'bg-violet-600/20 text-violet-400') : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'}
        ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="text-base">{icon}</span>
      {label}
      {locked && <span className="ml-auto text-[10px] text-amber-400/70">🔒</span>}
    </button>
  );
}

function StatCard({ icon, label, value, gradient, onClick, clickable }: {
  icon: React.ReactNode; label: string; value: string;
  gradient: string; onClick?: () => void; clickable?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-xl p-4 border border-border/40 flex flex-col gap-2 transition-all
        ${clickable ? 'cursor-pointer hover:border-white/20 hover:scale-[1.02]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold mt-0.5 capitalize">{value}</p>
      </div>
    </div>
  );
}

function ActionCard({ icon, title, desc, gradient, onClick, locked }: {
  icon: React.ReactNode; title: string; desc: string;
  gradient: string; onClick?: () => void; locked?: boolean;
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`relative flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br ${gradient}
        text-left transition-all group border
        ${locked ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-lg cursor-pointer'}`}
    >
      <div className="mt-0.5 text-foreground/70 group-hover:text-foreground transition-colors">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      {locked && <span className="absolute top-2 right-2 text-[10px] text-amber-400">🔒</span>}
      {!locked && <BsChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
    </button>
  );
}

function MeetingCard({ meeting, role, onJoin }: { meeting: ScheduledMeeting; role?: string; onJoin: () => void }) {
  const soon = isSoon(meeting.scheduledAt);
  const relative = formatRelativeTime(meeting.scheduledAt);
  const accentText = role === 'admin' ? 'text-rose-400' : role === 'teacher' ? 'text-emerald-400' : 'text-violet-400';
  const accentBadge = role === 'admin' ? 'bg-rose-500/15 text-rose-300' : role === 'teacher' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-violet-500/15 text-violet-300';

  return (
    <div className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all
      ${soon ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/30 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{meeting.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(meeting.scheduledAt)}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0
          ${soon ? 'bg-amber-500/20 text-amber-400' : accentBadge}`}>
          {relative}
        </span>
      </div>
      {meeting.description && (
        <p className="text-xs text-muted-foreground/70 line-clamp-1">{meeting.description}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/50">{meeting.duration} min</span>
        <button onClick={onJoin}
          className={`flex items-center gap-1.5 text-xs font-medium ${accentText} hover:opacity-80 transition-colors`}>
          <BsPlay /> Join
        </button>
      </div>
    </div>
  );
}
