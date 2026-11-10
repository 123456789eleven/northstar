"""Performance metrics on an index series (1.0 at start, flow-adjusted)."""
import numpy as np
import pandas as pd


def periods_per_year(idx):
    gaps = pd.Series(idx.index).diff().dt.days.dropna()
    g = float(gaps.median()) if len(gaps) else 1.0
    return 252 if g <= 4 else 52 if g <= 10 else 12 if g <= 40 else 4 if g <= 120 else 1


def total_return(idx):
    return float(idx.iloc[-1] / idx.iloc[0] - 1)


def cagr(idx):
    days = (idx.index[-1] - idx.index[0]).days
    if days <= 0 or idx.iloc[0] <= 0 or idx.iloc[-1] <= 0:
        return float("nan")
    return float((idx.iloc[-1] / idx.iloc[0]) ** (365.25 / days) - 1)


def returns(idx):
    return idx.pct_change().dropna()


def volatility(idx, ppy=None):
    r = returns(idx)
    return float(r.std(ddof=1) * np.sqrt(ppy or periods_per_year(idx))) if len(r) > 1 else float("nan")


def sharpe(idx, rf=0.0, ppy=None):
    ppy = ppy or periods_per_year(idx)
    r = returns(idx) - rf / ppy
    sd = r.std(ddof=1)
    return float(r.mean() / sd * np.sqrt(ppy)) if len(r) > 1 and sd > 0 else float("nan")


def sortino(idx, rf=0.0, ppy=None):
    ppy = ppy or periods_per_year(idx)
    r = returns(idx) - rf / ppy
    dd = np.sqrt((np.minimum(r, 0) ** 2).mean()) if len(r) else 0
    return float(r.mean() / dd * np.sqrt(ppy)) if dd > 0 else float("nan")


def drawdown_series(idx):
    return idx / idx.cummax() - 1


def max_drawdown(idx):
    """Returns dict: depth (negative), peak, trough, recovery (date or None), days_to_recover, days_peak_to_trough."""
    dd = drawdown_series(idx)
    trough = dd.idxmin()
    depth = float(dd.min())
    peak = idx.loc[:trough].idxmax()
    after = idx.loc[trough:]
    rec = after[after >= idx.loc[peak]]
    recovery = rec.index[0] if len(rec) else None
    return {
        "depth": depth, "peak": peak, "trough": trough, "recovery": recovery,
        "days_peak_to_trough": (trough - peak).days,
        "days_to_recover": (recovery - trough).days if recovery is not None else None,
    }


def monthly_returns(idx):
    m = idx.resample("ME").last()
    first = idx.iloc[0]
    m = pd.concat([pd.Series([first], index=[m.index[0] - pd.offsets.MonthEnd(1)]), m])
    return m.pct_change().dropna()


def best_worst_month(idx):
    m = monthly_returns(idx)
    if m.empty:
        return None
    return (m.idxmax().strftime("%Y-%m"), float(m.max())), (m.idxmin().strftime("%Y-%m"), float(m.min()))


def rolling_1y(idx, ppy=None):
    ppy = ppy or periods_per_year(idx)
    return (idx / idx.shift(ppy) - 1).dropna()


def rolling_summary(idx, ppy=None):
    r = rolling_1y(idx, ppy)
    if r.empty:
        return None
    q = r.quantile([0.05, 0.25, 0.5, 0.75, 0.95])
    return {"n": len(r), "p5": q[0.05], "p25": q[0.25], "median": q[0.5], "p75": q[0.75], "p95": q[0.95],
            "min": r.min(), "max": r.max(), "pct_negative": float((r < 0).mean())}


def summarize(idx, rf=0.0):
    ppy = periods_per_year(idx)
    return {
        "start": idx.index[0], "end": idx.index[-1], "bars": len(idx),
        "total_return": total_return(idx), "cagr": cagr(idx), "volatility": volatility(idx, ppy),
        "sharpe": sharpe(idx, rf, ppy), "sortino": sortino(idx, rf, ppy),
        "max_drawdown": max_drawdown(idx), "best_worst_month": best_worst_month(idx),
        "rolling_1y": rolling_summary(idx, ppy),
    }
