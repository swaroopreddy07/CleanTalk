"""
FastAPI application for the AI Moderation Microservice.

Provides REST endpoints for text toxicity analysis using a BERT-based
model fine-tuned on the Jigsaw Toxic Comment Classification dataset.
The model is loaded once at startup and shared across all requests.

Endpoints:
    POST /predict  — Analyze text for toxicity
    GET  /health   — Health check with uptime and model status
"""

import logging
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from config import MAX_INPUT_LENGTH, MODEL_NAME, TOXICITY_LABELS, configure_logging
from model import is_model_loaded, load_model, predict
from image_model import load_image_model, predict_image, is_image_model_loaded

# ─────────────────────────────────────────────────────────────
# Logging Setup
# ─────────────────────────────────────────────────────────────

configure_logging()
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Application State
# ─────────────────────────────────────────────────────────────

_startup_time: float = 0.0


# ─────────────────────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler — lazy loading, no models loaded at startup."""
    global _startup_time
    logger.info("Starting AI Moderation Microservice (lazy loading mode)...")
    _startup_time = time.time()
    logger.info("Server ready. Models will load on first request.")

    yield  # Application runs here

    logger.info("Shutting down AI Moderation Microservice.")


# ─────────────────────────────────────────────────────────────
# FastAPI App Initialization
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Moderation Microservice",
    description=(
        "Production-ready text toxicity analysis service powered by "
        "unitary/toxic-bert (BERT fine-tuned on Jigsaw Toxic Comment dataset). "
        "Classifies text across 6 toxicity categories and recommends "
        "moderation actions (allow / warn / block)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for cross-origin requests from frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Schema for the POST /predict request body."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=MAX_INPUT_LENGTH,
        description="The text content to analyze for toxicity.",
        examples=["This is a sample comment to moderate."],
    )

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, v: str) -> str:
        """Ensure the text is not just whitespace."""
        if not v.strip():
            raise ValueError("Text must contain non-whitespace characters.")
        return v


class LabelScores(BaseModel):
    """Per-label toxicity probability scores."""

    toxic: float = Field(..., ge=0.0, le=1.0)
    severe_toxic: float = Field(..., ge=0.0, le=1.0)
    obscene: float = Field(..., ge=0.0, le=1.0)
    threat: float = Field(..., ge=0.0, le=1.0)
    insult: float = Field(..., ge=0.0, le=1.0)
    identity_hate: float = Field(..., ge=0.0, le=1.0)


class PredictResponse(BaseModel):
    """Schema for the POST /predict response body."""

    toxicity_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Maximum toxicity probability across all 6 labels.",
    )
    labels: LabelScores = Field(
        ...,
        description="Individual toxicity scores for each of the 6 categories.",
    )
    prediction: str = Field(
        ...,
        description="Name of the highest-scoring toxicity label.",
    )
    action: str = Field(
        ...,
        description="Recommended moderation action: 'allow', 'warn', or 'block'.",
    )


class HealthResponse(BaseModel):
    """Schema for the GET /health response body."""

    status: str = Field(..., description="Service health status.")
    model_loaded: bool = Field(..., description="Whether the model is loaded.")
    model_name: str = Field(..., description="HuggingFace model identifier.")
    uptime: float = Field(..., description="Service uptime in seconds.")


