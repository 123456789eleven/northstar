#!/usr/bin/env python
"""Convert a text-based bank/brokerage PDF statement to a Northstar-importable CSV.

Offline. Reads one PDF (pypdf), writes Date,Description,Amount (ISO dates, expenses
negative, income positive) only into the folder given by --out. Never prints full
account numbers (long digit runs are masked to the last 4).
"""
import argparse
import csv
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import eprint, mask_numbers  # noqa: E402

MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}
_MON = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"
DATE_RE = re.compile(
    rf"(?P<iso>\d{{4}}-\d{{2}}-\d{{2}})(?![\d])"
    rf"|(?P<num>\d{{1,2}}/\d{{1,2}}(?:/\d{{4}}|/\d{{2}})?)(?![\d/])"
    rf"|(?P<mon>{_MON}\s+\d{{1,2}}(?:,?\s+\d{{4}})?)(?!\d)",
    re.I,
)
FULL_DATE = rf"(?:\d{{4}}-\d{{2}}-\d{{2}}|\d{{1,2}}/\d{{1,2}}/(?:\d{{4}}|\d{{2}})|{_MON}\s+\d{{1,2}},?\s+\d{{4}})"
PERIOD_RE = re.compile(rf"(?P<start>{FULL_DATE})\s*(?:-|–|to|through|thru)\s*(?P<end>{FULL_DATE})", re.I)
MONEY_RE = re.compile(
    r"(?<![\w/.,])(?P<open>\()?(?P<s1>[+-])?\s?\$?\s?(?P<s2>[+-])?(?P<num>\d{1,3}(?:,\d{3})+|\d+)\.(?P<dec>\d{2})"
    r"(?P<close>\))?(?P<trail>-)?(?:\s?(?P<crdr>CR|DR))?(?![\w/])",
    re.I,
)
BALANCE_LINE = re.compile(
    r"\b(beginning|ending|opening|closing|previous|new|running|daily|starting)\s+balance\b|balance\s+(forward|brought)|\bsubtotal\b", re.I
)
GENERIC_SKIP = re.compile(
    r"^(page\s+\d+|.*\bpage\s+\d+\s+of\s+\d+|total\b|date\s+(posted\s+)?description|.*\bcontinued\b.*|.*customer service.*"
    r"|.*statement (period|date).*|.*account (number|summary).*)",
    re.I,
)
FOOTER = re.compile(r"(page\s+\d+|customer service|www\.|https?:|@\w|member fdic|statement period|account number|continued)", re.I)
HEADER_WORDS = {
    "debit": "debit", "debits": "debit", "withdrawal": "debit", "withdrawals": "debit",
    "credit": "credit", "credits": "credit", "deposit": "credit", "deposits": "credit",
    "amount": "amount", "balance": "balance",
}
SECTION = re.compile(
    r"^(other\s+)?(deposits?|credits?|withdrawals?|debits?|checks?(\s+paid)?|purchases?|payments?|fees?|charges?|additions?|subtractions?)"
    r"(\s*(and|&|/)\s*(other\s+)?(deposits?|credits?|withdrawals?|debits?|additions?|subtractions?|charges?|fees?|adjustments?|payments?))?"
    r"(\s*\(continued\))?:?$",
    re.I,
)
TOT_CREDIT = re.compile(r"^(total\s+)?(deposits(\s+and\s+(other\s+)?(credits|additions))?|credits|additions|payments\s+and\s+(other\s+)?credits)\b", re.I)
TOT_DEBIT = re.compile(r"^(total\s+)?(withdrawals(\s+and\s+(other\s+)?debits)?|debits|purchases|checks(\s+paid)?|fees(\s+charged)?|charges|subtractions)\b", re.I)
BEGIN_RE = re.compile(r"(beginning|opening|previous|starting)\s+balance", re.I)
END_RE = re.compile(r"(ending|closing|new)\s+balance", re.I)


class StatementError(Exception):
    pass


