"""
Intelligent query normalization and fuzzy matching for pre-query enforcement.

Handles:
- Case insensitivity
- Typos and misspellings (fuzzy matching)
- Homoglyphs and character substitutions (l33t speak, lookalikes)
- Whitespace/separator manipulation
- Repeated characters (saaaaalary -> salary)
- Word boundaries and context
"""

import re
from typing import List, Set, Dict, Tuple
from difflib import SequenceMatcher


# ============================================================================
# HOMOGLYPH MAPPING (lookalike characters)
# ============================================================================

HOMOGLYPH_MAP = {
    # Latin lookalikes
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',  # Cyrillic -> Latin
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',

    # Greek lookalikes
    'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'ο': 'o', 'υ': 'y', 'ν': 'v',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',

    # Numbers and special chars
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
    '@': 'a', '$': 's', '!': 'i', '|': 'i', '£': 'e',

    # Accented characters
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n', 'ç': 'c',
}


# ============================================================================
# NORMALIZATION FUNCTIONS
# ============================================================================

def normalize_homoglyphs(text: str) -> str:
    """Replace lookalike characters with ASCII equivalents."""
    result = []
    for char in text:
        result.append(HOMOGLYPH_MAP.get(char, char))
    return ''.join(result)


def normalize_repeated_chars(text: str) -> str:
    """
    Collapse repeated characters: saaaaalary -> salary, heeello -> hello
    Keep double letters that are legitimate (e.g., 'book', 'letter')
    """
    # Replace 3+ repeated chars with single char
    return re.sub(r'(.)\1{2,}', r'\1', text)


def normalize_separators(text: str) -> str:
    """
    Remove or normalize separators: s.a.l.a.r.y -> salary, s-a-l-a-r-y -> salary
    Also handles: sal ary -> salary, sal_ary -> salary
    """
    # Remove common separators between characters
    text = re.sub(r'([a-z])[.\-_\s]+([a-z])', r'\1\2', text, flags=re.IGNORECASE)
    return text


def normalize_whitespace(text: str) -> str:
    """Normalize all whitespace to single spaces."""
    return re.sub(r'\s+', ' ', text).strip()


def normalize_case(text: str) -> str:
    """Convert to lowercase."""
    return text.lower()


def apply_full_normalization(text: str) -> str:
    """
    Apply all normalization steps in sequence.

    Pipeline:
    1. Normalize homoglyphs (lookalike chars)
    2. Normalize case (lowercase)
    3. Remove separators
    4. Collapse repeated chars
    5. Normalize whitespace
    """
    text = normalize_homoglyphs(text)
    text = normalize_case(text)
    text = normalize_separators(text)
    text = normalize_repeated_chars(text)
    text = normalize_whitespace(text)
    return text


# ============================================================================
# FUZZY MATCHING
# ============================================================================

def fuzzy_similarity(str1: str, str2: str) -> float:
    """
    Calculate similarity ratio between two strings (0.0 to 1.0).
    Uses SequenceMatcher for edit distance-based similarity.
    """
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def fuzzy_match(query: str, term: str, threshold: float = 0.85) -> bool:
    """
    Check if term fuzzy-matches within query.

    Args:
        query: The query text to search in
        term: The term to search for
        threshold: Similarity threshold (0.0 to 1.0, default 0.85)

    Returns:
        True if term is found with similarity >= threshold
    """
    query_normalized = apply_full_normalization(query)
    term_normalized = apply_full_normalization(term)

    # Direct substring match after normalization
    if term_normalized in query_normalized:
        return True

    # Fuzzy match against words in query
    query_words = query_normalized.split()
    for word in query_words:
        if fuzzy_similarity(word, term_normalized) >= threshold:
            return True

    # Fuzzy match against n-grams (for multi-word terms)
    if ' ' in term_normalized:
        term_words = term_normalized.split()
        n = len(term_words)
        for i in range(len(query_words) - n + 1):
            window = ' '.join(query_words[i:i+n])
            if fuzzy_similarity(window, term_normalized) >= threshold:
                return True

    return False


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate Levenshtein distance (edit distance) between two strings.
    Returns minimum number of single-character edits needed.
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            # Cost of insertions, deletions, substitutions
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def typo_match(query: str, term: str, max_edits: int = 2) -> bool:
    """
    Check if term appears in query with at most max_edits typos.

    Args:
        query: Query text
        term: Term to search for
        max_edits: Maximum allowed edit distance (typos)

    Returns:
        True if term found with <= max_edits typos
    """
    query_normalized = apply_full_normalization(query)
    term_normalized = apply_full_normalization(term)

    # Check each word in query
    query_words = query_normalized.split()
    for word in query_words:
        if levenshtein_distance(word, term_normalized) <= max_edits:
            return True

    # Check n-grams for multi-word terms
    if ' ' in term_normalized:
        term_words = term_normalized.split()
        n = len(term_words)
        for i in range(len(query_words) - n + 1):
            window = ' '.join(query_words[i:i+n])
            if levenshtein_distance(window, term_normalized) <= max_edits * n:
                return True

    return False


