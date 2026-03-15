"""POST /api/predict — ECG file upload and classification."""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import DEFAULT_SAMPLING_RATE, MAX_UPLOAD_SIZE
from app.core import inference, preprocessing

# In-memory cache for visualize: ecg_id -> { "signal": [...], "lead_names": [...] }
_visualize_cache: dict = {}
_last_ecg_id: int = 0


def _next_ecg_id() -> str:
    global _last_ecg_id
    _last_ecg_id += 1
    return str(_last_ecg_id)


router = APIRouter(tags=["predict"])


@router.post("/predict")
async def predict(
    file: UploadFile = File(..., description="ECG file (.dat, .csv, .npy)"),
    model: str = Form("resnet", description="Model name"),
    sampling_rate: int = Form(DEFAULT_SAMPLING_RATE, description="Sampling rate Hz"),
):
    """Accept ECG file and optional model/sampling_rate; return labels, probabilities, signal."""
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=422,
            detail="File too large. Maximum size is 50MB.",
        )
    filename = file.filename or ""

    try:
        x = preprocessing.preprocess(raw, filename=filename, sampling_rate=sampling_rate)
    except ValueError as e:
        msg = str(e)
        if "shape" in msg.lower() or "Expected" in msg:
            raise HTTPException(
                status_code=422,
                detail="Invalid ECG file. Expected shape (N, 12).",
            ) from e
        raise HTTPException(status_code=422, detail=msg) from e

    # Raw signal (before normalization) for visualization: (1, T, 12) -> (T, 12)
    try:
        signal_2d = preprocessing.load_ecg(raw, filename=filename, sampling_rate=sampling_rate)
    except Exception:
        signal_2d = x[0]

    try:
        result = inference.predict(model, x, signal_2d=signal_2d)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail="Selected model not available.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Server error. Please try again.",
        ) from e

    ecg_id = _next_ecg_id()
    _visualize_cache[ecg_id] = {
        "signal": result["signal"],
        "lead_names": result["lead_names"],
    }
    _visualize_cache["last"] = _visualize_cache[ecg_id]
    result["ecg_id"] = ecg_id
    return result
