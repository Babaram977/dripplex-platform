FROM node:22-alpine

WORKDIR /app

COPY dripplex-mail-bridge/package.json ./package.json
RUN npm install --omit=dev

COPY dripplex-mail-bridge/index.js ./index.js

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "index.js"]
