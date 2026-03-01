// PM2 ecosystem config — for VPS deployment
// Usage:
//   npm install -g pm2
//   npm run build
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup   ← persist across reboots

module.exports = {
    apps: [
        {
            name: 'edustream',
            script: 'server.js',
            instances: 1,           // Keep at 1 — Socket.IO requires sticky sessions for multi-instance
            exec_mode: 'fork',      // Not cluster — Socket.IO in-memory rooms won't work across workers
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            // Logging
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            // Restart policy
            max_restarts: 10,
            restart_delay: 4000,
            watch: false,
        },
    ],
};
