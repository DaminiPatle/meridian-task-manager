# ---- Build the React UI -------------------------------------------------
FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci

COPY web ./web
RUN npm run build

# ---- Runtime: Express API + built UI on one port ------------------------
FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/meridian.db

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/web/dist ./web/dist

EXPOSE 4000

# index.js creates the schema and seeds the demo workspace on an empty database.
CMD ["node", "server/src/index.js"]