# ============================================================================
# INTENT PATTERNS (semantic matching)
# ============================================================================

INTENT_PATTERNS = {
    "salary_query": [
        r'\b(?:what|how\s+much|tell\s+me|show\s+me|give\s+me)\b.*\b(?:salary|salaries|compensation|pay|earning|income|wage)\b',
        r'\b(?:salary|salaries|compensation|pay|earning|income|wage)\b.*\b(?:of|for)\b',
        r'\b(?:how\s+much\s+does|how\s+much\s+do)\b.*\b(?:make|earn|get\s+paid)\b',
    ],
    "personal_info_query": [
        r'\b(?:what|tell\s+me|show\s+me|give\s+me)\b.*\b(?:email|phone|address|contact|personal)\b',
        r'\b(?:phone\s+number|email\s+address|home\s+address)\b',
    ],
    "confidential_doc_query": [
        r'\b(?:confidential|classified|secret|restricted|private)\b.*\b(?:document|file|report|memo)\b',
        r'\b(?:show|give|access)\b.*\b(?:confidential|classified|restricted)\b',
    ],
}


def match_intent(query: str, intent_name: str) -> bool:
    """
    Check if query matches a semantic intent pattern.

    Args:
        query: Query text
        intent_name: Intent pattern name (e.g., "salary_query")

    Returns:
        True if query matches the intent
    """
    if intent_name not in INTENT_PATTERNS:
        return False

    query_normalized = apply_full_normalization(query)

    for pattern in INTENT_PATTERNS[intent_name]:
        if re.search(pattern, query_normalized, re.IGNORECASE):
            return True

    return False


# ============================================================================
# ADVANCED MATCHING ENGINE
# ============================================================================

class QueryMatcher:
    """
    Advanced query matching engine with multiple strategies.
    """

    def __init__(
        self,
        fuzzy_threshold: float = 0.85,
        max_typos: int = 2,
        enable_normalization: bool = True
    ):
        """
        Initialize matcher with configuration.

        Args:
            fuzzy_threshold: Threshold for fuzzy matching (0.0-1.0)
            max_typos: Maximum allowed typos for typo matching
            enable_normalization: Whether to apply text normalization
        """
        self.fuzzy_threshold = fuzzy_threshold
        self.max_typos = max_typos
        self.enable_normalization = enable_normalization

    def matches(
        self,
        query: str,
        terms: List[str],
        match_mode: str = "fuzzy"
    ) -> Tuple[bool, List[str]]:
        """
        Check if any term matches the query.

        Args:
            query: Query text to check
            terms: List of terms to match against
            match_mode: Matching strategy - "exact", "fuzzy", "typo", "semantic"

        Returns:
            Tuple of (matched: bool, matched_terms: List[str])
        """
        matched_terms = []

        for term in terms:
            if match_mode == "exact":
                if self._exact_match(query, term):
                    matched_terms.append(term)
            elif match_mode == "fuzzy":
                if fuzzy_match(query, term, self.fuzzy_threshold):
                    matched_terms.append(term)
            elif match_mode == "typo":
                if typo_match(query, term, self.max_typos):
                    matched_terms.append(term)
            elif match_mode == "semantic":
                # Treat term as intent name
                if match_intent(query, term):
                    matched_terms.append(term)
            elif match_mode == "any":
                # Try all strategies
                if (self._exact_match(query, term) or
                    fuzzy_match(query, term, self.fuzzy_threshold) or
                    typo_match(query, term, self.max_typos)):
                    matched_terms.append(term)

        return len(matched_terms) > 0, matched_terms

    def _exact_match(self, query: str, term: str) -> bool:
        """Exact match with normalization."""
        if self.enable_normalization:
            query_normalized = apply_full_normalization(query)
            term_normalized = apply_full_normalization(term)
            return term_normalized in query_normalized
        else:
            return term.lower() in query.lower()

    def normalize(self, text: str) -> str:
        """Normalize text using configured settings."""
        if self.enable_normalization:
            return apply_full_normalization(text)
        return text.lower()


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def smart_match(query: str, forbidden_terms: List[str], match_mode: str = "fuzzy") -> Tuple[bool, List[str]]:
    """
    Convenience function for smart matching with default settings.

    Args:
        query: Query text
        forbidden_terms: Terms to match against
        match_mode: Matching mode ("exact", "fuzzy", "typo", "semantic", "any")

    Returns:
        Tuple of (is_blocked: bool, matched_terms: List[str])
    """
    matcher = QueryMatcher()
    return matcher.matches(query, forbidden_terms, match_mode)


def normalize_query(query: str) -> str:
    """Normalize query with full pipeline."""
    return apply_full_normalization(query)
