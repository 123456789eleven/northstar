"""Plain-text report and PNG charts."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from . import metrics as M  # noqa: E402

CAUTION = (
    "CAUTION: A backtest is not a forecast. It shows what a rule would have done on the past data you supplied, "
    "with simplifying assumptions (costs, execution at the next close, no taxes, cash earns nothing). "
    "Overfitting is likely: trying many rules or parameters on the same history will find some that look good by chance. "
    "Treat results as an illustration for learning, not as advice or a prediction."
)


def pct(x):
    return "n/a" if x is None or x != x else f"{x * 100:,.2f}%"


def num(x):
    return "n/a" if x is None or x != x else f"{x:,.2f}"


def metrics_block(label_a, a, label_b, b):
    """Two-column comparison. a, b are summarize() dicts (b may be None)."""
    rows = [
        ("Period", f"{a['start']:%Y-%m-%d} to {a['end']:%Y-%m-%d} ({a['bars']} bars)", None),
        ("Total return", pct(a["total_return"]), pct(b["total_return"]) if b else None),
        ("CAGR", pct(a["cagr"]), pct(b["cagr"]) if b else None),
        ("Volatility (annualised)", pct(a["volatility"]), pct(b["volatility"]) if b else None),
        ("Sharpe", num(a["sharpe"]), num(b["sharpe"]) if b else None),
        ("Sortino", num(a["sortino"]), num(b["sortino"]) if b else None),
        ("Max drawdown", pct(a["max_drawdown"]["depth"]), pct(b["max_drawdown"]["depth"]) if b else None),
    ]
    out = [f"{'':<26}{label_a:<30}" + (f"{label_b:<30}" if b else "")]
    for name, x, y in rows:
        out.append(f"{name:<26}{x:<30}" + (f"{y:<30}" if y is not None else ""))
    d = a["max_drawdown"]
    rec = f"recovered {d['recovery']:%Y-%m-%d} ({d['days_to_recover']} days after the low)" if d["recovery"] is not None else "not recovered by the end of the data"
    out.append(f"\nDrawdown detail ({label_a}): peak {d['peak']:%Y-%m-%d}, low {d['trough']:%Y-%m-%d} "
               f"({d['days_peak_to_trough']} days down), {rec}.")
    bw = a["best_worst_month"]
    if bw:
        out.append(f"Best month {bw[0][0]} {pct(bw[0][1])}; worst month {bw[1][0]} {pct(bw[1][1])}.")
    r = a["rolling_1y"]
    if r:
        out.append(f"Rolling 1-year return ({r['n']} windows): worst {pct(r['min'])}, 5th pct {pct(r['p5'])}, median {pct(r['median'])}, "
                   f"95th pct {pct(r['p95'])}, best {pct(r['max'])}; negative in {pct(r['pct_negative'])} of windows.")
    else:
        out.append("Rolling 1-year return: not enough data for a full year window.")
    return "\n".join(out)


def charts(outdir, strat_idx, bench_idx, title, split=None):
    files = []
    c1, c2, c3 = "#2f6f9f", "#8a8a8a", "#c0392b"

    def finish(fig, ax, name):
        ax.grid(alpha=0.25)
        if split is not None:
            ax.axvline(split, color=c3, ls=":", lw=1)
            ax.annotate("walk-forward split", (split, ax.get_ylim()[1]), fontsize=8, color=c3, va="top", ha="right")
        fig.tight_layout()
        fig.savefig(outdir / name, dpi=110)
        plt.close(fig)
        files.append(name)

    fig, ax = plt.subplots(figsize=(9, 4.5))
    ax.plot(strat_idx.index, strat_idx.values, color=c1, label=title)
    ax.plot(bench_idx.index, bench_idx.values, color=c2, label="Buy and hold, first asset")
    ax.set_title("Growth of 1.00 (flow-adjusted)")
    ax.legend()
    finish(fig, ax, "equity_vs_benchmark.png")

    fig, ax = plt.subplots(figsize=(9, 3.5))
    ax.fill_between(strat_idx.index, M.drawdown_series(strat_idx).values * 100, 0, color=c1, alpha=0.5, label=title)
    ax.plot(bench_idx.index, M.drawdown_series(bench_idx).values * 100, color=c2, lw=1, label="Buy and hold")
    ax.set_ylabel("Drawdown (%)")
    ax.set_title("Drawdown from previous peak")
    ax.legend()
    finish(fig, ax, "drawdown.png")

    fig, ax = plt.subplots(figsize=(9, 3.5))
    ra, rb = M.rolling_1y(strat_idx), M.rolling_1y(bench_idx)
    if len(ra):
        ax.plot(ra.index, ra.values * 100, color=c1, label=title)
    if len(rb):
        ax.plot(rb.index, rb.values * 100, color=c2, lw=1, label="Buy and hold")
    ax.axhline(0, color="black", lw=0.6)
    ax.set_ylabel("1-year return (%)")
    ax.set_title("Rolling 1-year return")
    if len(ra) or len(rb):
        ax.legend()
    else:
        ax.text(0.5, 0.5, "Less than one year of data", transform=ax.transAxes, ha="center")
    finish(fig, ax, "rolling_1y_returns.png")
    return files
