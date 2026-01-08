from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import uuid
from pathlib import Path

from .rag_engine import RAGEngine
from .normal_mode import NormalModeRules
from .gatekeeper_mode import GatekeeperMode

app = FastAPI(title="Enterprise RAG Demo", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG engine
rag_engine = RAGEngine()
normal_rules = NormalModeRules()
gatekeeper_mode = GatekeeperMode()

# Store for feedback
feedback_store: Dict[str, Dict[str, Any]] = {}


class QueryRequest(BaseModel):
    query: str
    mode: str  # "normal" or "gatekeeper"
    user: Optional[Dict[str, Any]] = None


class FeedbackRequest(BaseModel):
    query_id: str
    helpful: bool
    comment: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload a document for RAG processing."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Save file
    upload_dir = Path(__file__).parent.parent / "uploads"
    upload_dir.mkdir(exist_ok=True)
    
    file_path = upload_dir / f"{uuid.uuid4()}_{file.filename}"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Process document
    try:
        doc_id = rag_engine.add_document(str(file_path), file.filename)
        return {"doc_id": doc_id, "filename": file.filename, "message": "Document uploaded and processed successfully"}
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")


@app.post("/api/query")
async def query(request: QueryRequest):
    """Query the RAG system in normal or gatekeeper mode."""
    if not request.query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    # Default user context if not provided
    user = request.user or {"role": "user", "department": "general"}
    
    query_id = str(uuid.uuid4())
    
    try:
        if request.mode == "normal":
            # Normal mode: apply hardcoded rules
            result = await normal_rules.process_query(request.query, user, rag_engine)
        elif request.mode == "gatekeeper":
            # Gatekeeper mode: use gatekeeper at all 4 stages
            result = await gatekeeper_mode.process_query(request.query, user, rag_engine)
        else:
            raise HTTPException(status_code=400, detail="Mode must be 'normal' or 'gatekeeper'")
        
        result["query_id"] = query_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")


@app.post("/api/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """Submit feedback for a query."""
    feedback_store[feedback.query_id] = {
        "helpful": feedback.helpful,
        "comment": feedback.comment,
        "timestamp": str(uuid.uuid4())  # Simple timestamp placeholder
    }
    return {"message": "Feedback submitted successfully"}


@app.get("/api/documents")
def list_documents():
    """List all uploaded documents."""
    return {"documents": rag_engine.list_documents()}


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    """Delete a document."""
    success = rag_engine.remove_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

