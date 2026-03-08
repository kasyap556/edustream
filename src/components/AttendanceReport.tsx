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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-[#1e1e2e] to-[#16162a] border border-purple-400/25 rounded-2xl p-8 w-full max-w-[560px] max-h-[85vh] flex flex-col gap-5 shadow-[0_25px_60px_rgba(0,0,0,0.5)]">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="m-0 text-[22px] font-extrabold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            📋 Meeting Summary
                        </h2>
                        <p className="mt-1 text-muted-foreground text-[13px]">
                            Room: <span className="text-gray-400 font-mono">{roomId}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-white/5 border-none text-gray-400 cursor-pointer rounded-lg w-8 h-8 text-base flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"
                    >✕</button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Duration', value: formatDuration(meetingDuration), icon: '⏱' },
                        { label: 'Participants', value: String(attendees.length), icon: '👥' },
                        { label: 'Date', value: new Date(meetingStartedAt).toLocaleDateString(), icon: '📅' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
                            <div className="text-[22px]">{stat.icon}</div>
                            <div className="text-lg font-bold text-gray-200 mt-1">{stat.value}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Time row */}
                <div className="flex gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-[13px] text-gray-400">
                    <span>🟢 Started: <strong className="text-gray-200">{formatTime(meetingStartedAt)}</strong></span>
                    <span className="text-gray-700">|</span>
                    <span>🔴 Ended: <strong className="text-gray-200">{formatTime(meetingEndedAt)}</strong></span>
                </div>

                {/* Attendee list */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                    <h3 className="m-0 text-[13px] text-gray-500 uppercase tracking-widest">
                        Participants ({attendees.length})
                    </h3>
                    {attendees.length === 0 ? (
                        <div className="text-center text-gray-600 py-5 text-sm">
                            No participants recorded.
                        </div>
                    ) : (
                        attendees.map((a, i) => {
                            const left = a.leftAt ?? meetingEndedAt;
                            const dur = formatDuration(left - a.joinedAt);
                            const initials = a.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                            return (
                                <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5">
                                    <div className="w-9 h-9 rounded-full shrink-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-[13px] font-bold text-white">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-sm text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis">
                                            {a.name}
                                        </div>
                                        <div className="text-[11px] text-gray-500 mt-0.5">
                                            Joined {formatTime(a.joinedAt)}
                                            {a.leftAt ? ` · Left ${formatTime(a.leftAt)}` : ' · Still in meeting'}
                                        </div>
                                    </div>
                                    <div className="text-xs text-purple-400 font-semibold bg-purple-400/10 px-2.5 py-1 rounded-full shrink-0">
                                        {dur}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2.5">
                    <button
                        onClick={handleDownload}
                        className="flex-1 py-2.5 rounded-xl border-none bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity"
                    >
                        ⬇ Download Report
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 font-semibold text-sm cursor-pointer hover:bg-white/10 hover:text-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
