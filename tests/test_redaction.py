"""
Tests for redaction patterns and post-retrieval enforcement.
"""

import pytest
from backend.app.policies.redaction_patterns import (
    RedactionEngine,
    PIIPattern,
    MaskingStrategy,
    BUILTIN_PATTERNS,
    redact_text,
    redact_chunks,
    detect_pii,
)
from backend.app.policies.actions import action_redact, action_enforce


class TestPIIPatterns:
    """Test built-in PII detection patterns."""

    def test_email_redaction(self):
        text = "Contact me at john.doe@example.com for details."
        result = redact_text(text, ["EMAIL"])
        assert "john.doe@example.com" not in result
        assert "[EMAIL]" in result

    def test_phone_redaction(self):
        text = "Call me at +1-555-123-4567 or (555) 987-6543"
        result = redact_text(text, ["PHONE"])
        assert "555-123-4567" not in result
        assert "987-6543" not in result
        assert "[PHONE]" in result

    def test_pan_redaction(self):
        text = "My PAN is ABCDE1234F for tax purposes."
        result = redact_text(text, ["PAN"])
        assert "ABCDE1234F" not in result
        assert "[PAN]" in result

    def test_aadhaar_redaction(self):
        text = "Aadhaar: 1234 5678 9012"
        result = redact_text(text, ["AADHAAR"])
        assert "1234 5678 9012" not in result
        assert "[AADHAAR]" in result

    def test_credit_card_redaction(self):
        text = "Card number: 1234-5678-9012-3456"
        result = redact_text(text, ["CREDIT_CARD"])
        assert "1234-5678-9012-3456" not in result
        assert "[CREDIT_CARD]" in result

    def test_ssn_redaction(self):
        text = "SSN: 123-45-6789"
        result = redact_text(text, ["SSN"])
        assert "123-45-6789" not in result
        assert "[SSN]" in result

    def test_salary_redaction(self):
        text = "The salary is Rs. 50,000 per month or $75,000 annually."
        result = redact_text(text, ["SALARY"])
        assert "Rs. 50,000" not in result
        assert "$75,000" not in result
        assert "[SALARY]" in result

    def test_multiple_patterns(self):
        text = "Contact john@example.com or call +1-555-1234. PAN: ABCDE1234F"
        result = redact_text(text, ["EMAIL", "PHONE", "PAN"])
        assert "john@example.com" not in result
        assert "555-1234" not in result
        assert "ABCDE1234F" not in result
        assert result.count("[EMAIL]") == 1
        assert result.count("[PHONE]") == 1
        assert result.count("[PAN]") == 1


class TestRedactionEngine:
    """Test RedactionEngine class."""

    def test_redact_text(self):
        engine = RedactionEngine()
        text = "Email: test@example.com, Phone: 555-1234"
        result = engine.redact_text(text, ["EMAIL", "PHONE"])
        assert "test@example.com" not in result
        assert "555-1234" not in result

    def test_redact_fields_simple(self):
        engine = RedactionEngine()
        data = {
            "text": "My email is secret@example.com",
            "metadata": {"notes": "Call 555-1234"}
        }
        field_patterns = {
            "text": ["EMAIL"],
            "metadata.notes": ["PHONE"]
        }
        result = engine.redact_fields(data, field_patterns)
        assert "secret@example.com" not in result["text"]
        assert "[EMAIL]" in result["text"]
        assert "555-1234" not in result["metadata"]["notes"]
        assert "[PHONE]" in result["metadata"]["notes"]

    def test_redact_chunks(self):
        engine = RedactionEngine()
        chunks = [
            {"text": "Email: admin@company.com", "score": 0.9},
            {"text": "Phone: 555-9999", "score": 0.8}
        ]
        result = engine.redact_chunks(chunks, ["EMAIL", "PHONE"])
        assert "admin@company.com" not in result[0]["text"]
        assert "555-9999" not in result[1]["text"]
        assert "[EMAIL]" in result[0]["text"]
        assert "[PHONE]" in result[1]["text"]

    def test_detect_pii(self):
        engine = RedactionEngine()
        text = "Contact john@example.com or call +1-555-1234"
        detections = engine.detect_pii(text, ["EMAIL", "PHONE"])
        assert "EMAIL" in detections
        assert "PHONE" in detections
        assert len(detections["EMAIL"]) >= 1
        assert len(detections["PHONE"]) >= 1

    def test_custom_pattern(self):
        engine = RedactionEngine()
        custom = PIIPattern(
            name="EMPLOYEE_ID",
            pattern=r'\bEMP-\d{5}\b',
            strategy=MaskingStrategy.TYPE_LABEL
        )
        engine.add_pattern("EMPLOYEE_ID", custom)

        text = "Employee ID: EMP-12345"
        result = engine.redact_text(text, ["EMPLOYEE_ID"])
        assert "EMP-12345" not in result
        assert "[EMPLOYEE_ID]" in result


