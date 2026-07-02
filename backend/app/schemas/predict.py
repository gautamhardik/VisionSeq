from pydantic import BaseModel
from typing import List

class PredictionResult(BaseModel):
    request_id: str
    prediction: str
    confidence: float
    char_confs: List[float]
    processing_ms: float

class BatchPredictionResult(BaseModel):
    request_id: str
    predictions: List[PredictionResult]
    total_processing_ms: float

class ModelInfo(BaseModel):
    version: str
    parameters: str
    architecture: str
    input_shape: List[int]
    output_shape: List[int]
