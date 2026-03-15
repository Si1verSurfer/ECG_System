"""Path, model, and sampling rate configuration for ECG classifier."""
from pathlib import Path

# Base paths (relative to project root)
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

MODELS_DIR = BASE_DIR / "models"
STATIC_DIR = BASE_DIR / "static"
RESULTS_DIR = PROJECT_ROOT / "results"
METRICS_PATH = RESULTS_DIR / "metrics.json"

# Model names (must match keys in metrics and filenames in models/)
MODEL_NAMES = ["resnet", "cnn", "cnn_lstm", "transformer"]

# Sampling rates (Hz)
SAMPLING_RATES = [100, 500]
DEFAULT_SAMPLING_RATE = 500

# 12-lead names (order must match model input)
LEAD_NAMES = ["I", "II", "III", "AVL", "AVR", "AVF", "V1", "V2", "V3", "V4", "V5", "V6"]

# Label classes (multi-label output)
LABEL_CLASSES = ["NORM", "MI", "STTC", "CD", "HYP"]

# Max upload size (bytes) — 50 MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024
