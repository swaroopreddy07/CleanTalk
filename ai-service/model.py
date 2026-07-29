"""
Model module for the AI Moderation Microservice.

Handles loading the unitary/toxic-bert model from HuggingFace Hub,
running inference, and returning structured toxicity predictions.
The model is loaded once at application startup and reused for all requests.
"""

import logging
from typing import Any

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from config import (
    MAX_TOKEN_LENGTH,
    MODEL_NAME,
    TOXICITY_LABELS,
    ModerationAction,
    get_moderation_action,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Module-Level Model State
# ─────────────────────────────────────────────────────────────

_model: AutoModelForSequenceClassification | None = None
_tokenizer: AutoTokenizer | None = None
_device: torch.device | None = None


def is_model_loaded() -> bool:
    """Check whether the model and tokenizer have been loaded.

    Returns:
        True if both the model and tokenizer are initialized.
    """
    return _model is not None and _tokenizer is not None


def load_model() -> None:
    """Load the toxic-bert model and tokenizer from HuggingFace Hub.

    This function should be called exactly once during application startup.
    On first run, the model weights will be downloaded from HuggingFace Hub
    (~440 MB) and cached locally for subsequent starts.

    The model is moved to GPU if available, otherwise CPU is used.

    Raises:
        RuntimeError: If the model fails to load (network issues,
            corrupted cache, etc.).
    """
    global _model, _tokenizer, _device

    logger.info("Loading model '%s' from HuggingFace Hub...", MODEL_NAME)

    try:
        # Select compute device
        _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info("Using device: %s", _device)

        # Load tokenizer
        logger.info("Loading tokenizer...")
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

        # Load model and move to device
        logger.info("Loading model weights...")
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
        _model.to(_device)
        _model.eval()  # Set to evaluation mode (disables dropout, etc.)

        logger.info(
            "Model '%s' loaded successfully with %d labels: %s",
            MODEL_NAME,
            len(TOXICITY_LABELS),
            ", ".join(TOXICITY_LABELS),
        )

    except Exception as exc:
        logger.error("Failed to load model '%s': %s", MODEL_NAME, exc)
        _model = None
        _tokenizer = None
        _device = None
        raise RuntimeError(
            f"Model loading failed for '{MODEL_NAME}'. "
            f"Ensure you have internet access on first run to download "
            f"model weights from HuggingFace Hub."
        ) from exc


def predict(text: str) -> dict[str, Any]:
    """Run toxicity inference on the provided text.

    Tokenizes the input, runs a forward pass through the model with
    gradient computation disabled, applies sigmoid activation to the
    raw logits, and maps scores to moderation actions.

    Args:
        text: The text content to analyze for toxicity.

    Returns:
        A dictionary containing:
            - toxicity_score (float): Maximum probability across all labels.
            - labels (dict[str, float]): Per-label toxicity probabilities.
            - prediction (str): Name of the highest-scoring toxicity label.
            - action (str): Recommended moderation action
                            ('allow', 'warn', or 'block').

    Raises:
        RuntimeError: If the model has not been loaded yet.
        ValueError: If the input text is empty.
    """
    if not is_model_loaded():
        raise RuntimeError(
            "Model is not loaded. Ensure load_model() is called at startup."
        )

    if not text or not text.strip():
        raise ValueError("Input text must not be empty.")

    logger.debug("Running inference on text of length %d", len(text))

    # Tokenize the input text
    inputs = _tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_TOKEN_LENGTH,
        padding=True,
    )
    inputs = {key: val.to(_device) for key, val in inputs.items()}

    # Run inference without computing gradients (saves memory & time)
    with torch.no_grad():
        outputs = _model(**inputs)

    # Apply sigmoid to convert logits → probabilities [0, 1]
    probabilities = torch.sigmoid(outputs.logits).squeeze().cpu().numpy()

    # Build per-label scores dictionary
    label_scores: dict[str, float] = {
        label: round(float(prob), 6)
        for label, prob in zip(TOXICITY_LABELS, probabilities)
    }

    # Determine the overall toxicity score (max across all labels)
    toxicity_score: float = round(float(probabilities.max()), 6)

    # Identify the highest-scoring label
    max_label_index: int = int(probabilities.argmax())
    prediction: str = TOXICITY_LABELS[max_label_index]

    # Map score to moderation action
    action: ModerationAction = get_moderation_action(toxicity_score)

    result = {
        "toxicity_score": toxicity_score,
        "labels": label_scores,
        "prediction": prediction,
        "action": action.value,
    }

    logger.info(
        "Prediction complete — score=%.4f, prediction=%s, action=%s",
        toxicity_score,
        prediction,
        action.value,
    )

    return result
