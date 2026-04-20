"""文档Pydantic模型"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentUploadResponse(BaseModel):
    """文档上传响应模型"""
    id: str
    filename: str
    file_size: int
    file_type: str
    status: str
    message: str = "Document upload successful, processing queued"


class DocumentResponse(BaseModel):
    """文档响应模型"""
    id: str
    kb_id: str
    filename: str
    file_size: int
    file_type: str
    status: str
    chunk_count: int
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """文档列表响应模型"""
    items: list[DocumentResponse]
    total: int
