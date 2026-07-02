# Deployment Guide

How to configure and deploy VisionSeq in development and production environments.

**Live reference deployment:** [huggingface.co/spaces/Hardik-25/VisionSeq](https://huggingface.co/spaces/Hardik-25/VisionSeq)

---

## 1. Environment Variables

Backend config (`backend/.env`):

| Variable | Default | Description |
|---|---|---|
| `MODEL_PATH` | `weights/final_resnet18_captcha.pth` | Path to PyTorch model weights |
| `NUM_CHARS` | `31` | Output vocabulary size |
| `MAX_FILE_SIZE_BYTES` | `5242880` (5MB) | Max single-file upload size |
| `MAX_BATCH_SIZE` | `5` | Max files per batch request |
| `IMAGE_HEIGHT` | `100` | Preprocessed image height |
| `IMAGE_WIDTH` | `200` | Preprocessed image width |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins — **restrict in production** |

Frontend config (`frontend/.env.local`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL, e.g. `http://localhost:8000/api/v1` |

---

## 2. Docker Compose (Recommended)

```bash
# Build and run all services
docker compose up --build -d

# Tail logs
docker compose logs -f

# Stop
docker compose down
```

| Service | URL |
|---|---|
| Frontend | `http://localhost:3000` |
| Backend API | `http://localhost:8000` |
| Swagger Docs | `http://localhost:8000/docs` |

---

## 3. Local Virtual Environment

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 4. Cloud Deployment

VisionSeq's decoupled architecture supports independent deployment of frontend and backend.

### Reference deployment (this project)

The live demo runs the full stack as a single Docker image on **Hugging Face Spaces** — a practical choice for portfolio hosting since it requires no payment card and provides free CPU/GPU tiers. See [`huggingface.co/spaces/Hardik-25/VisionSeq`](https://huggingface.co/spaces/Hardik-25/VisionSeq).

### Alternative topologies

| Component | Recommended | Alternative |
|---|---|---|
| Frontend | Vercel | Any static/Next.js-compatible host |
| Backend | Render | Hugging Face Spaces, Railway, self-managed container host |

### Production hardening checklist

- **Reverse proxy:** place Nginx or a cloud load balancer in front of FastAPI for SSL termination, HTTP→HTTPS redirects, and request timeouts.
- **CORS:** replace the `["*"]` default with the actual frontend origin:
  ```env
  CORS_ORIGINS=["https://my-ocr-app.com"]
  ```
- **Compute sizing:** CPU inference runs efficiently at ~170ms/request; for sustained throughput above ~50 req/s, move to a CUDA-enabled instance to bring latency under 50ms.
- **Shared state:** the current rate limiter and request counters are in-process — if scaling to multiple backend instances, back them with Redis (or equivalent) instead of local memory.

## Related Documentation

- [Architecture](ARCHITECTURE.md) — what's being deployed
- [Hardening Notes](HARDENING.md) — security posture to configure per environment
- [Engineering Audit](AUDIT.md) — known scale-out caveats for multi-instance deployment
