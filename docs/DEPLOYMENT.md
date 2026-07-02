# Deployment Guide

This document describes how to deploy and configure the CAPTCHA OCR application in development and production environments.

---

## 1. Environment Variables

Configure settings in `backend/.env` (and similarly for production environment injections):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MODEL_PATH` | `weights/final_resnet18_captcha.pth` | Path to PyTorch model weights file |
| `NUM_CHARS` | `31` | Output vocabulary size |
| `MAX_FILE_SIZE_BYTES` | `5242880` (5MB) | Maximum file size limit |
| `MAX_BATCH_SIZE` | `5` | Maximum files in batch upload |
| `IMAGE_HEIGHT` | `100` | Preprocessed image height |
| `IMAGE_WIDTH` | `200` | Preprocessed image width |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins list |

For the Next.js frontend, configure `frontend/.env.local`:
- `NEXT_PUBLIC_API_URL`: Path to backend API routes (`http://localhost:8000/api/v1`).

---

## 2. Docker Compose Deployment (Recommended)

To build and run the entire multi-container application locally:

```bash
# Build and run containers
docker compose up --build -d

# View service logs
docker compose logs -f

# Stop containers
docker compose down
```

The services will be exposed at:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/docs`

---

## 3. Local Virtual Environment Setup

If running without Docker:

### A. Start Backend
1. Create virtualenv:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the uvicorn server:
   ```bash
   uvicorn app.main:app --port 8000 --reload
   ```

### B. Start Frontend
1. Install node dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```

---

## 4. Production Hardening Notes

When deploying to a public cloud (e.g. AWS ECS, GCP Cloud Run, or Kubernetes):

- **Reverse Proxy**: Place an Nginx reverse proxy or cloud load balancer in front of the FastAPI app to handle SSL termination, redirect HTTP to HTTPS, and enforce additional request timeouts.
- **CORS Configuration**: Change `CORS_ORIGINS` from `["*"]` to the actual frontend URL domain:
  ```env
  CORS_ORIGINS=["https://my-ocr-app.com"]
  ```
- **Compute Instance Selection**: The backend runs fallback CPU calculations efficiently (~170ms latency per request). For high-throughput environments (>50 requests/sec), deploy on CUDA-supported GPU nodes to achieve sub-50ms inference.
