"""GET /api/visualize/{ecg_id} — Cached 12-lead signal for an ECG."""
from fastapi import APIRouter, HTTPException

from app.api.predict import _visualize_cache

router = APIRouter(tags=["visualize"])


@router.get("/visualize/{ecg_id}")
async def visualize(ecg_id: str):
    """Return 12-lead signal arrays and lead names for the given ecg_id (from recent predict)."""
    if ecg_id not in _visualize_cache:
        raise HTTPException(status_code=404, detail="ECG not found.")
    return _visualize_cache[ecg_id]
