import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from research import metrics as M
from research.backtest import main as bt_main
from research.data import load_prices, DataError
from research.engine import Costs, run
from research.strategies import BuyHold, DCA, Rebalance, MACross, Momentum


def bdays(n, start="2020-01-01"):
    return pd.bdate_range(start, periods=n)


def frame(**cols):
    n = len(next(iter(cols.values())))
    return pd.DataFrame(cols, index=bdays(n))


class MetricTests(unittest.TestCase):
    def test_cagr_known_answer(self):
        idx = pd.Series([1.0, 1.21], index=pd.to_datetime(["2020-01-01", "2022-01-01"]))
        self.assertAlmostEqual(M.cagr(idx), 1.21 ** (365.25 / 731) - 1, places=9)
        self.assertAlmostEqual(M.cagr(idx), 0.10, places=3)
        self.assertAlmostEqual(M.total_return(idx), 0.21)

    def test_drawdown_known_answer(self):
        idx = pd.Series([100, 120, 90, 100, 130.0], index=bdays(5))
        d = M.max_drawdown(idx)
        self.assertAlmostEqual(d["depth"], -0.25)
        self.assertEqual((d["peak"], d["trough"]), (idx.index[1], idx.index[2]))
        self.assertEqual(d["recovery"], idx.index[4])
        self.assertEqual(d["days_to_recover"], (idx.index[4] - idx.index[2]).days)
        idx2 = pd.Series([100, 120, 90, 100.0], index=bdays(4))
        self.assertIsNone(M.max_drawdown(idx2)["recovery"])

    def test_vol_sharpe_flat(self):
        idx = pd.Series(np.ones(30), index=bdays(30))
        self.assertEqual(M.volatility(idx), 0.0)
        self.assertTrue(np.isnan(M.sharpe(idx)))

    def test_monthly_best_worst(self):
        idx = pd.Series([1.0, 1.1, 0.99, 1.089], index=pd.to_datetime(["2020-01-31", "2020-02-29", "2020-03-31", "2020-04-30"]))
        (bm, bv), (wm, wv) = M.best_worst_month(idx)
        self.assertEqual(bm, "2020-02")
        self.assertEqual(wm, "2020-03")
        self.assertAlmostEqual(wv, -0.1)

    def test_rolling_1y(self):
        idx = pd.Series(1.0 + np.arange(300) * 0.001, index=bdays(300))
        s = M.rolling_summary(idx)
        self.assertEqual(s["n"], 300 - 252)
        self.assertEqual(s["pct_negative"], 0.0)


class EngineTests(unittest.TestCase):
    def test_buy_and_hold_executes_next_bar(self):
        p = frame(A=[10, 20, 20, 40.0])
        r = run(p, BuyHold(["A"], [1.0]), 1000, Costs())
        self.assertEqual(r.trades.iloc[0]["bar"], 1)  # decided at bar 0, executed at bar 1
        self.assertAlmostEqual(r.positions["A"].iloc[-1], 50.0)  # 1000 / 20
        self.assertAlmostEqual(r.equity.iloc[-1], 2000.0)
        self.assertAlmostEqual(r.equity.iloc[0], 1000.0)

    def test_dca_cost_basis(self):
        idx = pd.to_datetime(["2020-01-01", "2020-02-03", "2020-03-02", "2020-04-01"])
        p = pd.DataFrame({"A": [5, 10, 20, 40.0]}, index=idx)
        r = run(p, DCA(["A"], 100, [1.0]), 0, Costs())
        self.assertAlmostEqual(r.positions["A"].iloc[-1], 100 / 10 + 100 / 20 + 100 / 40)
        self.assertAlmostEqual(r.contributed, 300.0)
        self.assertAlmostEqual(r.cost_basis["A"], 300.0)
        self.assertAlmostEqual(r.avg_cost("A"), 300 / 17.5)
        self.assertAlmostEqual(r.equity.iloc[-1], 17.5 * 40)

    def test_costs_and_whole_shares(self):
        p = frame(A=[10, 10, 10.0])
        r = run(p, BuyHold(["A"], [1.0]), 1000, Costs(commission_pct=0.01, commission_fixed=1.0, slippage_bps=100), fractional=False)
        t = r.trades.iloc[0]
        self.assertAlmostEqual(t["price"], 10.1)
        self.assertEqual(t["qty"], float(int(t["qty"])))
        self.assertLessEqual(t["qty"] * t["price"] + t["fee"], 1000.0)
        self.assertAlmostEqual(r.cash.iloc[-1] + t["qty"] * t["price"] + t["fee"], 1000.0)

    def test_rebalance_restores_weights(self):
        rng = np.random.default_rng(1)
        n = 300
        p = frame(A=100 * np.cumprod(1 + rng.normal(0.001, 0.01, n)), B=50 * np.cumprod(1 + rng.normal(0, 0.01, n)))
        r = run(p, Rebalance(["A", "B"], [0.6, 0.4], "monthly"), 10000, Costs())
        reb_bars = sorted(set(r.trades["bar"]))
        self.assertGreater(len(reb_bars), 5)
        for b in reb_bars:
            w = r.weights_at(b)
            self.assertAlmostEqual(w["A"], 0.6, places=6)
            self.assertAlmostEqual(w["B"], 0.4, places=6)
        mid = [i for i in range(40, 60) if i not in reb_bars][0]
        self.assertGreater(abs(r.weights_at(mid)["A"] - 0.6), 1e-4)  # drifts between rebalances

    def test_no_lookahead_future_does_not_change_past(self):
        rng = np.random.default_rng(2)
        n, k = 400, 250
        base = 100 * np.cumprod(1 + rng.normal(0.0005, 0.01, n))
        alt = base.copy()
        alt[k + 1:] *= rng.uniform(0.2, 3.0, n - k - 1)
        for make, single in ((lambda: MACross(["A"], 10, 40), True), (lambda: Momentum(["A", "B"], 20, 1), False)):
            a = pd.DataFrame({"A": base, "B": base[::-1].copy()}, index=bdays(n))
            b = pd.DataFrame({"A": alt, "B": base[::-1].copy()}, index=bdays(n))
            if single:
                a, b = a[["A"]], b[["A"]]
            ra, rb = run(a, make(), 1000, Costs()), run(b, make(), 1000, Costs())
            pd.testing.assert_series_equal(ra.equity.iloc[: k + 1], rb.equity.iloc[: k + 1])
            self.assertTrue(ra.trades[ra.trades.bar <= k].equals(rb.trades[rb.trades.bar <= k]))

    def test_decision_only_sees_history(self):
        seen = []

        class Spy(BuyHold):
            def decide(self, i, hist, next_date):
                seen.append((i, len(hist), bool(hist.index[-1] < next_date)))
                return super().decide(i, hist, next_date)

        run(frame(A=[1, 2, 3, 4.0]), Spy(["A"]), 100, Costs())
        self.assertEqual(seen, [(0, 1, True), (1, 2, True), (2, 3, True)])

    def test_signal_trade_after_cross(self):
        up = np.concatenate([np.linspace(100, 50, 60), np.linspace(50, 150, 60)])
        r = run(frame(A=up), MACross(["A"], 5, 20), 1000, Costs())
        buys = r.trades[r.trades.side == "buy"]
        sma5, sma20 = pd.Series(up).rolling(5).mean(), pd.Series(up).rolling(20).mean()
        first_cross = int((sma5 > sma20).idxmax())
        self.assertEqual(int(buys.iloc[0]["bar"]), first_cross + 1)


