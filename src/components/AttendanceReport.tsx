'use client';

import React from 'react';

export interface AttendeeRecord {
    name: string;
    joinedAt: number;
    leftAt?: number;
}

interface AttendanceReportProps {
    roomId: string;
    attendees: AttendeeRecord[];
    meetingStartedAt: number;
    meetingEndedAt: number;
    onClose: () => void;
}

function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

export const AttendanceReport: React.FC<AttendanceReportProps> = ({
    roomId,
    attendees,
    meetingStartedAt,
    meetingEndedAt,
    onClose,
}) => {
    const meetingDuration = meetingEndedAt - meetingStartedAt;

    const handleDownload = () => {
        const lines = [
            `EduStream — Meeting Attendance Report`,
            `Room ID: ${roomId}`,
            `Date: ${new Date(meetingStartedAt).toLocaleDateString()}`,
            `Started: ${formatTime(meetingStartedAt)}`,
            `Ended: ${formatTime(meetingEndedAt)}`,
            `Duration: ${formatDuration(meetingDuration)}`,
            `Total Participants: ${attendees.length}`,
            ``,
            `# Participant List`,
            `Name | Joined At | Left At | Duration`,
            ...attendees.map(a => {
                const left = a.leftAt ?? meetingEndedAt;
                const dur = formatDuration(left - a.joinedAt);
                return `${a.name} | ${formatTime(a.joinedAt)} | ${a.leftAt ? formatTime(a.leftAt) : 'Still in meeting'} | ${dur}`;
            }),
        ];
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${roomId}_${new Date(meetingStartedAt).toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e1e2e 0%, #16162a 100%)',
                border: '1px solid rgba(167,139,250,0.25)',
                borderRadius: 20,
                padding: '32px',
                width: '100%',
                maxWidth: 560,
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            margin: 0, fontSize: 22, fontWeight: 800,
                            background: 'linear-gradient(90deg, #a78bfa, #60a5fa)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            📋 Meeting Summary
                        </h2>
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
                            Room: <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{roomId}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: 'none',
                            color: '#9ca3af', cursor: 'pointer', borderRadius: 8,
                            width: 32, height: 32, fontSize: 16, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >✕</button>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                        { label: 'Duration', value: formatDuration(meetingDuration), icon: '⏱' },
                        { label: 'Participants', value: String(attendees.length), icon: '👥' },
                        { label: 'Date', value: new Date(meetingStartedAt).toLocaleDateString(), icon: '📅' },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 12, padding: '14px 16px', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: 22 }}>{stat.icon}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginTop: 4 }}>{stat.value}</div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Time row */}
                <div style={{
                    display: 'flex', gap: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '10px 16px',
                    fontSize: 13, color: '#9ca3af',
                }}>
                    <span>🟢 Started: <strong style={{ color: '#e5e7eb' }}>{formatTime(meetingStartedAt)}</strong></span>
                    <span style={{ color: '#374151' }}>|</span>
                    <span>🔴 Ended: <strong style={{ color: '#e5e7eb' }}>{formatTime(meetingEndedAt)}</strong></span>
                </div>

                {/* Attendee list */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 13, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Participants ({attendees.length})
                    </h3>
                    {attendees.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#4b5563', padding: '20px 0', fontSize: 14 }}>
                            No participants recorded.
                        </div>
                    ) : (
                        attendees.map((a, i) => {
                            const left = a.leftAt ?? meetingEndedAt;
                            const dur = formatDuration(left - a.joinedAt);
                            const initials = a.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, padding: '10px 14px',
                                }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                        background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 700, color: '#fff',
                                    }}>{initials}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {a.name}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                            Joined {formatTime(a.joinedAt)}
                                            {a.leftAt ? ` · Left ${formatTime(a.leftAt)}` : ' · Still in meeting'}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: 12, color: '#a78bfa', fontWeight: 600,
                                        background: 'rgba(167,139,250,0.1)', padding: '3px 10px', borderRadius: 20,
                                        flexShrink: 0,
                                    }}>
                                        {dur}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={handleDownload}
                        style={{
                            flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
                            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        }}
                    >
                        ⬇ Download Report
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '11px 0', borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: '#9ca3af', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
