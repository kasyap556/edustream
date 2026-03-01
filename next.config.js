/** @type {import('next').NextConfig} */
const nextConfig = {
    // Disable StrictMode: it double-mounts every useEffect in dev, which causes
    // SocketContext to create/destroy/recreate the socket, changing the socket
    // reference and double-triggering useWebRTC → double join-room → connection failure.
    reactStrictMode: false,
    turbopack: {
        root: __dirname,
    },
};

module.exports = nextConfig;
