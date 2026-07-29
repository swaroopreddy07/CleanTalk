"""
Configuration module for the AI Moderation Microservice.

Centralizes all configuration constants including model settings,
toxicity thresholds, server configuration, and logging setup.
"""

import logging
from enum import Enum
from typing import Final


# ─────────────────────────────────────────────────────────────
# Model Configuration
# ─────────────────────────────────────────────────────────────

MODEL_NAME: Final[str] = "unitary/toxic-bert"
"""HuggingFace model identifier. Uses a BERT-based model fine-tuned
on the Jigsaw Toxic Comment Classification dataset, outputting
probabilities for 6 toxicity categories."""

TOXICITY_LABELS: Final[list[str]] = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]
"""Ordered list of the 6 toxicity labels output by the model.
Order must match the model's output head indices."""

MAX_INPUT_LENGTH: Final[int] = 5000
"""Maximum number of characters allowed in a single moderation request."""

MAX_TOKEN_LENGTH: Final[int] = 512
"""Maximum number of tokens for the BERT tokenizer (model limit)."""


# ─────────────────────────────────────────────────────────────
# Toxicity Thresholds & Actions
# ─────────────────────────────────────────────────────────────

class ModerationAction(str, Enum):
    """Actions the moderation service can recommend based on toxicity score."""
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"


THRESHOLD_WARN: Final[float] = 0.70
"""Toxicity score at or above this value triggers a 'warn' action."""

THRESHOLD_BLOCK: Final[float] = 0.90
"""Toxicity score at or above this value triggers a 'block' action."""


def get_moderation_action(toxicity_score: float) -> ModerationAction:
    """Determine the moderation action based on the toxicity score.

    Threshold ranges:
        - allow:  score < 0.70
        - warn:   0.70 <= score < 0.90
        - block:  score >= 0.90

    Args:
        toxicity_score: A float between 0.0 and 1.0 representing
            the maximum toxicity probability across all labels.

    Returns:
        The corresponding ModerationAction enum value.
    """
    if toxicity_score >= THRESHOLD_BLOCK:
        return ModerationAction.BLOCK
    elif toxicity_score >= THRESHOLD_WARN:
        return ModerationAction.WARN
    return ModerationAction.ALLOW


# ─────────────────────────────────────────────────────────────
# Server Configuration
# ─────────────────────────────────────────────────────────────

HOST: Final[str] = "0.0.0.0"
PORT: Final[int] = 8000


# ─────────────────────────────────────────────────────────────
# Logging Configuration
# ─────────────────────────────────────────────────────────────

LOG_LEVEL: Final[int] = logging.INFO
LOG_FORMAT: Final[str] = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)
LOG_DATE_FORMAT: Final[str] = "%Y-%m-%d %H:%M:%S"


def configure_logging() -> None:
    """Set up application-wide logging with consistent formatting.

    Configures the root logger with a stream handler that writes
    to stdout using the standardized format defined above.
    """
    logging.basicConfig(
        level=LOG_LEVEL,
        format=LOG_FORMAT,
        datefmt=LOG_DATE_FORMAT,
    )
    # Suppress noisy third-party loggers in production
    logging.getLogger("transformers").setLevel(logging.WARNING)
    logging.getLogger("torch").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
