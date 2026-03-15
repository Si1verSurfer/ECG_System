"""Model loading, caching, and prediction with label decoding."""
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import LABEL_CLASSES, LEAD_NAMES, MODELS_DIR

# In-memory cache: model_name -> (model, mlb)
_model_cache: Dict[str, tuple] = {}
_mlb_cache: Optional[Any] = None


def _load_mlb() -> Any:
    """Load MultiLabelBinarizer from app/models/mlb.pkl."""
    global _mlb_cache
    if _mlb_cache is not None:
        return _mlb_cache
    import joblib
    pkl_path = MODELS_DIR / "mlb.pkl"
    if not pkl_path.exists():
        # Fallback: build a trivial binarizer from LABEL_CLASSES
        from sklearn.preprocessing import MultiLabelBinarizer
        mlb = MultiLabelBinarizer(classes=LABEL_CLASSES)
        mlb.fit([LABEL_CLASSES])
        _mlb_cache = mlb
        return _mlb_cache
    _mlb_cache = joblib.load(pkl_path)
    return _mlb_cache


def _load_keras_model(path: Path) -> Any:
    import tensorflow as tf
    return tf.keras.models.load_model(str(path))


def _load_pytorch_model(path: Path) -> Any:
    import torch
    model = torch.load(path, map_location="cpu", weights_only=False)
    if hasattr(model, "eval"):
        model.eval()
    return model


def load_model(model_name: str) -> Any:
    """Load model by name from app/models/, with caching."""
    if model_name in _model_cache:
        return _model_cache[model_name][0]

    name = model_name.lower().strip()
    for ext in (".h5", ".keras", ".pt", ".pth"):
        path = MODELS_DIR / f"{name}{ext}"
        if path.exists():
            break
    else:
        raise FileNotFoundError(f"Model not found: {model_name}")

    if path.suffix in (".h5", ".keras"):
        model = _load_keras_model(path)
    else:
        model = _load_pytorch_model(path)

    mlb = _load_mlb()
    _model_cache[model_name] = (model, mlb)
    return model


def predict_proba_keras(model: Any, x: np.ndarray) -> np.ndarray:
    """Run Keras/TF model.predict; return (1, 5) probabilities."""
    out = model.predict(x, verbose=0)
    if hasattr(out, "numpy"):
        out = out.numpy()
    out = np.asarray(out, dtype=np.float64)
    if out.ndim == 1:
        out = out.reshape(1, -1)
    if out.shape[1] == 5 and out.max() > 1.1:
        # logits -> sigmoid
        out = 1.0 / (1.0 + np.exp(-out))
    return out


def predict_proba_pytorch(model: Any, x: np.ndarray) -> np.ndarray:
    """Run PyTorch model; return (1, 5) probabilities."""
    import torch
    device = next(model.parameters(), None)
    device = device.device if device is not None else torch.device("cpu")
    t = torch.from_numpy(x).float().to(device)
    with torch.no_grad():
        out = model(t)
    if hasattr(out, "numpy"):
        out = out.cpu().numpy()
    else:
        out = out.cpu().numpy()
    out = np.asarray(out, dtype=np.float64)
    if out.ndim == 1:
        out = out.reshape(1, -1)
    if out.shape[1] == 5 and out.max() > 1.1:
        out = 1.0 / (1.0 + np.exp(-out))
    return out


def is_keras_model(model: Any) -> bool:
    try:
        import tensorflow as tf
        return isinstance(model, tf.keras.Model)
    except Exception:
        return False


def predict(
    model_name: str,
    x: np.ndarray,
    signal_2d: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Run inference and decode labels.
    x: (1, timesteps, 12)
    Returns dict with labels, probabilities, signal (12 arrays), lead_names, model_used.
    """
    if model_name not in _model_cache:
        load_model(model_name)
    model, mlb = _model_cache[model_name]

    if is_keras_model(model):
        proba = predict_proba_keras(model, x)
    else:
        proba = predict_proba_pytorch(model, x)

    # Ensure (1, 5)
    proba = np.asarray(proba, dtype=np.float64).reshape(1, -1)
    if proba.shape[1] != 5:
        proba = np.pad(proba, ((0, 0), (0, max(0, 5 - proba.shape[1]))), constant_values=0)[:, :5]

    classes = getattr(mlb, "classes_", None) or LABEL_CLASSES
    if len(classes) != 5:
        classes = LABEL_CLASSES[:5]

    proba_vec = proba[0]
    proba_dict = {c: float(proba_vec[i]) for i, c in enumerate(classes) if i < len(proba_vec)}
    for c in LABEL_CLASSES:
        if c not in proba_dict:
            proba_dict[c] = 0.0

    # Binary predictions for inverse_transform (threshold 0.5)
    binary = (proba_vec >= 0.5).astype(int).reshape(1, -1)
    try:
        decoded = mlb.inverse_transform(binary)
        labels = list(decoded[0]) if decoded.size else []
    except Exception:
        labels = [c for c, p in proba_dict.items() if p >= 0.5]

    # Signal for response: (timesteps, 12) -> list of 12 arrays
    if signal_2d is not None and signal_2d.ndim == 2 and signal_2d.shape[1] == 12:
        signal = [signal_2d[:, j].tolist() for j in range(12)]
    else:
        signal = []
        if x.ndim == 3 and x.shape[0] == 1:
            for j in range(min(12, x.shape[2])):
                signal.append(x[0, :, j].tolist())
        if len(signal) < 12:
            signal = [[] for _ in range(12)]

    return {
        "labels": labels,
        "probabilities": proba_dict,
        "signal": signal,
        "lead_names": list(LEAD_NAMES),
        "model_used": model_name,
    }
