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
import { SidebarView, ChatMessage, Participant } from '@/components/SidebarView';

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
    const chatScrollRef = useRef<HTMLDivElement>(null);

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
    const initStream = React.useCallback(async () => {
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
    }, [isMicOn, isCamOn, searchParams]);

    useEffect(() => {
        initStream();
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
                    <button onClick={initStream} className="ml-2 underline underline-offset-2 hover:text-white whitespace-nowrap">Retry</button>
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
                <SidebarView
                    roomId={roomId}
                    userName={userName}
                    socket={socket}
                    activeSidebar={activeSidebar}
                    setActiveSidebar={setActiveSidebar}
                    participants={participants}
                    chatMessages={chatMessages}
                    setChatMessages={setChatMessages}
                    chatScrollRef={chatScrollRef}
                    isTeacher={isTeacher}
                    styles={styles}
                />

            </div>
        </>
    );
}
