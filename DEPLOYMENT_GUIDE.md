# SocialConnect — Deployment Guide

## Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| **Docker Desktop** | 20.10+ | Containerized deployment |
| **Docker Compose** | 2.0+ | Multi-service orchestration |
| **Node.js** | 18+ | Local backend development |
| **Python** | 3.10+ | Local AI service development |
| **MySQL** | 8.0+ | Local database (without Docker) |
| **Git** | 2.0+ | Source control |

---

## Environment Variables Reference

### Backend (`server/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=socialconnect

# Authentication
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRE=7d

# Client
CLIENT_URL=http://localhost:3000

# AI Moderation
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_TIMEOUT=5000
MODERATION_WARN_THRESHOLD=0.70
MODERATION_BLOCK_THRESHOLD=0.90

# Azure Storage (optional — falls back to local storage)
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_ACCOUNT_NAME=
AZURE_CONTAINER_PROFILES=profile-pictures
AZURE_CONTAINER_POSTS=post-images
AZURE_CONTAINER_STORIES=story-images
```

### AI Service (environment variables)

```env
MODEL_NAME=unitary/toxic-bert
WARN_THRESHOLD=0.70
BLOCK_THRESHOLD=0.90
MAX_INPUT_LENGTH=5000
LOG_LEVEL=INFO
```

### Frontend (`client/.env`)

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## Option 1: Docker Compose (Recommended)

### Quick Start

```bash
# Clone the repository
cd socialConnect

# Start all 5 services
docker-compose up --build

# Or in detached mode
docker-compose up --build -d
```

This starts:
- **frontend** → http://localhost:3000
- **backend** → http://localhost:5000
- **ai-service** → http://localhost:8000
- **db** (MySQL) → localhost:3306
- **redis** → localhost:6379

### First Run Notes

The **AI service** will download the `unitary/toxic-bert` model from HuggingFace on first start (~500MB). This may take 2-5 minutes depending on your internet connection. The model is cached in a Docker volume (`model_cache`) for subsequent runs.

### Verify Services

```bash
# Check all services are running
docker-compose ps

# Check AI service health
curl http://localhost:8000/health

# Check backend health
curl http://localhost:5000/api/health

# Test toxicity prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "Great photo!"}'

# Test toxic content
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "I hate you, you are terrible"}'
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f ai-service
docker-compose logs -f backend

# View moderation logs in database
docker-compose exec db mysql -u root -psocialconnect_password socialconnect \
  -e "SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT 10;"
```

### Stop Services

```bash
# Stop (preserve data)
docker-compose down

# Stop and delete all data
docker-compose down -v
```

---

## Option 2: Local Development (Without Docker)

### Step 1: Database Setup

```bash
# Start MySQL and create database
mysql -u root -p < database/MASTER_SETUP.sql

# Or run the migration for existing databases
cd server
node scripts/migration-add-moderation.js
```

### Step 2: AI Service

```bash
cd ai-service

# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Start the service (model downloads on first run)
uvicorn app:app --host 0.0.0.0 --port 8000 --reload

# Verify
curl http://localhost:8000/health
```

### Step 3: Backend

```bash
cd server

# Install dependencies
npm install

# Create .env file (see Environment Variables above)
copy .env.example .env  # Edit with your settings

# Start the server
npm run dev   # With nodemon (auto-restart)
# or
node server.js

# Verify
curl http://localhost:5000/api/health
```

### Step 4: Frontend

```bash
cd client

# Install dependencies
npm install

# Create .env file
echo REACT_APP_API_URL=http://localhost:5000/api > .env

# Start development server
npm start

# Opens http://localhost:3000
```

---

## Database Migration (Existing Databases)

If you already have a running SocialConnect database and just need to add the moderation table:

```bash
cd server
node scripts/migration-add-moderation.js
```

This script:
1. Creates `moderation_logs` table if it doesn't exist
2. Verifies the table was created
3. Shows the table structure

---

## Troubleshooting

### AI Service won't start

**Problem**: `RuntimeError: Failed to load model`
**Solution**: Ensure you have internet access for the first model download. The model is ~500MB.

```bash
# Test manually
python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('unitary/toxic-bert')"
```

### Backend can't connect to AI service

**Problem**: `AI Moderation Service unavailable`
**Solution**: The backend operates in **fail-open** mode — content is allowed through. Check:

```bash
curl http://localhost:8000/health
```

If the AI service is down, start it first. The backend will reconnect automatically.

### MySQL connection refused

**Problem**: `ECONNREFUSED 127.0.0.1:3306`
**Solution**: Ensure MySQL is running and credentials in `.env` match.

### Docker memory issues

**Problem**: AI service OOM killed
**Solution**: The AI service needs ~1.5GB RAM. Ensure Docker Desktop has at least 4GB allocated.

```yaml
# docker-compose.yml — already configured
deploy:
  resources:
    limits:
      memory: 2G
```

### CORS errors

**Problem**: `Access-Control-Allow-Origin` errors in browser
**Solution**: Ensure `CLIENT_URL` in backend `.env` matches your frontend URL. In Docker, CORS is wide-open by default.
