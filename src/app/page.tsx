'use client';

import React, { useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BsCameraVideo, BsKeyboard, BsCalendar3, BsPersonBadge, BsShieldCheck } from 'react-icons/bs';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const [roomId, setRoomId] = React.useState('');
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [institution, setInstitution] = useState('');
  const [reason, setReason] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) router.push(`/lobby?roomId=${roomId}`);
  };
  const handleStartInstantMeeting = () => router.push(`/lobby?roomId=${Math.random().toString(36).substring(2, 10)}`);
  const handleCreateMeeting = () => router.push('/create-meeting');
  const handleScheduleMeeting = () => router.push('/schedule');

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-x-hidden">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Teacher Request Modal */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-8">
            <h2 className="text-xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
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
                <p className="font-semibold text-foreground">Request Submitted!</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecting to status page…</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Institution / College Name</label>
                  <input className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    placeholder="e.g., AJCE, MG University" value={institution} onChange={e => setInstitution(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Why do you need teacher access?</label>
                  <textarea className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                    rows={3} placeholder="I am a faculty member teaching…" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" className="flex-1 border border-border/50" onClick={() => setShowTeacherModal(false)}>Cancel</Button>
                  <Button className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90" isLoading={isRequesting} onClick={handleRequestTeacher}>
                    Submit Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <nav className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-primary">
          <HiOutlineAcademicCap className="text-3xl" />
          <span className="text-xl font-bold tracking-tight text-foreground">EduStream</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'authenticated' ? (
            <>
              {/* Role badge */}
              {role === 'teacher' && (
                <Button variant="ghost" size="sm" className="border border-green-500/30 text-green-400 hover:bg-green-500/10"
                  onClick={() => router.push('/teacher')}>
                  <BsPersonBadge className="mr-1.5" /> Teacher Dashboard
                </Button>
              )}
              {role === 'admin' && (
                <Button variant="ghost" size="sm" className="border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  onClick={() => router.push('/admin')}>
                  <BsShieldCheck className="mr-1.5" /> Admin Panel
                </Button>
              )}
              {role === 'pending' && (
                <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">
                  ⏳ Approval Pending
                </span>
              )}
              {role === 'student' && (
                <Button variant="ghost" size="sm" className="hidden sm:flex border border-border/50"
                  onClick={() => setShowTeacherModal(true)}>
                  <BsPersonBadge className="mr-1.5" /> Apply as Teacher
                </Button>
              )}
              <span className="text-sm font-medium text-muted-foreground hidden md:block">
                {session.user?.name?.split(' ')[0]}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>Sign Out</Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => signIn('google', { callbackUrl: '/' })}>
              Sign In
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="z-10 max-w-4xl w-full text-center space-y-8 animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50 pb-2">
          Premium Video Learning <br /> for Modern Institutions.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Secure, domain-restricted video conferencing designed for academic excellence.
          Seamlessly collaborate with advanced presentation tools.
        </p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-12">

          {/* Create Meeting Card — Teacher Only */}
          {(() => {
            const canTeach = ['teacher', 'admin'].includes(role ?? '');
            const isGuest = status !== 'authenticated';
            const locked = !canTeach;
            return (
              <div
                className={`glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 w-full md:w-72 transition-all relative
                  ${locked ? 'opacity-50 cursor-not-allowed border-border/20' : 'hover:border-primary/50 cursor-pointer group'}`}
                onClick={locked ? undefined : handleCreateMeeting}
                title={locked ? 'Teacher access required' : ''}
              >
                {locked && (
                  <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    🔒 Teachers Only
                  </span>
                )}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform
                  ${locked ? 'bg-white/5' : 'bg-gradient-to-br from-primary to-secondary group-hover:scale-110'}`}>
                  <BsCameraVideo className={`text-3xl ${locked ? 'text-muted-foreground' : 'text-white'}`} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Create Meeting</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {locked ? (isGuest ? 'Sign in as teacher' : 'Apply for teacher access') : 'Generate shareable link & QR code'}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Schedule Meeting Card — Teacher Only */}
          {(() => {
            const canTeach = ['teacher', 'admin'].includes(role ?? '');
            const isGuest = status !== 'authenticated';
            const locked = !canTeach;
            return (
              <div
                className={`glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 w-full md:w-72 transition-all relative
                  ${locked ? 'opacity-50 cursor-not-allowed border-border/20' : 'hover:border-green-500/50 cursor-pointer group'}`}
                onClick={locked ? undefined : handleScheduleMeeting}
                title={locked ? 'Teacher access required' : ''}
              >
                {locked && (
                  <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    🔒 Teachers Only
                  </span>
                )}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform
                  ${locked ? 'bg-white/5' : 'bg-gradient-to-br from-green-600 to-emerald-500 group-hover:scale-110'}`}>
                  <BsCalendar3 className={`text-3xl ${locked ? 'text-muted-foreground' : 'text-white'}`} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Schedule Meeting</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {locked ? (isGuest ? 'Sign in as teacher' : 'Apply for teacher access') : 'Plan & manage future sessions'}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Instant Meeting Card — Everyone */}
          <div className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 w-full md:w-72 hover:border-primary/50 transition-colors group cursor-pointer" onClick={handleStartInstantMeeting}>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BsCameraVideo className="text-3xl text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold">Instant Meeting</h3>
              <p className="text-sm text-muted-foreground mt-1">Start a quick class session</p>
            </div>
          </div>

          {/* Join Meeting Card — Everyone */}
          <form onSubmit={handleJoin} className="glass-panel p-8 rounded-2xl flex flex-col items-center gap-4 w-full md:w-80 hover:border-accent/50 transition-colors">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <BsKeyboard className="text-3xl text-foreground/70" />
            </div>
            <div className="w-full space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-bold">Join Class</h3>
                <p className="text-sm text-muted-foreground mt-1">Enter code to join</p>
              </div>
              <div className="flex item-center gap-2">
                <Input
                  placeholder="e.g. bio-101"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="text-center tracking-wider"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full" disabled={!roomId.trim()}>
                Enter Room
              </Button>
            </div>
          </form>

        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground">
        © 2024 EduStream Academic Platform. Secure & Encrypted.
      </footer>
    </main>
  );
}
