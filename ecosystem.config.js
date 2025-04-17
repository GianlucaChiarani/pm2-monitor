module.exports = {
  apps: [
    {
      name: "pm2-monitor",
      script: "./dist/pm2-monitor.js",
      mode: "fork",
      watch: false,
    },
  ],
};
