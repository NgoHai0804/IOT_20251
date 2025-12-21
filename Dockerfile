# syntax=docker/dockerfile:1.7

# Multi-stage build cho IoT Backend + Frontend

# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies với cache mount (nhanh hơn 5-10 lần)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# Copy source code
COPY frontend/ ./

# Build arguments cho frontend
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://iot-20251.onrender.com}
ENV NODE_ENV=production

# Build frontend
RUN npm run build:docker

# ============================================
# Stage 2: Python Backend
# ============================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements và install Python dependencies với cache mount
COPY backend/requirements.txt ./

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./

# Copy built frontend từ stage 1 vào thư mục static
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Health check (sử dụng PORT từ environment hoặc mặc định 8000)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import os, urllib.request; port = os.getenv('PORT', '8000'); urllib.request.urlopen(f'http://localhost:{port}/health')" || exit 1

# Run backend với uvicorn (hỗ trợ Render PORT)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
