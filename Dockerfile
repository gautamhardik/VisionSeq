FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=/api/v1
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (OpenCV requirements)
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code directly into /app
COPY backend/ /app/

# Copy the built frontend from builder stage into /app/frontend/out
COPY --from=frontend-builder /app/frontend/out /app/frontend/out

# Port 7860 is Hugging Face's default port
EXPOSE 7860

# Run uvicorn on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
