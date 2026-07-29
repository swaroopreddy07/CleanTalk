# SocialConnect — Scaling Strategy

## Phased Scaling Roadmap

### Phase 1: MVP (Current)

```
Scope: Comments + Post Captions
Architecture: Synchronous HTTP

Frontend → Backend → AI Service (single instance) → MySQL
                                                   → moderation_logs
```

**Performance Characteristics:**
- Latency: ~100-200ms per moderation check (DistilBERT inference)
- Throughput: ~50-100 requests/second (single AI instance, CPU)
- Storage: ~1KB per moderation log entry

**Suitable for**: Up to ~10,000 daily active users

---

### Phase 2: Direct Messages

**Timeline**: After MVP stabilization

```
Scope: + Direct Messages
Architecture: Synchronous HTTP (same pattern)

messageController.sendMessage()
    │
    ▼
moderationService.checkContent(message)
    │
    ▼
AI Service → score → allow/warn/block

moderation_logs.content_type → ENUM('comment', 'caption', 'message')
```

**Changes Required:**
1. Add `'message'` to `content_type` ENUM in `moderation_logs`
2. Add moderation check in `messageController.sendMessage()`
3. Add moderation UI in `Messages.js` component
4. Consider: messages are private — softer moderation (warn only, no block)

---

### Phase 3: Horizontal Scaling

**Timeline**: When single AI instance hits capacity (~100 req/s)

```
                    ┌──────────────┐
                    │ Load Balancer│
                    │  (nginx)     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
         │Backend 1│ │Backend 2│ │Backend N│
         └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
         │AI Svc 1 │ │AI Svc 2 │ │AI Svc N │
         └─────────┘ └─────────┘ └─────────┘
```

**Docker Compose scaling:**
```bash
docker-compose up --scale ai-service=3 --scale backend=2
```

**Changes Required:**
1. Add nginx load balancer service to `docker-compose.yml`
2. Make Socket.IO stateless with Redis adapter (`@socket.io/redis-adapter`)
3. Move session/socket state to Redis
4. Add sticky sessions for WebSocket connections

---

### Phase 4: Asynchronous Processing with Message Queue

**Timeline**: When synchronous moderation adds unacceptable latency

```
Current (synchronous):
  Comment → Backend → AI Service → Response → Insert
  Total latency: ~200ms

Future (asynchronous):
  Comment → Backend → Insert (status: 'pending') → Kafka → AI Worker
                                                              │
                                                              ▼
                                               Update status: 'approved'/'rejected'
                                               Emit Socket.IO event to client
```

**Architecture:**
```
Backend → Kafka/RabbitMQ → AI Worker Pool → MySQL update
                                          → Socket.IO notification
```

**Benefits:**
- Comment appears instantly (pending state)
- AI processing happens in background
- Can handle burst traffic
- Workers scale independently

**Changes Required:**
1. Add `status` column to `comments` table: `ENUM('pending', 'approved', 'rejected')`
2. Create Kafka producer in `moderationService.js`
3. Create AI worker process that consumes from Kafka
4. Frontend shows pending indicator while comment is being moderated
5. Socket.IO emits moderation result to user

---

### Phase 5: Redis Caching

**Timeline**: When same content is submitted frequently

```
Comment Text → Hash → Redis Cache Check
                         │
                    ┌─────┴─────┐
                    │           │
                 HIT          MISS
                    │           │
              Return cached   AI Service
              result          prediction
                              │
                         Store in Redis
                         TTL: 1 hour
```

**Implementation:**
```javascript
// In moderationService.js
const crypto = require('crypto');
const redis = require('redis');

async function checkContent(text) {
  const hash = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  
  // Check cache
  const cached = await redis.get(`mod:${hash}`);
  if (cached) return JSON.parse(cached);
  
  // AI service call
  const result = await callAIService(text);
  
  // Cache for 1 hour
  await redis.setex(`mod:${hash}`, 3600, JSON.stringify(result));
  
  return result;
}
```

**Benefits:**
- Eliminates duplicate AI calls for identical text
- Reduces AI service load by 30-50% (typical comment patterns)
- Sub-millisecond response for cached results

---

### Phase 6: Multimodal Moderation

**Timeline**: Phase 3 of original roadmap

```
Post with Image + Caption
    │
    ├── Caption → NLP Model (DistilBERT) → Text Score
    │
    └── Image → Vision Model (CLIP/ViT) → Image Score
                                              │
                                    Combined Decision
                                              │
                                    max(text_score, image_score)
                                              │
                                   allow / warn / block
```

**New AI Service Endpoints:**
```
POST /predict/text   → Existing (DistilBERT)
POST /predict/image  → New (CLIP or ViT for NSFW/violence)
POST /predict/multi  → New (combined text + image)
```

---

### Phase 7: Kubernetes Migration

**Timeline**: When Docker Compose can't scale enough

```yaml
# kubernetes/ai-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    spec:
      containers:
      - name: ai-service
        image: socialconnect/ai-service:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        ports:
        - containerPort: 8000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ai-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ai-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## Performance Targets

| Metric | Phase 1 | Phase 3 | Phase 7 |
|--------|---------|---------|---------|
| **DAU** | 10K | 100K | 1M+ |
| **Moderation latency** | <200ms | <200ms | <100ms |
| **Throughput** | 100 req/s | 500 req/s | 5000+ req/s |
| **AI instances** | 1 | 3-5 | Auto (2-10) |
| **Availability** | 99% | 99.9% | 99.99% |
| **GPU** | CPU only | Optional | GPU recommended |

---

## Cost Estimates

| Phase | Infrastructure | Monthly Cost (Estimate) |
|-------|---------------|------------------------|
| Phase 1 (MVP) | 1 VM (4GB RAM) | $20-40 |
| Phase 3 (Scale) | 3 VMs + RDS | $150-300 |
| Phase 7 (K8s) | EKS/GKE cluster | $500-2000 |

---

## Why This Architecture Scales

1. **`moderationService.js` abstracts AI communication** — swap HTTP for Kafka without changing controllers
2. **AI service is stateless** — model in memory, no database dependency, easy to replicate
3. **Docker Compose → K8s migration is straightforward** — same containers, different orchestrator
4. **`moderation_logs` provides audit trail** — analytics, retraining data, compliance at any scale
5. **Threshold configuration via environment variables** — tune without code changes
