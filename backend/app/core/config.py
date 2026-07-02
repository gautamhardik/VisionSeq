from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "CAPTCHA OCR API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    MODEL_PATH: str = "weights/final_resnet18_captcha.pth"
    NUM_CHARS: int = 31
    MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024 # 5MB
    MAX_BATCH_SIZE: int = 5
    IMAGE_HEIGHT: int = 100
    IMAGE_WIDTH: int = 200
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
