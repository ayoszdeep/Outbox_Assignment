# The app runs straight from TypeScript through ts-node, exactly as it does locally.
# There is deliberately no `tsc` build step: src/ also holds plain .js files (the sequelize
# models, the migrations and the worker entrypoint) and tsconfig has allowJs off, so a
# compiled dist/ would be missing them and crash on first require.
FROM node:20-bookworm-slim

WORKDIR /app

# argon2 falls back to compiling from source whenever no prebuilt binary matches the
# platform, so the toolchain has to be present before npm ci runs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Dev dependencies stay in the image on purpose: ts-node and typescript run the app, and
# sequelize-cli runs the migrations.
RUN npm ci --include=dev

COPY . .

# Types are checked in development with `npx tsc --noEmit`; skipping the per-start check
# keeps container boot fast and stops a type error from taking the service down.
ENV NODE_ENV=production \
    TS_NODE_TRANSPILE_ONLY=true \
    PORT=3001

EXPOSE 3001

# API only. Deploy the worker as a second Northflank service from this same image with its
# run command overridden to `npm run worker` — this keeps the two independently restartable,
# same as local development. A single-container "npm start & npm run worker" was tried and
# reverted: when the worker process died, the whole container (API included) died with it,
# producing a crash loop instead of a stable API.
CMD ["npm", "start"]
