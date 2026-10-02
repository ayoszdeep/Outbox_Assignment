// Runs the API and the worker as two independently-restartable PM2 processes inside one
// container. Replaces the earlier `npm start & npm run worker` CMD, which coupled their
// lifecycles: a worker crash took the whole container (API included) down with it and
// produced a crash loop in production. PM2 restarts only the process that died.
module.exports = {
  apps: [
    {
      name: 'api',
      script: 'npm',
      args: 'start',
      autorestart: true,
      restart_delay: 3000,
    },
    {
      name: 'worker',
      script: 'npm',
      args: 'run worker',
      autorestart: true,
      restart_delay: 3000,
    },
  ],
};
