# System Architecture

VisionSeq is built as a decoupled, service-oriented system: a Next.js frontend, a FastAPI backend, and an in-process PyTorch inference service. This document describes each component, their responsibilities, and how a request flows end-to-end.

**Live system:** [huggingface.co/spaces/Hardik-25/VisionSeq](https://huggingface.co/spaces/Hardik-25/VisionSeq)

---

## Architecture Diagram

```mermaid
graph TD
    User([User Client]) -->|Web UI| FE[Next.js Frontend]
    FE -->|REST API Requests| BE[FastAPI Backend]
    BE -->|Preprocessed Tensor| INF[PyTorch Inference Service]
    INF -->|Model weights| Model[ResNet-18 Multi-Head Classifier]
    Model -->|Logits| Dec[Character Decoder]
    Dec -->|Prediction & Confidence| BE
    BE -->|JSON Response| FE
```

## Design Principles

- **Separation of concerns:** the frontend never touches the model; it only speaks REST/JSON to the backend. The backend never renders UI; it only validates, orchestrates, and serves predictions.
- **Single model instance:** the model is loaded exactly once per process, not per request, eliminating repeated disk I/O and weight-loading latency from the hot path.
- **Non-blocking request handling:** CPU/GPU-bound work never runs directly on FastAPI's async event loop — it's offloaded to a threadpool so I/O-bound requests (like concurrent uploads) are never starved.
- **Fail fast, fail loud:** if model weights are missing or corrupted, the server refuses to start rather than serving broken predictions.

---

## Component Details

### 1. Frontend — Next.js + Tailwind CSS

- **Presentation:** Responsive dashboard with glassmorphism styling, Framer Motion micro-interactions, and a live canvas preview of the uploaded image.
- **API integration:** Async client with support for both single and batch prediction, rendering per-character confidence breakdowns alongside the decoded sequence.
- **Config:** Backend base URL is injected via `NEXT_PUBLIC_API_URL`, keeping the frontend environment-agnostic across local, staging, and production deployments.

### 2. Backend — FastAPI

- **API surface:** JSON endpoints for single prediction, batch prediction, model metadata, and health monitoring (see [API.md](API.md)).
- **Middleware:** A boundary-level `Content-Length` check rejects oversized uploads before the body is read, backed by a token-bucket rate limiter to protect compute resources from abuse.
- **Threadpool scheduling:** Preprocessing and inference are wrapped in `run_in_threadpool()`, keeping the event loop free to accept and parse concurrent requests while CPU/GPU work happens on background threads.

### 3. ML Inference Service — PyTorch & ResNet-18

- **Lifecycle:** Instantiated once at startup as a singleton (`InferenceService`), avoiding per-request model-loading overhead.
- **Execution mode:** Runs in `eval()` mode; a dummy `[1, 1, 100, 200]` tensor is pushed through the model during boot to trigger kernel compilation and CUDA context initialization ahead of the first real request.
- **Device selection:** Automatically targets `cuda` when available, with a transparent fallback to CPU — no configuration required to run in either environment.
- **Multi-position head:** CAPTCHA decoding is framed as 6 concurrent per-position classification tasks. A ResNet-18 backbone (modified for 1-channel input) is pooled to `[B, 512, 6]` and classified into a shared 31-class vocabulary per position — see the [Modeling Approach](../README.md#modeling-approach) section of the README for the full rationale.

---

## Request Data Pipeline

| Step | Stage | Detail |
|---|---|---|
| 1 | **Upload** | Client submits a distorted CAPTCHA image via `multipart/form-data`. |
| 2 | **Defensive check** | Middleware validates request size against `Content-Length` and checks the caller's rate-limit bucket. |
| 3 | **MIME verification** | API confirms the declared content type starts with `image/`. |
| 4 | **Streaming read** | Image bytes are read in 64KB chunks, aborting if the stream exceeds the 5MB limit — protects against missing/spoofed `Content-Length` headers. |
| 5 | **Structural integrity** | `PIL.Image.verify()` confirms the file is a physically valid image, not a disguised payload. |
| 6 | **Preprocessing** (threadpool) | Grayscale conversion, resize to `100×200`, normalization, tensor conversion to `[1, 1, 100, 200]`. |
| 7 | **Inference** (threadpool) | ResNet-18 forward pass produces raw logits of shape `[1, 6, 31]`. |
| 8 | **Decoding** | Softmax per position; the argmax index at each of the 6 positions maps to a character in the 31-symbol vocabulary. |
| 9 | **Telemetry** | Uptime and request counters are updated; structured logs capture request ID, latency, and prediction. |

---

## Why This Design

**Per-position classification over CTC.** Because every label in this dataset is exactly 6 characters, there's no variable-length alignment problem for CTC to solve — a shared linear head over 6 pooled feature vectors directly optimizes the actual objective with less architectural and training complexity.

**Threadpool over async-native inference.** PyTorch's synchronous CPU/GPU execution doesn't natively play well with `asyncio`; rather than rewriting the inference stack around async primitives, offloading to a threadpool is the minimal-risk way to keep the event loop responsive under concurrent load.

**Singleton over per-request instantiation.** Model loading (deserializing ~44MB of weights, initializing CUDA context) is orders of magnitude slower than a single forward pass — doing it once at startup, rather than per request, is what makes sub-200ms latency achievable at all.

---

## Related Documentation

- [API Specification](API.md) — endpoint contracts and payloads
- [Hardening Notes](HARDENING.md) — security and reliability measures layered onto this architecture
- [Engineering Audit](AUDIT.md) — independent review of this design
- [Deployment Guide](DEPLOYMENT.md) — running this architecture locally, via Docker, or in the cloud
