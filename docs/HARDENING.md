# Operational Hardening

Security, reliability, and performance measures applied to the FastAPI backend, following the findings in [AUDIT.md](AUDIT.md).

---

## 1. Denial-of-Service Protection

Two layers guard against memory exhaustion from oversized or malicious payloads:

**Layer A — Boundary `Content-Length` check (middleware).**
A custom HTTP middleware in `main.py` inspects incoming `POST` requests before the body is read. If `Content-Length` exceeds the configured limit (5MB for `/predict`, 25MB for `/predict/batch`), the request is rejected immediately with `413 Payload Too Large`.

**Layer B — Defensive streaming check (endpoint level).**
If a client omits `Content-Length` or sends a spoofed value, the endpoint reads the file in bounded chunks and aborts once the cumulative size crosses the limit:

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

This closes the gap that header-only checks leave open — slow-post attacks and unbounded streams are terminated mid-transfer rather than after full buffering.

---

## 2. Event Loop Isolation

FastAPI's async endpoints run on a single-threaded event loop; synchronous CPU-bound work on that loop blocks *all* concurrent request handling, not just the request performing the work.

**Fix:** both image preprocessing (`preprocess_image()`) and the PyTorch forward pass are wrapped in a helper (`_process()`) dispatched via `run_in_threadpool()`.

**Effect:** the event loop stays free to accept and parse new connections while inference happens on background worker threads — the server handles concurrent uploads instead of serializing them behind whichever request is currently on the GPU/CPU.

---

## 3. Input Validation & MIME Security

Trusting client-reported `content_type` is insecure — filenames and MIME headers are trivially spoofable.

**Fix:** every uploaded buffer is validated with `PIL.Image.verify()`, which parses the actual image headers to confirm the file is structurally a valid image rather than an executable, archive, or corrupted payload.

**Exception mapping:** validation failures raise a `ValueError` inside the preprocessing pipeline, caught at the route level and converted to a logged `400 Bad Request` — never surfaced as an unhandled `500`.

---

## 4. Rate Limiting

An in-memory token-bucket limiter protects prediction endpoints from GPU/CPU exhaustion:

- **Algorithm:** per-IP token bucket, replenished at a fixed rate (2 requests/sec) up to a burst cap of 5.
- **Enforcement:** implemented as a FastAPI dependency (`rate_limit`), raising `429 Too Many Requests` once a client's bucket is depleted.
- **Known limitation:** state is process-local — a multi-instance deployment needs a shared backing store (e.g. Redis) for the limiter to be effective across replicas. Flagged in [AUDIT.md](AUDIT.md).

---

## 5. Observability

Hardened to support health monitoring and auditing in cloud environments (e.g. Kubernetes liveness/readiness probes):

- **Health metrics:** `/health` actively checks model readiness and GPU availability rather than returning a static `200`.
- **Service stats:** exposes model version, process uptime, and cumulative requests served.
- **Structured logging:** every request logs HTTP status, end-to-end latency (including upload streaming), raw inference time, and the resulting prediction or error — tagged with a request ID for tracing.

## Related Documentation

- [Engineering Audit](AUDIT.md) — the review that identified each issue addressed here
- [Architecture](ARCHITECTURE.md) — where these measures sit in the request lifecycle
- [API Specification](API.md) — the error codes these protections surface to clients
