from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict
import os
import uuid


class DocumentProcessor:
    SUPPORTED_FORMATS = {'.txt', '.md', '.pdf', '.docx'}
    
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", "。", "，", " ", ""]
        )
    
    def process(self, file_path: str, metadata: Dict = None) -> List[Dict]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {ext}")
        
        if ext == '.txt' or ext == '.md':
            with open(file_path, 'r', encoding='utf-8') as f:
                full_text = f.read()
        else:
            full_text = self._extract_text(file_path, ext)
        
        doc_metadata = {"source": os.path.basename(file_path), "file_type": ext, **(metadata or {})}
        chunks = self.text_splitter.split_text(full_text)
        
        result = []
        for i, chunk in enumerate(chunks):
            result.append({
                "id": i,  # Milvus Lite 要求 id 是 int64，使用索引作为 id
                "content": chunk,
                "metadata": {**doc_metadata, "chunk_index": i, "total_chunks": len(chunks)},
                "chunk_index": i
            })
        return result
    
    def _extract_text(self, file_path: str, ext: str) -> str:
        if ext == '.pdf':
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        elif ext == '.docx':
            from docx import Document
            doc = Document(file_path)
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return f"[Document content from {ext} file]"