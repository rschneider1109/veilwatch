FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# App code
WORKDIR /app
COPY app.js ./
COPY public ./public
CMD ["node","app.js"]

ENV PORT=8080
EXPOSE 8080

CMD ["node", "app.js"]
