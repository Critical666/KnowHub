from pymilvus import MilvusClient
from typing import List, Dict, Optional, Any
import os
import logging

logger = logging.getLogger(__name__)

class MilvusVectorStore:
    '''Milvus Lite 向量存储操作类'''

    def __init__(self, db_path:str = "./milvus_data/knowhub.db", dim: int = 1024):
        self.db_path = db_path
        self.dim = dim

        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.client = MilvusClient(db_path)
        logger.info(f"Milvus Lite initialized: {db_path}")

    def _get_collection_name(self, kb_id:str) -> str:
        safe_kb_id = kb_id.replace("-", "_")
        return f"kb_{safe_kb_id}"

    def create_collection(self, kb_id: str) -> bool:
        """创建Collection - Milvus Lite 简化版"""
        collection_name = self._get_collection_name(kb_id)

        if self.client.has_collection(collection_name):
            logger.info(f"Collection {collection_name} already exists")
            return True
        
        # Milvus Lite 简化创建方式
        self.client.create_collection(
            collection_name=collection_name,
            dimension=self.dim,
            metric_type="COSINE"
        )

        logger.info(f"Created collection {collection_name}")
        return True
    
    def insert_chunks(self, kb_id:str, chunks: List[Dict[str, Any]]) -> None:
        """批量插入chunks"""
        if not chunks:
            logger.warning("No chunks to insert")
            return
        
        collection_name = self._get_collection_name(kb_id)

        if not self.client.has_collection(collection_name):
            self.create_collection(kb_id)

        # 准备数据 - Milvus Lite 格式
        data = []
        for i, chunk in enumerate(chunks):
            data.append({
                "id": i,
                "vector": chunk["embedding"],
                "doc_id": chunk["doc_id"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"][:500],  # 限制长度避免超出限制
            })
        
        self.client.insert(collection_name, data)
        logger.info(f"Inserted {len(chunks)} chunks into {collection_name}")

    def search(
        self,
        kb_id:str,
        query_embedding:List[float],
        query_text: str = "",
        top_k:int = 10,
        score_threshold: float = 0.5,
        doc_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """向量相似度检索 + 简单关键词过滤"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            logger.warning(f"Collection {collection_name} does not exist")
            return []

        # 执行向量搜索
        results = self.client.search(
            collection_name=collection_name,
            data=[query_embedding],
            limit=top_k * 2,  # 多取一些结果用于过滤
            output_fields=["doc_id", "content", "chunk_index"],
        )

        # 解析结果
        hits = []
        for result in results[0]:
            similarity = 1 - result["distance"]
            
            # 应用分数阈值
            if similarity >= score_threshold:
                hits.append({
                    "id": result["id"],
                    "doc_id": result["entity"]["doc_id"],
                    "content": result["entity"]["content"],
                    "chunk_index": result["entity"]["chunk_index"],
                    "score": similarity,
                })
        
        # 如果有查询文本，进行简单关键词加权
        if query_text and hits:
            keywords = self._extract_keywords(query_text)
            for hit in hits:
                content_lower = hit["content"].lower()
                keyword_matches = sum(1 for kw in keywords if kw in content_lower)
                # 关键词匹配加分
                if keyword_matches > 0:
                    hit["score"] = min(hit["score"] + 0.1 * keyword_matches, 1.0)
            
            # 重新排序
            hits.sort(key=lambda x: x["score"], reverse=True)
        
        final_hits = hits[:top_k]
        
        logger.info(f"Search in {collection_name} returned {len(final_hits)} results")
        return final_hits
    
    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词"""
        # 简单提取中文字符和英文单词
        import re
        # 提取中文词汇（2-4个字）
        chinese_words = re.findall(r'[\u4e00-\u9fa5]{2,4}', text)
        # 提取英文单词
        english_words = re.findall(r'[a-zA-Z]{3,}', text)
        return chinese_words + english_words

    def delete_by_doc_id(self, kb_id: str, doc_id: str) -> None:
        """删除指定文档的所有片段"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return
        
        self.client.delete(collection_name, filter=f"doc_id == '{doc_id}'")
        logger.info(f"Deleted chunks for doc {doc_id} from {collection_name}")
        
    def delete_collection(self, kb_id: str) -> None:
        """删除整个知识库的Collection"""
        collection_name = self._get_collection_name(kb_id)
        
        if self.client.has_collection(collection_name):
            self.client.drop_collection(collection_name)
            logger.info(f"Dropped collection {collection_name}")
    
    def get_stats(self, kb_id: str) -> Dict[str, int]:
        """获取知识库统计信息"""
        collection_name = self._get_collection_name(kb_id)
        
        if not self.client.has_collection(collection_name):
            return {"total": 0}
        
        stats = self.client.get_collection_stats(collection_name)
        return {"total": stats.get("row_count", 0)}
