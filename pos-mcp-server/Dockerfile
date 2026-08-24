FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