@dataclass
class Money:
    value: float
    sign: object  # -1, +1 or None (unsigned)
    end: int = 0
    start: int = 0


@dataclass
class Row:
    date: str
    desc: str
    mag: float
    sign: object
    role: str
    section: object
    flags: list = field(default_factory=list)
    conts: int = 0

    @property
    def amount(self):
        return round(self.mag * (self.sign or 1), 2)


def parse_money_match(m):
    v = float((m.group("num") + "." + m.group("dec")).replace(",", ""))
    neg = bool(m.group("open") or m.group("trail") or "-" in (m.group("s1"), m.group("s2")))
    pos = "+" in (m.group("s1"), m.group("s2"))
    crdr = (m.group("crdr") or "").upper()
    if crdr == "DR":
        neg = True
    if crdr == "CR":
        pos, neg = True, False
    sign = -1 if neg else (1 if pos else None)
    return Money(v, sign, m.end(), m.start())


def parse_money(text):
    m = MONEY_RE.search(text or "")
    return parse_money_match(m) if m else None


# ---------------------------------------------------------------- text extraction
def extract_pages(path):
    from pypdf import PdfReader
    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted and not reader.decrypt(""):
            raise StatementError("The PDF is password protected. Open it, save an unprotected copy, and try again.")
    except StatementError:
        raise
    except Exception as e:  # noqa: BLE001
        raise StatementError(f"Could not read the file as a PDF ({type(e).__name__}).")
    pages = []
    for p in reader.pages:
        try:
            t = p.extract_text(extraction_mode="layout")
        except Exception:  # noqa: BLE001
            t = p.extract_text() or ""
        pages.append(t or "")
    if sum(len(t.strip()) for t in pages) < 40:
        raise StatementError(
            "This PDF has no readable text, so it is probably a scanned image. This tool does not do OCR and will not guess. "
            "Download the statement again from your bank's website as a text PDF (or use its CSV export)."
        )
    return pages


# ---------------------------------------------------------------- dates
def parse_full_date(s):
    s = s.strip()
    try:
        m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
        if m:
            return date(int(m[1]), int(m[2]), int(m[3]))
        m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2}|\d{4})", s)
        if m:
            y = int(m[3])
            return date(y + 2000 if y < 100 else y, int(m[1]), int(m[2]))
        m = re.fullmatch(rf"({_MON})\s+(\d{{1,2}}),?\s+(\d{{4}})", s, re.I)
        if m:
            return date(int(m[3]), MONTHS[m[1][:3].lower()], int(m[2]))
    except ValueError:
        return None
    return None


def find_period(text, regex=None):
    rx = re.compile(regex, re.I) if regex else PERIOD_RE
    for m in rx.finditer(text):
        s, e = parse_full_date(m.group("start")), parse_full_date(m.group("end"))
        if s and e and s <= e and (e - s).days < 400:
            return s, e
    return None


def resolve_date(tok, period, year):
    """Returns (iso or None, flag or None). tok is the date text as printed."""
    full = parse_full_date(tok)
    if full:
        return full.isoformat(), None
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})", tok.strip())
    if m:
        mo, d = int(m[1]), int(m[2])
    else:
        m = re.fullmatch(rf"({_MON})\s+(\d{{1,2}})", tok.strip(), re.I)
        if not m:
            return None, "unreadable date"
        mo, d = MONTHS[m[1][:3].lower()], int(m[2])
    if period:
        s, e = period
        best = None
        for y in range(s.year - 1, e.year + 2):
            try:
                c = date(y, mo, d)
            except ValueError:
                continue
            dist = 0 if s <= c <= e else min(abs((c - s).days), abs((c - e).days))
            if best is None or dist < best[0]:
                best = (dist, c)
        if best is None:
            return None, "invalid date"
        return best[1].isoformat(), ("date far outside statement period" if best[0] > 7 else None)
    if year:
        try:
            return date(year, mo, d).isoformat(), "year taken from --year, not the statement"
        except ValueError:
            return None, "invalid date"
    return None, "no year (statement period not found; pass --year)"


