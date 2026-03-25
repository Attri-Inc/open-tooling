FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc -p tsconfig.json

RUN npm prune --omit=dev

RUN mkdir -p /data

ENV CRM_DB_PATH=/data/crm.db
ENV PORT=8787

EXPOSE 8787

CMD ["node", "dist/server.js"]
