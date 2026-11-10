import csv
import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

import statement2csv as s
from common import mask_numbers
from tests.pdfmaker import make_pdf, blank_pdf

SPLIT = [
    "EXAMPLE BANK  Statement Period 12/16/2024 - 01/15/2025",
    "Account Number 123456789012",
    "Beginning Balance                                 1,000.00",
    "Total Deposits                                    1,500.00",
    "Total Withdrawals                                   75.50",
    "Ending Balance                                    2,424.50",
    "Date    Description                    Debits      Credits     Balance",
    "12/20   GROCERY MART #12                  50.00                  950.00",
    "        CARD 4111 1111 1111 1234",
    "12/31   PAYROLL DEPOSIT                             1,500.00   2,450.00",
    "01/03   COFFEE SHOP                       25.50                2,424.50",
    "Page 1 of 1",
]
PAREN = [
    "Statement Period: Mar 1, 2025 - Mar 31, 2025",
    "Date  Description                        Amount",
    "03/02 STORE ONE                        (12.34)",
    "03/05 REFUND                            20.00 CR",
    "03/09 FUEL STOP                         45.10-",
    "Mar 12 MISC                              -5.00",
]


class T(unittest.TestCase):
    def parse(self, lines, **kw):
        return s.parse_pages(["\n".join(lines)], **kw)

    def test_split_columns_and_rollover(self):
        p = self.parse(SPLIT)
        self.assertEqual([(r.date, r.amount) for r in p.rows],
                         [("2024-12-20", -50.0), ("2024-12-31", 1500.0), ("2025-01-03", -25.5)])
        self.assertIn("4111", p.rows[0].desc)  # continuation joined
        self.assertEqual(p.rows[0].desc.split()[0], "GROCERY")

    def test_reconcile_ok_and_mismatch(self):
        p = self.parse(SPLIT)
        self.assertEqual(p.totals["begin"], 1000.0)
        self.assertTrue(all(c[3] for c in s.reconcile(p)))
        p.rows.pop()
        self.assertFalse(all(c[3] for c in s.reconcile(p)))

    def test_paren_crdr_trailing_minus_and_mon_dd(self):
        p = self.parse(PAREN)
        self.assertEqual([r.amount for r in p.rows], [-12.34, 20.0, -45.1, -5.0])
        self.assertEqual(p.rows[3].date, "2025-03-12")

    def test_unsigned_sections(self):
        p = self.parse(["Period 01/01/2025 - 01/31/2025", "Deposits and other credits", "01/04 PAY   100.00",
                        "Withdrawals", "01/05 SHOP   40.00"])
        self.assertEqual([r.amount for r in p.rows], [100.0, -40.0])

    def test_unsigned_flagged(self):
        p = self.parse(["Period 01/01/2025 - 01/31/2025", "01/04 PAY   100.00"])
        self.assertTrue(p.rows[0].flags)

    def test_no_year_error_flag(self):
        p = self.parse(["01/04 PAY   -10.00"])
        self.assertEqual(p.rows, [])  # unusable date skipped, with a note
        self.assertTrue(p.notes)
        p = self.parse(["01/04 PAY   -10.00"], year=2023)
        self.assertEqual(p.rows[0].date, "2023-01-04")
        self.assertTrue(p.rows[0].flags)

    def test_profile_regex(self):
        prof = {"name": "x", "row_regex": r"^(?P<date>\d{2}/\d{2})\s+(?P<desc>.+?)\s+(?P<amount>-?[\d,]+\.\d{2})$", "unsigned": "expense"}
        p = self.parse(["Period 01/01/2025 - 01/31/2025", "01/04 SHOP ONE   40.00", "01/06 X  -3.00"], profile=prof)
        self.assertEqual([r.amount for r in p.rows], [-40.0, -3.0])
        self.assertEqual(p.profile, "x")

    def test_masking(self):
        self.assertEqual(mask_numbers("ACCT 123456789012 ok"), "ACCT ****9012 ok")
        self.assertEqual(mask_numbers("4111 1111 1111 1234"), "****1234")
        self.assertEqual(mask_numbers("1,234,567.89 and 12/31"), "1,234,567.89 and 12/31")

    def test_end_to_end_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            pdf = Path(d) / "stmt.pdf"
            make_pdf([SPLIT], pdf)
            out = Path(d) / "out"
            buf = io.StringIO()
            with redirect_stdout(buf):
                rc = s.main([str(pdf), "--out", str(out)])
            self.assertEqual(rc, 0, buf.getvalue())
            with open(out / "stmt.csv", encoding="utf-8") as fh:
                rows = list(csv.reader(fh))
            self.assertEqual(rows[0], ["Date", "Description", "Amount"])
            self.assertEqual(len(rows), 4)
            self.assertNotIn("123456789012", buf.getvalue())
            self.assertEqual(os.listdir(d).count("stmt.pdf"), 1)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(s.main([str(pdf), "--dry-run"]), 0)

    def test_dry_run_mismatch_exit(self):
        bad = [l.replace("75.50", "99.00") for l in SPLIT]
        with tempfile.TemporaryDirectory() as d:
            pdf = Path(d) / "b.pdf"
            make_pdf([bad], pdf)
            with redirect_stdout(io.StringIO()):
                self.assertEqual(s.main([str(pdf), "--dry-run"]), 1)

    def test_scanned_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            pdf = Path(d) / "scan.pdf"
            blank_pdf(pdf)
            err = io.StringIO()
            with redirect_stderr(err):
                self.assertEqual(s.main([str(pdf), "--dry-run"]), 2)
            self.assertIn("scanned", err.getvalue())


if __name__ == "__main__":
    unittest.main()
