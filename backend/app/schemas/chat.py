from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ChatSessionCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)


class ChatSessionResponse(BaseModel):
    id: str
    kb_id: str
    title: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    session_id: Optional[str] = Field(None)


class SourceItem(BaseModel):
    doc_id: str
    doc_name: Optional[str] = None
    content: str
    score: float
    chunk_index: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    sources: Optional[List[SourceItem]]
    created_at: datetime