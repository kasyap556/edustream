'use client';

import { useEffect, useState } from 'react';

export default function DeviceTestPage() {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>('');
    const [permissionStatus, setPermissionStatus] = useState<string>('not requested');

    const requestPermissions = async () => {
        try {
            setPermissionStatus('requesting...');
            const tempStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            setStream(tempStream);
            setPermissionStatus('granted');
            setError('');

            // Enumerate devices
            const deviceList = await navigator.mediaDevices.enumerateDevices();
            setDevices(deviceList);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            const errorName = err instanceof DOMException ? err.name : '';
            setError(`${errorName}: ${errorMessage}`);
            setPermissionStatus('denied');
        }
    };

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    return (
        <div className="min-h-screen p-8 bg-background">
            <div className="max-w-4xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">Device Test Page</h1>

                <div className="glass-panel p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Permission Status: {permissionStatus}</h2>

                    <div className="flex gap-4">
                        <button
                            onClick={requestPermissions}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
                        >
                            Request Permissions
                        </button>
                        <button
                            onClick={stopStream}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:opacity-90"
                        >
                            Stop Stream
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
                            <p className="font-bold">Error:</p>
                            <p className="font-mono text-sm">{error}</p>
                        </div>
                    )}

                    {stream && (
                        <div className="space-y-2">
                            <h3 className="font-semibold">Active Stream:</h3>
                            <video
                                ref={(video) => {
                                    if (video && stream) {
                                        video.srcObject = stream;
                                    }
                                }}
                                autoPlay
                                muted
                                playsInline
                                className="w-full max-w-2xl rounded-lg bg-black"
                            />
                            <p className="text-sm text-muted-foreground">
                                Audio tracks: {stream.getAudioTracks().length} |
                                Video tracks: {stream.getVideoTracks().length}
                            </p>
                        </div>
                    )}
                </div>

                <div className="glass-panel p-6 space-y-4">
                    <h2 className="text-xl font-semibold">Available Devices ({devices.length})</h2>

                    {devices.length === 0 ? (
                        <p className="text-muted-foreground">No devices found. Request permissions first.</p>
                    ) : (
                        <div className="space-y-2">
                            {devices.map((device, index) => (
                                <div key={index} className="p-3 bg-white/5 rounded-lg">
                                    <p className="font-semibold">{device.kind}</p>
                                    <p className="text-sm">Label: {device.label || '(no label)'}</p>
                                    <p className="text-xs font-mono text-muted-foreground">
                                        ID: {device.deviceId.slice(0, 20)}...
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
