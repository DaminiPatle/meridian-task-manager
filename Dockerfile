# Production image for the Meridian API.
# The API serves the built React app too when web/dist exists.
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/meridian.db

EXPOSE 4000

# index.js creates the schema and seeds the demo workspace on an empty database.
CMD ["node", "server/src/index.js"]
