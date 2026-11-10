"""Proves the tools never touch the network: sockets are blocked while every tool is imported and run."""
import ast
import io
import json
import socket
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FORBIDDEN = {"requests", "urllib", "urllib3", "http", "socket", "ftplib", "smtplib", "httpx", "aiohttp", "webbrowser", "telnetlib"}


class Blocked(AssertionError):
    pass


class T(unittest.TestCase):
    def setUp(self):
        self._saved = (socket.socket, socket.create_connection, socket.getaddrinfo)

        def boom(*a, **k):
            raise Blocked("network access attempted")
        socket.socket = boom
        socket.create_connection = boom
        socket.getaddrinfo = boom

    def tearDown(self):
        socket.socket, socket.create_connection, socket.getaddrinfo = self._saved

    def test_no_network_imports_in_source(self):
        for f in ROOT.rglob("*.py"):
            if "tests" in f.parts:
                continue
            for node in ast.walk(ast.parse(f.read_text(encoding="utf-8"))):
                names = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""] if isinstance(node, ast.ImportFrom) else []
                for n in names:
                    self.assertNotIn(n.split(".")[0], FORBIDDEN, f"{f.name} imports {n}")

    def test_all_tools_run_with_sockets_blocked(self):
        import portfolio_report
        import statement2csv
        from research import backtest
        from tests.pdfmaker import make_pdf
        from tests.test_portfolio import SYN
        from tests.test_statement import SPLIT
        with tempfile.TemporaryDirectory() as d, redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            d = Path(d)
            make_pdf([SPLIT], d / "s.pdf")
            self.assertEqual(statement2csv.main([str(d / "s.pdf"), "--out", str(d / "o1")]), 0)
            (d / "b.json").write_text(json.dumps(SYN), encoding="utf-8")
            self.assertEqual(portfolio_report.main([str(d / "b.json"), "--out", str(d / "o2")]), 0)
            idx = pd.bdate_range("2020-01-01", periods=120)
            pd.DataFrame({"Date": idx.strftime("%Y-%m-%d"), "Close": 100 + np.arange(120.0)}).to_csv(d / "p.csv", index=False)
            self.assertEqual(backtest.main(["--prices", str(d / "p.csv"), "--out", str(d / "o3")]), 0)
            # nothing written outside the --out folders
            self.assertEqual(sorted(p.name for p in d.iterdir()), ["b.json", "o1", "o2", "o3", "p.csv", "s.pdf"])


if __name__ == "__main__":
    unittest.main()
