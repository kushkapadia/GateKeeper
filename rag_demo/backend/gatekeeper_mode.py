from typing import Dict, Any, List
import os
import sys
from pathlib import Path
import asyncio
import httpx

# Add parent directory to path to import gatekeeper SDK
project_root = Path(__file__).parent.parent.parent
sdk_path = project_root / "sdk" / "python"
sys.path.insert(0, str(sdk_path))

from gatekeeper_sdk.client import GateKeeperClient
import google.generativeai as genai

class GatekeeperMode:
    """Gatekeeper mode that calls gatekeeper at all 4 stages."""
    
    def __init__(self):
        # Initialize GateKeeper client with async support
        gatekeeper_url = os.getenv("GATEKEEPER_URL", "http://localhost:8000")
        self.gatekeeper = GateKeeperClient(gatekeeper_url)
        self.gatekeeper_url = gatekeeper_url
        
        # Initialize Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
    
    async def _enforce_async(self, stage: str, user: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
        """Async wrapper for gatekeeper enforce calls."""
        async with httpx.AsyncClient(timeout=5.0) as client:
            payload = {
                "stage": stage,
                "user": user,
                "request": data,
            }
            resp = await client.post(f"{self.gatekeeper_url}/v1/enforce", json=payload)
            resp.raise_for_status()
            return resp.json()
    
    async def process_query(self, query: str, user: Dict[str, Any], rag_engine) -> Dict[str, Any]:
        """Process query with gatekeeper at all 4 stages."""
        result = {
            "query": query,
            "mode": "gatekeeper",
            "stages": {}
        }
        
        # Stage 1: Pre-Query Enforcement (optimized with async)
        try:
            pre_query_result = await self._enforce_async(
                stage="pre_query",
                user=user,
                data={"query": query}
            )
        except Exception as e:
            # Fallback to sync if async fails
            pre_query_result = self.gatekeeper.enforce(
                stage="pre_query",
                user=user,
                data={"query": query}
            )
        
        result["stages"]["pre_query"] = {
            "decision": pre_query_result.get("decision", "allowed"),
            "trace": pre_query_result.get("trace", []),
            "data": pre_query_result.get("data", {})
        }
        
        if pre_query_result.get("decision") == "blocked":
            result["answer"] = pre_query_result.get("data", {}).get("message", "Query blocked by policy")
            result["sources"] = []
            return result
        
        # Get modified query if rewritten
        # API returns: {"request": {"query": replacement}} or {"message": "..."}
        data = pre_query_result.get("data", {})
        modified_query = data.get("request", {}).get("query", query)
        policy_context_pre_query = pre_query_result.get("policyContext")
        
        # Stage 2: Pre-Retrieval Enforcement
        try:
            pre_retrieval_result = await self._enforce_async(
                stage="pre_retrieval",
                user=user,
                data={"query": modified_query}
            )
        except Exception as e:
            pre_retrieval_result = self.gatekeeper.enforce(
                stage="pre_retrieval",
                user=user,
                data={"query": modified_query}
            )
        
        # API returns: {"request": {"filters": {...}}}
        pre_retrieval_data = pre_retrieval_result.get("data", {})
        filters = pre_retrieval_data.get("request", {}).get("filters", {})
        
        result["stages"]["pre_retrieval"] = {
            "decision": pre_retrieval_result.get("decision", "allowed"),
            "trace": pre_retrieval_result.get("trace", []),
            "filters": filters
        }
        
        # Apply filters from gatekeeper
        policy_context_pre_retrieval = pre_retrieval_result.get("policyContext")
        
        # Stage 3: Retrieve documents
        retrieved_chunks = rag_engine.retrieve(modified_query, top_k=5, filters=filters)
        
        # Stage 4: Post-Retrieval Enforcement
        try:
            post_retrieval_result = await self._enforce_async(
                stage="post_retrieval",
                user=user,
                data={
                    "chunks": [
                        {
                            "text": chunk["chunk"],
                            "metadata": {
                                "doc_id": chunk["doc_id"],
                                "filename": chunk["filename"],
                                "similarity": chunk["similarity"]
                            }
                        }
                        for chunk in retrieved_chunks
                    ]
                }
            )
        except Exception as e:
            post_retrieval_result = self.gatekeeper.enforce(
                stage="post_retrieval",
                user=user,
                data={
                    "chunks": [
                        {
                            "text": chunk["chunk"],
                            "metadata": {
                                "doc_id": chunk["doc_id"],
                                "filename": chunk["filename"],
                                "similarity": chunk["similarity"]
                            }
                        }
                        for chunk in retrieved_chunks
                    ]
                }
            )
        
        # Post-retrieval: API may return sanitized chunks in data
        # Structure depends on implementation - could be {"chunks": [...]} or {"request": {"chunks": [...]}}
        post_retrieval_data = post_retrieval_result.get("data", {})
        
        # Try different possible structures
        sanitized_chunks_data = (
            post_retrieval_data.get("chunks") or 
            post_retrieval_data.get("request", {}).get("chunks") or 
            []
        )
        
        result["stages"]["post_retrieval"] = {
            "decision": post_retrieval_result.get("decision", "allowed"),
            "trace": post_retrieval_result.get("trace", []),
            "original_count": len(retrieved_chunks),
            "sanitized_count": len(sanitized_chunks_data)
        }
        
        policy_context_post_retrieval = post_retrieval_result.get("policyContext")
        
        # Reconstruct sanitized chunks
        # If GateKeeper returned sanitized chunks, use them; otherwise use original
        if sanitized_chunks_data:
            sanitized_chunks = []
            for i, chunk_data in enumerate(sanitized_chunks_data):
                if i < len(retrieved_chunks):
                    sanitized_chunk = retrieved_chunks[i].copy()
                    # Handle both dict and string formats
                    if isinstance(chunk_data, dict):
                        sanitized_chunk["chunk"] = chunk_data.get("text", chunk_data.get("chunk", sanitized_chunk["chunk"]))
                    elif isinstance(chunk_data, str):
                        sanitized_chunk["chunk"] = chunk_data
                    sanitized_chunks.append(sanitized_chunk)
        else:
            # No sanitization returned - use original chunks
            sanitized_chunks = retrieved_chunks
        
        # Build context for LLM
        if sanitized_chunks:
            context = "\n\n".join([f"[From {chunk['filename']}]: {chunk['chunk']}" for chunk in sanitized_chunks])
            
            # Combine policy contexts if available
            policy_instructions = ""
            for pc in [policy_context_pre_query, policy_context_pre_retrieval, policy_context_post_retrieval]:
                if pc:
                    policy_instructions += f"\n{pc}\n"
            
            # Generate answer with Gemini
            prompt = f"""Based on the following context from documents, answer the user's question.

Context:
{context}

User Question: {modified_query}

{policy_instructions if policy_instructions else ""}

Provide a clear, accurate answer based on the context. If the context doesn't contain enough information, say so."""
            
            try:
                response = self.model.generate_content(prompt)
                answer = response.text
            except Exception as e:
                answer = f"Error generating answer: {str(e)}"
            
            sources = [
                {"filename": chunk["filename"], "similarity": chunk["similarity"]}
                for chunk in sanitized_chunks
            ]
        else:
            answer = "No relevant information found after policy enforcement."
            sources = []
        
        # Stage 5: Post-Generation Enforcement
        try:
            post_generation_result = await self._enforce_async(
                stage="post_generation",
                user=user,
                data={
                    "answer": answer,
                    "sources": sources
                }
            )
        except Exception as e:
            post_generation_result = self.gatekeeper.enforce(
                stage="post_generation",
                user=user,
                data={
                    "answer": answer,
                    "sources": sources
                }
            )
        
        result["stages"]["post_generation"] = {
            "decision": post_generation_result.get("decision", "allowed"),
            "trace": post_generation_result.get("trace", []),
            "modified": post_generation_result.get("decision") == "modified"
        }
        
        # Post-generation: API may return modified answer
        # Structure could be {"answer": "..."} or {"request": {"answer": "..."}}
        post_generation_data = post_generation_result.get("data", {})
        final_answer = (
            post_generation_data.get("answer") or 
            post_generation_data.get("request", {}).get("answer") or 
            answer
        )
        
        result["answer"] = final_answer
        result["sources"] = sources
        result["policy_context"] = {
            "pre_query": policy_context_pre_query,
            "pre_retrieval": policy_context_pre_retrieval,
            "post_retrieval": policy_context_post_retrieval,
            "post_generation": post_generation_result.get("policyContext")
        }
        
        return result

