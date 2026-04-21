from sentence_transformers import SentenceTransformer
from typing import List


class BGEEmbeddingService:
    def __init__(self, model_path: str = "BAAI/bge-m3"):
        self.model = SentenceTransformer(model_path)
        self.dim = 1024
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        instruction = "为这个句子生成表示以用于检索相关文章："
        texts_with_instruction = [instruction + t for t in texts]
        embeddings = self.model.encode(texts_with_instruction, normalize_embeddings=True, batch_size=32)
        return embeddings.tolist()
    
    def embed_query(self, text: str) -> List[float]:
        instruction = "为这个句子生成表示以用于检索相关文章："
        embedding = self.model.encode(instruction + text, normalize_embeddings=True)
        return embedding.tolist()
    
    def embed_batch(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self.embed_documents(batch)
            all_embeddings.extend(embeddings)
        return all_embeddings