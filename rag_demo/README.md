# Enterprise RAG Demo

A demonstration RAG (Retrieval-Augmented Generation) application that showcases two modes of operation: **Normal Mode** (with hardcoded rules) and **Gatekeeper Mode** (with policy enforcement at all 4 stages).

## Features

- 📄 **Document Upload**: Upload PDF, DOCX, TXT, or MD files
- 🔍 **Query Interface**: Ask questions about uploaded documents
- 🛡️ **Two Modes**:
  - **Normal Mode**: Hardcoded rules for blocking queries, filtering, and redaction
  - **Gatekeeper Mode**: Full integration with GateKeeper policy enforcement at all 4 stages
- 🤖 **Gemini Integration**: Uses Google's Gemini Pro model for answer generation
- 💬 **Feedback System**: Submit feedback on answer quality
- 📊 **Stage Visualization**: See policy enforcement decisions at each stage

## Architecture

### Normal Mode
- **Pre-Query**: Hardcoded blocked terms and role-based restrictions
- **Pre-Retrieval**: Hardcoded filters based on user role/department
- **Post-Retrieval**: Hardcoded redaction (email masking, sensitive term filtering)
- **Post-Generation**: Hardcoded answer validation

### Gatekeeper Mode
- **Pre-Query**: Calls GateKeeper API to enforce policies
- **Pre-Retrieval**: Calls GateKeeper API to apply filters
- **Post-Retrieval**: Calls GateKeeper API to sanitize retrieved chunks
- **Post-Generation**: Calls GateKeeper API to validate final answer

## Setup

### Prerequisites

1. Python 3.11+
2. GateKeeper backend running (default: http://localhost:8000) - **Only needed for Gatekeeper Mode**
3. Gemini API key - **Required for answer generation**

### Quick Start

**Option 1: Using the startup script (Recommended)**
```bash
cd rag_demo
python run.py
```

**Option 2: Manual setup**

1. Install dependencies:
```bash
cd rag_demo
pip install -r requirements.txt
```

2. Create a `.env` file (or set environment variables):
```bash
# Create .env file
cat > .env << EOF
GEMINI_API_KEY=your-gemini-api-key-here
GATEKEEPER_URL=http://localhost:8000
EOF
```

Or set environment variables directly:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export GATEKEEPER_URL="http://localhost:8000"  # Optional, defaults to localhost:8000
```

3. Start the RAG demo backend:
```bash
cd backend
python -m uvicorn main:app --reload --port 8001
```

4. Open the frontend:
   - Open `frontend/index.html` directly in your web browser
   - Or serve it with a simple HTTP server:
   ```bash
   cd frontend
   python -m http.server 8080
   ```
   Then navigate to `http://localhost:8080`

## Usage

1. **Upload Documents**: 
   - Click the upload area or drag and drop files
   - Supported formats: PDF, DOCX, TXT, MD

2. **Select Mode**:
   - Choose between "Normal Mode" (hardcoded rules) or "Gatekeeper Mode" (policy enforcement)

3. **Set User Context**:
   - Enter user role (e.g., "admin", "intern", "guest")
   - Enter department (e.g., "HR", "IT")

4. **Ask Questions**:
   - Type your question in the input field
   - Click "Ask" or press Enter
   - View the answer, sources, and policy enforcement stages

5. **Provide Feedback**:
   - After receiving an answer, click 👍 or 👎 to provide feedback

## API Endpoints

- `POST /api/upload` - Upload a document
- `POST /api/query` - Query the RAG system
- `POST /api/feedback` - Submit feedback
- `GET /api/documents` - List uploaded documents
- `DELETE /api/documents/{doc_id}` - Delete a document
- `GET /health` - Health check

## Example Queries

Try these queries to see policy enforcement in action:

1. **Test Normal Mode Blocking**:
   - Set user role to "intern"
   - Ask: "What is the salary information?"
   - Expected: Query should be blocked at pre-query stage

2. **Test Normal Mode Filtering**:
   - Set user role to "intern" and department to "HR"
   - Ask: "Tell me about the company structure"
   - Expected: Only HR-related documents should be retrieved

3. **Test Gatekeeper Mode** (requires GateKeeper backend):
   - Switch to Gatekeeper Mode
   - Set user role to "guest"
   - Ask: "Show me confidential documents"
   - Expected: GateKeeper policies will be enforced at all 4 stages

4. **Test Document Upload**:
   - Upload `sample_document.txt` (included in the repo)
   - Ask: "What departments does the company have?"
   - Expected: Answer based on the uploaded document

## Sample Document

A sample document (`sample_document.txt`) is included for testing. Upload it to see the RAG system in action!

## Notes

- This is a **demo application** and not production-ready
- Vector store is in-memory and will be lost on restart
- Document processing uses basic chunking (500 words with 50 word overlap)
- For production use, consider:
  - Persistent vector database (FAISS, Pinecone, Weaviate)
  - Better chunking strategies
  - More sophisticated embedding models
  - Authentication and authorization
  - Error handling and logging

## Troubleshooting

- **GateKeeper connection errors**: Ensure GateKeeper backend is running on port 8000
- **Gemini API errors**: Check that `GEMINI_API_KEY` is set correctly
- **Document upload fails**: Check file format and size
- **No results**: Ensure documents are uploaded and processed successfully

