FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# App code
COPY app.js ./app.js

ENV PORT=8080
EXPOSE 8080

CMD ["node", "app.js"]
