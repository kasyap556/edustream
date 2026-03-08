'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BsMic, BsMicMute, BsCameraVideo, BsCameraVideoOff, BsLaptop } from 'react-icons/bs';
import { useSession } from 'next-auth/react';
import styles from './lobby.module.css';
import '@/app/globals.css';

// Wrapper component to handle search params in Suspense
function LobbyContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomId = searchParams?.get('roomId') || '';
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    // Ref tracks the live stream so the cleanup closure (captured once) always stops the right tracks
    const localStreamRef = useRef<MediaStream | null>(null);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[], video: MediaDeviceInfo[] }>({ audio: [], video: [] });
    const [selectedAudio, setSelectedAudio] = useState('');
    const [selectedVideo, setSelectedVideo] = useState('');
    const { data: session, status } = useSession();
    const [userName, setUserName] = useState(session?.user?.name || '');

    // ── Guard: redirect while loading / unauthenticated / no roomId ────────────
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated' && !roomId) {
            router.push('/');
        }
    }, [status, roomId, router]);


    // Sync display name when NextAuth session hydrates after mount
    useEffect(() => {
        if (session?.user?.name && !userName) {
            setUserName(session.user.name);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.name]);

    // Initialize media stream - DON'T stop the initial stream!
    useEffect(() => {
        let mounted = true;

        async function initializeMedia() {
            try {
                console.log('[Lobby] Requesting media stream...');

                // Request stream with default devices
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: { width: 1280, height: 720 }
                });

                console.log('[Lobby] Stream acquired successfully');

                if (!mounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                // Set the stream immediately
                localStreamRef.current = stream;  // keep ref for cleanup
                setLocalStream(stream);

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // Apply initial mute states
                stream.getAudioTracks().forEach(track => track.enabled = isMicOn);
                stream.getVideoTracks().forEach(track => track.enabled = isCamOn);

                // Now enumerate devices to populate the dropdowns
                const deviceInfos = await navigator.mediaDevices.enumerateDevices();
                const audio = deviceInfos.filter(d => d.kind === 'audioinput');
                const video = deviceInfos.filter(d => d.kind === 'videoinput');

                console.log('[Lobby] Found devices:', { audioCount: audio.length, videoCount: video.length });
                setDevices({ audio, video });

                // Get the actual devices being used from the active tracks
                const audioTrack = stream.getAudioTracks()[0];
                const videoTrack = stream.getVideoTracks()[0];

                if (audioTrack) {
                    const audioSettings = audioTrack.getSettings();
                    console.log('[Lobby] Using audio device:', audioSettings.deviceId);
                    setSelectedAudio(audioSettings.deviceId || '');
                }

                if (videoTrack) {
                    const videoSettings = videoTrack.getSettings();
                    console.log('[Lobby] Using video device:', videoSettings.deviceId);
                    setSelectedVideo(videoSettings.deviceId || '');
                }

            } catch (err) {
                console.error("[Lobby] Error initializing media:", err);

                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                const errorName = err instanceof DOMException ? err.name : '';

                if (errorName === 'NotAllowedError' || errorMessage.includes('Permission denied')) {
                    alert('Camera/Microphone access denied.\n\nPlease enable permissions in your browser settings and refresh the page.');
                } else if (errorName === 'NotFoundError' || errorMessage.includes('not found')) {
                    alert('No camera or microphone found.\n\nPlease connect a device and try again.');
                } else if (errorName === 'NotReadableError') {
                    alert('Camera/Microphone is already in use.\n\nPlease close other apps and try again.');
                } else {
                    alert('Failed to access camera/microphone.\n\nError: ' + errorMessage);
                }
            }
        }

        initializeMedia();

        return () => {
            mounted = false;
            // Use ref — avoids stale closure that captured null on first render
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle device changes - switch to new device
    useEffect(() => {
        if (!localStream || !selectedAudio || !selectedVideo) return;

        // Get current device IDs
        const currentAudioId = localStream.getAudioTracks()[0]?.getSettings().deviceId;
        const currentVideoId = localStream.getVideoTracks()[0]?.getSettings().deviceId;

        // Only switch if user selected a different device
        if (currentAudioId === selectedAudio && currentVideoId === selectedVideo) {
            return;
        }

        console.log('[Lobby] Switching devices...', { selectedAudio, selectedVideo });

        let mounted = true;

        async function switchDevices() {
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { ideal: selectedAudio } },
                    video: { deviceId: { ideal: selectedVideo }, width: 1280, height: 720 }
                });

                if (!mounted) {
                    newStream.getTracks().forEach(track => track.stop());
                    return;
                }

                // Stop old stream
                localStreamRef.current?.getTracks().forEach(track => track.stop());

                // Set new stream
                localStreamRef.current = newStream;  // update ref before state
                setLocalStream(newStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                }

                // Apply mute states
                newStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
                newStream.getVideoTracks().forEach(track => track.enabled = isCamOn);

                console.log('[Lobby] Device switch successful');

            } catch (err) {
                console.error('[Lobby] Error switching devices:', err);
                alert('Failed to switch device. Please try again.');
            }
        }

        switchDevices();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAudio, selectedVideo]);

    // Separate effect to handle Mute/Unmute without restarting stream
    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = isMicOn);
            localStream.getVideoTracks().forEach(track => track.enabled = isCamOn);
        }
    }, [isMicOn, isCamOn, localStream]);

    // Toggle handlers
    const toggleMic = () => {
        if (localStream) {
            const newState = !isMicOn;
            localStream.getAudioTracks().forEach(track => track.enabled = newState);
            setIsMicOn(newState);
        }
    };

    const toggleCam = () => {
        if (localStream) {
            const newState = !isCamOn;
            localStream.getVideoTracks().forEach(track => track.enabled = newState);
            setIsCamOn(newState);
        }
    };

    // ── Show a loading spinner AFTER all hooks — early return before hooks violates Rules of Hooks
    if (status === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground text-sm">Loading your session…</p>
                </div>
            </div>
        );
    }

    const handleJoin = () => {
        // Pass state to the room via query params or context (simplified here)
        if (!userName.trim()) return;

        // Construct URL with necessary params
        const params = new URLSearchParams();
        params.set('mic', isMicOn.toString());
        params.set('cam', isCamOn.toString());
        params.set('name', userName);
        if (selectedAudio) params.set('audioId', selectedAudio);
        if (selectedVideo) params.set('videoId', selectedVideo);

        router.push(`/room/${roomId}?${params.toString()}`);
    };

    return (
        <div className={styles.container}>

            {/* Video Preview Section */}
            <div className={styles.previewSection}>
                <h2 className={styles.title}>
                    Check your Audio & Video
                </h2>

                <div className={`glass-panel ${styles.videoWrapper}`}>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className={styles.video}
                        style={{ opacity: isCamOn ? 1 : 0 }}
                    />

                    {!isCamOn && (
                        <div className={styles.videoOffOverlay}>
                            <div className="flex flex-col items-center gap-2">
                                <BsCameraVideoOff className="text-3xl" />
                                <span>Camera is off</span>
                            </div>
                        </div>
                    )}

                    {/* Overlay Controls */}
                    <div className={styles.overlayControls}>
                        <Button
                            variant={isMicOn ? 'glass' : 'danger'}
                            size="icon"
                            className="rounded-full w-12 h-12"
                            onClick={toggleMic}
                        >
                            {isMicOn ? <BsMic /> : <BsMicMute />}
                        </Button>
                        <Button
                            variant={isCamOn ? 'glass' : 'danger'}
                            size="icon"
                            className="rounded-full w-12 h-12"
                            onClick={toggleCam}
                        >
                            {isCamOn ? <BsCameraVideo /> : <BsCameraVideoOff />}
                        </Button>
                    </div>

                    {/* Audio Level Indicator (Visual only for now) */}
                    <div className={styles.audioIndicator}>
                        {[1, 2, 3].map((bar) => (
                            <div key={bar} className={styles.audioBar} style={{ height: isMicOn ? '100%' : '20%', animationDelay: `${bar * 0.1}s` }} />
                        ))}
                    </div>
                </div>

                {/* Device Selectors */}
                <div className={styles.deviceSelectors}>
                    <select
                        className={`glass-panel ${styles.select}`}
                        value={selectedAudio}
                        onChange={(e) => setSelectedAudio(e.target.value)}
                    >
                        {devices.audio.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}</option>
                        ))}
                    </select>

                    <select
                        className={`glass-panel ${styles.select}`}
                        value={selectedVideo}
                        onChange={(e) => setSelectedVideo(e.target.value)}
                    >
                        {devices.video.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${device.deviceId.slice(0, 5)}...`}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Right Actions Panel */}
            <div className={`glass-panel ${styles.joinPanel}`}>
                <div>
                    <h1 className="text-xl font-bold mb-1">Ready to join?</h1>
                    <p className="text-sm text-muted-foreground">Class: <span className="text-primary font-mono bg-white/5 px-1 rounded">{roomId}</span></p>
                </div>

                <div className="flex flex-col gap-4">
                    <Input
                        label="Display Name"
                        placeholder="Your Name (e.g. John Doe)"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                    />

                    <div className={styles.statusSummary}>
                        <p className="flex items-center gap-2">
                            <BsLaptop /> You are joining as standard participant.
                        </p>
                        <p>• Mic is {isMicOn ? 'On' : 'Off'}</p>
                        <p>• Camera is {isCamOn ? 'On' : 'Off'}</p>
                    </div>

                    <Button
                        className={styles.joinButton}
                        onClick={handleJoin}
                        disabled={!userName.trim()}
                    >
                        Join Session
                    </Button>
                </div>
            </div>

        </div>
    );
}

export default function LobbyPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <LobbyContent />
        </Suspense>
    );
}
