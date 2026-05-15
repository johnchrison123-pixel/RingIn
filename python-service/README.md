# RingIn ML Service

Python FastAPI microservice providing AI/ML features for the RingIn app:

- 🎯 **Expert recommendations** — personalized "people you may like"
- 📊 **Feed ranking** — personalized post ordering by interests + recency + engagement
- 🤝 **Matching** — geography + interests for Anonymous Connect
- 🛡️ **Content moderation** — spam, profanity, abuse detection
- 🏷️ **Auto-tagging** — detect topics in posts
- 📝 **Summarization** — extract key sentences
- 📈 **Analytics** — admin dashboard data (DAU, top users, retention, funnel)

---

## 🚀 Quick Start (Local)

### 1. Install Python 3.11+

```bash
python --version  # Should show 3.11 or higher
```

### 2. Install dependencies

```bash
cd python-service
pip install -r requirements.txt
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in:

```env
SUPABASE_URL=https://fnthuegoevgicqmzhwcw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
ALLOWED_ORIGINS=http://localhost:3000,https://ring-in.vercel.app
ADMIN_API_KEY=your-secret-here
```

### 4. Run the service

```bash
uvicorn app.main:app --reload --port 8000
```

Visit:
- **http://localhost:8000** — health check
- **http://localhost:8000/docs** — interactive API docs (Swagger UI)

---

## 📚 API Endpoints

### Recommendations
- `GET /api/recommend/experts/{user_id}?limit=8` — Personalized expert picks
- `GET /api/recommend/similar-users/{user_id}` — Users similar to this one
- `GET /api/recommend/trending-experts` — Globally trending experts

### Feed
- `GET /api/feed/personalized/{user_id}?limit=20` — Ranked feed

### Matching
- `POST /api/match/anonymous` — Anonymous Connect matching
- `GET /api/match/geography/{user_id}?radius=city` — Find local users
- `GET /api/match/by-interests?interests=tech,fitness` — Find by interests

### Detection
- `POST /api/detect/` — Check single text for spam/profanity/abuse
- `POST /api/detect/batch` — Bulk check

### AI Features
- `POST /api/ai/auto-tag` — Detect topics in a post
- `POST /api/ai/summarize` — Extract key sentences
- `GET /api/ai/trending-topics` — Trending hashtags + topics
- `POST /api/ai/extract-keywords` — Top keywords

### Analytics (Admin only)
Requires `x-admin-key` header.

- `GET /api/analytics/overview` — Total users, posts, messages
- `GET /api/analytics/daily-active?days=14` — DAU over N days
- `GET /api/analytics/top-users?by=posts` — Top users by posts/followers
- `GET /api/analytics/geography` — Users by country/state/city
- `GET /api/analytics/funnel` — Signup → posted → followed → messaged → called

---

## 🌐 Deployment

### Option 1: Render.com (Recommended)

1. Push the `python-service/` folder to a GitHub repo
2. Create a new **Web Service** on https://render.com
3. Connect your repo, set:
   - **Root directory**: `python-service`
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables (same as `.env`)
5. Deploy. Get a URL like `https://ringin-ml.onrender.com`
6. Update website `.env.local`:
   ```
   NEXT_PUBLIC_ML_SERVICE_URL=https://ringin-ml.onrender.com
   ```

**Cost**: Free tier (spins down after 15 min idle) → $7/mo for always-on

### Option 2: Railway.app

1. Sign up at https://railway.app
2. Deploy from GitHub → select `python-service` directory
3. Auto-detects Python, runs `uvicorn` from `Procfile`
4. Get a URL, update website env

**Cost**: $5/mo with 512 MB RAM

### Option 3: AWS Lambda + API Gateway

For serverless (pay only per call). Use **Mangum**:
```bash
pip install mangum
```
Wrap the app:
```python
from mangum import Mangum
handler = Mangum(app)
```

**Cost**: Pennies per million calls

### Option 4: Fly.io

```bash
flyctl launch
flyctl secrets set SUPABASE_URL=...
flyctl deploy
```

**Cost**: Free tier with 3 small VMs

---

## 📊 Admin Dashboard

The Next.js website includes `/admin` route that calls these analytics endpoints.

To access:
1. Open https://your-site.com/admin
2. Enter the `ADMIN_API_KEY` from your `.env`
3. View live metrics

⚠️ Keep `ADMIN_API_KEY` secret. Don't commit it. Use Vercel env vars for production.

---

## 🧪 Test The Service

```bash
# Health check
curl http://localhost:8000/health

# Get recommendations
curl http://localhost:8000/api/recommend/experts/USER_ID_HERE?limit=5

# Test detection
curl -X POST http://localhost:8000/api/detect/ \
  -H "Content-Type: application/json" \
  -d '{"text":"Buy crypto now!! guaranteed profit!!!"}'

# Get analytics (admin)
curl http://localhost:8000/api/analytics/overview \
  -H "x-admin-key: your-secret-here"
```

---

## 🔧 How It Works

```
Browser / Mobile App
       ↓
   Next.js Website
       ↓
  ┌────────────────┐
  │ ML Service     │ ← THIS SERVICE
  │ (FastAPI)      │
  └────────────────┘
       ↓
   Supabase DB
```

The Python service reads the same Supabase database that powers your app. It does NOT replace anything — it adds ML smarts on top.

If the ML service is down, the website falls back to non-personalized lists (graceful degradation).

---

## 🛠️ Adding More Features

Want to add an OpenAI-powered feature?

1. `pip install openai`
2. Add `OPENAI_API_KEY=...` to `.env`
3. Create a new route in `app/routes/`
4. Add it to `main.py` includes

Example: voice transcription with OpenAI Whisper, sentiment analysis, image moderation with Vision API.

---

## 📝 License

Internal RingIn use only.
