# node:22 is required, not optional: sanitize-html@2.17.6 declares
# "engines": { "node": ">=22.12.0" } and pulls in htmlparser2@12, which is a
# pure ESM package ("type": "module"). sanitize-html itself is CommonJS and
# does require('htmlparser2'), and require() of an ES module only works from
# Node 22.12 (resp. 20.19) onwards. On node:18 the backend crashes at startup
# with ERR_REQUIRE_ESM before it ever reaches the DB.
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]
