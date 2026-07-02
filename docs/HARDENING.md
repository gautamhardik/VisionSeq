# Operational Hardening

This document explains the security, reliability, and performance hardening measures applied to the FastAPI backend.

---

## 1. Denial of Service (DoS) Protections

To protect the server from memory exhaustion (Out of Memory crashes) and resource starvation, two defense layers were implemented:

### Layer A: boundary Content-Length Check (Middleware)
A custom HTTP middleware in `main.py` intercepts incoming requests at the server boundary. If a `POST` request contains a `Content-Length` header exceeding the maximum allowed size (5MB for `/predict`, 25MB for `/predict/batch`), the request is rejected immediately with an `HTTP 413 Payload Too Large` status before the body is streamed or parsed.

### Layer B: Defensive Chunked Streaming Check (Endpoint Level)
If a client omits the `Content-Length` header or sends a spoofed headers value, the endpoint employs a defensive streaming loop to consume files:
```python
contents = b""
chunk_size = 64 * 1024  # 64KB chunks
total_read = 0
while True:
    chunk = await file.read(chunk_size)
    if not chunk:
        break
    total_read += len(chunk)
    if total_read > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File size exceeds limit")
    contents += chunk
```
This forces immediate termination of connection if the streaming payload grows larger than 5MB, preventing DoS via slow HTTP post attacks or infinite byte streams.

---

## 2. Event Loop Isolation (Concurrency)

FastAPI runs async endpoints on a single-threaded event loop. If synchronous, CPU-bound tasks are run on this loop, it blocks all concurrent request parsing:

- **Fix**: Both the image decoding/resizing logic (`preprocess_image()`) and PyTorch tensor forward evaluation are executed sequentially inside a helper function (`_process()`) which is passed to FastAPI's `run_in_threadpool()`.
- **Outcome**: The event loop offloads computations to background worker threads, allowing the server to handle concurrent request I/O and process multiple image uploads in parallel.

---

## 3. Input Validation & MIME Security

Relying purely on the `content_type` field reported by client uploads is insecure because filename extensions can be spoofed:

- **Fix**: The image buffer is loaded and verified using `PIL.Image.verify()`. This reads the image headers to confirm that the file is physically structured as a valid image and not an executable script, zip bomb, or corrupted payload.
- **Exception Mapping**: Any validation failure throws a `ValueError` inside the preprocessing pipeline, which is trapped by routes and converted to an `HTTP 400 Bad Request` log and client response.

---

## 4. Rate Limiting

To prevent API starvation and protect GPU processing resources, an in-memory token-bucket rate limiter was integrated:

- **Algorithm**: Tracks tokens per IP address. It replenishes tokens at a configured rate (e.g. 2 requests per second) up to a maximum burst capacity (5 requests).
- **Implementation**: The custom `rate_limit` dependency raises an `HTTP 429 Too Many Requests` status if the client's token bucket is depleted.

---

## 5. Active Telemetry & Observability

Observability was hardened to support health monitoring and auditing in cloud environments (e.g., Kubernetes liveness/readiness probes):

- **Health Metrics**: The `/health` endpoint actively checks if the model instance is loaded and verifies GPU availability.
- **Service Stats**: Exposes active metrics like model version, `uptime`, and `requests_served` globally.
- **Structured Request Logging**: Requests log HTTP statuses, total request processing latencies (including file streaming), raw model inference times, and predictions/errors.
