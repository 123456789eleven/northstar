# Northstar Python tools (offline)

Three small local tools for working with your own files. Generic code only: your real statements, price files and backups live in a private folder outside this repo (for example `Documents\northstar-private`), never in git (`*.pdf` and `tools/python/out/` are git-ignored).

**Privacy.** Everything runs on this computer. No tool imports or uses any network module (a test blocks sockets and runs every tool to prove it). Nothing is uploaded. Tools write only into the folder you pass with `--out`. Account and card numbers are masked to the last 4 digits in anything printed or written.

Interpreter (the isolated one with pypdf, pandas, matplotlib; install nothing else):
`C:\Users\bearf\.northstar-tools\pyenv\Scripts\python.exe`

Run all commands from `tools\python`. Below, `PY` means that interpreter path.

## 1. PDF statement to CSV

```
PY statement2csv.py "C:\Users\bearf\Documents\northstar-private\statements\jan.pdf" --dry-run
PY statement2csv.py "...\jan.pdf" --out "C:\Users\bearf\Documents\northstar-private\csv"
```
Writes `jan.csv` with `Date,Description,Amount` (ISO dates, expenses negative, income positive), ready for the app's CSV import. `--dry-run` prints a preview, flags rows it is unsure about, and reconciles the rows against statement totals (credits, debits, beginning/ending balance) when it finds them; exit code 1 on mismatch (a real run then refuses to write unless `--force`). Other flags: `--year` (when no statement period is found), `--unsigned income|expense`, `--profile NAME`, `--profiles FILE`, `--show-text N` (print the first N extracted lines, numbers masked, to help build a profile).

Handles: one Amount column with `-`, parentheses, trailing `-`, `CR`/`DR`; separate Debits/Credits columns (found from the header row); dates `MM/DD`, `MM/DD/YY`, `MM/DD/YYYY`, `Mon DD`, ISO; year inferred from the statement period (December/January rollover handled); multi-line descriptions; headers, footers, running balances and summary tables skipped.

Limits: text PDFs only. A scanned image has no text; the tool says so and stops (no OCR, no guessing). Password-protected PDFs must be saved unprotected first. Unsigned amounts with no hint are assumed income and flagged. Always check the dry-run reconciliation before importing.

### Adding a statement profile (no code)
Edit `statement_profiles.json` (or pass `--profiles` with your own copy kept in the private folder). Run `--show-text 60` to see the lines, then add:
```
{ "name": "my-bank", "detect": "text that appears on every statement",
  "row_regex": "^(?P<date>\d{2}/\d{2})\s+(?P<desc>.+?)\s+(?P<amount>-?[\d,]+\.\d{2})\s+(?P<balance>[\d,]+\.\d{2})$",
  "skip": ["^Page \d+"], "unsigned": "expense",
  "period_regex": "(?P<start>\d{2}/\d{2}/\d{4})\s*-\s*(?P<end>\d{2}/\d{2}/\d{4})" }
```
Named groups: `date`, `desc`, and one or more of `amount`, `debit`, `credit`, `balance` (balance is ignored). `detect`, `skip`, `unsigned` (`income`/`expense`) and `period_regex` are optional. Continuation lines and totals still work. First profile whose `detect` matches wins; otherwise automatic detection is used.

## 2. Backtesting and portfolio research (`research/`)

Price CSVs you supply: `Date,Close` or `Date,Open,High,Low,Close,Volume` (any common date format; `--dayfirst` for DD/MM). If an adjusted-close column exists it is used and the report says so; otherwise Close is used and dividends are ignored.
```
PY -m research.backtest --prices a.csv --strategy buyhold --out OUT
PY -m research.backtest --prices a.csv b.csv c.csv --strategy rebalance --weights 0.5 0.3 0.2 --rebalance quarterly --out OUT
PY -m research.backtest --prices a.csv --strategy dca --monthly 500 --out OUT
PY -m research.backtest --prices a.csv --strategy ma --fast 50 --slow 200 --slippage-bps 5 --commission-pct 0.1 --out OUT
PY -m research.backtest --prices a.csv b.csv c.csv --strategy momentum --lookback 126 --top-n 1 --out OUT
PY -m research.backtest --prices a.csv --strategy ma --walk-forward 70 --grid "fast=10,20,50;slow=100,200" --out OUT
PY -m research.backtest config.json --out OUT
```
A config JSON uses the same names as the flags (`prices`, `strategy`, `weights`, `monthly`, `rf`, ...); paths are relative to the config file; flags override it. Output in `OUT`: `report.txt`, `equity_curve.csv`, `equity_vs_benchmark.png`, `drawdown.png`, `rolling_1y_returns.png`. Options: `--initial-cash`, `--commission-fixed`, `--whole-shares`, `--rf 0.03`, `--start/--end`.

Honest engine: a decision sees prices up to the close of bar i and trades at the close of bar i+1, after slippage and commission. Cash earns nothing, no taxes. Benchmark is buy and hold of the first file. Metrics: total return, CAGR, volatility, Sharpe, Sortino, max drawdown with peak/low/recovery dates, best/worst month, rolling 1-year distribution. Contributions (DCA) are excluded from returns (time-weighted). `--walk-forward N` fits `--grid` parameters on the first N% only, then reports the rest separately.

Limits: daily/weekly/monthly bars only, long-only, no taxes, no intraday, no dividends unless adjusted close. Every report begins with a caution: a backtest is not a forecast, and overfitting is likely. Educational illustration, not advice.

## 3. Portfolio report from a Northstar backup

Export a PLAIN backup in the app (Settings, Backup) into your private folder.
```
PY portfolio_report.py "C:\Users\bearf\Documents\northstar-private\northstar-backup.json" --out "C:\Users\bearf\Documents\northstar-private\report"
```
Writes net worth over time, allocation by account and by ticker, holdings table (cost basis, unrealised P/L using prices in the export), monthly spending by category, savings rate by month, top merchants, and `summary.txt`. Transfers are excluded from spending and income. Encrypted `.enc.json` files are refused: export a plain copy, or restore the encrypted file in the app and export a plain one.

## Tests
`run_tests.cmd` (same as `PY -m unittest discover -s tests -t .`). All fixtures are synthetic.
