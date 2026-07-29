"""
Unit tests for the AI Moderation Microservice.

Tests cover:
    - Threshold-based action classification logic
    - Input validation (empty text, whitespace, length limits)
    - Prediction endpoint responses (mocked model)
    - Health endpoint responses
    - Edge cases and error handling

Usage:
    pytest tests/test_predict.py -v
"""

import sys
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure the parent directory is on the path so imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import (
    MAX_INPUT_LENGTH,
    THRESHOLD_BLOCK,
    THRESHOLD_WARN,
    TOXICITY_LABELS,
    ModerationAction,
    get_moderation_action,
)


# ─────────────────────────────────────────────────────────────
# Tests: Threshold Classification Logic (config.py)
# ─────────────────────────────────────────────────────────────


class TestGetModerationAction:
    """Tests for the get_moderation_action threshold function."""

    def test_allow_low_score(self) -> None:
        """Scores well below the warn threshold should return ALLOW."""
        assert get_moderation_action(0.0) == ModerationAction.ALLOW
        assert get_moderation_action(0.1) == ModerationAction.ALLOW
        assert get_moderation_action(0.5) == ModerationAction.ALLOW

    def test_allow_just_below_warn(self) -> None:
        """A score just below 0.70 should return ALLOW."""
        assert get_moderation_action(0.69) == ModerationAction.ALLOW
        assert get_moderation_action(0.699) == ModerationAction.ALLOW

    def test_warn_at_threshold(self) -> None:
        """A score of exactly 0.70 should return WARN."""
        assert get_moderation_action(0.70) == ModerationAction.WARN

    def test_warn_mid_range(self) -> None:
        """Scores between 0.70 and 0.90 should return WARN."""
        assert get_moderation_action(0.75) == ModerationAction.WARN
        assert get_moderation_action(0.80) == ModerationAction.WARN
        assert get_moderation_action(0.85) == ModerationAction.WARN

    def test_warn_just_below_block(self) -> None:
        """A score just below 0.90 should return WARN."""
        assert get_moderation_action(0.89) == ModerationAction.WARN
        assert get_moderation_action(0.899) == ModerationAction.WARN

    def test_block_at_threshold(self) -> None:
        """A score of exactly 0.90 should return BLOCK."""
        assert get_moderation_action(0.90) == ModerationAction.BLOCK

    def test_block_high_scores(self) -> None:
        """Scores above 0.90 should return BLOCK."""
        assert get_moderation_action(0.95) == ModerationAction.BLOCK
        assert get_moderation_action(1.0) == ModerationAction.BLOCK

    def test_boundary_precision(self) -> None:
        """Ensure threshold boundaries are correctly exclusive/inclusive."""
        # 0.70 is the first WARN value
        assert get_moderation_action(THRESHOLD_WARN) == ModerationAction.WARN
        # 0.90 is the first BLOCK value
        assert get_moderation_action(THRESHOLD_BLOCK) == ModerationAction.BLOCK

    def test_action_enum_values(self) -> None:
        """ModerationAction enum values should match expected strings."""
        assert ModerationAction.ALLOW.value == "allow"
        assert ModerationAction.WARN.value == "warn"
        assert ModerationAction.BLOCK.value == "block"


# ─────────────────────────────────────────────────────────────
# Tests: Toxicity Labels Configuration
# ─────────────────────────────────────────────────────────────


class TestToxicityLabels:
    """Tests for the TOXICITY_LABELS configuration."""

    def test_correct_number_of_labels(self) -> None:
        """The model should output exactly 6 toxicity categories."""
        assert len(TOXICITY_LABELS) == 6

    def test_expected_labels_present(self) -> None:
        """All expected Jigsaw dataset labels should be present."""
        expected = {"toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"}
        assert set(TOXICITY_LABELS) == expected

    def test_max_input_length(self) -> None:
        """MAX_INPUT_LENGTH should be 5000 characters."""
        assert MAX_INPUT_LENGTH == 5000


# ─────────────────────────────────────────────────────────────
# Fixtures: Mocked model for endpoint testing
# ─────────────────────────────────────────────────────────────

# Sample prediction result returned by the mocked model.predict()
MOCK_PREDICTION_ALLOW = {
    "toxicity_score": 0.12,
    "labels": {
        "toxic": 0.12,
        "severe_toxic": 0.01,
        "obscene": 0.05,
        "threat": 0.02,
        "insult": 0.08,
        "identity_hate": 0.01,
    },
    "prediction": "toxic",
    "action": "allow",
}

MOCK_PREDICTION_WARN = {
    "toxicity_score": 0.78,
    "labels": {
        "toxic": 0.78,
        "severe_toxic": 0.10,
        "obscene": 0.45,
        "threat": 0.05,
        "insult": 0.60,
        "identity_hate": 0.03,
    },
    "prediction": "toxic",
    "action": "warn",
}

MOCK_PREDICTION_BLOCK = {
    "toxicity_score": 0.95,
    "labels": {
        "toxic": 0.95,
        "severe_toxic": 0.80,
        "obscene": 0.88,
        "threat": 0.15,
        "insult": 0.90,
        "identity_hate": 0.12,
    },
    "prediction": "toxic",
    "action": "block",
}


@pytest.fixture
def client():
    """Create a FastAPI test client with the model loading mocked out.

    The model is not actually loaded — instead, is_model_loaded()
    returns True and predict() returns a mocked result.
    """
    with patch("app.load_model"):
        with patch("app.is_model_loaded", return_value=True):
            from app import app
            yield TestClient(app)


