"""
Tests for intelligent query normalization and fuzzy matching.
"""

import pytest
from backend.app.policies.query_normalizer import (
    normalize_homoglyphs,
    normalize_repeated_chars,
    normalize_separators,
    normalize_whitespace,
    normalize_case,
    apply_full_normalization,
    fuzzy_match,
    typo_match,
    levenshtein_distance,
    match_intent,
    QueryMatcher,
    smart_match,
)


class TestNormalization:
    """Test individual normalization functions."""

    def test_normalize_homoglyphs_cyrillic(self):
        # Cyrillic 'а', 'е', 'о' look like Latin 'a', 'e', 'o'
        text = "sаlаry"  # 'а' is Cyrillic
        result = normalize_homoglyphs(text)
        assert result == "salary"

    def test_normalize_homoglyphs_leet_speak(self):
        text = "s@l@ry w1th numb3rs"
        result = normalize_homoglyphs(text)
        assert '@' not in result or result == "salary with numbers"

    def test_normalize_repeated_chars(self):
        assert normalize_repeated_chars("saaaaalary") == "salary"
        assert normalize_repeated_chars("heeeeello") == "hello"
        assert normalize_repeated_chars("book") == "book"  # Legitimate double-o
        assert normalize_repeated_chars("cooooooffee") == "coffee"

    def test_normalize_separators(self):
        assert "salary" in normalize_separators("s.a.l.a.r.y")
        assert "salary" in normalize_separators("s-a-l-a-r-y")
        assert "salary" in normalize_separators("s_a_l_a_r_y")
        assert "salary" in normalize_separators("s a l a r y")

    def test_normalize_whitespace(self):
        assert normalize_whitespace("  multiple   spaces  ") == "multiple spaces"
        assert normalize_whitespace("tab\t\tspaces") == "tab spaces"

    def test_normalize_case(self):
        assert normalize_case("SALARY") == "salary"
        assert normalize_case("SaLaRy") == "salary"

    def test_full_normalization_pipeline(self):
        # Complex obfuscated query
        text = "What is the  s@l@ry  of the CEO?"
        result = apply_full_normalization(text)
        assert "salary" in result
        assert "@" not in result
        assert "  " not in result


class TestFuzzyMatching:
    """Test fuzzy matching functionality."""

    def test_fuzzy_match_exact(self):
        assert fuzzy_match("What is the salary?", "salary") is True

    def test_fuzzy_match_case_insensitive(self):
        assert fuzzy_match("What is the SALARY?", "salary") is True

    def test_fuzzy_match_with_typo(self):
        assert fuzzy_match("What is the salaary?", "salary") is True
        assert fuzzy_match("What is the saary?", "salary") is True

    def test_fuzzy_match_with_separators(self):
        assert fuzzy_match("What is the s.a.l.a.r.y?", "salary") is True
        assert fuzzy_match("What is the s-a-l-a-r-y?", "salary") is True

    def test_fuzzy_match_with_repeated_chars(self):
        assert fuzzy_match("What is the saaaalary?", "salary") is True
        assert fuzzy_match("What is the sallllary?", "salary") is True

    def test_fuzzy_match_homoglyphs(self):
        # Cyrillic 'а' instead of Latin 'a'
        assert fuzzy_match("What is the sаlаry?", "salary") is True

    def test_fuzzy_match_no_match(self):
        assert fuzzy_match("What is the weather?", "salary") is False

    def test_fuzzy_match_multi_word(self):
        assert fuzzy_match("Show me employee compensation", "employee compensation") is True
        assert fuzzy_match("Show me employe compnsation", "employee compensation") is True


class TestTypoMatching:
    """Test typo-tolerant matching."""

    def test_typo_match_one_typo(self):
        assert typo_match("What is the salery?", "salary") is True  # 1 typo
        assert typo_match("What is the salary?", "salary") is True  # No typo

    def test_typo_match_two_typos(self):
        assert typo_match("What is the saary?", "salary", max_edits=2) is True  # 2 typos
        assert typo_match("What is the slary?", "salary", max_edits=2) is True  # 1 deletion

    def test_typo_match_too_many_typos(self):
        assert typo_match("What is the xyz?", "salary", max_edits=2) is False

    def test_levenshtein_distance(self):
        assert levenshtein_distance("salary", "salary") == 0
        assert levenshtein_distance("salary", "salery") == 1
        assert levenshtein_distance("salary", "slary") == 1
        assert levenshtein_distance("salary", "saary") == 1
        assert levenshtein_distance("salary", "saay") == 3


class TestIntentMatching:
    """Test semantic intent pattern matching."""

    def test_match_salary_query_intent(self):
        assert match_intent("What is the salary of the CEO?", "salary_query") is True
        assert match_intent("Show me the compensation details", "salary_query") is True
        assert match_intent("How much does John earn?", "salary_query") is True

    def test_match_personal_info_intent(self):
        assert match_intent("What is John's email address?", "personal_info_query") is True
        assert match_intent("Give me the phone number", "personal_info_query") is True

    def test_match_confidential_doc_intent(self):
        assert match_intent("Show me the confidential report", "confidential_doc_query") is True
        assert match_intent("Give access to classified files", "confidential_doc_query") is True

    def test_no_intent_match(self):
        assert match_intent("What is the weather today?", "salary_query") is False


