"""GET /api/dashboard — Model performance metrics."""
from fastapi import APIRouter

from app.core import metrics

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def dashboard():
    """Return metrics per model (macro_auc, macro_f1, hamming_loss, subset_accuracy, per_class_auc, confusion_matrices)."""
    data = metrics.get_metrics()
    return data