# ─────────────────────────────────────────────────────────────
# Tests: POST /predict Endpoint
# ─────────────────────────────────────────────────────────────


class TestPredictEndpoint:
    """Tests for the POST /predict endpoint."""

    @patch("app.predict", return_value=MOCK_PREDICTION_ALLOW)
    def test_predict_allow_action(self, mock_predict: MagicMock, client: TestClient) -> None:
        """A benign text should return an 'allow' action."""
        response = client.post("/predict", json={"text": "Hello, how are you?"})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "allow"
        assert data["toxicity_score"] == 0.12
        assert data["prediction"] == "toxic"
        assert len(data["labels"]) == 6

    @patch("app.predict", return_value=MOCK_PREDICTION_WARN)
    def test_predict_warn_action(self, mock_predict: MagicMock, client: TestClient) -> None:
        """Moderately toxic text should return a 'warn' action."""
        response = client.post("/predict", json={"text": "Some borderline content"})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "warn"
        assert 0.70 <= data["toxicity_score"] < 0.90

    @patch("app.predict", return_value=MOCK_PREDICTION_BLOCK)
    def test_predict_block_action(self, mock_predict: MagicMock, client: TestClient) -> None:
        """Highly toxic text should return a 'block' action."""
        response = client.post("/predict", json={"text": "Very toxic content"})
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "block"
        assert data["toxicity_score"] >= 0.90

    @patch("app.predict", return_value=MOCK_PREDICTION_ALLOW)
    def test_predict_response_structure(self, mock_predict: MagicMock, client: TestClient) -> None:
        """The response should contain all expected fields."""
        response = client.post("/predict", json={"text": "Test input"})
        assert response.status_code == 200
        data = response.json()

        # Top-level fields
        assert "toxicity_score" in data
        assert "labels" in data
        assert "prediction" in data
        assert "action" in data

        # Label fields
        for label in TOXICITY_LABELS:
            assert label in data["labels"]

    @patch("app.predict", return_value=MOCK_PREDICTION_ALLOW)
    def test_predict_score_range(self, mock_predict: MagicMock, client: TestClient) -> None:
        """All scores should be between 0.0 and 1.0."""
        response = client.post("/predict", json={"text": "Test input"})
        data = response.json()

        assert 0.0 <= data["toxicity_score"] <= 1.0
        for label, score in data["labels"].items():
            assert 0.0 <= score <= 1.0, f"{label} score {score} out of range"


# ─────────────────────────────────────────────────────────────
# Tests: Input Validation
# ─────────────────────────────────────────────────────────────


class TestInputValidation:
    """Tests for request input validation."""

    def test_empty_text_rejected(self, client: TestClient) -> None:
        """An empty string should be rejected with 422."""
        response = client.post("/predict", json={"text": ""})
        assert response.status_code == 422

    def test_whitespace_only_rejected(self, client: TestClient) -> None:
        """Whitespace-only text should be rejected with 422."""
        response = client.post("/predict", json={"text": "   "})
        assert response.status_code == 422

    def test_missing_text_field(self, client: TestClient) -> None:
        """A request without the 'text' field should be rejected."""
        response = client.post("/predict", json={})
        assert response.status_code == 422

    def test_text_exceeds_max_length(self, client: TestClient) -> None:
        """Text longer than MAX_INPUT_LENGTH should be rejected."""
        long_text = "a" * (MAX_INPUT_LENGTH + 1)
        response = client.post("/predict", json={"text": long_text})
        assert response.status_code == 422

    @patch("app.predict", return_value=MOCK_PREDICTION_ALLOW)
    def test_text_at_max_length(self, mock_predict: MagicMock, client: TestClient) -> None:
        """Text exactly at MAX_INPUT_LENGTH should be accepted."""
        exact_text = "a" * MAX_INPUT_LENGTH
        response = client.post("/predict", json={"text": exact_text})
        assert response.status_code == 200

    def test_non_string_text_rejected(self, client: TestClient) -> None:
        """Non-string values for 'text' should be rejected."""
        response = client.post("/predict", json={"text": 12345})
        assert response.status_code == 422

    def test_null_text_rejected(self, client: TestClient) -> None:
        """Null value for 'text' should be rejected."""
        response = client.post("/predict", json={"text": None})
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────
# Tests: GET /health Endpoint
# ─────────────────────────────────────────────────────────────


class TestHealthEndpoint:
    """Tests for the GET /health endpoint."""

    @patch("app.is_model_loaded", return_value=True)
    def test_health_when_model_loaded(self, mock_loaded: MagicMock, client: TestClient) -> None:
        """Health check should return 'healthy' when model is loaded."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model_loaded"] is True
        assert data["model_name"] == "unitary/toxic-bert"
        assert "uptime" in data

    @patch("app.is_model_loaded", return_value=False)
    def test_health_when_model_not_loaded(self, mock_loaded: MagicMock, client: TestClient) -> None:
        """Health check should return 'degraded' when model fails to load."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["model_loaded"] is False


# ─────────────────────────────────────────────────────────────
# Tests: Model Not Loaded Error Handling
# ─────────────────────────────────────────────────────────────


class TestModelNotLoaded:
    """Tests for behaviour when the model is not loaded."""

    def test_predict_returns_503_when_model_not_loaded(self) -> None:
        """POST /predict should return 503 if model is not loaded."""
        with patch("app.load_model"):
            with patch("app.is_model_loaded", return_value=False):
                from app import app
                unloaded_client = TestClient(app)
                response = unloaded_client.post(
                    "/predict", json={"text": "test"}
                )
                assert response.status_code == 503
                assert "not loaded" in response.json()["detail"].lower()
