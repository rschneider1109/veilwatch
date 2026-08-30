FROM node:20-alpine
WORKDIR /app

# Install runtime + 3D build dependencies
COPY package.json ./
RUN npm install --omit=dev

# Build the browser-side Three.js/VRM renderer into public/js
COPY build-3d.js ./
COPY src ./src
COPY public ./public
RUN npm run build:3d

# App code
COPY app.js ./

ENV PORT=8080
EXPOSE 8080
CMD ["node", "app.js"]
