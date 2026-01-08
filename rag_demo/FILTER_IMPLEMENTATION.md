# Filter Implementation - How It Works

## Problem Identified

1. **No Vector DB**: We're using in-memory NumPy arrays (not a proper vector DB like Pinecone/Weaviate)
2. **Filters Were Ignored**: The `retrieve()` method accepted `filters` parameter but **never applied them**

## Solution Implemented

### 1. Metadata Extraction
- Automatically extracts metadata from filenames:
  - **Department**: Detects "HR", "IT", "Finance", "Legal" from filename
  - **Classification**: Detects "confidential", "public", "internal"
- Example: `demo_document_hr.txt` → `{department: "HR", classification: "internal"}`

### 2. Metadata Storage
- Each chunk inherits metadata from its document
- Stored in `chunk_metadata` dictionary: `{chunk_index: metadata}`
- Allows filtering at chunk level

### 3. Filter Application
- `_matches_filters()` method checks if chunk matches filter criteria
- Applied **during retrieval** - only matching chunks are returned
- Case-insensitive string matching
- Exact match for other types

### 4. How Filters Work Now

**Example Flow:**

1. **Gatekeeper Pre-Retrieval Stage** returns:
   ```json
   {
     "filters": {
       "department": "HR"
     }
   }
   ```

2. **RAG Engine** receives filters and:
   - Computes similarity scores for all chunks
   - Sorts by similarity
   - **Filters out chunks that don't match** `department: "HR"`
   - Returns top-k matching chunks

3. **Result**: Only HR department documents are retrieved, even if IT documents have higher similarity

## Current Limitations

1. **Simple Metadata**: Only extracts from filename (not document content)
2. **Basic Filtering**: Exact match only (no range queries, regex, etc.)
3. **No Vector DB Features**: 
   - No hybrid search (keyword + vector)
   - No advanced filtering (date ranges, numeric ranges)
   - No persistence (in-memory only)

## For Production

To use a proper vector DB, you would:

1. **Use Pinecone/Weaviate/FAISS**:
   - Store embeddings in vector DB
   - Store metadata separately
   - Use DB's native filtering capabilities

2. **Example with Pinecone**:
   ```python
   index.query(
       vector=query_embedding,
       top_k=top_k,
       filter={
           "department": {"$eq": "HR"}
       }
   )
   ```

3. **Benefits**:
   - Better performance at scale
   - Advanced filtering (ranges, AND/OR logic)
   - Persistence
   - Hybrid search

## Testing Filters

To test that filters work:

1. Upload `demo_document_hr.txt` (detected as HR department)
2. Upload `demo_document_it.txt` (detected as IT department)
3. In Gatekeeper mode, set user role to `intern`, department to `HR`
4. Query: "What are the security policies?"
5. **Expected**: Only HR document chunks returned (IT filtered out)
6. Check the `pre_retrieval` stage in response - should show filters applied

## Key Takeaway

**Filters from Gatekeeper are now properly applied!** 

The pre-retrieval stage filters are used to restrict which chunks are retrieved, ensuring users only see documents they're authorized to access.

