import React, { useRef, useEffect } from 'react';
import { BsMicMute, BsPinAngle, BsPinAngleFill, BsThreeDotsVertical } from 'react-icons/bs';
import { useSpeaking } from '@/hooks/useSpeaking';

interface VideoTileProps {
    stream?: MediaStream | null;
    username: string;
    isLocal?: boolean;
    isMuted?: boolean;
    isCamOff?: boolean;
    isPinned?: boolean;
    onPin?: () => void;
    className?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
    stream,
    username,
    isLocal,
    isMuted,
    isCamOff,
    isPinned,
    onPin,
    className
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // ── Real speaking detection via Web Audio API ──────────────────────────────
    // Only monitor remote peers (local audio is already audible locally)
    // and only when not muted.
    const isSpeaking = useSpeaking(
        !isLocal && !isMuted ? stream : null
    );

    useEffect(() => {
        if (videoRef.current) {
            // Always assign — setting to null clears the frozen frame when peer disconnects
            videoRef.current.srcObject = stream ?? null;
        }
    }, [stream]);

    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    return (
        <div className={`relative w-full h-full bg-card rounded-xl overflow-hidden shadow-sm border transition-all duration-300
            ${isSpeaking ? 'border-green-400 shadow-[0_0_12px_rgba(74,222,128,0.4)]' : 'border-border'}
            group ${className}`}>

            {/* Video Element */}
            {!isCamOff && stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted={isLocal} // Always mute local video to prevent echo
                    playsInline
                    className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                        {getInitials(username)}
                    </div>
                </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Top Right Controls */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                    onClick={onPin}
                    className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors"
                >
                    {isPinned ? <BsPinAngleFill /> : <BsPinAngle />}
                </button>
                <button className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-colors">
                    <BsThreeDotsVertical />
                </button>
            </div>

            {/* Bottom Left Info */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 max-w-[80%]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white text-sm font-medium">
                    {isMuted && <BsMicMute className="text-red-400" />}
                    <span className="truncate">{username} {isLocal && '(You)'}</span>
                </div>
            </div>

            {/* Real speaking indicator — only shown when audio is actually detected */}
            {isSpeaking && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
                    <span className="text-[10px] font-semibold text-green-300 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                        Speaking
                    </span>
                </div>
            )}
        </div>
    );
};