# ---------------------------------------------------------------- parsing
def _clean(s):
    return re.sub(r"\s+", " ", s).strip(" -–|")


def header_columns(raw):
    cols = []
    for m in re.finditer(r"[A-Za-z]+", raw):
        role = HEADER_WORDS.get(m.group(0).lower())
        if role:
            cols.append((role, m.end()))
    return cols if len({r for r, _ in cols}) >= 2 else None


def load_profiles(path):
    p = Path(path)
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8")).get("profiles", [])


def pick_profile(profiles, text, name=None):
    for p in profiles:
        if name and p.get("name") == name:
            return p
        if not name and p.get("detect") and re.search(p["detect"], text, re.I):
            return p
    if name:
        raise StatementError(f"No profile named '{name}' in the profiles file.")
    return None


@dataclass
class Parsed:
    rows: list
    totals: dict
    period: object
    profile: object
    notes: list


def assign_columns(toks, cols):
    """Map money tokens to roles using header column right edges; plain 'amount' when no header."""
    if not cols:
        return [("amount", t) for t in toks]
    return [(min(cols, key=lambda c: abs(c[1] - t.end))[0], t) for t in toks]


def parse_pages(pages, profile=None, year=None, unsigned=None):
    text = "\n".join(pages)
    period = find_period(text, profile.get("period_regex") if profile else None) or (find_period(text) if profile else None)
    skip_extra = [re.compile(x, re.I) for x in (profile or {}).get("skip", [])]
    row_rx = re.compile(profile["row_regex"], re.I) if profile and profile.get("row_regex") else None
    totals = {"credit": [], "debit": [], "begin": None, "end": None}
    rows, notes = [], []
    st = {"cols": None, "section": None, "last": None, "pending": None}

    def add_row(tok, desc, entries):
        iso, flag = resolve_date(tok, period, year)
        if not iso:
            notes.append(f"skipped a line with an unusable date: {flag}")
            st["last"] = None
            return
        non_bal = [(r, m) for r, m in entries if r != "balance"]
        if not non_bal:
            st["last"] = None
            return
        role, money = non_bal[0]
        r = Row(iso, _clean(desc), money.value, money.sign, role, st["section"])
        if flag:
            r.flags.append(flag)
        if len(non_bal) > 1:
            r.flags.append("several amounts on the line; used the first")
        if role == "debit":
            r.sign = -1
        elif role == "credit":
            r.sign = 1
        rows.append(r)
        st["last"] = r

    for page in pages:
        st["cols"] = None
        for raw in page.splitlines():
            raw = raw.rstrip()
            s = raw.strip()
            if not s:
                st["last"] = None
                continue
            mny = list(MONEY_RE.finditer(s))
            if mny and not DATE_RE.match(s):
                v = parse_money_match(mny[-1]).value
                if TOT_CREDIT.search(s):
                    totals["credit"].append(v)
                elif TOT_DEBIT.search(s):
                    totals["debit"].append(v)
                elif BEGIN_RE.search(s) and totals["begin"] is None:
                    totals["begin"] = v
                elif END_RE.search(s) and totals["end"] is None:
                    totals["end"] = v
            hc = header_columns(raw)
            if hc and not DATE_RE.match(s) and not mny:
                st["cols"], st["last"], st["pending"] = hc, None, None
                continue
            if any(x.search(s) for x in skip_extra) or GENERIC_SKIP.match(s):
                st["last"] = st["pending"] = None
                continue
            if SECTION.match(s) and not mny:
                low = s.lower()
                cr = bool(re.search(r"deposit|credit|addition", low))
                dr = bool(re.search(r"withdrawal|debit|check|purchase|fee|charge|subtraction", low))
                st["section"] = "credit" if cr and not dr else "debit" if dr and not cr else None
                st["last"] = st["pending"] = None
                continue

            entries, desc, tok = [], None, None
            if row_rx:
                m = row_rx.search(s)
                if m:
                    g = m.groupdict()
                    tok, desc = g.get("date"), g.get("desc") or ""
                    for role in ("amount", "debit", "credit", "balance"):
                        mm = parse_money(g.get(role)) if g.get(role) else None
                        if mm:
                            entries.append((role, mm))
            else:
                lead = len(raw) - len(raw.lstrip())
                dm = DATE_RE.match(raw, lead)
                if dm and not BALANCE_LINE.search(s):
                    rest_pos = dm.end()
                    gap = len(raw[rest_pos:]) - len(raw[rest_pos:].lstrip())
                    dm2 = DATE_RE.match(raw, rest_pos + gap)
                    if dm2 and gap <= 12:
                        rest_pos = dm2.end()
                    toks = [parse_money_match(m) for m in MONEY_RE.finditer(raw, rest_pos)]
                    tok = dm.group(0)
                    if toks:
                        desc = raw[rest_pos:toks[0].start]
                        entries = assign_columns(toks, st["cols"])
                        if len(entries) >= 2 and not st["cols"]:
                            entries = [entries[0]] + [("balance", m) for _, m in entries[1:]]
                            add_row(tok, desc, entries)
                            if rows:
                                rows[-1].flags.append("two numbers on the line; assumed the second is a running balance")
                            continue
                    else:
                        st["pending"] = (tok, raw[rest_pos:])
                        st["last"] = None
                        continue
                elif st["pending"] and mny and not dm:
                    toks = [parse_money_match(m) for m in MONEY_RE.finditer(raw)]
                    tok = st["pending"][0]
                    desc = st["pending"][1] + " " + raw[:toks[0].start]
                    entries = assign_columns(toks, st["cols"])
            if tok and entries:
                st["pending"] = None
                add_row(tok, desc, entries)
                continue
            st["pending"] = None
            last = st["last"]
            if last is not None and not mny and not FOOTER.search(s) and len(last.desc) < 250:
                last.desc = _clean(last.desc + " " + s)
                last.conts += 1
                continue
            st["last"] = None

    neg_seen = any(r.role == "amount" and r.sign == -1 for r in rows)
    pos_seen = any(r.role == "amount" and r.sign == 1 for r in rows)
    sec_seen = any(r.role == "amount" and r.sign is None and r.section for r in rows)
    unsure_default = False
    if unsigned:
        default = 1 if unsigned == "income" else -1
    elif profile and profile.get("unsigned"):
        default = 1 if profile["unsigned"] == "income" else -1
    elif neg_seen:
        default = 1
    elif pos_seen:
        default = -1
    else:
        default, unsure_default = 1, True
    for r in rows:
        if r.sign is None:
            if r.section:
                r.sign = 1 if r.section == "credit" else -1
            else:
                r.sign = default
                if unsure_default and not sec_seen:
                    r.flags.append("amount has no sign or section hint; assumed income (use --unsigned expense if wrong)")
        if r.conts > 2:
            r.flags.append("long multi-line description")
        if not r.desc:
            r.flags.append("empty description")
    return Parsed(rows, totals, period, profile.get("name") if profile else None, notes)