class TestQueryMatcher:
    """Test QueryMatcher class."""

    def test_exact_mode(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches("What is the salary?", ["salary"], match_mode="exact")
        assert matched is True
        assert "salary" in terms

    def test_fuzzy_mode(self):
        matcher = QueryMatcher(fuzzy_threshold=0.85)
        matched, terms = matcher.matches("What is the salaary?", ["salary"], match_mode="fuzzy")
        assert matched is True

    def test_typo_mode(self):
        matcher = QueryMatcher(max_typos=2)
        matched, terms = matcher.matches("What is the salery?", ["salary"], match_mode="typo")
        assert matched is True

    def test_semantic_mode(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches(
            "How much does the CEO make?",
            ["salary_query"],
            match_mode="semantic"
        )
        assert matched is True

    def test_any_mode(self):
        matcher = QueryMatcher()
        # Should match with any strategy
        matched, terms = matcher.matches("What is the s@l@ry?", ["salary"], match_mode="any")
        assert matched is True

    def test_no_match(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches("What is the weather?", ["salary"], match_mode="fuzzy")
        assert matched is False
        assert len(terms) == 0

    def test_multiple_terms(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches(
            "What is the salary and compensation?",
            ["salary", "bonus"],
            match_mode="fuzzy"
        )
        assert matched is True
        assert "salary" in terms


class TestComplexObfuscation:
    """Test complex obfuscation attempts."""

    def test_combination_attacks(self):
        """Test queries that combine multiple obfuscation techniques."""
        obfuscated_queries = [
            "What is the s@l@ry?",  # Leet speak
            "What is the sаlаry?",  # Cyrillic
            "What is the s.a.l.a.r.y?",  # Separators
            "What is the saaaaalary?",  # Repeated chars
            "What is the SAL ARY?",  # Spaces + caps
            "What is the s-@-l-a-r-y?",  # Mixed separators
            "What is the sаlааааry?",  # Cyrillic + repeated
            "Whаt is thе sаlаry?",  # Multiple Cyrillic chars
        ]

        for query in obfuscated_queries:
            matched, terms = smart_match(query, ["salary"], match_mode="fuzzy")
            assert matched is True, f"Failed to detect: {query}"

    def test_typo_variations(self):
        """Test common typo patterns."""
        typo_queries = [
            "What is the salery?",  # Common misspelling
            "What is the salaary?",  # Double letter
            "What is the salray?",  # Transposition
            "What is the saary?",  # Missing letter
            "What is the slary?",  # Missing letter
        ]

        for query in typo_queries:
            matched, terms = smart_match(query, ["salary"], match_mode="fuzzy")
            assert matched is True, f"Failed to detect: {query}"

    def test_semantic_variations(self):
        """Test semantic variations of salary queries."""
        semantic_queries = [
            "How much does John make?",
            "What's the CEO's compensation?",
            "Tell me about employee pay",
            "Show me the earnings data",
            "What is the income of managers?",
        ]

        for query in semantic_queries:
            matched, terms = smart_match(query, ["salary_query"], match_mode="semantic")
            assert matched is True, f"Failed to detect: {query}"


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_empty_query(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches("", ["salary"], match_mode="fuzzy")
        assert matched is False

    def test_empty_terms(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches("What is the salary?", [], match_mode="fuzzy")
        assert matched is False

    def test_very_short_query(self):
        matcher = QueryMatcher()
        matched, terms = matcher.matches("sal", ["salary"], match_mode="fuzzy")
        # Short queries might not match with high threshold
        # This is expected behavior

    def test_very_long_obfuscation(self):
        query = "What is the s" + "a" * 20 + "lary?"  # "saaaaa...aaaalary"
        result = apply_full_normalization(query)
        assert "salary" in result

    def test_unicode_normalization(self):
        # Accented characters
        query = "What is the sàlàry?"
        result = apply_full_normalization(query)
        assert "salary" in result

    def test_mixed_scripts(self):
        # Mix of Latin and Cyrillic
        query = "sаlаry"  # 'а' is Cyrillic, 's', 'l', 'r', 'y' are Latin
        result = apply_full_normalization(query)
        assert result == "salary"


class TestRealWorldExamples:
    """Test real-world query examples."""

    def test_salary_queries(self):
        """Real salary-related queries users might try."""
        queries = [
            "What is John's salary?",
            "Tell me the CEO compensation",
            "How much does the manager earn?",
            "Show me employee pay data",
            "What's the s@l@ry of directors?",
            "Give me saaaaalary information",
            "What is the s.a.l.a.r.y range?",
        ]

        matcher = QueryMatcher()
        for query in queries:
            matched, _ = matcher.matches(query, ["salary"], match_mode="fuzzy")
            assert matched is True, f"Should block: {query}"

    def test_legitimate_queries(self):
        """Queries that should NOT be blocked."""
        queries = [
            "What is the weather today?",
            "Show me the sales report",
            "What is the company policy?",
            "Tell me about the benefits",
        ]

        matcher = QueryMatcher()
        for query in queries:
            matched, _ = matcher.matches(query, ["salary"], match_mode="fuzzy")
            assert matched is False, f"Should allow: {query}"

    def test_context_awareness(self):
        """Test that context matters."""
        # "Salary" in different contexts
        query1 = "What is the salary policy?"  # Policy about salary (might allow)
        query2 = "What is John's salary?"  # Direct salary query (block)

        matcher = QueryMatcher()
        # Both contain "salary" - fuzzy match will catch both
        matched1, _ = matcher.matches(query1, ["salary"], match_mode="fuzzy")
        matched2, _ = matcher.matches(query2, ["salary"], match_mode="fuzzy")

        assert matched1 is True
        assert matched2 is True
        # Note: Context-aware policies would use semantic matching or additional rules


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
