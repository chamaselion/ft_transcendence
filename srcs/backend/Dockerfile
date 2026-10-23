FROM node:22-alpine

WORKDIR /usr/src/app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

RUN mkdir -p /usr/src/app/certs \
    && openssl req -x509 -nodes -newkey rsa:2048 \
        -days 365 \
        -keyout /usr/src/app/certs/backend.key \
        -out /usr/src/app/certs/backend.crt \
        -subj "/CN=backend" \
        -addext "subjectAltName=DNS:backend,DNS:localhost,IP:127.0.0.1" \
    && chmod 600 /usr/src/app/certs/backend.key

# ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]
