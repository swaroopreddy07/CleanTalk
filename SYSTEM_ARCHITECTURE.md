# SocialConnect — System Architecture

## Overview

SocialConnect is a full-stack social media platform with **AI-powered content moderation**. The system uses a **DistilBERT-based model** (fine-tuned on the Jigsaw Toxic Comment Dataset) to classify user-generated content across 6 toxicity categories in real-time.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + MUI)                        │
│                                                                     │
│   PostCard.js ──► Comment Submit ───┐                               │
│   PostModal.js ─► Comment Submit ───┤                               │
│   CreatePost.js ► Caption Submit ───┤                               │
│                                     ▼                               │
│                       POST /api/posts/...                           │
│                     (Authorization: Bearer JWT)                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP (port 3000 → 5000)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                      │
│                                                                     │
│   middleware/auth.js ──► JWT Verification                           │
│                                                                     │
│   postController.createPost() ──┐                                   │
│   postController.addComment() ──┤                                   │
│                                 ▼                                   │
│         moderationService.checkContent(text)                        │
│                                 │                                   │
│                    HTTP POST /predict                                │
│                                 │                                   │
│              ┌──────────────────┼──────────────────┐                │
│              │                  │                  │                │
│         score < 0.70      0.70 ≤ score < 0.90   score ≥ 0.90      │
│              │                  │                  │                │
│           ALLOW              WARN (422)        BLOCK (403)         │
│              │                  │                  │                │
│        INSERT INTO         Return warning      Log to              │
│        comments/posts      to frontend         moderation_logs     │
│              │                                     │                │
│              ▼                                     ▼                │
│         Return 201                           Return 403            │
└──────────┬──────────────────────────────────────────────────────────┘
           │ HTTP (port 5000 → 8000)         │ MySQL (port 3306)
           ▼                                 ▼
┌──────────────────────┐         ┌──────────────────────┐
│  AI SERVICE (FastAPI) │         │   DATABASE (MySQL 8)  │
│                       │         │                       │
│  POST /predict        │         │  users                │
│    ► Tokenize text    │         │  posts                │
│    ► DistilBERT infer │         │  comments             │
│    ► Sigmoid scores   │         │  likes                │
│    ► Return labels    │         │  followers            │
│                       │         │  messages             │
│  GET /health          │         │  notifications        │
│    ► Model status     │         │  stories              │
│                       │         │  saved_posts          │
│  Model:               │         │  moderation_logs ←NEW │
│  unitary/toxic-bert   │         │                       │
│  (Jigsaw dataset)     │         └───────────────────────┘
└───────────────────────┘
           │
     ┌─────┴─────┐
     │   REDIS   │
     │  (Cache)  │
     └───────────┘
```

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 18.2.0 | UI framework |
| **UI Components** | Material-UI (MUI) | 5.14.19 | Component library |
| **HTTP Client** | Axios | 1.6.2 | API communication |
| **Real-Time** | Socket.IO Client | 4.5.4 | WebSocket messaging |
| **Routing** | React Router DOM | 6.20.0 | Client-side routing |
| **Backend** | Node.js + Express | 4.18.2 | REST API server |
| **Auth** | JWT (jsonwebtoken) | 9.0.2 | Token-based authentication |
| **Password** | bcryptjs | 2.4.3 | Password hashing |
| **File Upload** | Multer | 1.4.5 | Multipart form handling |
| **Cloud Storage** | Azure Blob Storage | 12.28.0 | Image hosting |
| **Database** | MySQL | 8.0 | Relational data store |
| **AI Framework** | FastAPI | 0.104.1 | AI microservice |
| **ML Model** | HuggingFace Transformers | 4.35+ | DistilBERT inference |
| **ML Runtime** | PyTorch | 2.0+ | Tensor computation |
| **Cache** | Redis | 7 | Session cache (future) |
| **Containers** | Docker + Compose | Latest | Containerization |

---

## AI Moderation Pipeline

### Model: `unitary/toxic-bert`

A BERT-based model fine-tuned on the **Jigsaw Toxic Comment Classification** dataset from Kaggle. It classifies text across 6 toxicity categories:

| Label | Description | Example |
|-------|-------------|---------|
| `toxic` | Generally toxic language | "You're so dumb" |
| `severe_toxic` | Extremely toxic | Extreme profanity/slurs |
| `obscene` | Obscene language | Vulgar content |
| `threat` | Threats of violence | "I will hurt you" |
| `insult` | Personal insults | "You're an idiot" |
| `identity_hate` | Identity-based hate | Slurs targeting groups |

### Threshold-Based Moderation

```
Input Text
    │
    ▼
