import os
from app.celery_tasks.celery_app import celery_app
from app.services.rag.document_processor import DocumentProcessor
from app.services.rag.embedding_service import BGEEmbeddingService
from app.services.rag.vector_store import MilvusVectorStore
from app.services.storage.minio_client import MinioStorageService
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.document import Document, DocStatus
from app.models.knowledge_base import KnowledgeBase


@celery_app.task(bind=True, max_retries=3)
def process_document_task(self, document_id: str, object_name: str, kb_id: str, org_id: str):
    db = SessionLocal()
    temp_file_path = None
    
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = DocStatus.PROCESSING
        db.commit()
        
        storage = MinioStorageService(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            bucket=settings.MINIO_BUCKET,
            secure=settings.MINIO_SECURE
        )
        
        temp_file_path = f"/tmp/{document_id}_{doc.filename}"
        storage.download_file(object_name, temp_file_path)
        
        processor = DocumentProcessor(
            chunk_size=settings.DOCUMENT_CHUNK_SIZE,
            chunk_overlap=settings.DOCUMENT_CHUNK_OVERLAP
        )
        chunks = processor.process(temp_file_path, metadata={"doc_id": document_id})
        
        embedding_service = BGEEmbeddingService(model_path=settings.BGE_MODEL_PATH)
        texts = [c["content"] for c in chunks]
        embeddings = embedding_service.embed_batch(texts)
        
        for i, chunk in enumerate(chunks):
            chunk["embedding"] = embeddings[i]
            chunk["doc_id"] = document_id
        
        vector_store = MilvusVectorStore(
            db_path=settings.MILVUS_LITE_PATH,
            dim=settings.EMBEDDING_DIMENSION
        )
        vector_store.insert_chunks(kb_id, chunks)
        
        doc.status = DocStatus.COMPLETED
        doc.chunk_count = len(chunks)
        
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        kb.document_count += 1
        kb.total_chunks += len(chunks)
        
        db.commit()
        return {"document_id": document_id, "chunks_processed": len(chunks)}
        
    except Exception as exc:
        doc = db.query(Document).filter(Document.id == document_id).first()
        doc.status = DocStatus.FAILED
        doc.error_message = str(exc)
        db.commit()
        raise self.retry(exc=exc, countdown=60)
        
    finally:
        db.close()
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)