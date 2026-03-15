"""Read and return dashboard metrics from results/metrics.json."""
import json
from pathlib import Path
from typing import Any, Dict

from app.config import METRICS_PATH


def get_metrics() -> Dict[str, Any]:
    """
    Read metrics.json and return dict keyed by model name.
    Each value has macro_auc, macro_f1, hamming_loss, subset_accuracy,
    per_class_auc, and optionally confusion_matrices.
    """
    path = Path(METRICS_PATH)
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}
