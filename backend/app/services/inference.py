import time
import torch
import torch.nn.functional as F
from ..models.resnet18 import ResNetCaptcha
from .decoding import decode_predictions, VOCAB
from ..core.config import settings

from loguru import logger

class InferenceService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ResNetCaptcha(settings.NUM_CHARS)
        self.load_model()
        self.warmup()
    
    def load_model(self):
        state = torch.load(settings.MODEL_PATH, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state)
        self.model.to(self.device)
        self.model.eval()

    def warmup(self):
        logger.info(f"Warming up model on {self.device}...")
        try:
            dummy_tensor = torch.randn(1, 1, settings.IMAGE_HEIGHT, settings.IMAGE_WIDTH)
            self.predict_single(dummy_tensor)
            logger.info("Model warmup complete.")
        except Exception as e:
            logger.error(f"Model warmup failed: {e}")

    def predict_single(self, tensor: torch.Tensor) -> dict:
        t0 = time.perf_counter()
        tensor = tensor.to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=2)
            max_probs, preds = probs.max(dim=2)
        
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        text = decode_predictions(preds[0].tolist())
        char_confs = [float(p.item() * 100) for p in max_probs[0]]
        confidence = float(max_probs[0].mean().item() * 100.0)
        
        return {
            "prediction": text,
            "confidence": confidence,
            "char_confs": char_confs,
            "processing_ms": elapsed_ms
        }

    def predict_batch(self, tensor: torch.Tensor) -> tuple[list[dict], float]:
        t0 = time.perf_counter()
        tensor = tensor.to(self.device)
        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=2)
            max_probs, preds = probs.max(dim=2)
        
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        
        results = []
        batch_size = tensor.size(0)
        for i in range(batch_size):
            text = decode_predictions(preds[i].tolist())
            char_confs = [float(p.item() * 100) for p in max_probs[i]]
            confidence = float(max_probs[i].mean().item() * 100.0)
            results.append({
                "prediction": text,
                "confidence": confidence,
                "char_confs": char_confs,
                "processing_ms": elapsed_ms / batch_size  # Avg time per item
            })
            
        return results, elapsed_ms

inference_service = InferenceService()
