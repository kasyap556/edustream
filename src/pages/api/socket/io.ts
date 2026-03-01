/**
 * This file is intentionally a no-op stub.
 *
 * The actual Socket.IO server is mounted on the custom Node.js HTTP server
 * defined in server.js at the root of the project.
 *
 * When running `node server.js`, Socket.IO listens at /api/socket/io
 * directly on the HTTP server — this Next.js Pages API route is never
 * reached by Socket.IO upgrade requests.
 *
 * This stub exists only to prevent a 404 for any stray GET /api/socket/io
 * HTTP requests (e.g., health checks).
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    api: { bodyParser: false },
};

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
    // Socket.IO is handled by server.js — nothing needed here.
    res.status(200).json({ status: 'Socket.IO is served by server.js' });
}