class ErrorResponse(BaseModel):
    """Schema for error responses."""

    detail: str = Field(..., description="Human-readable error description.")


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.post(
    "/predict",
    response_model=PredictResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        503: {"model": ErrorResponse, "description": "Model not loaded"},
    },
    summary="Analyze text for toxicity",
    description=(
        "Accepts a text string and returns toxicity scores across 6 "
        "categories, the highest-scoring label, and a recommended "
        "moderation action based on configurable thresholds."
    ),
)
async def predict_toxicity(request: PredictRequest) -> PredictResponse:
    """Analyze the provided text for toxicity.

    Args:
        request: The incoming prediction request containing the text.

    Returns:
        Structured toxicity analysis with scores, prediction, and action.

    Raises:
        HTTPException 400: If the input text is invalid.
        HTTPException 503: If the model is not loaded.
    """
    request_start = time.time()
    logger.info(
        "Received prediction request — text_length=%d",
        len(request.text),
    )

    # Lazy load: load text model on first request
    if not is_model_loaded():
        logger.info("Text model not loaded yet — loading now (first request)...")
        try:
            load_model()
            logger.info("Text model loaded successfully (lazy).")
        except RuntimeError as exc:
            logger.error("Failed to load text model: %s", exc)
            raise HTTPException(
                status_code=503,
                detail=f"Failed to load text model: {exc}",
            )

    try:
        result: dict[str, Any] = predict(request.text)
    except ValueError as exc:
        logger.warning("Invalid input: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Unexpected error during prediction: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred during toxicity analysis.",
        )

    elapsed_ms = (time.time() - request_start) * 1000
    logger.info(
        "Prediction completed in %.1fms — score=%.4f, action=%s",
        elapsed_ms,
        result["toxicity_score"],
        result["action"],
    )

    return PredictResponse(
        toxicity_score=result["toxicity_score"],
        labels=LabelScores(**result["labels"]),
        prediction=result["prediction"],
        action=result["action"],
    )


# ─── Image Moderation Endpoint ────────────────────────────────

class ImagePredictRequest(BaseModel):
    """Schema for the POST /predict-image request body."""
    image_url: str = Field(
        ...,
        description="URL of the image to analyze (Azure blob or local path).",
    )

class ImagePredictResponse(BaseModel):
    """Schema for the POST /predict-image response body."""
    nsfw_score: float = Field(..., ge=0.0, le=1.0)
    normal_score: float = Field(..., ge=0.0, le=1.0)
    is_nsfw: bool = Field(...)
    action: str = Field(...)
    label: str = Field(...)

@app.post(
    "/predict-image",
    response_model=ImagePredictResponse,
    summary="Analyze image for NSFW content",
    description="Accepts an image URL, downloads it, and classifies it as nsfw or normal.",
)
async def predict_image_endpoint(request: ImagePredictRequest) -> ImagePredictResponse:
    """Analyze an image for NSFW content."""
    import requests as http_requests

    logger.info("Received image prediction request — url=%s", request.image_url[:100])

    # Lazy load: load image model on first request
    if not is_image_model_loaded():
        logger.info("Image model not loaded yet — loading now (first request)...")
        try:
            load_image_model()
            logger.info("Image model loaded successfully (lazy).")
        except RuntimeError as exc:
            logger.error("Failed to load image model: %s", exc)
            raise HTTPException(
                status_code=503,
                detail=f"Failed to load image model: {exc}",
            )

    try:
        # Download image
        resp = http_requests.get(request.image_url, timeout=10)
        resp.raise_for_status()
        image_bytes = resp.content

        result = predict_image(image_bytes)

        return ImagePredictResponse(
            nsfw_score=result["nsfw_score"],
            normal_score=result["normal_score"],
            is_nsfw=result["is_nsfw"],
            action=result["action"],
            label=result["label"],
        )
    except http_requests.RequestException as e:
        logger.error("Failed to download image: %s", e)
        raise HTTPException(status_code=400, detail=f"Cannot download image: {e}")
    except Exception as e:
        logger.exception("Image prediction error: %s", e)
        raise HTTPException(status_code=500, detail="Image analysis failed.")


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Returns service health status, model loading state, and uptime.",
)
async def health_check() -> HealthResponse:
    """Return the current health status of the microservice."""
    uptime = round(time.time() - _startup_time, 2) if _startup_time else 0.0
    text_loaded = is_model_loaded()
    image_loaded = is_image_model_loaded()

    status = "healthy" if (text_loaded and image_loaded) else "degraded" if text_loaded else "unhealthy"

    logger.debug("Health check — status=%s, uptime=%.2fs, image_model=%s", status, uptime, image_loaded)

    return HealthResponse(
        status=status,
        model_loaded=text_loaded,
        model_name=MODEL_NAME,
        uptime=uptime,
    )
