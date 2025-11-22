"""
Redaction patterns and PII detection for GateKeeper.

Supports various PII types with configurable patterns and masking strategies.
"""

import re
from typing import Dict, List, Any, Callable, Optional
from enum import Enum


class MaskingStrategy(str, Enum):
    """Strategies for masking detected PII."""
    FULL = "full"  # Replace entire match with [REDACTED]
    PARTIAL = "partial"  # Keep first/last chars visible
    HASH = "hash"  # Replace with deterministic hash
    TYPE_LABEL = "type_label"  # Replace with [EMAIL], [PHONE], etc.


class PIIPattern:
    """Represents a PII detection pattern with masking strategy."""

    def __init__(
        self,
        name: str,
        pattern: str,
        strategy: MaskingStrategy = MaskingStrategy.TYPE_LABEL,
        label: Optional[str] = None,
        flags: int = re.IGNORECASE
    ):
        self.name = name
        self.regex = re.compile(pattern, flags)
        self.strategy = strategy
        self.label = label or f"[{name.upper()}]"

    def mask(self, text: str, match: re.Match) -> str:
        """Apply masking strategy to matched text."""
        matched_text = match.group(0)

        if self.strategy == MaskingStrategy.FULL:
            return "[REDACTED]"

        elif self.strategy == MaskingStrategy.TYPE_LABEL:
            return self.label

        elif self.strategy == MaskingStrategy.PARTIAL:
            if len(matched_text) <= 4:
                return "*" * len(matched_text)
            # Show first and last char: a***@example.com
            return matched_text[0] + "*" * (len(matched_text) - 2) + matched_text[-1]

        elif self.strategy == MaskingStrategy.HASH:
            # Simple deterministic hash for consistent masking
            hash_val = hash(matched_text) % 10000
            return f"[{self.name.upper()}-{hash_val:04d}]"

        return "[REDACTED]"

    def redact(self, text: str) -> str:
        """Redact all matches in text."""
        def replacer(match: re.Match) -> str:
            return self.mask(text, match)

        return self.regex.sub(replacer, text)


# ============================================================================
# BUILT-IN PII PATTERNS
# ============================================================================

