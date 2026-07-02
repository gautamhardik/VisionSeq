import cv2
import numpy as np
import torch
import io
from PIL import Image
from typing import List
from ..core.config import settings

def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    """Convert uploaded bytes → grayscale float32 tensor [1,1,H,W]."""
    # Security: Verify image integrity before feeding to OpenCV
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
    except Exception:
        raise ValueError("Invalid or corrupted image file structure.")

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Invalid image format or unable to decode image.")
        
    # Standardize image size based on config
    img = cv2.resize(img, (settings.IMAGE_WIDTH, settings.IMAGE_HEIGHT))
    
    img = img.astype(np.float32) / 255.0
    return torch.tensor(img, dtype=torch.float32).unsqueeze(0).unsqueeze(0)

def preprocess_batch(images_bytes: List[bytes]) -> torch.Tensor:
    """Convert a list of uploaded bytes into a batched float32 tensor [B,1,H,W]."""
    tensors = []
    for img_bytes in images_bytes:
        tensors.append(preprocess_image(img_bytes).squeeze(0)) # [1, H, W]
    return torch.stack(tensors) # [B, 1, H, W]
