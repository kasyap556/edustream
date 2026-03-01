'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import styles from './room.module.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    BsSend, BsPaperclip,
    BsFilePdf, BsFileEarmarkPpt, BsDownload,
    BsMicMute, BsCameraVideoOff,
} from 'react-icons/bs';
import { useSocket } from '@/contexts/SocketContext';
import { useSession } from 'next-auth/react';
import { RoomControls } from '@/components/RoomControls';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useRecording } from '@/hooks/useRecording';
import { VideoTile } from '@/components/VideoTile';
import { Whiteboard } from '@/components/Whiteboard';
import { AttendanceReport, AttendeeRecord } from '@/components/AttendanceReport';

interface Participant {
    id: string;
    name: string;
    isMuted: boolean;
    isCamOff: boolean;
    isHandRaised: boolean;
    stream?: MediaStream;
}

interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    timestamp: number;
    file?: {
        url: string;
        name: string;
        type: string;
        size: number;
    };
}

export default function RoomPage() {
    const params = useParams();
    const roomId = params?.roomId as string;
    const searchParams = useSearchParams();
    const router = useRouter();
    const { socket } = useSocket();
    const { data: session } = useSession();

    // Determine role from session — both 'teacher' AND 'admin' get teacher controls
    const userRole = (session?.user as any)?.role as string | undefined;
    const isTeacher = userRole === 'teacher' || userRole === 'admin';

    // State
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
    // Ref for cleanup — avoids stale closure problem with [] dependency array
    const localStreamRef = useRef<MediaStream | null>(null);
    const [activeSidebar, setActiveSidebar] = useState<'chat' | 'participants' | null>(null);
    const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

    // Controls State
    const [isMicOn, setIsMicOn] = useState(searchParams?.get('mic') === 'true');
    const [isCamOn, setIsCamOn] = useState(searchParams?.get('cam') === 'true');
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
    // Tracks hand-raise state per remote peer (keyed by socket.id)
    const [peersHandState, setPeersHandState] = useState<Record<string, boolean>>({});

    // Attendance tracking
    const meetingStartedAt = useRef<number>(Date.now());
    const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
    const [showReport, setShowReport] = useState(false);
    const [meetingEndedAt, setMeetingEndedAt] = useState<number>(0);
    // Track leftAt per userId
    const attendeeMap = useRef<Map<string, AttendeeRecord>>(new Map());

    // Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // WebRTC identity — must be STABLE after first set to avoid re-triggering
    // the WebRTC effect (which would destroy all peers mid-handshake).
    // guestId is the fallback used until session loads; we upgrade to real email once.
    const [guestId] = useState(() => Math.random().toString(36).substring(2, 9));
    const [stableUserId, setStableUserId] = useState<string>(guestId);
    const [stableUserName, setStableUserName] = useState<string>('Guest');

    // Upgrade once when session becomes available — never regress back to guestId
    const sessionUpgradedRef = useRef(false);
    useEffect(() => {
        if (sessionUpgradedRef.current) return; // upgrade only once
        if (session?.user?.email) {
            sessionUpgradedRef.current = true;
            setStableUserId(session.user.email);
            const rawName = searchParams?.get('name') || session.user.name || 'Guest';
            setStableUserName(rawName.replace(/\s*\(You\)$/i, '').trim());
        }
    }, [session, searchParams]);

    // Derive display-only name from URL or session (for UI labels)
    const rawName = searchParams?.get('name') || session?.user?.name || 'Guest';
    const userName = stableUserName !== 'Guest' ? stableUserName : rawName.replace(/\s*\(You\)$/i, '').trim();

    const { peers } = useWebRTC(roomId, localStream, stableUserId, stableUserName);

    // Extract peer streams for recording compositor
    const peerStreams = peers.map(p => p.stream).filter((s): s is MediaStream => !!s);

    // Real recording via MediaRecorder
    const { isRecording, recordingDuration, toggleRecording } = useRecording({
        localStream,
        peerStreams,
    });

    // Derive participants list
    const participants = React.useMemo(() => {
        const localParticipant: Participant = {
            id: 'local',
            name: userName,   // VideoTile appends ' (You)' via isLocal prop — don't double it here
            isMuted: !isMicOn,
            isCamOff: !isCamOn,
            isHandRaised: isHandRaised,
            stream: localStream || undefined,
        };
        const peerParticipants: Participant[] = peers.map(p => ({
            id: p.peerId,
            name: p.userName || `User ${p.peerId.substring(0, 4)}`,
            isMuted: false,
            isCamOff: false,
            isHandRaised: peersHandState[p.peerId] ?? false,
            stream: p.stream,
        }));
        return [localParticipant, ...peerParticipants];
    }, [peers, localStream, isMicOn, isCamOn, isHandRaised, peersHandState, userName]);

    // ─── Keep a ref to isTeacher so socket handlers always read current value
    // (session loads asynchronously — using stale closure from effect deps would be wrong)
    const isTeacherRef = useRef(isTeacher);
    useEffect(() => { isTeacherRef.current = isTeacher; }, [isTeacher]);

    // ─── Socket listeners ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // Chat
        const handleReceiveMessage = (message: ChatMessage) => {
            setChatMessages(prev => [...prev, message]);
            setTimeout(() => {
                if (chatScrollRef.current)
                    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }, 100);
        };
        const handleReceiveFile = (fileMessage: ChatMessage) => {
            setChatMessages(prev => [...prev, fileMessage]);
            setTimeout(() => {
                if (chatScrollRef.current)
                    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }, 100);
        };

        // Attendance tracking
        const handleParticipantJoined = (data: { userId: string; name: string; joinedAt: number }) => {
            attendeeMap.current.set(data.userId, { name: data.name, joinedAt: data.joinedAt });
        };
        const handleParticipantLeft = (data: { userId: string; leftAt: number }) => {
            const existing = attendeeMap.current.get(data.userId);
            if (existing) {
                attendeeMap.current.set(data.userId, { ...existing, leftAt: data.leftAt });
            }
        };

        // Meeting ended (teacher ends for everyone)
        const handleMeetingEnded = (data: {
            endedAt: number;
            participants: Array<{ userId: string; name: string; joinedAt: number }>;
        }) => {
            const endedAt = data.endedAt;
            setMeetingEndedAt(endedAt);

            // Merge server-provided list with local leftAt records
            const finalList: AttendeeRecord[] = data.participants.map(p => {
                const local = attendeeMap.current.get(p.userId);
                return {
                    name: p.name,
                    joinedAt: p.joinedAt,
                    leftAt: local?.leftAt,
                };
            });
            setAttendees(finalList);

            // Use ref — avoids stale isTeacher closure from session loading late
            if (isTeacherRef.current) {
                setShowReport(true);
            } else {
                router.push('/');
            }
        };

        // Hand raise from a peer
        const handleRaiseHand = (peerId: string, raised: boolean) => {
            setPeersHandState(prev => ({ ...prev, [peerId]: raised }));
        };

        // Whiteboard toggle from teacher (students receive)
        const handleWhiteboardToggle = (isOpen: boolean) => {
            if (!isTeacherRef.current) setIsWhiteboardOpen(isOpen);
        };

        socket.on('receive-message', handleReceiveMessage);
        socket.on('receive-file', handleReceiveFile);
        socket.on('participant-joined', handleParticipantJoined);
        socket.on('participant-left', handleParticipantLeft);
        socket.on('meeting-ended', handleMeetingEnded);
        socket.on('whiteboard-toggle', handleWhiteboardToggle);
        socket.on('raise-hand', handleRaiseHand);

        return () => {
            socket.off('receive-message', handleReceiveMessage);
            socket.off('receive-file', handleReceiveFile);
            socket.off('participant-joined', handleParticipantJoined);
            socket.off('participant-left', handleParticipantLeft);
            socket.off('meeting-ended', handleMeetingEnded);
            socket.off('whiteboard-toggle', handleWhiteboardToggle);
            socket.off('raise-hand', handleRaiseHand);
        };
    }, [socket, router]);

    // ─── Initialize Local Stream ────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const audioId = searchParams?.get('audioId');
                const videoId = searchParams?.get('videoId');
                const currentDevices = await navigator.mediaDevices.enumerateDevices();
                const audioExists = audioId ? currentDevices.some(d => d.deviceId === audioId && d.kind === 'audioinput') : false;
                const videoExists = videoId ? currentDevices.some(d => d.deviceId === videoId && d.kind === 'videoinput') : false;
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: audioId && audioExists ? { deviceId: { ideal: audioId } } : true,
                    video: videoId && videoExists ? { deviceId: { ideal: videoId }, width: 1280, height: 720 } : true,
                });
                stream.getAudioTracks().forEach(t => (t.enabled = isMicOn));
                stream.getVideoTracks().forEach(t => (t.enabled = isCamOn));
                localStreamRef.current = stream;   // keep ref for cleanup
                setLocalStream(stream);
                setStreamError(null);
            } catch (err) {
                console.error('[Room] Failed to get media stream:', err);
                const msg = err instanceof DOMException
                    ? err.name === 'NotAllowedError' ? 'Camera/microphone permission denied. You will not be visible to others.'
                        : err.name === 'NotFoundError' ? 'No camera or microphone found.'
                            : `Media error: ${err.message}`
                    : 'Failed to access camera/microphone.';
                setStreamError(msg);
            }
        };
        init();
        // Use ref for cleanup — avoids stale closure capturing null on first render
        return () => {
            localStreamRef.current?.getTracks().forEach(t => t.stop());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => (t.enabled = isMicOn));
            localStream.getVideoTracks().forEach(t => (t.enabled = isCamOn));
        }
    }, [isMicOn, isCamOn, localStream]);

    // ─── Handlers ───────────────────────────────────────────────────────────────
    const handleToggleMic = () => setIsMicOn(!isMicOn);
    const handleToggleCam = () => setIsCamOn(!isCamOn);

    // Remember cam state before screen share so we can restore it correctly
    const preSharCamOnRef = useRef(isCamOn);

    const handleToggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                preSharCamOnRef.current = isCamOn; // snapshot cam state before sharing
                // @ts-expect-error - getDisplayMedia types
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ cursor: 'always' });
                const screenTrack = screenStream.getVideoTracks()[0];
                if (localStream) {
                    const videoTrack = localStream.getVideoTracks()[0];
                    if (videoTrack) {
                        try {
                            peers.forEach(p => p.peer.replaceTrack(videoTrack, screenTrack, localStream));
                            localStream.removeTrack(videoTrack);
                            localStream.addTrack(screenTrack);
                            videoTrack.stop();
                        } catch (e) {
                            console.error('Error replacing screen track', e);
                        }
                    }
                }
                // Screen share is always "cam on" visually
                setIsCamOn(true);
                screenTrack.onended = () => stopScreenSharing();
                setIsScreenSharing(true);
            } catch (err) {
                console.error('Screen share failed', err);
            }
        } else {
            stopScreenSharing();
        }
    };

    const stopScreenSharing = async () => {
        setIsScreenSharing(false);
        try {
            const videoId = searchParams?.get('videoId');
            const currentDevices = await navigator.mediaDevices.enumerateDevices();
            const videoExists = videoId ? currentDevices.some(d => d.deviceId === videoId && d.kind === 'videoinput') : false;
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: videoId && videoExists ? { deviceId: { ideal: videoId }, width: 1280, height: 720 } : true,
            });
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (localStream) {
                const screenTrack = localStream.getVideoTracks()[0];
                peers.forEach(p => p.peer.replaceTrack(screenTrack, newVideoTrack, localStream));
                localStream.removeTrack(screenTrack);
                localStream.addTrack(newVideoTrack);
                screenTrack.stop();
                // Restore cam enabled state from before screen share started
                newVideoTrack.enabled = preSharCamOnRef.current;
            }
            // Restore isCamOn to what it was before screen sharing
            setIsCamOn(preSharCamOnRef.current);
        } catch (e) {
            console.error('Failed to revert to camera', e);
        }
    };

    const handleToggleRecording = () => toggleRecording();

    const handleToggleWhiteboard = () => {
        const next = !isWhiteboardOpen;
        setIsWhiteboardOpen(next);
        // Broadcast to students
        if (socket && isTeacher) {
            socket.emit('whiteboard-toggle', roomId, next);
        }
    };

    const handleRaiseHand = () => {
        const next = !isHandRaised;
        setIsHandRaised(next);
        // Broadcast to everyone else in the room
        if (socket) socket.emit('raise-hand', roomId, next);
    };

    const handleToggleSidebar = (view: 'chat' | 'participants') => {
        setActiveSidebar(activeSidebar === view ? null : view);
    };

    const handleLeave = () => {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        router.push('/');
    };

    const handleEndMeeting = () => {
        if (!socket) return;
        socket.emit('end-meeting', roomId);
        // Teacher will receive meeting-ended back via socket listener
    };

    // ─── Chat ────────────────────────────────────────────────────────────────────
    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !socket) return;
        const msg: ChatMessage = {
            id: Date.now().toString(),
            sender: userName,
            text: newMessage,
            timestamp: Date.now(),
        };
        socket.emit('send-message', roomId, msg);
        setChatMessages(prev => [...prev, msg]);
        setNewMessage('');
        setTimeout(() => {
            if (chatScrollRef.current)
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }, 100);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !socket) return;
        setUploadError(null);
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Upload failed');
            }
            const { url, name, type, size } = await res.json();
            const fileMsg: ChatMessage = {
                id: Date.now().toString(),
                sender: userName,
                text: '',
                timestamp: Date.now(),
                file: { url, name, type, size },
            };
            socket.emit('share-file', roomId, fileMsg);
            setChatMessages(prev => [...prev, fileMsg]);
            setTimeout(() => {
                if (chatScrollRef.current)
                    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }, 100);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Upload failed';
            setUploadError(message);
            setTimeout(() => setUploadError(null), 4000);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Derived ─────────────────────────────────────────────────────────────────
    const pinnedParticipant = participants.find(p => p.id === pinnedParticipantId);
    const otherParticipants = pinnedParticipantId
        ? participants.filter(p => p.id !== pinnedParticipantId)
        : participants;

    return (
        <>
            {/* ── Stream error banner (fix: user was silently invisible to peers) ── */}
            {streamError && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-950/90 border border-red-500/60 text-red-200 text-sm font-medium px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md max-w-lg text-center">
                    <BsCameraVideoOff className="text-red-400 flex-shrink-0 text-lg" />
                    <span>{streamError}</span>
                    <button onClick={() => window.location.reload()} className="ml-2 underline underline-offset-2 hover:text-white whitespace-nowrap">Retry</button>
                </div>
            )}

            {/* Whiteboard overlay (teacher-controlled, students view) */}
            {isWhiteboardOpen && (
                <Whiteboard
                    socket={socket}
                    roomId={roomId}
                    isTeacher={isTeacher}
                    onClose={() => setIsWhiteboardOpen(false)}
                />
            )}

            {/* Post-meeting attendance report (teacher only) */}
            {showReport && (
                <AttendanceReport
                    roomId={roomId}
                    attendees={attendees}
                    meetingStartedAt={meetingStartedAt.current}
                    meetingEndedAt={meetingEndedAt}
                    onClose={() => {
                        setShowReport(false);
                        router.push('/');
                    }}
                />
            )}

            <div className={styles.roomContainer}>

                {/* Main Content Area */}
                <div className={styles.mainContent} style={{ marginRight: activeSidebar ? '350px' : '0' }}>

                    {/* Video Stage */}
                    <div className={pinnedParticipantId ? styles.focusMode : styles.videoGrid}>

                        {/* Pinned View */}
                        {pinnedParticipant && (
                            <div className={styles.focusStage}>
                                <div className="w-full h-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl">
                                    <VideoTile
                                        stream={pinnedParticipant.stream}
                                        username={pinnedParticipant.name}
                                        isLocal={pinnedParticipant.id === 'local'}
                                        isMuted={pinnedParticipant.isMuted}
                                        isCamOff={pinnedParticipant.isCamOff}
                                        isPinned={true}
                                        onPin={() => setPinnedParticipantId(null)}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Grid / Side Strip */}
                        <div
                            className={pinnedParticipantId ? styles.sideStrip : styles.videoGrid}
                            style={{ display: pinnedParticipantId ? 'flex' : 'grid' }}
                        >
                            {otherParticipants.map(participant => (
                                <div key={participant.id} className={pinnedParticipantId ? 'w-full aspect-video' : 'w-full h-full'}>
                                    <VideoTile
                                        stream={participant.stream}
                                        username={participant.name}
                                        isLocal={participant.id === 'local'}
                                        isMuted={participant.isMuted}
                                        isCamOff={participant.isCamOff}
                                        isPinned={false}
                                        onPin={() => setPinnedParticipantId(participant.id)}
                                    />
                                </div>
                            ))}
                            {participants.length === 1 && !pinnedParticipantId && [1, 2, 3].map(i => (
                                <div key={i} className={styles.videoTile}>
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                        <span className="text-zinc-500">Waiting for others...</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className={styles.controlsBar}>
                        <RoomControls
                            isMicOn={isMicOn}
                            isCamOn={isCamOn}
                            isScreenSharing={isScreenSharing}
                            isHandRaised={isHandRaised}
                            isRecording={isRecording}
                            recordingDuration={recordingDuration}
                            isWhiteboardOpen={isWhiteboardOpen}
                            activeSidebar={activeSidebar}
                            isTeacher={isTeacher}
                            onToggleMic={handleToggleMic}
                            onToggleCam={handleToggleCam}
                            onToggleScreenShare={handleToggleScreenShare}
                            onToggleRecording={handleToggleRecording}
                            onRaiseHand={handleRaiseHand}
                            onToggleChat={() => handleToggleSidebar('chat')}
                            onToggleParticipants={() => handleToggleSidebar('participants')}
                            onToggleWhiteboard={handleToggleWhiteboard}
                            onLeave={handleLeave}
                            onEndMeeting={handleEndMeeting}
                        />
                    </div>

                </div>

                {/* Sidebar (Chat / Participants) */}
                <div className={`${styles.sidebar} ${!activeSidebar ? styles.sidebarHidden : ''}`}>

                    {/* Sidebar Header */}
                    <div className={styles.sidebarHeader}>
                        <span>{activeSidebar === 'chat' ? 'In-Call Messages' : `Participants (${participants.length})`}</span>
                        <Button variant="ghost" size="icon" onClick={() => setActiveSidebar(null)}>✕</Button>
                    </div>

                    {/* Sidebar Content */}
                    <div className={styles.sidebarContent}>
                        {activeSidebar === 'chat' ? (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 space-y-4 overflow-y-auto" ref={chatScrollRef}>
                                    {chatMessages.length === 0 && (
                                        <div className="text-center text-muted-foreground mt-10 text-sm">
                                            No messages yet.
                                        </div>
                                    )}
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} className="flex flex-col gap-1">
                                            <div className="flex justify-between items-baseline">
                                                <span className="font-bold text-sm">{msg.sender}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {msg.file ? (
                                                <a
                                                    href={msg.file.url}
                                                    download={msg.file.name}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 bg-secondary/50 hover:bg-secondary/80 transition-colors p-3 rounded-lg border border-border/40 group"
                                                >
                                                    <div className="text-2xl flex-shrink-0">
                                                        {msg.file.type === 'application/pdf'
                                                            ? <BsFilePdf className="text-red-400" />
                                                            : <BsFileEarmarkPpt className="text-orange-400" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{msg.file.name}</p>
                                                        <p className="text-xs text-muted-foreground">{(msg.file.size / 1024).toFixed(0)} KB</p>
                                                    </div>
                                                    <BsDownload className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                                </a>
                                            ) : (
                                                <div className="bg-secondary/50 p-2 rounded-lg text-sm">{msg.text}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {participants.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                                                {p.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-medium text-sm">{p.name}</span>
                                                {p.id === 'local' && (
                                                    <span className="ml-1 text-xs text-primary">
                                                        {isTeacher ? '· Teacher' : '· You'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 text-muted-foreground">
                                            {p.isMuted && <BsMicMute size={14} />}
                                            {p.isHandRaised && <span title="Hand raised">✋</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Chat Input */}
                    {activeSidebar === 'chat' && (
                        <form onSubmit={handleSendMessage} className={styles.chatInputArea}>
                            {uploadError && (
                                <div className="mb-2 px-2 py-1 bg-red-500/10 border border-red-500/40 rounded text-xs text-red-400">
                                    {uploadError}
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    title="Share PDF or PowerPoint"
                                    disabled={isUploading}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border/50 hover:bg-white/5 transition-colors disabled:opacity-50"
                                >
                                    {isUploading
                                        ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        : <BsPaperclip className="text-muted-foreground" />}
                                </button>
                                <Input
                                    placeholder="Type a message..."
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    className="bg-background/50"
                                />
                                <Button type="submit" size="icon" variant="primary" disabled={!newMessage.trim()}>
                                    <BsSend className="text-sm" />
                                </Button>
                            </div>
                        </form>
                    )}

                </div>

            </div>
        </>
    );
}
