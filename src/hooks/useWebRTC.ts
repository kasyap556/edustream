import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import type { Instance as PeerInstance, SignalData } from 'simple-peer';

interface PeerData {
    peerId: string;       // = remote socket.id — unique per browser tab
    userName?: string;
    peer: PeerInstance;
    stream?: MediaStream;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
    try {
        const res = await fetch('/api/ice-servers');
        if (!res.ok) throw new Error(`ICE servers API returned ${res.status}`);
        const { iceServers } = await res.json();
        console.log('[WebRTC] ICE servers loaded:', iceServers.length, 'entries');
        return iceServers;
    } catch (err) {
        console.warn('[WebRTC] ICE server fetch failed, using STUN-only fallback:', err);
        return FALLBACK_ICE_SERVERS;
    }
}

export const useWebRTC = (
    roomId: string,
    userStream: MediaStream | null,
    userId: string,
    userName: string,
) => {
    const { socket } = useSocket();
    const [peers, setPeers] = useState<PeerData[]>([]);
    const peersRef = useRef<PeerData[]>([]);
    const iceConfigRef = useRef<{ iceServers: RTCIceServer[] } | null>(null);

    // ── Always-current refs — updated without triggering effect re-runs ──────────
    // This is the KEY fix: userId and userName change when NextAuth session loads.
    // If they were deps, the effect would re-run, destroy all peers, and re-emit
    // join-room while the other user is potentially mid-handshake → "Waiting for others"
    const userStreamRef = useRef<MediaStream | null>(userStream);
    const userIdRef = useRef<string>(userId);
    const userNameRef = useRef<string>(userName);

    useEffect(() => { userStreamRef.current = userStream; }, [userStream]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { userNameRef.current = userName; }, [userName]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SimplePeerRef = useRef<any>(null);

    const updatePeers = useCallback((newPeers: PeerData[]) => {
        peersRef.current = newPeers;
        setPeers([...newPeers]);
    }, []);

    // ── Main effect: only re-runs when socket or roomId changes ─────────────────
    // userId / userName / userStream changes are absorbed via refs above.
    // This guarantees join-room is only emitted ONCE per (socket, roomId) pair.
    // ────────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!socket || !roomId) return;

        let destroyed = false;

        const init = async () => {
            // ── Load ICE servers once ──────────────────────────────────────────
            if (!iceConfigRef.current) {
                const iceServers = await fetchIceServers();
                iceConfigRef.current = { iceServers };
            }
            if (destroyed) return;

            // ── Load simple-peer once ──────────────────────────────────────────
            if (!SimplePeerRef.current) {
                const peerModule = await import('simple-peer');
                SimplePeerRef.current = peerModule.default;
            }
            if (destroyed) return;

            // ── Wait for socket to fully connect (socket.id assigned) ──────────
            let waitedSocket = 0;
            while (!socket.id && waitedSocket < 5000) {
                await new Promise(r => setTimeout(r, 50));
                waitedSocket += 50;
            }
            if (destroyed) return;
            if (!socket.id) {
                console.error('[WebRTC] socket.id still undefined — socket failed to connect');
                return;
            }

            // ── Wait up to 5s for the user's media stream ──────────────────────
            // (camera permission prompt may take a moment)
            let waited = 0;
            while (!userStreamRef.current && waited < 5000) {
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }
            if (destroyed) return;

            const myPeerId = socket.id;
            const currentUserId = userIdRef.current;
            const currentUserName = userNameRef.current;

            console.log('[WebRTC] ✅ Joining room:', roomId,
                '| socketId:', myPeerId,
                '| userId:', currentUserId,
                '| name:', currentUserName,
                '| hasStream:', !!userStreamRef.current);

            socket.emit('join-room', roomId, currentUserId, currentUserName);

            // ── Helper: create a SimplePeer instance ───────────────────────────
            const makePeer = (initiator: boolean, remotePeerId: string): PeerInstance => {
                const stream = userStreamRef.current;
                console.log('[WebRTC] makePeer → initiator:', initiator,
                    'remote:', remotePeerId, 'stream:', !!stream);

                const peer = new SimplePeerRef.current({
                    initiator,
                    trickle: true,
                    stream: stream || undefined,
                    config: iceConfigRef.current!,
                }) as PeerInstance;

                peer.on('connect', () =>
                    console.log('[WebRTC] ✅ P2P connected to:', remotePeerId)
                );
                peer.on('error', (err: Error) =>
                    console.error('[WebRTC] ❌ Peer error with', remotePeerId, err.message)
                );
                peer.on('close', () =>
                    console.log('[WebRTC] Peer closed:', remotePeerId)
                );
                peer.on('stream', (remoteStream: MediaStream) => {
                    console.log('[WebRTC] ✅ Remote stream from:', remotePeerId,
                        'tracks:', remoteStream.getTracks().length);
                    updatePeers(
                        peersRef.current.map(p =>
                            p.peerId === remotePeerId ? { ...p, stream: remoteStream } : p
                        )
                    );
                });

                return peer;
            };

            // ── User B joins → A (already in room) creates offer ───────────────
            const handleUserConnected = (newPeerId: string, newUserName: string) => {
                console.log('[WebRTC] 👤 user-connected:', newPeerId, newUserName);
                if (peersRef.current.find(p => p.peerId === newPeerId)) {
                    console.log('[WebRTC] Duplicate user-connected, ignoring:', newPeerId);
                    return;
                }

                const peer = makePeer(true, newPeerId);

                peer.on('signal', (signal: SignalData) => {
                    console.log('[WebRTC] → offer/candidate to:', newPeerId,
                        (signal as any).type || 'candidate');
                    socket.emit('offer', signal, roomId, newPeerId, myPeerId);
                });

                updatePeers([...peersRef.current, { peerId: newPeerId, userName: newUserName, peer }]);
            };

            // ── Incoming offer / trickle ICE ───────────────────────────────────
            const handleOffer = (signal: SignalData, fromPeerId: string, targetId: string) => {
                if (targetId !== myPeerId) return;
                console.log('[WebRTC] ← offer/candidate from:', fromPeerId,
                    (signal as any).type || 'candidate');

                // Trickle ICE for an existing peer
                const existing = peersRef.current.find(p => p.peerId === fromPeerId);
                if (existing) {
                    existing.peer.signal(signal);
                    return;
                }

                // Only create answerer peer for a real SDP offer
                if ((signal as any).type !== 'offer') {
                    console.warn('[WebRTC] ⚠️ Early ICE candidate from unknown peer, dropping:', fromPeerId);
                    return;
                }

                const peer = makePeer(false, fromPeerId);

                peer.on('signal', (answerSignal: SignalData) => {
                    console.log('[WebRTC] → answer/candidate to:', fromPeerId,
                        (answerSignal as any).type || 'candidate');
                    socket.emit('answer', answerSignal, roomId, fromPeerId, myPeerId);
                });

                peer.signal(signal);
                updatePeers([...peersRef.current, { peerId: fromPeerId, peer }]);
            };

            // ── Incoming answer ────────────────────────────────────────────────
            const handleAnswer = (signal: SignalData, fromPeerId: string, targetId: string) => {
                if (targetId !== myPeerId) return;
                console.log('[WebRTC] ← answer from:', fromPeerId);
                peersRef.current.find(p => p.peerId === fromPeerId)?.peer.signal(signal);
            };

            // ── Peer disconnected ──────────────────────────────────────────────
            const handleUserDisconnected = (disconnectedPeerId: string) => {
                console.log('[WebRTC] 👤 user-disconnected:', disconnectedPeerId);
                peersRef.current.find(p => p.peerId === disconnectedPeerId)?.peer.destroy();
                updatePeers(peersRef.current.filter(p => p.peerId !== disconnectedPeerId));
            };

            // ── Register all listeners (named refs = safe to off() exactly) ────
            socket.off('user-connected', handleUserConnected);
            socket.off('offer', handleOffer);
            socket.off('answer', handleAnswer);
            socket.off('user-disconnected', handleUserDisconnected);

            socket.on('user-connected', handleUserConnected);
            socket.on('offer', handleOffer);
            socket.on('answer', handleAnswer);
            socket.on('user-disconnected', handleUserDisconnected);

            // Save exact handlers for precise cleanup
            cleanupHandlers.current = () => {
                socket.off('user-connected', handleUserConnected);
                socket.off('offer', handleOffer);
                socket.off('answer', handleAnswer);
                socket.off('user-disconnected', handleUserDisconnected);
            };
        };

        // Declared BEFORE init() so async callback can always write to it
        const cleanupHandlers = { current: () => { } };

        init();

        return () => {
            destroyed = true;
            cleanupHandlers.current();
            peersRef.current.forEach(p => {
                try { p.peer.destroy(); } catch { /* ignore */ }
            });
            updatePeers([]);
        };
        // ⚠️ ONLY socket and roomId — userId/userName/userStream use refs above.
        // Adding them here would cause double join-room when NextAuth session loads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, roomId]);

    return { peers };
};
