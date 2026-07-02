# API Specification

REST API exposed by the VisionSeq backend. Interactive Swagger documentation is auto-generated at `/docs` on any running instance.

**Live instance:** [huggingface.co/spaces/Hardik-25/VisionSeq](https://huggingface.co/spaces/Hardik-25/VisionSeq)

---

## Base Path

All routes are prefixed with:

```
/api/v1
```

## Authentication

None. All endpoints are public and protected only by rate limiting (see [HARDENING.md](HARDENING.md)). If deploying beyond a portfolio/demo context, place this API behind an auth layer or API gateway.

---

## Endpoints

### `GET /`

Root endpoint. Returns a welcome message and links to further documentation.

**Response `200 OK`**
```json
{
  "message": "Welcome to CAPTCHA OCR API",
  "docs_url": "/docs",
  "health_check": "/api/v1/health"
}
```

---

### `GET /api/v1/health`

Liveness/readiness probe. Reports model status, hardware capabilities, and service uptime — suitable for Kubernetes/cloud health checks.

**Response `200 OK`**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "device": "cuda",
  "cuda_available": true,
  "cuda_device_name": "NVIDIA GeForce RTX 4090",
  "model_ready": true,
  "model_version": "1.0",
  "uptime": "145.20s",
  "requests_served": 12
}
```

**Errors**

| Status | Cause |
|---|---|
| `503 Service Unavailable` | Model is not ready or failed to load |

---

### `GET /api/v1/model-info`

Returns metadata describing the loaded model.

**Response `200 OK`**
```json
{
  "version": "1.0.0",
  "parameters": "11.2M",
  "architecture": "ResNet-18",
  "input_shape": [1, 1, 100, 200],
  "output_shape": [1, 6, 31]
}
```

---

### `POST /api/v1/predict`

Predicts the character sequence for a single CAPTCHA image.

**Headers**
```
Content-Type: multipart/form-data
```

**Body**

| Field | Type | Constraints |
|---|---|---|
| `file` | binary | `image/png` or `image/jpeg`, max **5MB** |

**Response `200 OK`**
```json
{
  "request_id": "c092e7dc-0740-4c8d-9ed5-f9aeab5f3b39",
  "prediction": "7DUP98",
  "confidence": 87.47,
  "char_confs": [84.63, 89.46, 77.37, 88.03, 94.42, 90.89],
  "processing_ms": 172.59
}
```

**Errors**

| Status | Cause |
|---|---|
| `400 Bad Request` | File is not a valid image |
| `413 Payload Too Large` | File exceeds the 5MB limit |
| `429 Too Many Requests` | Rate limit exceeded |

---

### `POST /api/v1/predict/batch`

Predicts character sequences for up to 5 CAPTCHA images in a single batched run.

**Headers**
```
Content-Type: multipart/form-data
```

**Body**

| Field | Type | Constraints |
|---|---|---|
| `files` | binary[] | up to **5** images, each ≤ **5MB** |

**Response `200 OK`**
```json
{
  "request_id": "c092e7dc-0740-4c8d-9ed5-f9aeab5f3b39",
  "predictions": [
    {
      "request_id": "c092e7dc-0740-4c8d-9ed5-f9aeab5f3b39",
      "prediction": "7DUP98",
      "confidence": 87.47,
      "char_confs": [84.63, 89.46, 77.37, 88.03, 94.42, 90.89],
      "processing_ms": 34.51
    }
  ],
  "total_processing_ms": 172.59
}
```

**Errors**

| Status | Cause |
|---|---|
| `400 Bad Request` | Missing files, or an invalid image format present |
| `413 Payload Too Large` | More than 5 files, or a file exceeds the size limit |
| `429 Too Many Requests` | Rate limit exceeded |

---

## Response Field Reference

| Field | Type | Description |
|---|---|---|
| `request_id` | string (UUID) | Unique identifier for tracing this request through logs |
| `prediction` | string | Decoded 6-character sequence |
| `confidence` | float | Overall confidence (%), averaged across the 6 positions |
| `char_confs` | float[6] | Per-position confidence (%), in sequence order |
| `processing_ms` | float | Server-side processing time, from validated upload to decoded output |

## Rate Limiting

Requests are limited per-IP via a token-bucket algorithm: **2 requests/second**, burst capacity of **5**. Exceeding this returns `429 Too Many Requests`. See [HARDENING.md](HARDENING.md#4-rate-limiting) for implementation details.

## Related Documentation

- [Architecture](ARCHITECTURE.md) — how requests flow through the system
- [Hardening Notes](HARDENING.md) — validation, limits, and defensive measures behind these endpoints
