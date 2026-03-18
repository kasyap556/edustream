'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { HiOutlineAcademicCap } from 'react-icons/hi';
import { useRouter } from 'next/navigation';
import {
  BsPersonFill, BsMortarboardFill, BsArrowRight, BsCheckCircleFill,
  BsShieldLockFill, BsEnvelopeFill
} from 'react-icons/bs';

type Step = 'role' | 'google' | 'profile' | 'done';
type Role = 'student' | 'teacher';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [admissionNo, setAdmissionNo] = useState('');
  const [teacherIdNo, setTeacherIdNo] = useState('');
  const [college, setCollege] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // When user signs in with Google, move to profile step
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      // Check if profile already exists
      fetch('/api/user/profile')
        .then(r => r.json())
        .then(data => {
          if (data.profileComplete) {
            router.replace('/');
          } else {
            setStep('profile');
            setContactEmail(session.user?.email || '');
          }
        })
        .catch(() => {
          setStep('profile');
          setContactEmail(session.user?.email || '');
        });
    }
  }, [status, session, router]);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep('google');
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl: '/login' });
    } catch (err) {
      console.error('Google sign in error:', err);
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole && status !== 'authenticated') return;

    const role = selectedRole || 'student';
    if (role === 'student' && !admissionNo.trim()) {
      setError('Admission number is required for students.');
      return;
    }
    if (role === 'teacher' && !teacherIdNo.trim()) {
      setError('Teacher ID number is required.');
      return;
    }
    if (!college.trim()) {
      setError('College/Institution name is required.');
      return;
    }

    setIsSavingProfile(true);
    setError(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          admissionNo: role === 'student' ? admissionNo : undefined,
          teacherIdNo: role === 'teacher' ? teacherIdNo : undefined,
          college,
          contactEmail,
          department,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save profile');
      }

      setStep('done');
      setTimeout(() => router.replace('/'), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-x-hidden">

      {/* Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] bg-violet-600/15 rounded-full blur-[140px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-3xl shadow-2xl border border-border/50 flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg">
            <HiOutlineAcademicCap className="text-3xl text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-foreground">EduStream</span>
          <p className="text-sm text-muted-foreground text-center">Academic Video Hub</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 w-full justify-center">
          {(['role', 'google', 'profile', 'done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                ${step === s ? 'bg-violet-600 text-white scale-110' :
                  ['role', 'google', 'profile', 'done'].indexOf(step) > i
                    ? 'bg-violet-600/30 text-violet-400' : 'bg-white/10 text-muted-foreground'}`}>
                {['role', 'google', 'profile', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 3 && <div className={`w-8 h-0.5 transition-colors duration-300
                ${['role', 'google', 'profile', 'done'].indexOf(step) > i ? 'bg-violet-600/50' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="w-full border-t border-border/40" />

        {/* Error */}
        {error && (
          <div className="w-full p-3 bg-red-500/10 border border-red-500/40 rounded-xl text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {/* === STEP 1: Role Selection === */}
        {step === 'role' && (
          <div className="w-full flex flex-col gap-4">
            <h2 className="text-lg font-bold text-center">Who are you?</h2>
            <p className="text-sm text-muted-foreground text-center -mt-2">Select your role to get started</p>

            <button
              id="role-student-btn"
              onClick={() => handleRoleSelect('student')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border border-violet-500/30 bg-violet-600/10 hover:bg-violet-600/20 hover:border-violet-400/60 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <BsPersonFill className="text-xl text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-foreground">I&apos;m a Student</p>
                <p className="text-xs text-muted-foreground mt-0.5">Join classes, attend scheduled meetings</p>
              </div>
              <BsArrowRight className="ml-auto text-violet-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              id="role-teacher-btn"
              onClick={() => handleRoleSelect('teacher')}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border border-emerald-500/30 bg-emerald-600/10 hover:bg-emerald-600/20 hover:border-emerald-400/60 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <BsMortarboardFill className="text-xl text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-foreground">I&apos;m a Teacher</p>
                <p className="text-xs text-muted-foreground mt-0.5">Create classes, manage students</p>
              </div>
              <BsArrowRight className="ml-auto text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* === STEP 2: Google Sign-In === */}
        {step === 'google' && (
          <div className="w-full flex flex-col gap-5">
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3
                ${selectedRole === 'teacher' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-violet-500/15 text-violet-400 border border-violet-500/30'}`}>
                {selectedRole === 'teacher' ? <BsMortarboardFill /> : <BsPersonFill />}
                {selectedRole === 'teacher' ? 'Teacher Account' : 'Student Account'}
              </div>
              <h2 className="text-lg font-bold">Sign in with Google</h2>
              <p className="text-sm text-muted-foreground mt-1">We&apos;ll use your Google account to verify your identity</p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-border/30 flex items-start gap-3">
              <BsShieldLockFill className="text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Your Google account is only used for authentication. We don&apos;t store your Google password.</p>
            </div>

            <button
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border/60 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all duration-200 font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
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

            <button
              onClick={() => { setStep('role'); setError(null); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              ← Back to role selection
            </button>
          </div>
        )}

        {/* === STEP 3: Profile Form === */}
        {step === 'profile' && (
          <form onSubmit={handleSaveProfile} className="w-full flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-lg font-bold">Complete Your Profile</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Signed in as <span className="text-foreground font-medium">{session?.user?.name}</span>
              </p>
            </div>

            {/* Role toggle (in case someone skipped role selection) */}
            <div className="flex gap-2">
              {(['student', 'teacher'] as Role[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setSelectedRole(r); setError(null); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize
                    ${(selectedRole || 'student') === r
                      ? r === 'teacher' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-violet-600/20 border-violet-500/50 text-violet-400'
                      : 'bg-white/5 border-border/30 text-muted-foreground hover:bg-white/10'}`}
                >
                  {r === 'teacher' ? '🎓' : '🎒'} {r}
                </button>
              ))}
            </div>

            {/* Student: Admission No */}
            {(selectedRole === 'student' || !selectedRole) && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Admission Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="admission-no-input"
                  type="text"
                  placeholder="e.g. ADM2024001"
                  value={admissionNo}
                  onChange={e => setAdmissionNo(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                />
              </div>
            )}

            {/* Teacher: Teacher ID */}
            {selectedRole === 'teacher' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Teacher / Staff ID Number <span className="text-red-400">*</span>
                </label>
                <input
                  id="teacher-id-input"
                  type="text"
                  placeholder="e.g. TCH2024042"
                  value={teacherIdNo}
                  onChange={e => setTeacherIdNo(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
                />
              </div>
            )}

            {/* College */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                College / Institution Name <span className="text-red-400">*</span>
              </label>
              <input
                id="college-input"
                type="text"
                placeholder="e.g. Amal Jyothi College of Engineering"
                value={college}
                onChange={e => setCollege(e.target.value)}
                required
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
              />
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Department / Branch
              </label>
              <input
                id="department-input"
                type="text"
                placeholder="e.g. Computer Science & Engineering"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
              />
            </div>

            {/* Contact Gmail */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <BsEnvelopeFill className="text-violet-400" />
                Contact Gmail <span className="text-muted-foreground font-normal">(for notifications)</span>
              </label>
              <input
                id="contact-email-input"
                type="email"
                placeholder="your.email@gmail.com"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Used to receive group notifications and updates</p>
            </div>

            <button
              id="save-profile-btn"
              type="submit"
              disabled={isSavingProfile}
              className={`w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all
                ${selectedRole === 'teacher'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400'}
                text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSavingProfile ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : null}
              {isSavingProfile ? 'Saving…' : 'Complete Registration'}
            </button>
          </form>
        )}

        {/* === STEP 4: Done === */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <BsCheckCircleFill className="text-3xl text-green-400" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold">Welcome to EduStream!</h2>
              <p className="text-sm text-muted-foreground mt-1">Your profile is set up. Redirecting to dashboard…</p>
            </div>
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-violet-500" />
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By continuing, you agree to EduStream&apos;s terms of service.<br />
          Your data is secured and encrypted.
        </p>
      </div>
    </div>
  );
}
