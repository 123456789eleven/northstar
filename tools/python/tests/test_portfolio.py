import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import portfolio_report as pr

SYN = {
    "app": "northstar", "version": 20, "exportedAt": "2025-03-01T00:00:00Z",
    "tables": {
        "balances": [
            {"date": "2025-01-01", "name": "Checking 123456789012", "kind": "asset", "balance": 1000},
            {"date": "2025-01-01", "name": "Brokerage", "kind": "asset", "balance": 5000},
            {"date": "2025-01-01", "name": "Card", "kind": "liability", "balance": 400},
            {"date": "2025-02-01", "name": "Brokerage", "kind": "asset", "balance": 5500},
        ],
        "holdings": [
            {"account": "Brokerage", "ticker": "AAA", "shares": 10, "price": 100, "costBasis": 800},
            {"account": "Brokerage", "ticker": "BBB", "shares": 5, "costBasis": 300},
        ],
        "priceHistory": [{"symbol": "BBB", "date": "2025-02-28", "close": 50}],
        "transactions": [
            {"date": "2025-01-05", "amount": 3000, "description": "PAYROLL ACME", "category": "Income"},
            {"date": "2025-01-06", "amount": -100, "description": "GROCERY MART #12", "category": "Groceries"},
            {"date": "2025-01-20", "amount": -50, "description": "GROCERY MART #44", "category": "Groceries"},
            {"date": "2025-01-21", "amount": -500, "description": "TRANSFER TO SAVINGS", "category": "Savings/Transfer"},
            {"date": "2025-02-05", "amount": 3000, "description": "PAYROLL ACME", "category": "Income"},
            {"date": "2025-02-09", "amount": -200, "description": "FUEL STOP", "category": "Transport"},
        ],
    },
}


class T(unittest.TestCase):
    def test_report(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "backup.json"
            f.write_text(json.dumps(SYN), encoding="utf-8")
            out = Path(d) / "rep"
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertEqual(pr.main([str(f), "--out", str(out)]), 0)
            for name in ("net_worth.png", "allocation_by_account.png", "allocation_by_ticker.png", "holdings.csv",
                         "monthly_spending_by_category.csv", "savings_rate_by_month.csv", "top_merchants.csv", "summary.txt"):
                self.assertTrue((out / name).exists(), name)
            h = (out / "holdings.csv").read_text()
            self.assertIn("AAA", h)
            sav = (out / "savings_rate_by_month.csv").read_text().splitlines()
            self.assertIn("2025-01,3000.0,150.0,2850.0,95.0", sav[1])  # transfer excluded
            self.assertEqual((out / "top_merchants.csv").read_text().splitlines()[1].split(",")[0], "GROCERY MART")
            self.assertNotIn("123456789012", (out / "summary.txt").read_text() + buf.getvalue())

    def test_unrealised(self):
        ht = pr.holdings_table(pr.table(SYN, "holdings", ["account", "ticker", "shares", "price", "priceDate", "costBasis"]),
                               pr.table(SYN, "priceHistory", ["symbol", "date", "close"]))
        a = ht[ht.ticker == "AAA"].iloc[0]
        b = ht[ht.ticker == "BBB"].iloc[0]
        self.assertEqual(a["unrealised_pl"], 200)
        self.assertEqual(b["value"], 250)
        self.assertEqual(b["unrealised_pl"], -50)

    def test_refuses_encrypted(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "x.enc.json"
            f.write_text("{}", encoding="utf-8")
            err = io.StringIO()
            with redirect_stderr(err):
                self.assertEqual(pr.main([str(f), "--out", str(Path(d) / "o")]), 2)
            self.assertIn("plain copy", err.getvalue())
            g = Path(d) / "y.json"
            g.write_text(json.dumps({"app": "northstar", "kind": "encrypted-backup", "v": 1}), encoding="utf-8")
            with redirect_stderr(io.StringIO()):
                self.assertEqual(pr.main([str(g), "--out", str(Path(d) / "o")]), 2)
            self.assertFalse((Path(d) / "o").exists())


if __name__ == "__main__":
    unittest.main()