class TestActionRedact:
    """Test action_redact function."""

    def test_redact_all_chunks_no_tags(self):
        chunks = [
            {"text": "Email: test@example.com", "metadata": {}},
            {"text": "Phone: 555-1234", "metadata": {}}
        ]
        decision, changes = action_redact(
            chunks=chunks,
            patterns=["EMAIL", "PHONE"],
            fields=["text"],
            tags=[]
        )
        assert decision == "modified"
        redacted_chunks = changes["artifacts"]["chunks"]
        assert len(redacted_chunks) == 2
        assert "[EMAIL]" in redacted_chunks[0]["text"]
        assert "[PHONE]" in redacted_chunks[1]["text"]

    def test_redact_only_tagged_chunks(self):
        chunks = [
            {"text": "Salary: $50,000", "metadata": {"tags": ["salary"]}},
            {"text": "Public info", "metadata": {"tags": ["public"]}}
        ]
        decision, changes = action_redact(
            chunks=chunks,
            patterns=["SALARY"],
            fields=["text"],
            tags=["salary"]
        )
        assert decision == "modified"
        redacted_chunks = changes["artifacts"]["chunks"]
        assert "[SALARY]" in redacted_chunks[0]["text"]
        assert "Public info" == redacted_chunks[1]["text"]  # Not redacted

    def test_drop_chunks_by_condition(self):
        chunks = [
            {"text": "Confidential data", "metadata": {"sensitivity": "confidential"}},
            {"text": "Public data", "metadata": {"sensitivity": "public"}}
        ]
        decision, changes = action_redact(
            chunks=chunks,
            patterns=[],
            fields=["text"],
            tags=[],
            drop_if={"metadata.sensitivity": "confidential"}
        )
        assert decision == "modified"
        redacted_chunks = changes["artifacts"]["chunks"]
        assert len(redacted_chunks) == 1
        assert redacted_chunks[0]["text"] == "Public data"

    def test_redact_nested_fields(self):
        chunks = [
            {
                "text": "Main text",
                "metadata": {
                    "notes": "Contact admin@company.com",
                    "tags": ["internal"]
                }
            }
        ]
        decision, changes = action_redact(
            chunks=chunks,
            patterns=["EMAIL"],
            fields=["text", "metadata.notes"],
            tags=[]
        )
        redacted_chunks = changes["artifacts"]["chunks"]
        assert "admin@company.com" not in redacted_chunks[0]["metadata"]["notes"]
        assert "[EMAIL]" in redacted_chunks[0]["metadata"]["notes"]

    def test_empty_chunks(self):
        decision, changes = action_redact(
            chunks=[],
            patterns=["EMAIL"],
            fields=["text"],
            tags=[]
        )
        assert decision == "allowed"
        assert changes["artifacts"]["chunks"] == []


class TestActionEnforce:
    """Test action_enforce function for post-generation."""

    def test_enforce_citations_present(self):
        text = "The sky is blue [1]. Water is wet [source]."
        decision, changes = action_enforce(text, citations=True)
        assert decision == "allowed"

    def test_enforce_citations_missing(self):
        text = "The sky is blue. Water is wet."
        decision, changes = action_enforce(text, citations=True)
        assert decision == "blocked"
        assert "citations" in changes["message"].lower()
        assert len(changes["violations"]) > 0

    def test_enforce_formal_style_pass(self):
        text = "This is a professional document."
        decision, changes = action_enforce(text, style="formal")
        assert decision == "allowed"

    def test_enforce_formal_style_fail(self):
        text = "Yeah, this is gonna be awesome lol!!!"
        decision, changes = action_enforce(text, style="formal")
        assert decision == "blocked"
        assert "informal" in changes["message"].lower()

    def test_enforce_no_requirements(self):
        text = "Any text here"
        decision, changes = action_enforce(text)
        assert decision == "allowed"
        assert changes == {}


class TestMaskingStrategies:
    """Test different masking strategies."""

    def test_full_masking(self):
        pattern = PIIPattern(
            name="TEST",
            pattern=r"secret",
            strategy=MaskingStrategy.FULL
        )
        text = "This is secret information"
        result = pattern.redact(text)
        assert "secret" not in result
        assert "[REDACTED]" in result

    def test_type_label_masking(self):
        pattern = PIIPattern(
            name="TEST",
            pattern=r"secret",
            strategy=MaskingStrategy.TYPE_LABEL
        )
        text = "This is secret information"
        result = pattern.redact(text)
        assert "secret" not in result
        assert "[TEST]" in result

    def test_partial_masking(self):
        pattern = PIIPattern(
            name="TEST",
            pattern=r"secret",
            strategy=MaskingStrategy.PARTIAL
        )
        text = "This is secret information"
        result = pattern.redact(text)
        assert "secret" not in result
        assert "s" in result  # First character preserved
        assert "t" in result  # Last character preserved
        assert "*" in result  # Middle masked


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_empty_text_redaction(self):
        result = redact_text("", ["EMAIL"])
        assert result == ""

    def test_none_text_handling(self):
        engine = RedactionEngine()
        result = engine.redact_text(None, ["EMAIL"])
        assert result is None

    def test_redact_non_string_fields(self):
        chunks = [
            {"text": "test", "score": 0.9, "count": 5}
        ]
        decision, changes = action_redact(
            chunks=chunks,
            patterns=["EMAIL"],
            fields=["score"],  # Non-string field
            tags=[]
        )
        # Should not crash, just skip non-string fields
        assert decision == "modified"

    def test_unknown_pattern(self):
        engine = RedactionEngine()
        text = "Some text with email@example.com"
        # Unknown pattern should be ignored
        result = engine.redact_text(text, ["UNKNOWN_PATTERN"])
        assert result == text  # Unchanged

    def test_multiple_emails_in_text(self):
        text = "Contact alice@example.com or bob@example.com"
        result = redact_text(text, ["EMAIL"])
        assert "alice@example.com" not in result
        assert "bob@example.com" not in result
        assert result.count("[EMAIL]") == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
