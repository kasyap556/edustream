'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Connect directly to the custom server.js Socket.IO instance.
        // No fetch() needed — server.js mounts Socket.IO on the same HTTP server.
        const socketInstance = io({
            path: '/api/socket/io',
            addTrailingSlash: false,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
            console.log('[Socket] Connected:', socketInstance.id);
            setIsConnected(true);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
        });

        setSocket(socketInstance);

        // ✅ Cleanup returned directly from useEffect — React will call this on unmount
        return () => {
            console.log('[Socket] Cleaning up connection');
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
