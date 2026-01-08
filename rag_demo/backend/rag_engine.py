import os
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
import PyPDF2
import docx
from sentence_transformers import SentenceTransformer
import numpy as np
from collections import defaultdict

class RAGEngine:
    """Simple RAG engine with in-memory vector store."""
    
    def __init__(self):
        # Initialize embedding model (using a lightweight model for demo)
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # In-memory vector store: {doc_id: {chunks: [], embeddings: [], metadata: {}}}
        self.documents: Dict[str, Dict[str, Any]] = {}
        
        # Global index for search
        self.all_chunks: List[str] = []
        self.all_embeddings: np.ndarray = None
        self.chunk_to_doc: Dict[int, str] = {}  # chunk_index -> doc_id
        self.chunk_metadata: Dict[int, Dict[str, Any]] = {}  # chunk_index -> metadata
    
    def _extract_text(self, file_path: str) -> str:
        """Extract text from various file formats."""
        ext = Path(file_path).suffix.lower()
        
        if ext == '.pdf':
            text = ""
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            return text
        
        elif ext in ['.docx', '.doc']:
            doc = docx.Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        
        elif ext in ['.txt', '.md']:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        
        else:
            raise ValueError(f"Unsupported file format: {ext}")
    
    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split text into chunks with overlap."""
        words = text.split()
        chunks = []
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        
        return chunks
    
    def _extract_metadata_from_filename(self, filename: str) -> Dict[str, Any]:
        """Extract metadata from filename (e.g., department, document type)."""
        metadata = {}
        filename_lower = filename.lower()
        
        # Detect department from filename
        if "hr" in filename_lower or "human" in filename_lower:
            metadata["department"] = "HR"
        elif "it" in filename_lower or "tech" in filename_lower or "technical" in filename_lower:
            metadata["department"] = "IT"
        elif "finance" in filename_lower or "financial" in filename_lower:
            metadata["department"] = "Finance"
        elif "legal" in filename_lower:
            metadata["department"] = "Legal"
        else:
            metadata["department"] = "General"
        
        # Detect document type
        if "confidential" in filename_lower or "secret" in filename_lower:
            metadata["classification"] = "confidential"
        elif "public" in filename_lower:
            metadata["classification"] = "public"
        else:
            metadata["classification"] = "internal"
        
        return metadata
    
    def add_document(self, file_path: str, filename: str) -> str:
        """Add a document to the vector store."""
        doc_id = str(uuid.uuid4())
        
        # Extract text
        text = self._extract_text(file_path)
        
        # Chunk text
        chunks = self._chunk_text(text)
        
        if not chunks:
            raise ValueError("No text extracted from document")
        
        # Generate embeddings
        embeddings = self.embedding_model.encode(chunks, show_progress_bar=False)
        
        # Extract metadata from filename
        file_metadata = self._extract_metadata_from_filename(filename)
        
        # Store document
        self.documents[doc_id] = {
            "chunks": chunks,
            "embeddings": embeddings,
            "metadata": {
                "filename": filename,
                "file_path": file_path,
                "num_chunks": len(chunks),
                **file_metadata  # Add extracted metadata
            }
        }
        
        # Update global index
        self._rebuild_index()
        
        return doc_id
    
    def _rebuild_index(self):
        """Rebuild the global search index."""
        self.all_chunks = []
        self.chunk_to_doc = {}
        self.chunk_metadata = {}
        all_emb_list = []
        
        chunk_idx = 0
        for doc_id, doc_data in self.documents.items():
            chunks = doc_data["chunks"]
            embeddings = doc_data["embeddings"]
            doc_metadata = doc_data["metadata"]
            
            for i, chunk in enumerate(chunks):
                self.all_chunks.append(chunk)
                self.chunk_to_doc[chunk_idx] = doc_id
                # Store metadata for each chunk (inherited from document)
                self.chunk_metadata[chunk_idx] = doc_metadata.copy()
                all_emb_list.append(embeddings[i])
                chunk_idx += 1
        
        if all_emb_list:
            self.all_embeddings = np.array(all_emb_list)
        else:
            self.all_embeddings = np.array([])
    
    def _matches_filters(self, chunk_idx: int, filters: Dict[str, Any]) -> bool:
        """Check if a chunk matches the given filters."""
        if not filters:
            return True
        
        chunk_meta = self.chunk_metadata.get(chunk_idx, {})
        
        # Apply filters (simple exact match for demo)
        for key, value in filters.items():
            # Case-insensitive matching for string values
            if key in chunk_meta:
                chunk_value = chunk_meta[key]
                if isinstance(value, str) and isinstance(chunk_value, str):
                    if value.lower() != chunk_value.lower():
                        return False
                elif value != chunk_value:
                    return False
            else:
                # Filter key not in metadata - doesn't match
                return False
        
        return True
    
    def retrieve(self, query: str, top_k: int = 3, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks for a query with optional metadata filters."""
        if len(self.all_chunks) == 0:
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode([query], show_progress_bar=False)[0]
        
        # Compute similarities for all chunks
        similarities = np.dot(self.all_embeddings, query_embedding) / (
            np.linalg.norm(self.all_embeddings, axis=1) * np.linalg.norm(query_embedding)
        )
        
        # Get all indices sorted by similarity
        all_indices = np.argsort(similarities)[::-1]
        
        # Apply filters and collect top-k matching results
        results = []
        for idx in all_indices:
            # Check if chunk matches filters
            if self._matches_filters(idx, filters or {}):
                doc_id = self.chunk_to_doc[idx]
                doc_metadata = self.documents[doc_id]["metadata"]
                chunk_metadata = self.chunk_metadata.get(idx, {})
                
                results.append({
                    "chunk": self.all_chunks[idx],
                    "doc_id": doc_id,
                    "filename": doc_metadata["filename"],
                    "similarity": float(similarities[idx]),
                    "metadata": chunk_metadata  # Include metadata in results
                })
                
                # Stop when we have enough results
                if len(results) >= top_k:
                    break
        
        return results
    
    def list_documents(self) -> List[Dict[str, Any]]:
        """List all documents."""
        return [
            {
                "doc_id": doc_id,
                "filename": doc_data["metadata"]["filename"],
                "num_chunks": doc_data["metadata"]["num_chunks"]
            }
            for doc_id, doc_data in self.documents.items()
        ]
    
    def remove_document(self, doc_id: str) -> bool:
        """Remove a document."""
        if doc_id not in self.documents:
            return False
        
        # Remove file if it exists
        file_path = self.documents[doc_id]["metadata"]["file_path"]
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        
        del self.documents[doc_id]
        self._rebuild_index()
        return True

