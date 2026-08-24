# Production image for the Florida Roleplay site + API.
#
# One process serves both the built client and the Express API from the same
# origin — see server/src/index.js. The build script installs the client's dev
# dependencies (Vite is one), builds client/dist, then installs only the
# server's production dependencies. Nothing platform-specific lives here, so the
# same image runs on Northflank, Railway, Fly, or a plain VM.
FROM node:22-slim

WORKDIR /app

# Copy the whole monorepo. .dockerignore keeps node_modules, .git and local
# build output out, so this is source only.
COPY . .

# Installs client dev deps, builds the client, installs server prod deps.
RUN npm run build

# The server reads PORT; Northflank routes to whatever container port you set.
# 4000 is the app's own default, so it works with or without PORT injected.
ENV PORT=4000
EXPOSE 4000

# db:init is idempotent (every statement is IF NOT EXISTS), so running it on
# each start is safe and means a fresh database is ready without a manual step.
CMD ["sh", "-c", "npm run db:init && npm start"]
