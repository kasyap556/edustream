import React from 'react';
import {
    BsMic, BsMicMute, BsCameraVideo, BsCameraVideoOff,
    BsLaptop, BsHandIndexThumb, BsChatLeftText, BsPeople,
    BsPhoneFill, BsRecordCircle, BsStopCircle, BsBrush,
} from 'react-icons/bs';
import { Button } from '@/components/ui/Button';

interface RoomControlsProps {
    isMicOn: boolean;
    isCamOn: boolean;
    isScreenSharing: boolean;
    isHandRaised: boolean;
    isRecording: boolean;
    recordingDuration: number;   // seconds — 0 when not recording
    isWhiteboardOpen: boolean;
    activeSidebar: 'chat' | 'participants' | null;
    isTeacher: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onToggleScreenShare: () => void;
    onToggleRecording: () => void;
    onRaiseHand: () => void;
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onToggleWhiteboard: () => void;
    onLeave: () => void;
    onEndMeeting: () => void;
}

/** Format seconds → "mm:ss" */
function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
    isMicOn,
    isCamOn,
    isScreenSharing,
    isHandRaised,
    isRecording,
    recordingDuration,
    isWhiteboardOpen,
    activeSidebar,
    isTeacher,
    onToggleMic,
    onToggleCam,
    onToggleScreenShare,
    onToggleRecording,
    onRaiseHand,
    onToggleChat,
    onToggleParticipants,
    onToggleWhiteboard,
    onLeave,
    onEndMeeting,
}) => {
    return (
        <div className="flex items-center gap-4 bg-background/80 backdrop-blur-lg border border-border/50 rounded-full px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-w-fit mx-auto transition-all hover:scale-105">

            {/* Mic Toggle */}
            <Button
                variant={isMicOn ? 'ghost' : 'danger'}
                size="icon"
                className={`rounded-full w-12 h-12 transition-all ${isMicOn ? 'bg-secondary/50 text-foreground hover:bg-secondary' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'}`}
                onClick={onToggleMic}
                title={isMicOn ? 'Mute' : 'Unmute'}
            >
                {isMicOn ? <BsMic className="text-xl" /> : <BsMicMute className="text-xl" />}
            </Button>

            {/* Camera Toggle */}
            <Button
                variant={isCamOn ? 'ghost' : 'danger'}
                size="icon"
                className={`rounded-full w-12 h-12 transition-all ${isCamOn ? 'bg-secondary/50 text-foreground hover:bg-secondary' : 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'}`}
                onClick={onToggleCam}
                title={isCamOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
                {isCamOn ? <BsCameraVideo className="text-xl" /> : <BsCameraVideoOff className="text-xl" />}
            </Button>

            <div className="w-px h-8 bg-border/50 mx-2" />

            {/* Screen Share */}
            <Button
                variant={isScreenSharing ? 'primary' : 'ghost'}
                size="icon"
                className={`rounded-full w-12 h-12 transition-all ${isScreenSharing ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_hsl(var(--primary)/0.5)]' : 'hover:bg-accent hover:text-accent-foreground'}`}
                onClick={onToggleScreenShare}
                title="Share Screen"
            >
                <BsLaptop className="text-xl" />
            </Button>

            {/* Whiteboard — teacher only */}
            {isTeacher && (
                <Button
                    variant={isWhiteboardOpen ? 'primary' : 'ghost'}
                    size="icon"
                    className={`rounded-full w-12 h-12 transition-all ${isWhiteboardOpen ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-[0_0_15px_rgba(124,58,237,0.5)]' : 'hover:bg-accent hover:text-accent-foreground'}`}
                    onClick={onToggleWhiteboard}
                    title="Whiteboard"
                >
                    <BsBrush className="text-xl" />
                </Button>
            )}

            {/* ── Recording button + live timer ──────────────────────────────── */}
            <div className="relative flex items-center">
                <Button
                    variant={isRecording ? 'danger' : 'ghost'}
                    size="icon"
                    className={`rounded-full w-12 h-12 transition-all ${isRecording
                            ? 'bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.6)]'
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                    onClick={onToggleRecording}
                    title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                    {isRecording
                        ? <BsStopCircle className="text-xl" />
                        : <BsRecordCircle className="text-xl" />}
                </Button>

                {/* Pulsing REC badge with live timer */}
                {isRecording && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-full whitespace-nowrap shadow-lg animate-pulse pointer-events-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                        REC&nbsp;{formatDuration(recordingDuration)}
                    </div>
                )}
            </div>

            {/* Raise Hand */}
            <Button
                variant={isHandRaised ? 'secondary' : 'ghost'}
                size="icon"
                className={`rounded-full w-12 h-12 transition-all ${isHandRaised ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30' : 'hover:bg-accent hover:text-accent-foreground'}`}
                onClick={onRaiseHand}
                title="Raise Hand"
            >
                <BsHandIndexThumb className="text-xl" />
            </Button>

            {/* Chat Toggle */}
            <Button
                variant={activeSidebar === 'chat' ? 'secondary' : 'ghost'}
                size="icon"
                className={`rounded-full w-12 h-12 relative ${activeSidebar === 'chat' ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={onToggleChat}
                title="Chat"
            >
                <BsChatLeftText className="text-lg" />
            </Button>

            {/* Participants Toggle */}
            <Button
                variant={activeSidebar === 'participants' ? 'secondary' : 'ghost'}
                size="icon"
                className={`rounded-full w-12 h-12 ${activeSidebar === 'participants' ? 'bg-accent text-accent-foreground' : ''}`}
                onClick={onToggleParticipants}
                title="Participants"
            >
                <BsPeople className="text-xl" />
            </Button>

            <div className="w-px h-8 bg-border/50 mx-2" />

            {/* Teacher: End Meeting for everyone | Student: Leave */}
            {isTeacher ? (
                <Button
                    variant="danger"
                    className="rounded-full px-5 h-12 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:scale-105"
                    onClick={onEndMeeting}
                    title="End meeting for everyone"
                >
                    <span className="mr-2">End</span>
                    <BsPhoneFill className="transform rotate-135" />
                </Button>
            ) : (
                <Button
                    variant="danger"
                    className="rounded-full px-5 h-12 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:scale-105"
                    onClick={onLeave}
                >
                    <span className="mr-2">Leave</span>
                    <BsPhoneFill className="transform rotate-135" />
                </Button>
            )}

        </div>
    );
};
