"""
Embedding 服务 - 使用本地 BGE-M3 模型
"""
from typing import List
import os


class BGEEmbeddingService:
    """
    Embedding 服务 - 使用本地 BGE-M3 模型
    """
    
    def __init__(self, model_path: str = None):
        self.dim = 1024
        self._model = None
        
        # 确定模型路径
        if model_path and os.path.exists(model_path):
            self.model_path = model_path
        else:
            # 默认路径
            self.model_path = "./model/bge-m3"
        
        # 加载模型
        try:
            from sentence_transformers import SentenceTransformer
            
            print(f"[INFO] Loading BGE-M3 model from: {self.model_path}")
            self._model = SentenceTransformer(self.model_path)
            print(f"[INFO] Model loaded successfully")
            
        except Exception as e:
            print(f"[ERROR] Failed to load embedding model: {e}")
            raise RuntimeError(f"Failed to load embedding model: {e}")
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        为文档生成 embedding
        使用指令前缀优化检索效果
        """
        if not texts:
            return []
        
        # BGE-M3 推荐的前缀
        instruction = "为这个句子生成表示以用于检索相关文章："
        texts_with_instruction = [instruction + t for t in texts]
        
        embeddings = self._model.encode(
            texts_with_instruction, 
            normalize_embeddings=True, 
            batch_size=32,
            show_progress_bar=False
        )
        return embeddings.tolist()
    
    def embed_query(self, text: str) -> List[float]:
        """为查询生成 embedding"""
        if not text:
            return [0.0] * self.dim
        
        instruction = "为这个句子生成表示以用于检索相关文章："
        embedding = self._model.encode(
            instruction + text, 
            normalize_embeddings=True,
            show_progress_bar=False
        )
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """批量生成 embedding"""
        return self.embed_documents(texts)
