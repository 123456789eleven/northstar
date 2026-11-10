"""CLI: python -m research.backtest <config.json> [flags]   (offline; writes only into --out)."""
import argparse
import itertools
import json
import sys
from pathlib import Path

import pandas as pd

from . import metrics as M
from .data import DataError, align, load_prices
from .engine import Costs, run
from .report import CAUTION, charts, metrics_block, num, pct
from .strategies import BuyHold, build

KEYS = ["prices", "strategy", "weights", "initial_cash", "monthly", "commission_pct", "commission_fixed", "slippage_bps",
        "whole_shares", "rf", "fast", "slow", "lookback", "top_n", "rebalance", "walk_forward", "grid", "start", "end",
        "dayfirst", "no_adjusted", "no_absolute"]


def parse_grid(spec):
    if isinstance(spec, dict):
        return {k: list(v) for k, v in spec.items()}
    out = {}
    for part in (spec or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = [int(x) for x in v.split(",") if x.strip()]
    return out


def simulate(prices, cfg):
    assets = list(prices.columns)
    strat = build(cfg["strategy"], assets, cfg)
    costs = Costs((cfg.get("commission_pct") or 0) / 100.0, cfg.get("commission_fixed") or 0, cfg.get("slippage_bps") or 0)
    frac = not cfg.get("whole_shares")
    init = cfg.get("initial_cash")
    init = 0.0 if (init is None and cfg["strategy"] == "dca") else (10000.0 if init is None else init)
    res = run(prices, strat, init, costs, frac)
    bench = run(prices[[assets[0]]], BuyHold([assets[0]], [1.0]), 10000.0, costs, frac)
    return res, bench


def rebase(s, start):
    seg = s.loc[start:]
    return seg / seg.iloc[0]


def pick_params(prices_in, cfg, grid):
    best = None
    names = list(grid)
    for combo in itertools.product(*[grid[k] for k in names]):
        c = dict(cfg, **dict(zip(names, combo)))
        try:
            res, _ = simulate(prices_in, c)
        except ValueError:
            continue
        sh = M.sharpe(res.index, cfg.get("rf") or 0)
        if sh == sh and (best is None or sh > best[0]):
            best = (sh, dict(zip(names, combo)))
    return best


def make_report(cfg, notes, prices, res, bench, wf_info=None):
    L = [CAUTION, "", "Offline backtest. Signals use data up to the prior close; trades execute at the next bar's close.", ""]
    L.append("Data")
    L += [f"  {n}" for n in notes]
    L.append(f"  Common dates: {prices.index[0]:%Y-%m-%d} to {prices.index[-1]:%Y-%m-%d} ({len(prices)} bars)")
    L.append("")
    L.append(f"Strategy: {cfg['strategy']} | assets: {', '.join(prices.columns)}")
    L.append(f"Costs: commission {cfg.get('commission_pct') or 0}% + {cfg.get('commission_fixed') or 0} per trade, slippage "
             f"{cfg.get('slippage_bps') or 0} bps; {'whole' if cfg.get('whole_shares') else 'fractional'} shares; risk-free {pct(cfg.get('rf') or 0)}")
    L.append("Dividends: only included where an adjusted-close column was used (see Data). Cash earns nothing. No taxes.")
    L.append("")
    rf = cfg.get("rf") or 0
    sa, sb = M.summarize(res.index, rf), M.summarize(bench.index, rf)
    L.append(metrics_block("Strategy", sa, "Buy and hold (first asset)", sb))
    L.append("")
    L.append(f"Trades: {len(res.trades)}; fees paid {num(res.trades['fee'].sum() if len(res.trades) else 0)}; "
             f"ending value {num(res.equity.iloc[-1])}; cash invested {num(res.contributed)}.")
    if res.flows.sum() > 0 or res.initial_cash == 0:
        gain = res.equity.iloc[-1] - res.contributed
        L.append(f"Money view: contributed {num(res.contributed)}, ended with {num(res.equity.iloc[-1])} (gain {num(gain)}). "
                 "Returns above are time-weighted so contributions do not inflate them.")
    for a in prices.columns:
        sh = res.positions[a].iloc[-1]
        if sh > 0:
            L.append(f"  {a}: {sh:,.4f} shares, average cost {num(res.avg_cost(a))}, last price {num(prices[a].iloc[-1])}")
    d = sa["total_return"] - sb["total_return"]
    L.append(f"\nVersus buy and hold of {prices.columns[0]}: {'ahead' if d >= 0 else 'behind'} by {pct(abs(d))} total return.")
    if wf_info:
        L += ["", "Walk-forward", "-" * 12, wf_info]
    return "\n".join(L) + "\n"


def run_cfg(cfg, out):
    if not cfg.get("prices"):
        raise ValueError("No price files given (--prices a.csv b.csv, or \"prices\" in the config).")
    series, notes = [], []
    for p in cfg["prices"]:
        s, n = load_prices(p, bool(cfg.get("dayfirst")), not cfg.get("no_adjusted"))
        series.append(s)
        notes.append(n)
    prices = align(series)
    if cfg.get("start"):
        prices = prices.loc[cfg["start"]:]
    if cfg.get("end"):
        prices = prices.loc[: cfg["end"]]
    if len(prices) < 3:
        raise DataError("Fewer than 3 bars remain after applying start/end.")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    wf, split_date, wf_text = cfg.get("walk_forward"), None, None
    if wf:
        k = int(len(prices) * float(wf) / 100.0)
        if k < 30 or len(prices) - k < 30:
            raise ValueError("Walk-forward needs at least 30 bars on each side of the split.")
        split_date = prices.index[k]
        grid = parse_grid(cfg.get("grid"))
        chosen = {}
        if grid:
            best = pick_params(prices.iloc[:k], cfg, grid)
            if best is None:
                raise ValueError("No grid combination could be run on the in-sample part.")
            chosen = best[1]
            cfg = dict(cfg, **chosen)
        res, bench = simulate(prices, cfg)
        rf = cfg.get("rf") or 0
        ins = M.summarize(rebase(res.index.iloc[:k], res.index.index[0]), rf)
        oos_s = M.summarize(rebase(res.index, split_date), rf)
        oos_b = M.summarize(rebase(bench.index, split_date), rf)
        wf_text = (f"Fit window: first {wf}% ({prices.index[0]:%Y-%m-%d} to {prices.index[k - 1]:%Y-%m-%d}). "
                   + (f"Parameters chosen on the fit window only (best Sharpe): {chosen}.\n" if chosen else "No parameter grid given, so nothing was fitted; the split just reports the two parts separately.\n")
                   + f"In-sample: total return {pct(ins['total_return'])}, Sharpe {num(ins['sharpe'])}, max drawdown {pct(ins['max_drawdown']['depth'])}.\n"
                   + "Out-of-sample (the rest, never used for choosing parameters):\n"
                   + metrics_block("Strategy", oos_s, "Buy and hold (first asset)", oos_b)
                   + "\nIf out-of-sample is much worse than in-sample, suspect overfitting.")
    else:
        res, bench = simulate(prices, cfg)
    (out / "report.txt").write_text(make_report(cfg, notes, prices, res, bench, wf_text), encoding="utf-8")
    ec = pd.DataFrame({"equity": res.equity, "index": res.index, "benchmark_index": bench.index,
                       "drawdown": M.drawdown_series(res.index), "contributed_cum": res.initial_cash + res.flows.cumsum()})
    ec.index.name = "Date"
    ec.round(6).to_csv(out / "equity_curve.csv")
    charts(out, res.index, bench.index, cfg["strategy"], split_date)
    return res, bench


def main(argv=None):
    ap = argparse.ArgumentParser(prog="research.backtest", description="Offline backtest of simple strategies on price CSVs you supply.")
    ap.add_argument("config", nargs="?", help="JSON config (flags override it)")
    ap.add_argument("--out", help="folder for report.txt, equity_curve.csv and PNG charts")
    ap.add_argument("--prices", nargs="+")
    ap.add_argument("--strategy", choices=["buyhold", "dca", "rebalance", "ma", "momentum"])
    ap.add_argument("--weights", nargs="+", type=float)
    ap.add_argument("--initial-cash", type=float, dest="initial_cash")
    ap.add_argument("--monthly", type=float, help="DCA amount per month")
    ap.add_argument("--commission-pct", type=float, dest="commission_pct", help="percent of notional, e.g. 0.1")
    ap.add_argument("--commission-fixed", type=float, dest="commission_fixed")
    ap.add_argument("--slippage-bps", type=float, dest="slippage_bps")
    ap.add_argument("--whole-shares", action="store_true", dest="whole_shares", default=None)
    ap.add_argument("--rf", type=float, help="annual risk-free rate as a fraction, e.g. 0.03")
    ap.add_argument("--fast", type=int)
    ap.add_argument("--slow", type=int)
    ap.add_argument("--lookback", type=int)
    ap.add_argument("--top-n", type=int, dest="top_n")
    ap.add_argument("--rebalance", choices=["monthly", "quarterly", "annual"])
    ap.add_argument("--walk-forward", type=float, dest="walk_forward", help="percent of bars used as the fit window")
    ap.add_argument("--grid", help='parameter grid for the fit window, e.g. "fast=10,20,50;slow=100,200"')
    ap.add_argument("--start")
    ap.add_argument("--end")
    ap.add_argument("--dayfirst", action="store_true", default=None)
    ap.add_argument("--no-adjusted", action="store_true", dest="no_adjusted", default=None)
    ap.add_argument("--no-absolute", action="store_true", dest="no_absolute", default=None)
    a = ap.parse_args(argv)
    cfg = {}
    if a.config:
        try:
            cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            print(f"Error: cannot read config ({type(e).__name__}).", file=sys.stderr)
            return 2
        base = Path(a.config).resolve().parent
        cfg["prices"] = [str(p if Path(p).is_absolute() else base / p) for p in cfg.get("prices", [])]
    out = a.out or cfg.get("out")
    for k in KEYS:
        v = getattr(a, k, None)
        if v is not None:
            cfg[k] = v
    cfg.setdefault("strategy", "buyhold")
    if not out:
        print("Error: --out FOLDER is required (nothing is written anywhere else).", file=sys.stderr)
        return 2
    try:
        res, bench = run_cfg(cfg, out)
    except (DataError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    print(CAUTION)
    print(f"Strategy total return {pct(M.total_return(res.index))} vs buy and hold {pct(M.total_return(bench.index))}. Files written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
