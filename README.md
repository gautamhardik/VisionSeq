---
title: VisionSeq
emoji: 👁️
colorFrom: indigo
colorTo: violet
sdk: docker
app_port: 7860
pinned: false
---

# Distorted Visual Sequence Pattern Recognition using Deep Learning

![Hero Banner](assets/hero.png)

I trained a ResNet-18 to read distorted 6-character CAPTCHAs at 99.94% character accuracy and 99.70% full-sequence accuracy with only 6 failures in 2,000 validation images.

## Technical Documentation
- 🏗️ **[System Architecture](docs/ARCHITECTURE.md)**: Detailed component description and data pipeline layout.
- 📋 **[Engineering Audit Report](docs/AUDIT.md)**: High-level architectural reviews and vulnerability assessment.
- 🛡️ **[Operational Hardening](docs/HARDENING.md)**: Security, rate limiting, and event loop concurrency hardening details.
- ⚡ **[API Specification](docs/API.md)**: Endpoint payload, response formats, and health checking protocols.
- 🛠️ **[Deployment Guide](docs/DEPLOYMENT.md)**: Virtualenv, environment variables, and Docker Compose configurations.

## Project Summary

A CAPTCHA recognition competition required decoding distorted alphanumeric sequences with no ground truth test labels. I built a ResNet-18 that treats each of the 6 character positions as a separate 31-class classifier. The model hit 99.83% character accuracy after one epoch and peaked at 99.94% by epoch 4. On 2,761 unseen test images, it produced predictions for every sample. The pipeline is deployed as a decoupled Next.js web application powered by a FastAPI backend.

## Problem & Motivation

CAPTCHAs exist to fool automated readers. Traditional OCR (Tesseract, EasyOCR) fails on distorted text, and custom CNN solutions usually rely on pretrained ImageNet features that transfer poorly to binary-like CAPTCHA patterns. The competition provided 20,000 labeled samples — enough to train, but not enough for a large model.

## Dataset

20,000 images, each 100×200 grayscale PNG, labeled with 6-character strings from a 31-character vocabulary (digits 2-9, uppercase A-Z excluding I, L, O). I found 2 corrupted labels during EDA — Excel auto-formatted them as scientific notation ("5.40E+12") and a date ("04-Mar-54"). One label was duplicated. After filtering, I kept 19,998 samples, split 90/10 stratified into 17,998 train + 2,000 validation.

## Approach

I used a per-position classifier instead of CTC. The ResNet-18 backbone (first conv replaced for 1-channel input) feeds into `AdaptiveAvgPool2d((1, 6))` to produce exactly 6 feature vectors, one per character position. Each goes through a shared `Linear(512, 31)` classifier.

Important caveat: I used `weights="DEFAULT"` then replaced conv1, so backbone layers (except conv1) started from ImageNet weights — not fully "from scratch." This explains the unusually fast convergence. Loss is summed CrossEntropy across 6 positions with 0.1 label smoothing. Optimizer: AdamW (lr=3e-4, weight_decay=1e-4) with ReduceLROnPlateau and gradient clipping at norm 5.0.

## Technical Decisions

| Decision | Alternatives Considered | Why I Chose This |
|----------|------------------------|------------------|
| Per-position classifier vs CTC | CTC with blank token | Fixed 6-char sequence makes CTC's variable-length alignment unnecessary. Per-position is simpler and directly optimizes the right objective. |
| ResNet-18 | ResNet-34, ResNet-50, custom CNN | 18 layers is sufficient for 100×200 input. Larger models risk overfitting on 18k training samples. |
| AdamW | SGD with momentum, Adam | AdamW decouples weight decay from gradient updates, giving smoother validation curves in early epochs. |
| Label smoothing 0.1 | No smoothing | Reduced overconfidence. The model assigned >99% probability to single classes by epoch 2 — smoothing kept probabilities distributed. |
| 31-class vocab (excluding I, L, O) | Full 36 alphanumeric | Competition spec. I, L, O are visually indistinguishable from 1, 0 in CAPTCHA fonts even for humans. |

## Results

| Metric | Score | What It Means |
|--------|-------|---------------|
| Character Accuracy | **99.94%** | 1 wrong character per ~1,667 predictions |
| Sequence Accuracy | **99.70%** | 6 out of 2,000 images had any error |
| Character Error Rate | **0.06%** | ~1 edit per 1,667 characters |

The model reached 99.83% char accuracy in one epoch (72 seconds on a T4 GPU). Best checkpoint was at epoch 4. Remaining 36 epochs oscillated between 99.93% and 99.94% — training was effectively complete in ~5 minutes. The only systematic confusion was `5` ↔ `S`, which the CAPTCHA font renders nearly identically.

## What Didn't Work

- **32-class vocab with blank index:** I initially included a blank class (index 0), as preparation for CTC. This was unnecessary — the fixed sequence length made it a dead class that never appeared in targets. I removed it after epoch 1.
- **Training without label smoothing:** I tried one epoch without it. Validation char accuracy dropped from 99.90% to 99.83%. I re-enabled it.

## Example Output

| Prediction | Confidence |
|-----------|------------|
| `7DUP98` | 99.7% |
| `6CUKRD` | 99.4% |

Six failures on the 2,000 validation images — the only recurring pattern was `MNYSDG` predicted as `MNY5DG`.

## User Interface Demo

![UI Preview Screenshot](assets/demo.png)

## Limitations

- Confuses `5` and `S` in certain fonts — the only systematic substitution pattern observed.
- Fixed 6-character length only. Cannot process shorter or longer sequences.
- Always predicts 6 characters with high confidence, even on non-CAPTCHA inputs (no rejection mechanism).
- Trained on one CAPTCHA rendering engine. Different generators (different noise, warping, occlusions) would likely degrade performance.

## Setup

Model weights (`final_resnet18_captcha.pth`, ~44 MB) are located inside the `backend/weights/` directory.

For detailed setup instructions on running locally or using Docker Compose, refer to the [Deployment Guide](docs/DEPLOYMENT.md).

## Production Architecture (Next.js + FastAPI)

![Architecture Diagram](assets/architecture.png)

This repository features a production-ready, decoupled architecture:
- **Frontend**: Next.js, Tailwind CSS, Framer Motion
- **Backend**: FastAPI, PyTorch (Service-oriented architecture)

### Running with Docker Compose

To spin up both the FastAPI backend and the Next.js frontend:
```bash
docker compose up --build
```
- The frontend will be available at `http://localhost:3000`
- The backend API will be available at `http://localhost:8000`
- API documentation (Swagger UI) is automatically generated at `http://localhost:8000/docs`
