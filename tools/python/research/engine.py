"""Honest backtest engine.

Timing: a strategy decision at bar i sees prices up to and including bar i close
(hist is sliced so later bars are physically unavailable). The resulting order is
executed at bar i+1 close (plus slippage and commission). Cash earns nothing.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass
class Costs:
    commission_pct: float = 0.0    # fraction of notional, e.g. 0.001 = 0.1%
    commission_fixed: float = 0.0  # per trade
    slippage_bps: float = 0.0      # applied against you on every trade


@dataclass
class Decision:
    weights: dict = None       # rebalance to these target weights (rest stays cash); None = no rebalance
    contribution: float = 0.0  # new cash arriving at the execution bar
    deploy: dict = None        # spend all cash on these assets in these proportions, never selling


class Strategy:
    name = "strategy"

    def decide(self, i, hist, next_date):  # pragma: no cover - interface
        return Decision()


@dataclass
class Result:
    equity: pd.Series
    flows: pd.Series
    index: pd.Series            # flow-adjusted (time-weighted), 1.0 at start
    trades: pd.DataFrame
    positions: pd.DataFrame     # shares per asset per bar
    cash: pd.Series
    cost_basis: dict
    prices: pd.DataFrame
    contributed: float
    initial_cash: float

    def weights_at(self, i):
        val = self.positions.iloc[i] * self.prices.iloc[i]
        return val / self.equity.iloc[i]

    def avg_cost(self, asset):
        sh = self.positions[asset].iloc[-1]
        return self.cost_basis[asset] / sh if sh > 0 else float("nan")


def run(prices, strategy, initial_cash=10000.0, costs=None, fractional=True):
    costs = costs or Costs()
    assets = list(prices.columns)
    n = len(prices)
    shares = {a: 0.0 for a in assets}
    basis = {a: 0.0 for a in assets}
    cash = float(initial_cash)
    contributed = float(initial_cash)
    eq, fl, cs, pos, trades = [], [], [], [], []
    pending = None
    slip = costs.slippage_bps / 10000.0

    def fee(notional):
        return notional * costs.commission_pct + costs.commission_fixed

    def qty_round(q):
        return q if fractional else float(np.floor(q + 1e-9))

    for i in range(n):
        px = prices.iloc[i]
        flow = 0.0
        if pending is not None:
            if pending.contribution:
                cash += pending.contribution
                contributed += pending.contribution
                flow = pending.contribution
            equity = cash + sum(shares[a] * px[a] for a in assets)
            buys = {}
            if pending.weights is not None:
                for a in assets:
                    tgt = pending.weights.get(a, 0.0) * equity
                    cur = shares[a] * px[a]
                    if cur > tgt + 1e-9:
                        q = min(qty_round((cur - tgt) / px[a]), shares[a])
                        if q > 0:
                            p = px[a] * (1 - slip)
                            f = fee(q * p)
                            basis[a] -= basis[a] / shares[a] * q
                            shares[a] -= q
                            cash += q * p - f
                            trades.append((i, prices.index[i], a, "sell", q, p, f))
                    elif tgt > cur + 1e-9:
                        buys[a] = tgt - cur
            elif pending.deploy:
                tot = sum(pending.deploy.values())
                if tot > 0 and cash > 0:
                    buys = {a: cash * w / tot for a, w in pending.deploy.items() if w > 0}
            if buys:
                var = sum(v * (1 + slip) * (1 + costs.commission_pct) for v in buys.values())
                avail = cash - len(buys) * costs.commission_fixed
                scale = min(1.0, avail / var) if var > 0 else 0.0
                for a, notional in buys.items():
                    if scale <= 0:
                        break
                    q = qty_round(notional * scale / px[a])
                    if q <= 0:
                        continue
                    p = px[a] * (1 + slip)
                    f = fee(q * p)
                    if q * p + f > cash + 1e-9:
                        continue
                    shares[a] += q
                    basis[a] += q * p + f
                    cash -= q * p + f
                    trades.append((i, prices.index[i], a, "buy", q, p, f))
        eq.append(cash + sum(shares[a] * px[a] for a in assets))
        fl.append(flow)
        cs.append(cash)
        pos.append([shares[a] for a in assets])
        pending = strategy.decide(i, prices.iloc[: i + 1], prices.index[i + 1]) if i < n - 1 else None

    equity = pd.Series(eq, index=prices.index, name="equity")
    flows = pd.Series(fl, index=prices.index, name="flows")
    prev = equity.shift(1)
    r = ((equity - flows) / prev - 1).where(prev > 0, 0.0).fillna(0.0)
    index = (1 + r).cumprod()
    tdf = pd.DataFrame(trades, columns=["bar", "date", "asset", "side", "qty", "price", "fee"])
    return Result(equity, flows, index, tdf, pd.DataFrame(pos, index=prices.index, columns=assets),
                  pd.Series(cs, index=prices.index), basis, prices, contributed, float(initial_cash))
