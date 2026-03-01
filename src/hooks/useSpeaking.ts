import { useEffect, useRef, useState } from 'react';

/**
 * Monitors a MediaStream for audio activity using the Web Audio API.
 * Returns `true` when the RMS audio level exceeds the threshold.
 *
 * @param stream       The media stream to monitor (can be null/undefined)
 * @param threshold    0–255 RMS level to trigger "speaking" (default 18)
 * @param intervalMs   How often to sample the analyser in ms (default 80)
 */
export function useSpeaking(
    stream: MediaStream | null | undefined,
    threshold = 18,
    intervalMs = 80,
): boolean {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const animRef = useRef<number | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!stream || stream.getAudioTracks().length === 0) {
            setIsSpeaking(false);
            return;
        }

        let active = true;

        const setup = () => {
            try {
                const ctx = new AudioContext();
                ctxRef.current = ctx;

                const source = ctx.createMediaStreamSource(stream);
                sourceRef.current = source;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                analyserRef.current = analyser;

                source.connect(analyser);

                const data = new Uint8Array(analyser.frequencyBinCount);

                timerRef.current = setInterval(() => {
                    if (!active) return;
                    analyser.getByteTimeDomainData(data);

                    // RMS of the deviation from 128 (silence)
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const val = data[i] - 128;
                        sum += val * val;
                    }
                    const rms = Math.sqrt(sum / data.length);
                    setIsSpeaking(rms > threshold);
                }, intervalMs);
            } catch {
                // AudioContext blocked (e.g., no permission) — graceful fallback
                setIsSpeaking(false);
            }
        };

        setup();

        return () => {
            active = false;
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (animRef.current) {
                cancelAnimationFrame(animRef.current);
                animRef.current = null;
            }
            try {
                sourceRef.current?.disconnect();
                ctxRef.current?.close();
            } catch { /* stream may already be closed */ }
            ctxRef.current = null;
            sourceRef.current = null;
            analyserRef.current = null;
            setIsSpeaking(false);
        };
    }, [stream, threshold, intervalMs]);

    return isSpeaking;
}