Tokenizer (AutoTokenizer)
    │
    ▼
BERT Model (AutoModelForSequenceClassification)
    │
    ▼
Logits → Sigmoid → Probabilities (6 scores, 0.0 to 1.0)
    │
    ▼
Max Score = toxicity_score
    │
    ├── score < 0.70  ────► ALLOW  (publish automatically)
    ├── 0.70 ≤ score < 0.90 ► WARN   (show warning, user can edit or force post)
    └── score ≥ 0.90  ────► BLOCK  (hard block, log to moderation_logs)
```

### Fail-Open Behavior

If the AI service is unreachable (network error, timeout, crash), the backend **allows content through** without moderation. This prevents the AI service from becoming a single point of failure.

```
AI Service Down?
    │
    ├── YES → Allow content, log warning to console
    └── NO  → Normal moderation flow
```

---

## Comment Moderation Flow (Step by Step)

```
1. User types comment in PostCard.js or PostModal.js
2. User presses Enter or clicks "Post"
3. Frontend: POST /api/posts/:postId/comment { content, forcePost: false }
4. Backend: middleware/auth.js verifies JWT token
5. Backend: postController.addComment() validates content not empty
6. Backend: moderationService.checkContent(content)
7. Backend → AI Service: POST http://ai-service:8000/predict { text: content }
8. AI Service: Tokenize → BERT inference → Sigmoid → Max score
9. AI Service → Backend: { toxicity_score, labels, prediction, action }
10. Backend evaluates action:

    IF action === 'block' (score ≥ 0.90):
        → INSERT INTO moderation_logs (action_taken='blocked')
        → Return 403 { moderated: true, action: 'block', message: '...' }
        → Frontend shows red Alert: "Your comment violates community guidelines."

    IF action === 'warn' AND forcePost === false (score 0.70-0.89):
        → INSERT INTO moderation_logs (action_taken='warned')
        → Return 422 { moderated: true, action: 'warn', message: '...' }
        → Frontend shows yellow Alert with [Edit] and [Post Anyway] buttons

    IF action === 'warn' AND forcePost === true:
        → INSERT INTO moderation_logs (action_taken='force_posted')
        → Proceed to insert comment normally

    IF action === 'allow' (score < 0.70):
        → INSERT INTO comments
        → INSERT INTO notifications (if commenter ≠ post owner)
        → Return 201 { success: true, comment: {...} }
        → Frontend adds comment to list, shows success snackbar
```

---

## Database Schema: moderation_logs

```sql
CREATE TABLE moderation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,                                 -- Who submitted the content
    post_id INT,                                          -- Related post (nullable)
    content TEXT NOT NULL,                                -- Original text
    content_type ENUM('comment', 'caption') NOT NULL,     -- What type of content
    prediction VARCHAR(50) NOT NULL,                      -- Highest toxicity label
    confidence DECIMAL(5,4) NOT NULL,                     -- Toxicity score (0.0000-1.0000)
    labels JSON,                                          -- Full label breakdown
    action_taken ENUM('blocked','warned','force_posted'), -- What happened
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
);
```

---

## Service Communication

| From | To | Protocol | Port | Endpoint |
|------|----|----------|------|----------|
| Frontend | Backend | HTTP/WS | 5000 | `/api/*`, Socket.IO |
| Backend | AI Service | HTTP | 8000 | `/predict`, `/health` |
| Backend | MySQL | TCP | 3306 | mysql2 driver |
| Backend | Redis | TCP | 6379 | redis client |

---

## Security Considerations

- **JWT Authentication**: All API routes protected via Bearer tokens (7-day expiry)
- **Password Hashing**: bcrypt with 10 salt rounds
- **SQL Injection**: Parameterized queries (mysql2 prepared statements)
- **Content Moderation**: AI-powered toxicity detection before content storage
- **CORS**: Configurable per environment
- **Fail-Open**: Moderation failure doesn't block the application
- **Audit Trail**: All moderation events logged with full context
