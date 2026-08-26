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

# Vite inlines VITE_* into the bundle during `npm run build`, so the bot API URL
# has to exist as a build argument. A runtime environment variable arrives too
# late — by then the string is already compiled into client/dist and the bot
# dashboard renders its "not configured" screen. ARG sits after COPY so changing
# the URL doesn't invalidate the copy layer. Set it as a Build argument on the
# platform (Northflank → Build → Build arguments), not a runtime variable.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Installs client dev deps, builds the client, installs server prod deps.
RUN npm run build

# Run in production mode by default. This is set AFTER the build so npm still
# installs the client's dev dependencies (Vite) to build the bundle; at runtime
# it disables the development auth affordances (the x-preview-rank / x-discord-id
# header paths) and forces Secure cookies. Baking it here means a deploy cannot
# fail open by forgetting to set NODE_ENV — the safe state is the default.
ENV NODE_ENV=production

# The server reads PORT; Northflank routes to whatever container port you set.
# 4000 is the app's own default, so it works with or without PORT injected.
ENV PORT=4000
EXPOSE 4000

# db:init is idempotent (every statement is IF NOT EXISTS), so running it on
# each start is safe and means a fresh database is ready without a manual step.
CMD ["sh", "-c", "npm run db:init && npm start"]
