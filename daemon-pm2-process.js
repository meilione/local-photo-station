{
  apps : [{
    name        : "local-photo-station",
    script      : "./daemon.js",
    env: {
      "NODE_ENV": "development",
    },
    args: "-c='rename'",
    error_file: '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.import-logs/pm2-daemon-out.log',
    out_file: '/home/yvesmeili/Sites/zivi/local-photo-station/digital-asset-management/.import-logs/pm2-daemon-err.log',
    restart_delay: 10000
  }]
}