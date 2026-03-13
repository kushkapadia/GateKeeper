"""Multi-layered query blocking with evasion resistance.

Layers (evaluated in order, first match wins):
  1. Exact     — case-insensitive substring (baseline, near-zero cost)
  2. Normalized— Unicode NFKD + homoglyph fold + leetspeak decode + separator strip
  3. Fuzzy     — token-level Levenshtein via rapidfuzz (catches typos)
  4. Phonetic  — consonant-skeleton comparison (catches phonetically similar words)

Each layer returns a label so the audit trace records *how* the query was caught.
"""

import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

try:
    from rapidfuzz import fuzz as _fuzz
    HAS_RAPIDFUZZ = True
except ImportError:
    _fuzz = None  # type: ignore[assignment]
    HAS_RAPIDFUZZ = False


# ── Character maps ──────────────────────────────────────────────────────────

LEET_MAP: Dict[str, str] = {
    "0": "o", "1": "i", "2": "z", "3": "e", "4": "a",
    "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
    "@": "a", "$": "s", "!": "i", "+": "t", "(": "c",
    "|": "l",
}

HOMOGLYPH_MAP: Dict[str, str] = {
    # Cyrillic → Latin
    "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p",
    "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
    "\u0458": "j", "\u042c": "b",
    # Latin-like symbols
    "\u0251": "a", "\u0299": "b", "\u03f2": "c", "\u0501": "d",
    "\u212f": "e", "\ua730": "f", "\u0262": "g", "\u210e": "h",
    "\uab75": "i", "\u03f3": "j", "\u1d0b": "k", "\u217c": "l",
    "\u217f": "m", "\u2115": "n", "\u2134": "o", "\u2119": "p",
    "\u211d": "r", "\ua731": "s", "\u0131": "i",
    # Dotted / accented Latin often used for evasion
    "\u1e61": "s", "\u1e6b": "t", "\u1e45": "n", "\u1e03": "b",
    "\u1e0b": "d", "\u1e1f": "f", "\u1e41": "m", "\u1e57": "p",
}

_SEPARATOR_RE = re.compile(r"[\s.\-_*+/\\,;:!?|~`'\"]+")
_VOWELS = frozenset("aeiou")


# ── Normalisation helpers ───────────────────────────────────────────────────

def _unicode_fold(text: str) -> str:
    """NFKD decomposition → drop combining marks → apply homoglyph map."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return "".join(HOMOGLYPH_MAP.get(c, c) for c in stripped)


def _leet_decode(text: str) -> str:
    return "".join(LEET_MAP.get(c, c) for c in text)


def normalize(text: str) -> str:
    """Full normalisation pipeline: Unicode fold → lower → leetspeak decode."""
    return _leet_decode(_unicode_fold(text).lower())


def _strip_separators(text: str) -> str:
    """Remove separator characters so 's.a.l.a.r.y' → 'salary'."""
    return _SEPARATOR_RE.sub("", text)


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z]+", text)


def _consonant_skeleton(word: str) -> str:
    """Reduce a word to its consonant skeleton for phonetic comparison."""
    return "".join(c for c in word.lower() if c.isalpha() and c not in _VOWELS)


# ── Matching layers ─────────────────────────────────────────────────────────

def _exact_match(query_lower: str, term_lower: str) -> bool:
    return term_lower in query_lower


def _normalized_match(query: str, term: str) -> bool:
    nq = normalize(query)
    nt = normalize(term)
    if nt in nq:
        return True
    if _strip_separators(nt) in _strip_separators(nq):
        return True
    return False


def _fuzzy_token_match(
    query_tokens: List[str],
    term: str,
    threshold: int,
) -> bool:
    if not HAS_RAPIDFUZZ or _fuzz is None:
        return False
    nt = normalize(term)
    term_words = nt.split()
    for tok in query_tokens:
        ntok = normalize(tok)
        if _fuzz.ratio(ntok, nt) >= threshold:
            return True
        # partial_ratio handles morphological variants (salary/salaries)
        # by finding the best alignment of the shorter string within the longer
        if len(ntok) >= len(nt) and _fuzz.partial_ratio(ntok, nt) >= threshold:
            return True
    if len(term_words) > 1:
        joined = " ".join(normalize(t) for t in query_tokens)
        if _fuzz.partial_ratio(joined, nt) >= threshold:
            return True
    return False


def _phonetic_match(query_tokens: List[str], term: str) -> bool:
    ts = _consonant_skeleton(term)
    if len(ts) < 3:
        return False
    for tok in query_tokens:
        if len(tok) < max(len(term) - 2, 3):
            continue
        if _consonant_skeleton(tok) == ts:
            return True
    return False


# ── Public API ──────────────────────────────────────────────────────────────

DEFAULT_FUZZY_THRESHOLD = 80


def check_query(
    query: str,
    blocked_terms: List[str],
    fuzzy_threshold: int = DEFAULT_FUZZY_THRESHOLD,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Check *query* against every term in *blocked_terms* using four layers.

    Returns
    -------
    (is_blocked, matched_term, detection_layer)
        *detection_layer* is one of ``"exact"``, ``"normalized"``,
        ``"fuzzy"``, ``"phonetic"`` or ``None`` when no match is found.
    """
    if not query or not blocked_terms:
        return False, None, None

    query_lower = query.lower()
    raw_tokens = _tokenize(query)
    norm_tokens = _tokenize(normalize(query))
    all_tokens = list(set(raw_tokens + norm_tokens))

    for term in blocked_terms:
        term_lower = term.lower()

        if _exact_match(query_lower, term_lower):
            return True, term, "exact"

        if _normalized_match(query, term):
            return True, term, "normalized"

        if _fuzzy_token_match(all_tokens, term, fuzzy_threshold):
            return True, term, "fuzzy"

        if _phonetic_match(all_tokens, term):
            return True, term, "phonetic"

    return False, None, None
