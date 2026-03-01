'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BsLink45Deg, BsQrCode, BsClipboard, BsCheck2, BsPlusCircle } from 'react-icons/bs';
import { useSession } from 'next-auth/react';

export default function CreateMeetingPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [roomId, setRoomId] = useState('');
    const [customRoomId, setCustomRoomId] = useState('');
    const [useCustomId, setUseCustomId] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);

    // Generate random room ID
    const generateRoomId = () => {
        const randomId = Math.random().toString(36).substring(2, 10);
        setRoomId(randomId);
        setUseCustomId(false);
        setCustomRoomId('');
    };

    // Use custom room ID
    const handleCustomRoomId = () => {
        if (customRoomId.trim()) {
            setRoomId(customRoomId.trim().toLowerCase().replace(/\s+/g, '-'));
            setUseCustomId(true);
        }
    };

    // Get meeting link
    const getMeetingLink = () => {
        if (!roomId) return '';
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        return `${baseUrl}/lobby?roomId=${roomId}`;
    };

    // Copy link to clipboard
    const copyLink = async () => {
        const link = getMeetingLink();
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy link');
        }
    };

    // Start meeting
    const startMeeting = () => {
        if (roomId) {
            router.push(`/lobby?roomId=${roomId}`);
        }
    };

    // Generate QR code URL (using a free QR code API)
    const getQRCodeUrl = () => {
        const link = getMeetingLink();
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
    };

    return (
        <div className="teacher-theme min-h-screen flex items-center justify-center bg-background relative overflow-x-hidden">

            {/* Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
            </div>

            <div className="relative z-10 w-full max-w-2xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-2">
                        Create a Meeting
                    </h1>
                    <p className="text-muted-foreground">
                        Start a new virtual classroom session
                    </p>
                </div>

                <div className="glass-panel rounded-2xl p-8 shadow-2xl border border-border/50 space-y-6">

                    {/* Generate Random Room ID */}
                    <div className="space-y-3">
                        <Button
                            onClick={generateRoomId}
                            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity h-14 text-lg"
                        >
                            <BsPlusCircle className="mr-2 text-xl" />
                            Generate Meeting ID
                        </Button>
                    </div>

                    {/* OR Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/50" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">Or use custom ID</span>
                        </div>
                    </div>

                    {/* Custom Room ID */}
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter custom meeting ID (e.g., math-class-101)"
                                value={customRoomId}
                                onChange={(e) => setCustomRoomId(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleCustomRoomId()}
                            />
                            <Button
                                onClick={handleCustomRoomId}
                                variant="outline"
                                disabled={!customRoomId.trim()}
                            >
                                Use
                            </Button>
                        </div>
                    </div>

                    {/* Display Room ID */}
                    {roomId && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="p-4 bg-white/5 rounded-lg border border-border/50">
                                <p className="text-sm text-muted-foreground mb-2">Meeting ID:</p>
                                <p className="text-2xl font-bold font-mono text-primary">{roomId}</p>
                            </div>

                            {/* Meeting Link */}
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Meeting Link:</p>
                                <div className="flex gap-2">
                                    <div className="flex-1 p-3 bg-white/5 rounded-lg border border-border/50 overflow-hidden">
                                        <p className="text-sm font-mono truncate">{getMeetingLink()}</p>
                                    </div>
                                    <Button
                                        onClick={copyLink}
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12"
                                    >
                                        {copied ? <BsCheck2 className="text-green-500" /> : <BsClipboard />}
                                    </Button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={startMeeting}
                                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 h-12"
                                >
                                    <BsLink45Deg className="mr-2 text-xl" />
                                    Start Meeting
                                </Button>
                                <Button
                                    onClick={() => setShowQR(!showQR)}
                                    variant="outline"
                                    className="h-12"
                                >
                                    <BsQrCode className="mr-2 text-xl" />
                                    {showQR ? 'Hide' : 'Show'} QR Code
                                </Button>
                            </div>

                            {/* QR Code */}
                            {showQR && (
                                <div className="flex justify-center p-6 bg-white rounded-lg animate-fadeIn">
                                    <img
                                        src={getQRCodeUrl()}
                                        alt="Meeting QR Code"
                                        className="w-64 h-64"
                                    />
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                                <p className="text-sm font-semibold mb-2">📋 How to share:</p>
                                <ul className="text-sm space-y-1 text-muted-foreground">
                                    <li>• Copy the link and send it to participants</li>
                                    <li>• Share the QR code for easy mobile access</li>
                                    <li>• Or simply share the Meeting ID: <span className="font-mono text-primary">{roomId}</span></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Welcome Message if no room created */}
                    {!roomId && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-lg">Click above to create a new meeting</p>
                            <p className="text-sm mt-2">You can generate a random ID or use your own custom ID</p>
                        </div>
                    )}
                </div>

                {/* Quick Join Option */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground mb-3">Already have a meeting ID?</p>
                    <Button
                        onClick={() => {
                            const id = prompt('Enter Meeting ID:');
                            if (id) {
                                router.push(`/lobby?roomId=${id.trim()}`);
                            }
                        }}
                        variant="ghost"
                        className="border border-border/50"
                    >
                        Join Existing Meeting
                    </Button>
                </div>
            </div>
        </div>
    );
}
