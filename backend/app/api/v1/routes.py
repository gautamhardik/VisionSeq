import uuid
import torch
import time
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.concurrency import run_in_threadpool
from loguru import logger
from ...schemas.predict import PredictionResult, BatchPredictionResult, ModelInfo
from ...services.preprocessing import preprocess_image, preprocess_batch
from ...services.inference import inference_service
from ...core.config import settings
from ...utils.rate_limiter import rate_limit

START_TIME = time.time()
REQUESTS_SERVED = 0

router = APIRouter()

@router.get("/health", summary="Check API health")
async def health_check():
    cuda_available = torch.cuda.is_available()
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU"
    model_ready = False
    try:
        if inference_service.model is not None:
            model_ready = True
    except Exception:
        pass

    if not model_ready:
        raise HTTPException(status_code=503, detail="Model is not ready")

    uptime_seconds = time.time() - START_TIME
    return {
        "status": "ok",
        "version": settings.VERSION,
        "device": str(inference_service.device),
        "cuda_available": cuda_available,
        "cuda_device_name": device_name,
        "model_ready": model_ready,
        "model_version": "1.0",
        "uptime": f"{uptime_seconds:.2f}s",
        "requests_served": REQUESTS_SERVED
    }

@router.get("/model-info", response_model=ModelInfo, summary="Get model metadata")
async def get_model_info():
    return ModelInfo(
        version="1.0.0",
        parameters="11.2M",
        architecture="ResNet-18",
        input_shape=[1, 1, settings.IMAGE_HEIGHT, settings.IMAGE_WIDTH],
        output_shape=[1, 6, settings.NUM_CHARS]
    )

@router.post("/predict", response_model=PredictionResult, summary="Predict single CAPTCHA", dependencies=[Depends(rate_limit)])
async def predict_single(file: UploadFile = File(...)):
    req_id = str(uuid.uuid4())
    logger.info(f"[{req_id}] Received single prediction request: {file.filename}")
    
    if not file.content_type.startswith("image/"):
        logger.error(f"[{req_id}] Invalid file type: {file.content_type}")
        raise HTTPException(status_code=400, detail="File must be an image")
        
    start_time = time.perf_counter()
    try:
        # Streaming read check to enforce size limits defensively (mitigates bypassed/missing Content-Length)
        contents = b""
        chunk_size = 64 * 1024  # 64KB
        total_read = 0
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > settings.MAX_FILE_SIZE_BYTES:
                logger.error(f"[{req_id}] File upload exceeds size limit of {settings.MAX_FILE_SIZE_BYTES} bytes during streaming")
                raise HTTPException(
                    status_code=413, 
                    detail=f"File exceeds limit of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)}MB"
                )
            contents += chunk

        def _process():
            tensor = preprocess_image(contents)
            return inference_service.predict_single(tensor)
            
        result = await run_in_threadpool(_process)
        
        # Track metric
        global REQUESTS_SERVED
        REQUESTS_SERVED += 1
        
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.info(
            f"[{req_id}] Status: 200 OK | Latency: {latency:.2f}ms (Inference: {result['processing_ms']:.2f}ms) | "
            f"Prediction: {result['prediction']} ({result['confidence']:.2f}%)"
        )
        return PredictionResult(
            request_id=req_id,
            **result
        )
    except HTTPException as e:
        raise e
    except ValueError as e:
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.warning(f"[{req_id}] Status: 400 Bad Request | Latency: {latency:.2f}ms | Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.exception(f"[{req_id}] Status: 500 Internal Server Error | Latency: {latency:.2f}ms | Error processing image")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict/batch", response_model=BatchPredictionResult, summary="Predict batch of CAPTCHAs", dependencies=[Depends(rate_limit)])
async def predict_batch(files: List[UploadFile] = File(...)):
    req_id = str(uuid.uuid4())
    logger.info(f"[{req_id}] Received batch prediction request for {len(files)} files")
    
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
        
    if len(files) > settings.MAX_BATCH_SIZE:
        logger.error(f"[{req_id}] Batch size {len(files)} exceeds limit {settings.MAX_BATCH_SIZE}")
        raise HTTPException(status_code=413, detail=f"Maximum batch size is {settings.MAX_BATCH_SIZE}")
    
    start_time = time.perf_counter()
    try:
        images_bytes = []
        chunk_size = 64 * 1024  # 64KB
        
        for file in files:
            if not file.content_type.startswith("image/"):
                logger.error(f"[{req_id}] Invalid file type in batch: {file.filename}")
                raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
            
            # Streaming check for each file to defend against omitted/lying Content-Length
            file_contents = b""
            total_read = 0
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > settings.MAX_FILE_SIZE_BYTES:
                    logger.error(f"[{req_id}] File {file.filename} exceeds size limit of {settings.MAX_FILE_SIZE_BYTES} bytes")
                    raise HTTPException(
                        status_code=413, 
                        detail=f"File {file.filename} exceeds limit of {settings.MAX_FILE_SIZE_BYTES // (1024*1024)}MB"
                    )
                file_contents += chunk
            images_bytes.append(file_contents)
            
        def _process_batch():
            tensor = preprocess_batch(images_bytes)
            return inference_service.predict_batch(tensor)
            
        results, total_time = await run_in_threadpool(_process_batch)
        
        preds = []
        for res in results:
            preds.append(PredictionResult(request_id=req_id, **res))
            
        # Track metrics
        global REQUESTS_SERVED
        REQUESTS_SERVED += len(files)
        
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.info(
            f"[{req_id}] Status: 200 OK | Latency: {latency:.2f}ms (Batch Inference: {total_time:.2f}ms) | "
            f"Predictions: {[r['prediction'] for r in results]}"
        )
        return BatchPredictionResult(
            request_id=req_id,
            predictions=preds,
            total_processing_ms=total_time
        )
    except HTTPException as e:
        raise e
    except ValueError as e:
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.warning(f"[{req_id}] Status: 400 Bad Request | Latency: {latency:.2f}ms | Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        latency = (time.perf_counter() - start_time) * 1000.0
        logger.exception(f"[{req_id}] Status: 500 Internal Server Error | Latency: {latency:.2f}ms | Error processing batch")
        raise HTTPException(status_code=500, detail=str(e))
