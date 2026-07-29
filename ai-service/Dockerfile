# ─────────────────────────────────────────────────────────────
# AI Moderation Microservice — Production Dockerfile
# ─────────────────────────────────────────────────────────────
# Multi-stage-ready, slim Python base for minimal attack surface.
# Model weights are downloaded at first startup from HuggingFace Hub
# and cached in /root/.cache/huggingface/ for subsequent restarts.
# ─────────────────────────────────────────────────────────────

FROM python:3.10-slim

# Metadata
LABEL maintainer="AI Moderation Service"
LABEL description="Text toxicity analysis microservice using unitary/toxic-bert"

# Prevent Python from buffering stdout/stderr (important for Docker logs)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install system dependencies required by torch & transformers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (leverages Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip

RUN pip install --no-cache-dir \
    torch==2.3.1 \
    --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Create non-root user for production security
RUN useradd --create-home --shell /bin/bash appuser
# Keep root for HF cache write access on first model download;
# switch to appuser after model is cached if desired.

# Expose the application port
EXPOSE 8000

# Health check to verify the service is responsive
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the application with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
