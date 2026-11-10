"""Strategies. Each decide() sees only prices up to the current close and returns a Decision."""
from .engine import Decision, Strategy


def _norm_weights(assets, weights):
    if weights is None:
        return {a: 1.0 / len(assets) for a in assets}
    if len(weights) != len(assets):
        raise ValueError(f"{len(weights)} weights given for {len(assets)} price files.")
    if min(weights) < 0 or sum(weights) > 1.0 + 1e-9:
        raise ValueError("Weights must be non-negative and sum to at most 1 (the remainder stays in cash).")
    return dict(zip(assets, weights))


def period_changed(kind, cur, nxt):
    if kind == "monthly":
        return (cur.year, cur.month) != (nxt.year, nxt.month)
    if kind == "quarterly":
        return (cur.year, (cur.month - 1) // 3) != (nxt.year, (nxt.month - 1) // 3)
    if kind == "annual":
        return cur.year != nxt.year
    raise ValueError(f"Unknown period '{kind}' (use monthly, quarterly or annual).")


class BuyHold(Strategy):
    name = "buy and hold"

    def __init__(self, assets, weights=None):
        self.w = _norm_weights(assets, weights)

    def decide(self, i, hist, next_date):
        return Decision(weights=self.w) if i == 0 else Decision()


class DCA(Strategy):
    name = "dollar-cost averaging"

    def __init__(self, assets, monthly, weights=None):
        self.w = _norm_weights(assets, weights)
        self.monthly = float(monthly)

    def decide(self, i, hist, next_date):
        if i == 0 or period_changed("monthly", hist.index[i], next_date):
            return Decision(contribution=self.monthly, deploy=self.w)
        return Decision()


class Rebalance(Strategy):
    name = "periodic rebalancing"

    def __init__(self, assets, weights=None, every="quarterly"):
        if every not in ("monthly", "quarterly", "annual"):
            raise ValueError(f"Unknown period '{every}' (use monthly, quarterly or annual).")
        self.w = _norm_weights(assets, weights)
        self.every = every

    def decide(self, i, hist, next_date):
        if i == 0 or period_changed(self.every, hist.index[i], next_date):
            return Decision(weights=self.w)
        return Decision()


class MACross(Strategy):
    """Per asset: invested (equal share) while the fast SMA is above the slow SMA at the close, else cash."""
    name = "moving-average crossover"

    def __init__(self, assets, fast=50, slow=200):
        if int(fast) >= int(slow):
            raise ValueError("fast must be shorter than slow.")
        self.assets, self.fast, self.slow = assets, int(fast), int(slow)

    def decide(self, i, hist, next_date):
        if len(hist) < self.slow:
            return Decision()
        w = {}
        for a in self.assets:
            c = hist[a]
            w[a] = (1.0 / len(self.assets)) if c.iloc[-self.fast:].mean() > c.iloc[-self.slow:].mean() else 0.0
        return Decision(weights=w)


class Momentum(Strategy):
    """Monthly: hold the top_n assets by trailing return over `lookback` bars (equal weight);
    with absolute=True an asset must also have a positive trailing return, otherwise that slot is cash."""
    name = "momentum rotation"

    def __init__(self, assets, lookback=126, top_n=1, absolute=True):
        if len(assets) < 2:
            raise ValueError("Momentum rotation needs at least two price files.")
        self.assets, self.lookback, self.top_n, self.absolute = assets, int(lookback), int(top_n), absolute

    def decide(self, i, hist, next_date):
        if not period_changed("monthly", hist.index[i], next_date):
            return Decision()
        if len(hist) <= self.lookback:
            return Decision()
        mom = hist.iloc[-1] / hist.iloc[-1 - self.lookback] - 1
        top = mom.sort_values(ascending=False).head(self.top_n)
        if self.absolute:
            top = top[top > 0]
        return Decision(weights={a: 1.0 / self.top_n for a in top.index})


def build(name, assets, cfg):
    w = cfg.get("weights")
    if name == "buyhold":
        return BuyHold(assets, w)
    if name == "dca":
        return DCA(assets, cfg.get("monthly") or 0, w)
    if name == "rebalance":
        return Rebalance(assets, w, cfg.get("rebalance") or "quarterly")
    if name == "ma":
        return MACross(assets, cfg.get("fast") or 50, cfg.get("slow") or 200)
    if name == "momentum":
        return Momentum(assets, cfg.get("lookback") or 126, cfg.get("top_n") or 1, not cfg.get("no_absolute", False))
    raise ValueError(f"Unknown strategy '{name}'. Choose buyhold, dca, rebalance, ma or momentum.")