class DataAndCliTests(unittest.TestCase):
    def write(self, d, name, text):
        p = Path(d) / name
        p.write_text(text, encoding="utf-8")
        return str(p)

    def test_loader_formats(self):
        with tempfile.TemporaryDirectory() as d:
            a = self.write(d, "a.csv", "Date,Close\n01/02/2020,$10.5\n01/03/2020,11\n01/06/2020,12\n")
            s, note = load_prices(a)
            self.assertEqual(s.index[0], pd.Timestamp("2020-01-02"))
            self.assertIn("dividends are ignored", note)
            b = self.write(d, "b.csv", "Date,Open,High,Low,Close,Adj Close,Volume\n2020-01-02,1,1,1,10,9,5\n2020-01-03,1,1,1,11,10,5\n2020-01-06,1,1,1,12,11,5\n")
            s, note = load_prices(b)
            self.assertEqual(s.iloc[0], 9.0)
            self.assertIn("adjusted", note)
            with self.assertRaises(DataError):
                load_prices(self.write(d, "c.csv", "Foo,Bar\n1,2\n"))

    def test_cli_end_to_end_walk_forward(self):
        rng = np.random.default_rng(3)
        n = 600
        with tempfile.TemporaryDirectory() as d:
            files = []
            for nm, mu in (("aaa", 0.0006), ("bbb", 0.0002)):
                px = 100 * np.cumprod(1 + rng.normal(mu, 0.01, n))
                f = Path(d) / f"{nm}.csv"
                pd.DataFrame({"Date": bdays(n).strftime("%Y-%m-%d"), "Close": px}).to_csv(f, index=False)
                files.append(str(f))
            out = Path(d) / "out"
            rc = bt_main(["--prices", *files, "--strategy", "ma", "--out", str(out), "--walk-forward", "70",
                          "--grid", "fast=5,10;slow=30,60", "--slippage-bps", "5", "--rf", "0.02"])
            self.assertEqual(rc, 0)
            rep = (out / "report.txt").read_text(encoding="utf-8")
            self.assertTrue(rep.startswith("CAUTION"))
            self.assertIn("Out-of-sample", rep)
            for f in ("equity_curve.csv", "equity_vs_benchmark.png", "drawdown.png", "rolling_1y_returns.png"):
                self.assertTrue((out / f).exists(), f)
            cfg = Path(d) / "c.json"
            cfg.write_text(json.dumps({"prices": ["aaa.csv", "bbb.csv"], "strategy": "dca", "monthly": 200}), encoding="utf-8")
            self.assertEqual(bt_main([str(cfg), "--out", str(Path(d) / "o2")]), 0)
            self.assertEqual(bt_main(["--out", str(Path(d) / "o3"), "--prices", files[0], "--strategy", "momentum"]), 2)


if __name__ == "__main__":
    unittest.main()
