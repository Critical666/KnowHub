"""文档管理API"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os
import uuid

from app.core.database import get_db
from app.core.auth import AuthUser, get_current_user
from app.core.config import settings
from app.models.document import Document, DocStatus
from app.models.knowledge_base import KnowledgeBase, KBStatus
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentResponse,
    DocumentListResponse
)
from app.services.storage.minio_client import MinioStorageService

router = APIRouter(prefix="/api/v1/knowledge-bases/{kb_id}/documents", tags=["documents"])

# 支持的文件类型
SUPPORTED_FILE_TYPES = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
}


def get_file_extension(filename: str) -> str:
    """获取文件扩展名"""
    return os.path.splitext(filename)[1].lower()


def validate_file(file: UploadFile) -> tuple[str, str]:
    """
    验证文件类型和大小
    
    Returns:
        (扩展名, MIME类型)
    """
    ext = get_file_extension(file.filename)
    
    if ext not in SUPPORTED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Supported: {list(SUPPORTED_FILE_TYPES.keys())}"
        )
    
    # 检查文件大小
    file.file.seek(0, 2)  # 移动到文件末尾
    file_size = file.file.tell()
    file.file.seek(0)  # 重置到开头
    
    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    return ext, SUPPORTED_FILE_TYPES[ext]


@router.get("", response_model=DocumentListResponse)
def list_documents(
    kb_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取知识库的文档列表
    """
    # 验证知识库存在且属于当前组织
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    docs = db.query(Document).filter(
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).order_by(Document.created_at.desc()).all()
    
    return DocumentListResponse(
        items=[doc.to_dict() for doc in docs],
        total=len(docs)
    )


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    kb_id: str,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    上传文档到知识库
    
    支持格式: txt, md, pdf, docx, doc
    最大文件大小: 50MB
    """
    # 验证知识库存在且属于当前组织
    kb = db.query(KnowledgeBase).filter(
        KnowledgeBase.id == kb_id,
        KnowledgeBase.org_id == user.org_id,
        KnowledgeBase.status != KBStatus.DELETED
    ).first()
    
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge base not found"
        )
    
    # 验证文件
    ext, content_type = validate_file(file)
    
    # 创建文档记录
    doc_id = str(uuid.uuid4())
    doc = Document(
        id=doc_id,
        kb_id=kb_id,
        org_id=user.org_id,
        filename=file.filename,
        file_size=0,  # 稍后更新
        file_type=ext,
        storage_path="",  # 稍后更新
        status=DocStatus.PENDING
    )
    
    # 上传到MinIO
    storage = MinioStorageService(
        endpoint=settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        bucket=settings.MINIO_BUCKET,
        secure=settings.MINIO_SECURE
    )
    
    object_name = storage.generate_object_name(
        org_id=user.org_id,
        kb_id=kb_id,
        doc_id=doc_id,
        filename=file.filename
    )
    
    try:
        # 获取文件大小
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        # 上传文件
        storage.upload_file(
            object_name=object_name,
            file_data=file.file,
            content_type=content_type,
            file_size=file_size
        )
        
        # 更新文档记录
        doc.file_size = file_size
        doc.storage_path = object_name
        db.add(doc)
        db.commit()
        db.refresh(doc)
        
        # TODO: 触发异步处理任务（将在Phase 4实现）
        # from app.celery_tasks.document_tasks import process_document_task
        # process_document_task.delay(doc_id, object_name, kb_id, user.org_id)
        
        return DocumentUploadResponse(
            id=doc_id,
            filename=file.filename,
            file_size=file_size,
            file_type=ext,
            status=DocStatus.PENDING
        )
        
    except Exception as e:
        # 清理：如果上传失败，删除已创建的文档记录
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(
    kb_id: str,
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取文档详情
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return doc.to_dict()


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    kb_id: str,
    doc_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除文档
    同时删除MinIO中的文件和向量存储中的数据
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.kb_id == kb_id,
        Document.org_id == user.org_id
    ).first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # 删除MinIO中的文件
    try:
        storage = MinioStorageService(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET,
            secure=settings.MINIO_SECURE
        )
        storage.delete_file(doc.storage_path)
    except Exception as e:
        # 记录错误但继续删除数据库记录
        print(f"Warning: Failed to delete file from storage: {e}")
    
    # 删除向量存储中的数据
    try:
        from app.services.vector_store import MilvusVectorStore
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.delete_by_doc_id(kb_id, doc_id)
    except Exception as e:
        print(f"Warning: Failed to delete vectors: {e}")
    
    # 删除数据库记录
    db.delete(doc)
    
    # 更新知识库文档计数
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if kb:
        kb.document_count = max(0, kb.document_count - 1)
        kb.total_chunks = max(0, kb.total_chunks - doc.chunk_count)
    
    db.commit()
    
    return None
