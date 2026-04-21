from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 现有配置
    CLERK_SECRET_KEY: str
    CLERK_PUBLISHABLE_KEY: str
    CLERK_JWKS_URL: str
    CLEAK_WEBHOOK_SECRET: str
    FRONTEND_URL: str = "http://localhost:5173"
    DATABASE_URL: str = "sqlite:///./knowhub.db"
    
    # ========== 关键变更：Milvus Lite配置 ==========
    # Milvus Lite使用本地文件路径，而不是host/port
    MILVUS_LITE_PATH: str = "./milvus_data/knowhub.db"
    MILVUS_COLLECTION_PREFIX: str = "kb_"
    
    # Kimi LLM配置
    KIMI_API_KEY: str
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "kimi-k2.5"
    
    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MinIO配置
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "rag-documents"
    MINIO_SECURE: bool = False
    
    # BGE配置
    BGE_MODEL_PATH: str = "BAAI/bge-m3"
    EMBEDDING_DIMENSION: int = 1024
    
    # 文档处理配置
    DOCUMENT_CHUNK_SIZE: int = 500
    DOCUMENT_CHUNK_OVERLAP: int = 50
    MAX_FILE_SIZE: int = 52428800
    
    # 检索配置
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_SCORE_THRESHOLD: float = 0.7

    # 组织人数设置
    FREE_TIER_MEMBERSHIP_LIMIT:int = 2
    PRO_TIER_MEMBERSHIP_LIMIT:int = 0 # zero means unlimited
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()