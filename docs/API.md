# API Specification

This document defines the REST API endpoints exposed by the CAPTCHA OCR service.

---

## Global Base Path
All API routes are prefixed with `/api/v1`.

---

## Endpoints

### 1. Root Endpoint
Returns welcome message and links to documentation.

- **URL**: `/`
- **Method**: `GET`
- **Response (200 OK)**:
  ```json
  {
      "message": "Welcome to CAPTCHA OCR API",
      "docs_url": "/docs",
      "health_check": "/api/v1/health"
  }
  ```

---

### 2. Health Check
Verifies API operational status, GPU capabilities, uptime, and request telemetry.

- **URL**: `/api/v1/health`
- **Method**: `GET`
- **Response (200 OK)**:
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
- **Error Responses**:
  - `503 Service Unavailable`: Model is not ready or failed to load.

---

### 3. Model Information
Returns metadata about the loaded deep learning model.

- **URL**: `/api/v1/model-info`
- **Method**: `GET`
- **Response (200 OK)**:
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

### 4. Predict Single CAPTCHA
Evaluates a single uploaded CAPTCHA image.

- **URL**: `/api/v1/predict`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Request Body**:
  - `file`: Binary file (image/png, image/jpeg, max 5MB).
- **Response (200 OK)**:
  ```json
  {
      "request_id": "c092e7dc-0740-4c8d-9ed5-f9aeab5f3b39",
      "prediction": "7DUP98",
      "confidence": 87.47,
      "char_confs": [84.63, 89.46, 77.37, 88.03, 94.42, 90.89],
      "processing_ms": 172.59
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: File is not a valid image format.
  - `413 Payload Too Large`: Uploaded file size exceeds the 5MB limit.
  - `429 Too Many Requests`: Rate limit has been exceeded.

---

### 5. Predict Batch of CAPTCHAs
Evaluates multiple uploaded CAPTCHA images in a single batched run.

- **URL**: `/api/v1/predict/batch`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: multipart/form-data`
- **Request Body**:
  - `files`: Array of binary files (max 5 images, each max 5MB).
- **Response (200 OK)**:
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
- **Error Responses**:
  - `400 Bad Request`: Upload is missing files, or contains an invalid image format.
  - `413 Payload Too Large`: The number of files exceeds 5, or a file exceeds the size limit.
  - `429 Too Many Requests`: Rate limit has been exceeded.
