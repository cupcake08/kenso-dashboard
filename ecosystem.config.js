module.exports = {
  apps: [
    {
      name: "kenso-dashboard",
      cwd: "/var/www/kenso-dashboard",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        NEXT_PUBLIC_API_BASE: "https://kenso.yourdomain.com",
        NEXT_PUBLIC_FIREBASE_API_KEY: "",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "",
        NEXT_PUBLIC_FIREBASE_APP_ID: "",
      },
      instances: 1,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
