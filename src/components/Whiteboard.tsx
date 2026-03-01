'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface DrawData {
    type: 'begin' | 'draw' | 'end' | 'clear';
    x?: number;
    y?: number;
    color?: string;
    lineWidth?: number;
    tool?: 'pen' | 'eraser';
}

interface WhiteboardProps {
    socket: Socket | null;
    roomId: string;
    isTeacher: boolean;
    onClose: () => void;
}

const COLORS = [
    '#ffffff', '#f87171', '#fb923c', '#facc15',
    '#4ade80', '#60a5fa', '#a78bfa', '#f472b6',
    '#000000', '#6b7280',
];

export const Whiteboard: React.FC<WhiteboardProps> = ({ socket, roomId, isTeacher, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
    const [color, setColor] = useState('#ffffff');
    const [lineWidth, setLineWidth] = useState(3);
    // History for undo (stores ImageData snapshots)
    const history = useRef<ImageData[]>([]);

    const getCtx = () => {
        const canvas = canvasRef.current;
        return canvas ? canvas.getContext('2d') : null;
    };

    // Resize canvas to fill its container
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            // Save current drawing
            const ctx = canvas.getContext('2d');
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            // Restore background
            if (ctx) {
                ctx.fillStyle = '#1e1e2e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                if (imageData) ctx.putImageData(imageData, 0, 0);
            }
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Listen for remote draw events
    useEffect(() => {
        if (!socket) return;
        const handleDraw = (data: DrawData) => {
            const ctx = getCtx();
            if (!ctx || !canvasRef.current) return;
            if (data.type === 'clear') {
                ctx.fillStyle = '#1e1e2e';
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                return;
            }
            ctx.strokeStyle = data.tool === 'eraser' ? '#1e1e2e' : (data.color || '#ffffff');
            ctx.lineWidth = data.lineWidth || 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (data.type === 'begin' && data.x !== undefined && data.y !== undefined) {
                ctx.beginPath();
                ctx.moveTo(data.x, data.y);
            } else if (data.type === 'draw' && data.x !== undefined && data.y !== undefined) {
                ctx.lineTo(data.x, data.y);
                ctx.stroke();
            }
        };
        socket.on('whiteboard-draw', handleDraw);
        return () => { socket.off('whiteboard-draw', handleDraw); };
    }, [socket]);

    const emit = useCallback((data: DrawData) => {
        if (socket && isTeacher) {
            socket.emit('whiteboard-draw', roomId, data);
        }
    }, [socket, roomId, isTeacher]);

    const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isTeacher) return;
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;

        // Save snapshot for undo
        history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        if (history.current.length > 30) history.current.shift();

        isDrawing.current = true;
        const { x, y } = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = tool === 'eraser' ? '#1e1e2e' : color;
        ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        emit({ type: 'begin', x, y, color, lineWidth: tool === 'eraser' ? lineWidth * 4 : lineWidth, tool });
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current || !isTeacher) return;
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;
        e.preventDefault();
        const { x, y } = getPos(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
        emit({ type: 'draw', x, y, color, lineWidth: tool === 'eraser' ? lineWidth * 4 : lineWidth, tool });
    };

    const endDraw = () => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        emit({ type: 'end' });
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx) return;
        history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        emit({ type: 'clear' });
    };

    const handleUndo = () => {
        const canvas = canvasRef.current;
        const ctx = getCtx();
        if (!canvas || !ctx || history.current.length === 0) return;
        const prev = history.current.pop()!;
        ctx.putImageData(prev, 0, 0);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column',
            background: '#0f0f1a',
        }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexWrap: 'wrap',
            }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#a78bfa', marginRight: 4 }}>
                    🖊 Whiteboard
                </span>

                {/* Tool buttons */}
                {isTeacher && (
                    <>
                        <button
                            onClick={() => setTool('pen')}
                            title="Pen"
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: tool === 'pen' ? '#7c3aed' : 'rgba(255,255,255,0.08)',
                                color: '#fff', fontWeight: 600, fontSize: 13,
                            }}
                        >✏️ Pen</button>
                        <button
                            onClick={() => setTool('eraser')}
                            title="Eraser"
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: tool === 'eraser' ? '#7c3aed' : 'rgba(255,255,255,0.08)',
                                color: '#fff', fontWeight: 600, fontSize: 13,
                            }}
                        >🧹 Eraser</button>

                        {/* Color palette */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setTool('pen'); }}
                                    title={c}
                                    style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        background: c, border: color === c ? '3px solid #a78bfa' : '2px solid rgba(255,255,255,0.2)',
                                        cursor: 'pointer', flexShrink: 0,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Thickness */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: '#9ca3af', fontSize: 12 }}>Size</span>
                            <input
                                type="range" min={1} max={20} value={lineWidth}
                                onChange={e => setLineWidth(Number(e.target.value))}
                                style={{ width: 80, accentColor: '#7c3aed' }}
                            />
                            <span style={{ color: '#9ca3af', fontSize: 12, minWidth: 20 }}>{lineWidth}</span>
                        </div>

                        <button
                            onClick={handleUndo}
                            title="Undo"
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, fontSize: 13,
                            }}
                        >↩ Undo</button>
                        <button
                            onClick={handleClear}
                            title="Clear board"
                            style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600, fontSize: 13,
                            }}
                        >🗑 Clear</button>
                    </>
                )}

                {!isTeacher && (
                    <span style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
                        View only — teacher is drawing
                    </span>
                )}

                {/* Close */}
                <button
                    onClick={onClose}
                    style={{
                        marginLeft: 'auto', padding: '6px 16px', borderRadius: 8,
                        border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, fontSize: 13,
                    }}
                >✕ Close</button>
            </div>

            {/* Canvas area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    style={{
                        display: 'block', width: '100%', height: '100%',
                        cursor: !isTeacher ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
                        touchAction: 'none',
                    }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />
            </div>
        </div>
    );
};