BUILTIN_PATTERNS: Dict[str, PIIPattern] = {
    # Email addresses
    "EMAIL": PIIPattern(
        name="EMAIL",
        pattern=r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Phone numbers (various formats)
    "PHONE": PIIPattern(
        name="PHONE",
        pattern=r'''(?x)
            (?:\+\d{1,3}[-.\s]?)?           # Optional country code
            (?:\(\d{3}\)|\d{3})[-.\s]?      # Area code
            \d{3}[-.\s]?                     # First 3 digits
            \d{4}                            # Last 4 digits
        ''',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Indian PAN (Permanent Account Number): ABCDE1234F
    "PAN": PIIPattern(
        name="PAN",
        pattern=r'\b[A-Z]{5}[0-9]{4}[A-Z]\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Indian Aadhaar Number: 1234 5678 9012
    "AADHAAR": PIIPattern(
        name="AADHAAR",
        pattern=r'\b\d{4}\s?\d{4}\s?\d{4}\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Credit Card Numbers (basic pattern)
    "CREDIT_CARD": PIIPattern(
        name="CREDIT_CARD",
        pattern=r'\b(?:\d{4}[-\s]?){3}\d{4}\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Social Security Number (US): 123-45-6789
    "SSN": PIIPattern(
        name="SSN",
        pattern=r'\b\d{3}-\d{2}-\d{4}\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # IP Addresses (v4)
    "IP_ADDRESS": PIIPattern(
        name="IP_ADDRESS",
        pattern=r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Generic person names (simple heuristic - capitalized words)
    # More conservative: only redact if preceded by context keywords
    "PERSON_NAME": PIIPattern(
        name="PERSON_NAME",
        pattern=r'(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*',
        strategy=MaskingStrategy.TYPE_LABEL
    ),

    # Dates in various formats (can be sensitive in medical/HR contexts)
    "DATE": PIIPattern(
        name="DATE",
        pattern=r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b',
        strategy=MaskingStrategy.TYPE_LABEL,
        flags=re.IGNORECASE
    ),

    # Salary/Currency amounts (when marked as sensitive)
    "SALARY": PIIPattern(
        name="SALARY",
        pattern=r'(?:Rs\.?|INR|USD|\$|€|£)\s*[\d,]+(?:\.\d{2})?(?:\s*(?:lakhs?|crores?|k|K|M))?',
        strategy=MaskingStrategy.TYPE_LABEL,
        flags=re.IGNORECASE
    ),

    # Medical Record Numbers (MRN): MRN-123456
    "MRN": PIIPattern(
        name="MRN",
        pattern=r'\bMRN[-:\s]?\d{5,10}\b',
        strategy=MaskingStrategy.TYPE_LABEL,
        flags=re.IGNORECASE
    ),

    # Generic ID numbers with prefixes
    "ID_NUMBER": PIIPattern(
        name="ID_NUMBER",
        pattern=r'\b(?:ID|EMP|CUST)[-:\s]?\d{4,10}\b',
        strategy=MaskingStrategy.TYPE_LABEL,
        flags=re.IGNORECASE
    ),
}


# ============================================================================
# REDACTION ENGINE
# ============================================================================

class RedactionEngine:
    """Main redaction engine for applying PII patterns to text."""

    def __init__(self, custom_patterns: Optional[Dict[str, PIIPattern]] = None):
        """
        Initialize redaction engine with built-in and custom patterns.

        Args:
            custom_patterns: Additional patterns to merge with built-in ones
        """
        self.patterns = BUILTIN_PATTERNS.copy()
        if custom_patterns:
            self.patterns.update(custom_patterns)

    def redact_text(self, text: str, pattern_names: List[str]) -> str:
        """
        Redact text using specified patterns.

        Args:
            text: Text to redact
            pattern_names: List of pattern names to apply (e.g., ["EMAIL", "PHONE"])

        Returns:
            Redacted text
        """
        if not text:
            return text

        redacted = text
        for pattern_name in pattern_names:
            if pattern_name in self.patterns:
                redacted = self.patterns[pattern_name].redact(redacted)

        return redacted

    def redact_fields(
        self,
        data: Dict[str, Any],
        field_patterns: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        """
        Redact specific fields in a dictionary using specified patterns.

        Args:
            data: Dictionary containing fields to redact
            field_patterns: Map of field paths to pattern names
                           e.g., {"text": ["EMAIL", "PHONE"], "metadata.notes": ["SALARY"]}

        Returns:
            Dictionary with redacted fields
        """
        result = data.copy()

        for field_path, pattern_names in field_patterns.items():
            # Handle nested paths like "metadata.notes"
            parts = field_path.split(".")
            current = result

            # Navigate to parent of target field
            for part in parts[:-1]:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    break
            else:
                # Redact the final field
                final_key = parts[-1]
                if isinstance(current, dict) and final_key in current:
                    if isinstance(current[final_key], str):
                        current[final_key] = self.redact_text(
                            current[final_key],
                            pattern_names
                        )
                    elif isinstance(current[final_key], list):
                        current[final_key] = [
                            self.redact_text(item, pattern_names)
                            if isinstance(item, str) else item
                            for item in current[final_key]
                        ]

        return result

    def redact_chunks(
        self,
        chunks: List[Dict[str, Any]],
        pattern_names: List[str],
        text_field: str = "text"
    ) -> List[Dict[str, Any]]:
        """
        Redact text field in a list of chunks (common for RAG retrieval).

        Args:
            chunks: List of chunk dictionaries
            pattern_names: Patterns to apply
            text_field: Field name containing text to redact (default: "text")

        Returns:
            List of chunks with redacted text
        """
        redacted_chunks = []

        for chunk in chunks:
            redacted_chunk = chunk.copy()
            if text_field in redacted_chunk and isinstance(redacted_chunk[text_field], str):
                redacted_chunk[text_field] = self.redact_text(
                    redacted_chunk[text_field],
                    pattern_names
                )
            redacted_chunks.append(redacted_chunk)

        return redacted_chunks

    def detect_pii(self, text: str, pattern_names: Optional[List[str]] = None) -> Dict[str, List[str]]:
        """
        Detect (but don't redact) PII in text.

        Args:
            text: Text to analyze
            pattern_names: Patterns to check (default: all patterns)

        Returns:
            Dictionary mapping pattern names to list of matches
        """
        if pattern_names is None:
            pattern_names = list(self.patterns.keys())

        detections = {}
        for pattern_name in pattern_names:
            if pattern_name in self.patterns:
                pattern = self.patterns[pattern_name]
                matches = pattern.regex.findall(text)
                if matches:
                    detections[pattern_name] = matches

        return detections

    def add_pattern(self, name: str, pattern: PIIPattern):
        """Add or override a pattern."""
        self.patterns[name] = pattern

    def remove_pattern(self, name: str):
        """Remove a pattern."""
        if name in self.patterns:
            del self.patterns[name]


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

# Global default engine instance
_default_engine = RedactionEngine()


def redact_text(text: str, patterns: List[str]) -> str:
    """Convenience function using default engine."""
    return _default_engine.redact_text(text, patterns)


def redact_fields(data: Dict[str, Any], field_patterns: Dict[str, List[str]]) -> Dict[str, Any]:
    """Convenience function using default engine."""
    return _default_engine.redact_fields(data, field_patterns)


def redact_chunks(chunks: List[Dict[str, Any]], patterns: List[str], text_field: str = "text") -> List[Dict[str, Any]]:
    """Convenience function using default engine."""
    return _default_engine.redact_chunks(chunks, patterns, text_field)


def detect_pii(text: str, patterns: Optional[List[str]] = None) -> Dict[str, List[str]]:
    """Convenience function using default engine."""
    return _default_engine.detect_pii(text, patterns)
