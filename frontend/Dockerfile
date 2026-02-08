# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
# VITE_API_BASE_URL and VITE_APP_NAME must be available at build time
ARG VITE_API_BASE_URL
ARG VITE_APP_NAME="Simple Invites"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
# nginx:alpine automatically processes .template files in /etc/nginx/templates/
# and substitutes environment variables using envsubst
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

# Use nginx:alpine's default entrypoint which handles template processing

