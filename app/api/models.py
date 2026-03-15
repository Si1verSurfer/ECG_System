"""GET /api/models — List available model names."""
from pathlib import Path

from fastapi import APIRouter

from app.config import MODELS_DIR, MODEL_NAMES

router = APIRouter(tags=["models"])


@router.get("/models")
async def models():
    """Return list of available model names (from config or by scanning models/)."""
    names = set()
    if MODELS_DIR.exists():
        for p in MODELS_DIR.iterdir():
            if p.suffix.lower() in (".h5", ".keras", ".pt", ".pth") and p.is_file():
                names.add(p.stem.lower())
    if not names:
        names = set(m.lower() for m in MODEL_NAMES)
    return sorted(names) if names else list(MODEL_NAMES)
