// Custom Next.js server with Socket.IO signaling
// Run with: node server.js (instead of next dev / next start)

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    // ─── Socket.IO ───────────────────────────────────────────────────────────────
    const io = new Server(httpServer, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        // Increase timeouts to survive Next.js HMR pauses and slow compilations
        pingTimeout: 60000,   // 60 s before declaring dead  (default: 20 s)
        pingInterval: 25000,  // heartbeat every 25 s         (default: 25 s)
        transports: ['websocket', 'polling'],
    });

    // roomId → Map<socketId, { userId, name, joinedAt }>
    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log('[Socket] Connected:', socket.id);

        // ── Join room ─────────────────────────────────────────────────────────────
        socket.on('join-room', (roomId, userId, userName) => {
            console.log(`[Socket] ${userName} (${socket.id}) joining room: ${roomId}`);
            socket.join(roomId);

            // Track room participants
            if (!rooms.has(roomId)) rooms.set(roomId, new Map());
            const room = rooms.get(roomId);

            // Evict any stale entry for this same socket (e.g. double join-room call)
            if (room.has(socket.id)) {
                console.log(`[Socket] Evicting stale entry for ${socket.id} before re-join`);
                room.delete(socket.id);
            }

            // ── Send the new joiner the list of everyone already in the room ──────
            // This is critical: without this, if user A is already in the room and
            // user B joins, A gets 'user-connected' and creates an offer. But if B's
            // socket reconnected (HMR, network blip), B never learns A is there and
            // waits silently forever.
            const existingPeers = [];
            room.forEach((peerData, peerId) => {
                existingPeers.push({ peerId, userName: peerData.name });
            });
            if (existingPeers.length > 0) {
                console.log(`[Socket] Sending existing peers to ${socket.id}:`, existingPeers.map(p => p.peerId));
                socket.emit('existing-peers', existingPeers);
            }

            room.set(socket.id, { userId, name: userName, joinedAt: Date.now() });

            // Notify existing participants that a new user joined
            socket.to(roomId).emit('user-connected', socket.id, userName);

            // Notify all (including sender) about participant joining for attendance
            io.to(roomId).emit('participant-joined', {
                userId,
                name: userName,
                joinedAt: Date.now(),
            });
        });

        // ── WebRTC Signaling ──────────────────────────────────────────────────────

        // Relay offer from initiator → specific responder
        socket.on('offer', (signal, roomId, targetSocketId, fromSocketId) => {
            console.log(`[Socket] Offer: ${fromSocketId} → ${targetSocketId}`);
            io.to(targetSocketId).emit('offer', signal, fromSocketId, targetSocketId);
        });

        // Relay answer from responder → initiator
        socket.on('answer', (signal, roomId, targetSocketId, fromSocketId) => {
            console.log(`[Socket] Answer: ${fromSocketId} → ${targetSocketId}`);
            io.to(targetSocketId).emit('answer', signal, fromSocketId, targetSocketId);
        });

        // ── Chat ──────────────────────────────────────────────────────────────────
        socket.on('send-message', (roomId, message) => {
            socket.to(roomId).emit('receive-message', message);
        });

        socket.on('share-file', (roomId, fileMessage) => {
            socket.to(roomId).emit('receive-file', fileMessage);
        });

        // ── Whiteboard ────────────────────────────────────────────────────────────
        socket.on('whiteboard-toggle', (roomId, isOpen) => {
            socket.to(roomId).emit('whiteboard-toggle', isOpen);
        });

        socket.on('whiteboard-draw', (roomId, drawData) => {
            socket.to(roomId).emit('whiteboard-draw', drawData);
        });

        socket.on('whiteboard-clear', (roomId) => {
            socket.to(roomId).emit('whiteboard-clear');
        });

        // Hand raise — broadcast to all others in the room
        socket.on('raise-hand', (roomId, raised) => {
            socket.to(roomId).emit('raise-hand', socket.id, raised);
        });

        // ── End Meeting (teacher only) ────────────────────────────────────────────
        socket.on('end-meeting', (roomId) => {
            const room = rooms.get(roomId);
            const endedAt = Date.now();
            const participants = room
                ? Array.from(room.entries()).map(([, p]) => ({
                    ...p,
                    // Everyone still in the room when meeting ends gets leftAt = endedAt
                    // This ensures the teacher (who initiates end-meeting) has a leftAt
                    leftAt: endedAt,
                }))
                : [];
            io.to(roomId).emit('meeting-ended', { endedAt, participants });
            rooms.delete(roomId);
        });

        // ── Disconnect ───────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected:', socket.id);
            rooms.forEach((room, roomId) => {
                if (room.has(socket.id)) {
                    const { userId } = room.get(socket.id);
                    room.delete(socket.id);
                    socket.to(roomId).emit('user-disconnected', socket.id);
                    socket.to(roomId).emit('participant-left', {
                        userId,
                        leftAt: Date.now(),
                    });
                    if (room.size === 0) rooms.delete(roomId);
                }
            });
        });
    });

    httpServer.listen(port, () => {
        console.log(`\n🚀 EduStream server ready on http://localhost:${port}`);
        console.log(`📡 Socket.IO signaling active at /api/socket/io\n`);
    });
});
