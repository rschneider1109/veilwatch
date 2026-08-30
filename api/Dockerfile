FROM node:20-alpine AS builder
WORKDIR /build

COPY package.json ./
RUN npm install --omit=dev

COPY build-3d.js ./
COPY src ./src
COPY public ./public
RUN npm run build:3d

FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/public ./public
COPY app.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "app.js"]
