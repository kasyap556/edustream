'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraTestPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Click the button to test your camera');
    const [error, setError] = useState('');
    const [stream, setStream] = useState<MediaStream | null>(null);

    const testCamera = async () => {
        try {
            setStatus('Requesting camera access...');
            setError('');

            console.log('Requesting getUserMedia...');
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            console.log('Got stream:', mediaStream);
            console.log('Video tracks:', mediaStream.getVideoTracks());
            console.log('Audio tracks:', mediaStream.getAudioTracks());

            setStream(mediaStream);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }

            setStatus('✅ Camera connected successfully!');

            // Log device info
            const videoTrack = mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                const settings = videoTrack.getSettings();
                console.log('Video settings:', settings);
                setStatus(`✅ Camera connected: ${settings.deviceId}`);
            }

        } catch (err) {
            console.error('Camera error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            const errorName = err instanceof DOMException ? err.name : '';

            setError(`${errorName}: ${errorMessage}`);
            setStatus('❌ Failed to connect to camera');

            // Provide specific guidance
            if (errorName === 'NotAllowedError') {
                setError('Permission denied. Please allow camera access in your browser settings.');
            } else if (errorName === 'NotFoundError') {
                setError('No camera found. Please check if your camera is connected and not being used by another application.');
            } else if (errorName === 'NotReadableError') {
                setError('Camera is already in use by another application. Please close other apps using your camera.');
            } else {
                setError(`Error: ${errorName} - ${errorMessage}`);
            }
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            setStream(null);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
            setStatus('Camera stopped');
        }
    };

    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    return (
        <div className="min-h-screen p-8 bg-background flex items-center justify-center">
            <div className="max-w-4xl w-full space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">Camera Test</h1>
                    <p className="text-muted-foreground">Simple camera connection test</p>
                </div>

                <div className="glass-panel p-8 space-y-6">
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={testCamera}
                            className="px-6 py-3 bg-primary text-white rounded-lg hover:opacity-90 font-semibold"
                        >
                            🎥 Test Camera
                        </button>
                        <button
                            onClick={stopCamera}
                            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:opacity-90 font-semibold"
                            disabled={!stream}
                        >
                            ⏹️ Stop Camera
                        </button>
                    </div>

                    <div className="text-center">
                        <p className="text-lg font-semibold">{status}</p>
                        {error && (
                            <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
                                <p className="font-bold text-red-400">Error Details:</p>
                                <p className="font-mono text-sm mt-2">{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        {!stream && (
                            <div className="absolute inset-0 flex items-center justify-center text-white">
                                <p>No video stream</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="font-semibold mb-2">Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Click "Test Camera" button</li>
                            <li>Allow camera access when prompted</li>
                            <li>You should see your camera feed above</li>
                            <li>Check the browser console (F12) for detailed logs</li>
                        </ol>
                    </div>

                    <div className="bg-white/5 p-4 rounded-lg">
                        <p className="font-semibold mb-2">Common Issues:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            <li><strong>Permission denied:</strong> Check browser settings and allow camera access</li>
                            <li><strong>No camera found:</strong> Ensure your camera is connected and drivers are installed</li>
                            <li><strong>Camera in use:</strong> Close other apps (Zoom, Teams, Skype, etc.)</li>
                            <li><strong>HTTPS required:</strong> Some browsers require HTTPS (localhost is OK)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
