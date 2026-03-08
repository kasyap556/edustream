'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { BsPersonBadge, BsPersonCheck, BsPersonX, BsShieldCheck, BsPeople, BsClock } from 'react-icons/bs';
import { HiOutlineAcademicCap } from 'react-icons/hi';

interface User {
    id: string; // email
    email: string;
    name: string;
    image?: string;
    role: 'student' | 'teacher' | 'admin' | 'pending';
    createdAt: string;
    pendingRequest?: {
        institution: string;
        reason: string;
        requestedAt: string;
    };
}

const ROLE_COLORS: Record<string, string> = {
    student: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    teacher: 'bg-green-500/20 text-green-400 border-green-500/30',
    admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export default function AdminClient({ initialUsers }: { initialUsers: User[] }) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = (session?.user as any)?.role as string;

    const [users, setUsers] = useState<User[]>(initialUsers);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'teacher' | 'student'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (status === 'authenticated' && role !== 'admin') router.push('/?error=admin_only');
    }, [status, role, router]);

    const updateRole = async (email: string, newRole: string) => {
        setUpdatingId(email);
        try {
            await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, role: newRole }),
            });
            setUsers(prev => prev.map(u => u.id === email ? { ...u, role: newRole as any, pendingRequest: undefined } : u));
        } finally {
            setUpdatingId(null);
        }
    };

    const filtered = users
        .filter(u => filter === 'all' || u.role === filter)
        .filter(u => !search || u.email.includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()));

    const stats = {
        total: users.length,
        pending: users.filter(u => u.role === 'pending').length,
        teachers: users.filter(u => u.role === 'teacher').length,
        students: users.filter(u => u.role === 'student').length,
    };

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
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] teacher-glow-1 opacity-10 rounded-full blur-[130px] animate-pulse-slow" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] teacher-glow-2 opacity-10 rounded-full blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            {/* Nav */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-border/30 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-3">
                    <HiOutlineAcademicCap className="text-2xl text-primary" />
                    <span className="text-lg font-bold text-foreground">EduStream</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium flex items-center gap-1">
                        <BsShieldCheck /> Admin Panel
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => router.push('/teacher')}>Teacher Dashboard</Button>
                    <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</Button>
                </div>
            </nav>

            <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-8">
                <div>
                    <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-primary to-secondary">
                        Admin Panel
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage user roles and approve teacher requests</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: <BsPeople />, label: 'Total Users', value: stats.total, color: 'text-foreground', bg: 'bg-white/5' },
                        { icon: <BsClock />, label: 'Pending Requests', value: stats.pending, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
                        { icon: <BsPersonBadge />, label: 'Teachers', value: stats.teachers, color: 'text-green-400', bg: 'bg-green-400/10' },
                        { icon: <BsPersonCheck />, label: 'Students', value: stats.students, color: 'text-blue-400', bg: 'bg-blue-400/10' },
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

                {/* Pending requests banner */}
                {stats.pending > 0 && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center gap-3">
                        <BsClock className="text-yellow-400 text-xl shrink-0" />
                        <p className="text-sm text-yellow-300">
                            <span className="font-bold">{stats.pending} teacher request{stats.pending > 1 ? 's' : ''}</span> awaiting approval.
                        </p>
                        <button onClick={() => setFilter('pending')} className="ml-auto text-xs text-yellow-400 hover:text-yellow-300 underline">View</button>
                    </div>
                )}

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        className="flex-1 min-w-[200px] h-9 px-3 rounded-lg bg-white/5 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-border/40">
                        {(['all', 'pending', 'teacher', 'student'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${filter === f ? 'bg-gradient-to-r from-primary to-secondary text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                {f} {f !== 'all' && `(${users.filter(u => u.role === f).length})`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Users Table */}
                {filtered.length === 0 ? (
                    <div className="glass-panel rounded-2xl border border-border/40 py-12 text-center">
                        <p className="text-muted-foreground text-sm">No users match this filter.</p>
                    </div>
                ) : (
                    <div className="glass-panel rounded-2xl border border-border/40 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/40 text-left">
                                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Request Details</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filtered.map(user => (
                                        <tr key={user.id} className="hover:bg-white/3 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {user.image
                                                        ? <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-border/50" />
                                                        : <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">{user.name?.[0] || user.email[0]}</div>
                                                    }
                                                    <div>
                                                        <p className="font-medium text-foreground text-sm">{user.name || '—'}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-full border font-medium capitalize ${ROLE_COLORS[user.role] || 'bg-white/5 text-foreground border-border/50'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                {user.pendingRequest ? (
                                                    <div className="text-xs text-muted-foreground">
                                                        <p><span className="text-foreground font-medium">Institution:</span> {user.pendingRequest.institution || 'Not specified'}</p>
                                                        <p className="mt-0.5"><span className="text-foreground font-medium">Reason:</span> {user.pendingRequest.reason || 'Not specified'}</p>
                                                    </div>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {user.role === 'pending' && (
                                                        <>
                                                            <button onClick={() => updateRole(user.id, 'teacher')} disabled={updatingId === user.id}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors text-xs font-medium disabled:opacity-40">
                                                                <BsPersonCheck /> Approve
                                                            </button>
                                                            <button onClick={() => updateRole(user.id, 'student')} disabled={updatingId === user.id}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-xs font-medium disabled:opacity-40">
                                                                <BsPersonX /> Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {user.role === 'teacher' && user.email !== session?.user?.email && (
                                                        <button onClick={() => updateRole(user.id, 'student')} disabled={updatingId === user.id}
                                                            className="px-3 py-1.5 rounded-lg bg-white/5 text-muted-foreground border border-border/50 hover:bg-white/10 transition-colors text-xs disabled:opacity-40">
                                                            Revoke
                                                        </button>
                                                    )}
                                                    {user.role === 'student' && (
                                                        <button onClick={() => updateRole(user.id, 'teacher')} disabled={updatingId === user.id}
                                                            className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors text-xs disabled:opacity-40">
                                                            Make Teacher
                                                        </button>
                                                    )}
                                                    {updatingId === user.id && (
                                                        <svg className="w-4 h-4 animate-spin text-primary ml-1" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
