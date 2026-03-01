import { useRef, useState, useCallback, useEffect } from 'react';

interface UseRecordingProps {
    localStream: MediaStream | null;
    peerStreams: MediaStream[];
}

interface UseRecordingReturn {
    isRecording: boolean;
    recordingDuration: number;   // seconds elapsed
    startRecording: () => void;
    stopRecording: () => void;
    toggleRecording: () => void;
}

/**
 * Composites all participants' video onto a canvas and mixes all audio
 * tracks via AudioContext, then records the result with MediaRecorder.
 * On stop, the recording is automatically downloaded as a .webm file.
 */
export const useRecording = ({
    localStream,
    peerStreams,
}: UseRecordingProps): UseRecordingReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animFrameRef = useRef<number | null>(null);
    // Keep a snapshot of peer streams captured at start time
    const peerStreamsRef = useRef<MediaStream[]>(peerStreams);

    // Keep ref in sync so the draw loop always has fresh peer streams
    useEffect(() => { peerStreamsRef.current = peerStreams; }, [peerStreams]);

    const startRecording = useCallback(() => {
        if (isRecording) return;

        // ── 1. Canvas composite ────────────────────────────────────────────────
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d')!;

        // Build video element per stream (already running, so just assign srcObject)
        const allStreams = [localStream, ...peerStreamsRef.current].filter(
            (s): s is MediaStream => s !== null
        );

        const videoEls = allStreams.map(stream => {
            const v = document.createElement('video');
            v.srcObject = stream;
            v.autoplay = true;
            v.muted = true; // prevent echo — audio is captured separately
            v.playsInline = true;
            v.play().catch(() => {/* ignore */ });
            return v;
        });

        // Animated draw loop – simple CSS-grid-style layout
        const draw = () => {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const count = videoEls.length;
            if (count === 0) {
                animFrameRef.current = requestAnimationFrame(draw);
                return;
            }

            const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
            const rows = Math.ceil(count / cols);
            const w = canvas.width / cols;
            const h = canvas.height / rows;

            videoEls.forEach((v, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                try { ctx.drawImage(v, col * w, row * h, w, h); } catch { /* frame not ready */ }
            });

            animFrameRef.current = requestAnimationFrame(draw);
        };
        draw();

        // ── 2. Audio mixing ───────────────────────────────────────────────────
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const destination = audioCtx.createMediaStreamDestination();

        allStreams.forEach(stream => {
            if (stream.getAudioTracks().length === 0) return;
            try {
                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(destination);
            } catch { /* stream ended */ }
        });

        // ── 3. Combined stream → MediaRecorder ────────────────────────────────
        const canvasStream = canvas.captureStream(30);
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...destination.stream.getAudioTracks(),
        ]);

        // Pick best supported codec
        const mimeType =
            MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' :
                    MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' :
                        'video/mp4';

        const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 2_500_000 });
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            // Clean up video elements
            videoEls.forEach(v => { v.srcObject = null; });

            const blob = new Blob(chunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
            a.download = `EduStream-Recording-${timestamp}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        // Collect data every second so we don't lose much if tab is closed
        recorder.start(1000);

        setIsRecording(true);
        setDuration(0);
        timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }, [isRecording, localStream]);

    const stopRecording = useCallback(() => {
        if (!isRecording) return;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }

        setIsRecording(false);
        setDuration(0);
    }, [isRecording]);

    const toggleRecording = useCallback(() => {
        if (isRecording) stopRecording();
        else startRecording();
    }, [isRecording, startRecording, stopRecording]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            audioContextRef.current?.close().catch(() => { });
        };
    }, []);

    return { isRecording, recordingDuration, startRecording, stopRecording, toggleRecording };
};
