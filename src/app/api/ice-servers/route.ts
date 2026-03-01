import { NextResponse } from 'next/server';

/**
 * GET /api/ice-servers
 *
 * Returns a list of ICE servers (STUN + TURN) for WebRTC.
 * Credentials are kept server-side so they are never exposed in client bundles.
 *
 * Free TURN via Open Relay Project (openrelay.metered.ca) — no signup needed.
 * For production, replace with Metered.ca paid plan or self-hosted coturn.
 */
export async function GET() {
    const turnUrl = process.env.TURN_SERVER_URL || 'openrelay.metered.ca';
    const turnUser = process.env.TURN_SERVER_USERNAME || 'openrelayproject';
    const turnPass = process.env.TURN_SERVER_PASSWORD || 'openrelayproject';

    const iceServers: RTCIceServer[] = [
        // ── STUN (free, always include) ────────────────────────────────────────
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: `stun:${turnUrl}:80` },
        { urls: `stun:${turnUrl}:443` },

        // ── TURN UDP ───────────────────────────────────────────────────────────
        // Works in most networks; blocked by strict firewalls
        {
            urls: `turn:${turnUrl}:80`,
            username: turnUser,
            credential: turnPass,
        },
        {
            urls: `turn:${turnUrl}:443`,
            username: turnUser,
            credential: turnPass,
        },

        // ── TURN TCP / TLS (port 443) ──────────────────────────────────────────
        // Tunnels through HTTPS port — works even behind aggressive firewalls /
        // university networks that block UDP entirely
        {
            urls: `turn:${turnUrl}:443?transport=tcp`,
            username: turnUser,
            credential: turnPass,
        },
        {
            urls: `turns:${turnUrl}:443?transport=tcp`,
            username: turnUser,
            credential: turnPass,
        },
    ];

    return NextResponse.json({ iceServers }, {
        headers: {
            // Cache for 5 minutes — TURN credentials are typically valid for hours
            'Cache-Control': 'private, max-age=300',
        },
    });
}
