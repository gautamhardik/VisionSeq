# Engineering Audit Report

An internal engineering review of VisionSeq, assessing production-readiness across architecture, security, inference latency, and concurrency handling. This audit was used to drive the hardening work documented in [HARDENING.md](HARDENING.md).

---

## Scope

The review covered:
- Backend request-handling architecture (FastAPI)
- Model serving pattern (PyTorch singleton service)
- Input validation and file-upload handling
- Concurrency behavior under load
- Dependency and deployment configuration
- Observability and health reporting

---

## Positive Findings

| Area | Finding |
|---|---|
| **Model Singleton** | Model is loaded once at startup (`InferenceService.__init__`), eliminating load latency from the request path |
| **Thread Safety** | The model runs safely in `eval()` mode across concurrent requests on a single GPU |
| **Device Selection** | Automatic `cuda` → `cpu` fallback handles heterogeneous deployment environments without config changes |
| **Request Logging** | Structured logging (`loguru`) captures request IDs, inference latency, and prediction confidence |
| **Fail-Fast Startup** | Missing model weights crash the server at boot rather than allowing it to serve broken predictions |

---

## Findings & Remediations

### BUG-001 — Unbounded File Uploads (Denial of Service)
**Severity:** Critical
**Finding:** Endpoints had no protection against memory exhaustion from oversized payloads.
**Remediation:** Boundary middleware enforcing `Content-Length` limits, plus chunk-based streaming caps as a fallback for missing/spoofed headers.

### BUG-002 — Blocking I/O in Async Handlers
**Severity:** Critical
**Finding:** CPU-bound preprocessing and PyTorch forward passes executed synchronously on the FastAPI event loop, blocking concurrent request handling.
**Remediation:** Offloaded both stages to background threads via `run_in_threadpool()`.

### BUG-003 — Insecure MIME Type Validation
**Severity:** High
**Finding:** Validation relied on filename/content-type strings alone, allowing disguised malicious payloads to pass as images.
**Remediation:** Enforced physical structural validation via `PIL.Image.verify()`, mapping failures to `400 Bad Request`.

### BUG-004 — Unpinned Dependencies
**Severity:** Medium
**Finding:** Loose version bounds (e.g. `torch>=2.0.0`) risked unreproducible builds over time.
**Remediation:** All packages pinned; lock files generated.

### BUG-005 — Missing Model Warmup
**Severity:** Low
**Finding:** First request paid the full CUDA cold-start penalty.
**Remediation:** Dummy-tensor inference executed at startup.

### BUG-006 — Hardcoded Image Specs
**Severity:** Low
**Finding:** Input dimensions and vocabulary size were hardcoded in endpoint logic.
**Remediation:** Centralized into `config.py`, referenced dynamically.

### BUG-007 — Shallow Health Checks
**Severity:** Low
**Finding:** Health endpoint returned static status regardless of actual model/hardware state.
**Remediation:** Health checks now verify model readiness and GPU availability, returning `503` when unhealthy.

### BUG-008 — Missing Rate Limiting
**Severity:** Low
**Finding:** No throttling exposed the GPU/CPU to resource-exhaustion abuse.
**Remediation:** Lightweight in-memory token-bucket limiter added as a route dependency.

---

## Production Readiness Summary

| Category | Status |
|---|---|
| Architecture | ✅ Production Ready |
| ML Pipeline | ✅ Production Ready |
| Frontend | ✅ Production Ready |
| Backend Structure | ✅ Production Ready |
| Security Hardening | ✅ Addressed (see below) |
| Scalability | ⚠ Single-instance; horizontal scaling not yet implemented |
| Deployment Configuration | ⚠ CORS defaults to `*`; tighten for public deployment |
| Operational Observability | ⚠ In-memory metrics only; no external metrics/log aggregation |

---

## Assessment

The architecture demonstrates a solid grasp of production ML-serving patterns: singleton model lifecycle, async-safe request handling, defensive input validation, and observable health state. All eight findings from the initial review (BUG-001 through BUG-008) have corresponding remediations implemented and documented in [HARDENING.md](HARDENING.md).

Remaining considerations before a genuinely public, multi-tenant deployment: the in-memory rate limiter and request counters won't survive a multi-instance deployment (would need a shared store like Redis), and CORS/observability configuration should be tightened per environment rather than left at permissive defaults. These are standard "scale-out" concerns rather than architectural flaws in the current single-instance design.

## Related Documentation

- [Hardening Notes](HARDENING.md) — implementation detail behind each remediation above
- [Architecture](ARCHITECTURE.md) — the design this audit evaluated
- [Deployment Guide](DEPLOYMENT.md) — production configuration guidance, including CORS
