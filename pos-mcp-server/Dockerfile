FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev || npm install

COPY . .

EXPOSE 3333

ENV PORT=3333
ENV NODE_ENV=production

CMD ["node", "server.js"]
