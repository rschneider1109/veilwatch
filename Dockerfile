FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App code + site
COPY server.js ./server.js
COPY site ./site

# Data dir for any local artifacts (optional)
RUN mkdir -p /app/data

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
