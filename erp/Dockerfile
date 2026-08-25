# Nexus ERP — production container
FROM node:22-slim

WORKDIR /app

# Install server deps first (better layer caching)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Install and build the client
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copy server source
COPY server/ ./server/

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# SQLite data lives here — mount a volume to persist it
VOLUME ["/app/data"]

CMD ["node", "server/index.js"]
