# ============================================================
# CleanTalk — Single Container Dockerfile
# ============================================================
# Bundles: React + Node.js + FastAPI + Redis + MySQL + Nginx
# Process manager: Supervisor
#
# Build:  docker build -t cleantalk .
# Run:    docker run -p 3000:3000 cleantalk
# Render: Just connect your GitHub repo — it auto-detects this
# ============================================================

# ─── Stage 1: Build React frontend ──────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY client/package*.json ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm ci
COPY client/ ./
ENV REACT_APP_API_URL=/api
ENV REACT_APP_SOCKET_URL=__AUTO__
RUN npm run build

# ─── Stage 2: Install Node.js backend deps ──────────────────
FROM node:20-alpine AS backend-deps
WORKDIR /build
COPY server/package*.json ./
RUN npm ci --only=production

# ─── Stage 3: Final unified image ───────────────────────────
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    nginx \
    redis-server \
    supervisor \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    mysql-server \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ─── Create directories ─────────────────────────────────────
RUN mkdir -p \
    /app/server \
    /app/ai-service \
    /app/database \
    /var/www/html \
    /var/log/supervisor \
    /run/mysqld \
    /app/server/uploads/posts \
    /app/server/uploads/stories

# ─── Copy React build (static files) ────────────────────────
COPY --from=frontend-build /build/build /var/www/html

# ─── Copy Node.js backend ───────────────────────────────────
COPY --from=backend-deps /build/node_modules /app/server/node_modules
COPY server/ /app/server/

# ─── Copy AI service + worker ────────────────────────────────
COPY ai-service/ /app/ai-service/

# ─── Copy database schema ───────────────────────────────────
COPY database/MASTER_SETUP.sql /app/database/MASTER_SETUP.sql

# ─── Install Python dependencies ────────────────────────────
WORKDIR /app/ai-service
RUN pip3 install --no-cache-dir --upgrade pip \
    && pip3 install --no-cache-dir \
        torch==2.3.1 \
        --index-url https://download.pytorch.org/whl/cpu \
    && pip3 install --no-cache-dir -r requirements.txt

# ─── Copy deploy configs ────────────────────────────────────
COPY deploy/nginx.conf /etc/nginx/sites-available/default
COPY deploy/supervisord.conf /etc/supervisor/conf.d/cleantalk.conf
COPY deploy/start.sh /app/start.sh
# Fix Windows CRLF line endings → Unix LF
RUN sed -i 's/\r$//' /app/start.sh /etc/nginx/sites-available/default /etc/supervisor/conf.d/cleantalk.conf
RUN chmod +x /app/start.sh

# ─── MySQL permissions ──────────────────────────────────────
RUN chown -R mysql:mysql /var/lib/mysql /run/mysqld

# ─── Environment defaults ───────────────────────────────────
ENV PORT=3000
ENV DB_HOST=localhost
ENV DB_USER=root
ENV DB_PASSWORD=cleantalk_password
ENV DB_NAME=socialconnect
ENV REDIS_HOST=localhost
ENV REDIS_PORT=6379
ENV AI_SERVICE_URL=http://localhost:8000
ENV JWT_SECRET=cleantalk_jwt_secret_change_in_production
ENV JWT_EXPIRE=7d
ENV CLIENT_URL=*
ENV NODE_ENV=production
ENV INSTANCE_ID=backend-1
ENV WORKER_ID=worker-1
ENV QUEUE_NAME=content-moderation
ENV BACKEND_URL=http://localhost:5000
ENV EMAIL_USER=cleantalk.verify@gmail.com
ENV EMAIL_PASS=tycsvumipncjsscj

EXPOSE 3000

WORKDIR /app
CMD ["/app/start.sh"]
