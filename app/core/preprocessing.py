"""ECG signal loading, validation, and normalization."""
import io
import tempfile
from pathlib import Path
from typing import Union

import numpy as np
import wfdb

try:
    import pandas as pd
except ImportError:
    pd = None


def load_ecg(
    data: Union[bytes, np.ndarray],
    filename: str = "",
    sampling_rate: int = 500,
) -> np.ndarray:
    """
    Load ECG from raw bytes or numpy array.
    Supports .dat (WFDB), .csv, .npy.
    Returns array of shape (timesteps, 12). Raises ValueError if invalid.
    """
    if isinstance(data, np.ndarray):
        arr = np.asarray(data, dtype=np.float64)
        if arr.ndim != 2 or arr.shape[1] != 12:
            raise ValueError(
                f"Invalid ECG shape. Expected (N, 12), got {arr.shape}."
            )
        return arr

    if not isinstance(data, bytes):
        raise ValueError("Input must be bytes or numpy array.")

    data = bytes(data)
    ext = (Path(filename).suffix or "").lower() if filename else ""

    if ext == ".npy":
        buf = io.BytesIO(data)
        arr = np.load(buf, allow_pickle=False)
        arr = np.asarray(arr, dtype=np.float64)
        if arr.ndim != 2 or arr.shape[1] != 12:
            raise ValueError(
                f"Invalid ECG shape in .npy. Expected (N, 12), got {arr.shape}."
            )
        return arr

    if ext == ".csv":
        if pd is None:
            raise ValueError("pandas is required for CSV support.")
        buf = io.BytesIO(data)
        df = pd.read_csv(buf)
        if df.shape[1] != 12:
            raise ValueError(
                f"Invalid ECG CSV. Expected 12 columns, got {df.shape[1]}."
            )
        arr = df.values.astype(np.float64)
        return arr

    if ext == ".dat":
        return _load_wfdb_dat(data, filename or "record", sampling_rate)

    raise ValueError(
        f"Unsupported file format. Use .dat, .csv, or .npy (got {ext or 'unknown'})."
    )


def _load_wfdb_dat(data: bytes, record_name: str, sampling_rate: int) -> np.ndarray:
    """Load WFDB .dat from bytes by writing to temp dir with a minimal .hea."""
    record_stem = Path(record_name).stem or "record"
    with tempfile.TemporaryDirectory() as tmpdir:
        dat_path = Path(tmpdir) / f"{record_stem}.dat"
        hea_path = Path(tmpdir) / f"{record_stem}.hea"
        dat_path.write_bytes(data)
        # Minimal WFDB header: 12 signals, 16-bit each = 24 bytes per sample
        n_samp = len(data) // (12 * 2)
        hea_lines = [
            f"{record_stem} 12 {sampling_rate} {n_samp} 0 12 16 0 0 100",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 I",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 II",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 III",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 aVL",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 aVR",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 aVF",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V1",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V2",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V3",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V4",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V5",
            f"{record_stem}.dat 16 0.0(16) 0 0 0 0 0 0 0 0 V6",
        ]
        hea_path.write_text("\n".join(hea_lines), encoding="utf-8")
        record = wfdb.rdrecord(str(hea_path.with_suffix("")))
        p_signal = record.p_signal
        if p_signal is None or p_signal.shape[1] != 12:
            raise ValueError(
                f"Invalid ECG shape from WFDB. Expected (N, 12), got {p_signal.shape if p_signal is not None else 'None'}."
            )
        return np.asarray(p_signal, dtype=np.float64)

    raise ValueError("Failed to load WFDB .dat file.")


def normalize_per_lead(x: np.ndarray) -> np.ndarray:
    """Zero mean, unit variance per lead. Shape (N, 12). std=0 -> no division."""
    out = np.zeros_like(x, dtype=np.float64)
    for lead in range(x.shape[1]):
        col = x[:, lead]
        mu = np.mean(col)
        std = np.std(col)
        if std == 0:
            out[:, lead] = col - mu
        else:
            out[:, lead] = (col - mu) / std
    return out


def preprocess(
    data: Union[bytes, np.ndarray],
    filename: str = "",
    sampling_rate: int = 500,
) -> np.ndarray:
    """
    Load, validate, normalize, and reshape ECG for model input.
    Returns array of shape (1, timesteps, 12). Raises ValueError if invalid.
    """
    arr = load_ecg(data, filename=filename, sampling_rate=sampling_rate)
    if arr.shape[1] != 12:
        raise ValueError("Invalid ECG file. Expected shape (N, 12).")
    arr = normalize_per_lead(arr)
    return arr[np.newaxis, :, :]  # (1, timesteps, 12)
