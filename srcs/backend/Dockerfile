FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]
