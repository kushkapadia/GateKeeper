from typing import Dict, Any, List, Tuple
import re
import os
import google.generativeai as genai

class NormalModeRules:
    """Hardcoded rules for normal mode."""
    
    def __init__(self):
        # Hardcoded blocked queries
        self.blocked_terms = [
            "salary", "compensation", "pay", "wage",
            "confidential", "secret", "classified",
            "ssn", "social security", "credit card"
        ]
        
        # Hardcoded role restrictions
        self.role_restrictions = {
            "intern": ["salary", "compensation", "pay"],
            "guest": ["confidential", "secret", "classified"]
        }
        
        # Initialize Gemini for answer generation
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-pro')
            except:
                self.model = None
        else:
            self.model = None
    
    async def process_query(self, query: str, user: Dict[str, Any], rag_engine) -> Dict[str, Any]:
        """Process query with hardcoded rules."""
        result = {
            "query": query,
            "mode": "normal",
            "stages": {}
        }
        
        # Stage 1: Pre-Query - Check if query should be blocked
        blocked, reason = self._pre_query_check(query, user)
        result["stages"]["pre_query"] = {
            "decision": "blocked" if blocked else "allowed",
            "reason": reason
        }
        
        if blocked:
            result["answer"] = f"Query blocked: {reason}"
            result["sources"] = []
            return result
        
        # Stage 2: Pre-Retrieval - Apply filters
        filters = self._pre_retrieval_filters(query, user)
        result["stages"]["pre_retrieval"] = {
            "decision": "modified" if filters else "allowed",
            "filters": filters
        }
        
        # Stage 3: Retrieve documents
        retrieved_chunks = rag_engine.retrieve(query, top_k=3, filters=filters)
        
        # Stage 4: Post-Retrieval - Redact sensitive content
        sanitized_chunks = self._post_retrieval_sanitize(retrieved_chunks, user)
        result["stages"]["post_retrieval"] = {
            "decision": "modified" if len(sanitized_chunks) < len(retrieved_chunks) else "allowed",
            "original_count": len(retrieved_chunks),
            "sanitized_count": len(sanitized_chunks)
        }
        
        # Stage 5: Generate answer using Gemini
        if sanitized_chunks:
            context = "\n\n".join([f"[From {chunk['filename']}]: {chunk['chunk']}" for chunk in sanitized_chunks])
            
            prompt = f"""Based on the following context from documents, answer the user's question.

Context:
{context}

User Question: {query}

Provide a clear, accurate answer based on the context. If the context doesn't contain enough information, say so."""
            
            if self.model:
                try:
                    response = self.model.generate_content(prompt)
                    answer = response.text
                except Exception as e:
                    answer = f"Error generating answer: {str(e)}"
            else:
                # Fallback if Gemini is not configured
                answer = f"Based on the documents: {context[:300]}..."
            
            sources = [{"filename": chunk["filename"], "similarity": chunk["similarity"]} 
                      for chunk in sanitized_chunks]
        else:
            answer = "No relevant information found."
            sources = []
        
        # Stage 6: Post-Generation - Validate answer
        validated_answer = self._post_generation_validate(answer, user)
        result["stages"]["post_generation"] = {
            "decision": "modified" if validated_answer != answer else "allowed"
        }
        
        result["answer"] = validated_answer
        result["sources"] = sources
        
        return result
    
    def _pre_query_check(self, query: str, user: Dict[str, Any]) -> Tuple[bool, str]:
        """Check if query should be blocked."""
        query_lower = query.lower()
        user_role = user.get("role", "").lower()
        
        # Check blocked terms
        for term in self.blocked_terms:
            if term in query_lower:
                # Check role restrictions
                if user_role in self.role_restrictions:
                    if term in self.role_restrictions[user_role]:
                        return True, f"Query contains restricted term '{term}' for role '{user_role}'"
        
        return False, ""
    
    def _pre_retrieval_filters(self, query: str, user: Dict[str, Any]) -> Dict[str, Any]:
        """Apply hardcoded filters based on user role."""
        filters = {}
        user_role = user.get("role", "").lower()
        user_dept = user.get("department", "").lower()
        
        # Example: Interns can only see documents from their department
        if user_role == "intern" and user_dept:
            filters["department"] = user_dept
        
        return filters
    
    def _post_retrieval_sanitize(self, chunks: List[Dict[str, Any]], user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Sanitize retrieved chunks."""
        sanitized = []
        user_role = user.get("role", "").lower()
        
        for chunk in chunks:
            chunk_text = chunk["chunk"]
            
            # Redact email addresses for non-admin users
            if user_role != "admin":
                chunk_text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL REDACTED]', chunk_text)
            
            # Filter out chunks with sensitive terms for interns
            if user_role == "intern":
                if any(term in chunk_text.lower() for term in ["salary", "compensation", "confidential"]):
                    continue  # Skip this chunk
            
            # Create sanitized chunk
            sanitized_chunk = chunk.copy()
            sanitized_chunk["chunk"] = chunk_text
            sanitized.append(sanitized_chunk)
        
        return sanitized
    
    def _post_generation_validate(self, answer: str, user: Dict[str, Any]) -> str:
        """Validate generated answer."""
        # Check if answer contains blocked content
        answer_lower = answer.lower()
        user_role = user.get("role", "").lower()
        
        if user_role == "intern":
            if any(term in answer_lower for term in ["salary", "compensation"]):
                return "I cannot provide information about compensation details for your role level."
        
        return answer

