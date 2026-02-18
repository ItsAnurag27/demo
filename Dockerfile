FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV NODE_OPTIONS=--dns-result-order=ipv4first
EXPOSE 3000

CMD ["node", "src/server.js"]