# ---------------------------------------------------------------- reconciliation and output
def reconcile(p):
    checks = []
    pos = round(sum(r.amount for r in p.rows if r.amount > 0), 2)
    neg = round(-sum(r.amount for r in p.rows if r.amount < 0), 2)
    net = round(sum(r.amount for r in p.rows), 2)
    for key, got, label in (("credit", pos, "income (credits) total"), ("debit", neg, "expense (debits) total")):
        vals = p.totals[key]
        if vals:
            ok = abs(vals[0] - got) < 0.01 or abs(sum(vals) - got) < 0.01
            checks.append((label, got, vals[0], ok))
    b, e = p.totals["begin"], p.totals["end"]
    if b is not None and e is not None:
        ok = abs((e - b) - net) < 0.01 or abs((b - e) - net) < 0.01
        checks.append(("balance change vs net of rows", abs(net), abs(round(e - b, 2)), ok))
    return checks


def show_table(p, limit=60):
    lines = [f"{'Date':<11}{'Description':<44}{'Amount':>12}  Flag"]
    for r in p.rows[:limit]:
        lines.append(f"{r.date:<11}{mask_numbers(r.desc)[:42]:<44}{r.amount:>12,.2f}  {'?' if r.flags else ''}")
    if len(p.rows) > limit:
        lines.append(f"... and {len(p.rows) - limit} more rows")
    return "\n".join(lines)


