"""Price CSV loading. Accepts Date,Close or Date,Open,High,Low,Close,Volume (any common date format)."""
from pathlib import Path

import pandas as pd


class DataError(Exception):
    pass


def _num(s):
    return pd.to_numeric(s.astype(str).str.replace(r"[$,\s]", "", regex=True), errors="coerce")


def load_prices(path, dayfirst=False, use_adjusted=True):
    """Returns (Series of prices indexed by date, note describing which column was used)."""
    p = Path(path)
    try:
        df = pd.read_csv(p, encoding="utf-8-sig")
    except Exception as e:  # noqa: BLE001
        raise DataError(f"Could not read {p.name}: {type(e).__name__}")
    cols = {str(c).strip().lower().replace("_", " "): c for c in df.columns}
    dcol = cols.get("date") or cols.get("timestamp") or cols.get("datetime")
    if dcol is None:
        raise DataError(f"{p.name}: no Date column (found: {', '.join(map(str, df.columns))}).")
    adj = next((cols[k] for k in ("adj close", "adjusted close", "adj. close", "adjclose") if k in cols), None)
    close = cols.get("close")
    if use_adjusted and adj is not None:
        pcol, note = adj, f"{p.stem}: adjusted close ('{adj}') used, so dividends are included"
    elif close is not None:
        pcol, note = close, f"{p.stem}: 'Close' used, dividends are ignored"
    elif adj is not None:
        pcol, note = adj, f"{p.stem}: adjusted close ('{adj}') used, so dividends are included"
    else:
        raise DataError(f"{p.name}: no Close column (found: {', '.join(map(str, df.columns))}).")
    try:
        dates = pd.to_datetime(df[dcol].astype(str).str.strip(), format="mixed", dayfirst=dayfirst, errors="coerce")
    except Exception:  # noqa: BLE001
        raise DataError(f"{p.name}: dates could not be parsed.")
    s = pd.Series(_num(df[pcol]).values, index=dates).dropna()
    s = s[~s.index.isna()]
    bad = len(df) - len(s)
    if len(s) < 3:
        raise DataError(f"{p.name}: fewer than 3 usable rows.")
    if (s <= 0).any():
        raise DataError(f"{p.name}: contains zero or negative prices.")
    s = s.sort_index()
    if s.index.has_duplicates:
        s = s[~s.index.duplicated(keep="last")]
        note += "; duplicate dates dropped (kept last)"
    if bad:
        note += f"; {bad} unusable row(s) skipped"
    s.name = p.stem
    return s.astype(float), note


def align(series_list):
    """Inner-join on common dates; returns DataFrame (one column per asset)."""
    df = pd.concat(series_list, axis=1, join="inner").dropna()
    if len(df) < 3:
        raise DataError("The price files share fewer than 3 common dates.")
    if df.columns.duplicated().any():
        df.columns = [f"{c}_{i}" for i, c in enumerate(df.columns)]
    return df
