# Multi-stage build for React Vite application
FROM node:18-alpine as build

# Set working directory
WORKDIR /app

# Copy package files first
COPY frontend/package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code (excluding node_modules)
COPY frontend/src ./src
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./
COPY frontend/tsconfig*.json ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.js ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]