def write_csv(rows, outfile):
    with open(outfile, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Description", "Amount"])
        for r in rows:
            w.writerow([r.date, mask_numbers(r.desc), f"{r.amount:.2f}"])


def main(argv=None):
    ap = argparse.ArgumentParser(description="Convert a text-based PDF bank/brokerage statement to a Northstar CSV (offline).")
    ap.add_argument("pdf")
    ap.add_argument("--out", help="folder to write <name>.csv into (required unless --dry-run)")
    ap.add_argument("--dry-run", action="store_true", help="preview + reconciliation, write nothing")
    ap.add_argument("--profile", help="force a profile name from the profiles file")
    ap.add_argument("--profiles", default=str(Path(__file__).with_name("statement_profiles.json")))
    ap.add_argument("--year", type=int, help="year to use when the statement period cannot be found")
    ap.add_argument("--unsigned", choices=["income", "expense"], help="meaning of amounts with no sign")
    ap.add_argument("--force", action="store_true", help="write the CSV even if reconciliation fails")
    ap.add_argument("--show-text", type=int, metavar="N", help="print the first N extracted lines (numbers masked) to help build a profile")
    a = ap.parse_args(argv)
    try:
        pages = extract_pages(a.pdf)
        if a.show_text:
            for ln in [x for pg in pages for x in pg.splitlines() if x.strip()][: a.show_text]:
                print(mask_numbers(ln))
            return 0
        profile = pick_profile(load_profiles(a.profiles), "\n".join(pages), a.profile)
        p = parse_pages(pages, profile, a.year, a.unsigned)
    except StatementError as e:
        eprint("Error:", e)
        return 2
    if not p.rows:
        eprint("Error: no transactions were found. Run with --show-text 80 to see what was extracted, then add a profile (see README).")
        return 2
    per = f"{p.period[0]} to {p.period[1]}" if p.period else "not found"
    print(f"Profile: {p.profile or 'automatic layout detection'}; period: {per}")
    print(show_table(p) if a.dry_run else f"{len(p.rows)} transactions parsed.")
    unsure = [r for r in p.rows if r.flags]
    if unsure:
        print(f"\n{len(unsure)} row(s) to double-check:")
        for r in unsure[:15]:
            print(f"  {r.date} {mask_numbers(r.desc)[:30]!r}: {'; '.join(r.flags)}")
    for n in p.notes[:5]:
        print("Note:", n)
    checks = reconcile(p)
    print("\nReconciliation:")
    if not checks:
        print("  No statement totals found in the text, so the rows cannot be checked. Compare by eye.")
    for label, got, want, ok in checks:
        print(f"  {'OK      ' if ok else 'MISMATCH'} {label}: rows {got:,.2f} vs statement {want:,.2f}")
    bad = any(not c[3] for c in checks)
    if bad:
        print("  Some rows are missing, duplicated or have the wrong sign. Do not import without checking.")
    if a.dry_run:
        return 1 if bad else 0
    if not a.out:
        eprint("Error: --out FOLDER is required (or use --dry-run).")
        return 2
    if bad and not a.force:
        eprint("Not writing the CSV because reconciliation failed. Fix the profile, or pass --force.")
        return 1
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    dest = out / (Path(a.pdf).stem + ".csv")
    write_csv(p.rows, dest)
    print(f"Wrote {len(p.rows)} rows to {dest}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
