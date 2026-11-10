#!/usr/bin/env python
"""Report from a Northstar PLAIN JSON backup export. Offline; writes only into --out.

Needs the tables transactions, balances, holdings (and optionally priceHistory) from the
app's Settings > Backup export. Encrypted (.enc.json) backups are refused.
Account names are masked (long digit runs keep only the last 4).
"""
import argparse
import json
import re
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import mask_numbers  # noqa: E402

ENC_MESSAGE = (
    "This is an encrypted Northstar backup (.enc.json); this tool cannot and should not read it.\n"
    "Either export a plain copy (Settings > Backup > export without encryption) into your private folder, "
    "or restore the encrypted file inside the app first and export a plain copy from there."
)
BLUE, GREY, RED = "#2f6f9f", "#8a8a8a", "#c0392b"


class ReportError(Exception):
    pass


def load_backup(path):
    p = Path(path)
    if p.name.lower().endswith(".enc.json"):
        raise ReportError(ENC_MESSAGE)
    try:
        data = json.loads(p.read_text(encoding="utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        raise ReportError(f"Could not read the file as JSON ({type(e).__name__}).")
    if isinstance(data, dict) and data.get("kind") == "encrypted-backup":
        raise ReportError(ENC_MESSAGE)
    if not isinstance(data, dict) or data.get("app") != "northstar" or not isinstance(data.get("tables"), dict):
        raise ReportError("This does not look like a Northstar backup export (expected app 'northstar' with a tables object).")
    return data


def table(data, name, cols):
    rows = data["tables"].get(name) or []
    df = pd.DataFrame(rows)
    for c in cols:
        if c not in df.columns:
            df[c] = pd.NA
    return df


def is_transfer(cat):
    return bool(re.search(r"transfer|^savings$", str(cat), re.I))


def merchant(desc):
    s = re.sub(r"[#*]\S*|\d+", " ", str(desc).upper())
    s = re.sub(r"[^A-Z& ]", " ", s)
    return " ".join(s.split()[:3]) or "(blank)"


def net_worth_series(bal):
    if bal.empty:
        return pd.DataFrame()
    bal = bal.copy()
    bal["date"] = pd.to_datetime(bal["date"], errors="coerce")
    bal = bal.dropna(subset=["date"])
    bal["balance"] = pd.to_numeric(bal["balance"], errors="coerce").fillna(0.0)
    bal["signed"] = bal.apply(lambda r: -r["balance"] if r["kind"] == "liability" else r["balance"], axis=1)
    piv = bal.pivot_table(index="date", columns="name", values="signed", aggfunc="last").sort_index().ffill().fillna(0.0)
    assets = [n for n in piv.columns if (bal[(bal["name"] == n)]["kind"] != "liability").all()]
    out = pd.DataFrame({"net_worth": piv.sum(axis=1)})
    out["assets"] = piv[assets].sum(axis=1) if assets else 0.0
    out["liabilities"] = out["net_worth"] - out["assets"]
    return out


def holdings_table(hold, prices):
    if hold.empty:
        return pd.DataFrame()
    last = {}
    if not prices.empty:
        pr = prices.sort_values("date").groupby("symbol").last()
        last = pr["close"].to_dict()
    h = hold.copy()
    h["shares"] = pd.to_numeric(h["shares"], errors="coerce")
    h["price"] = pd.to_numeric(h["price"], errors="coerce")
    h["price"] = h.apply(lambda r: r["price"] if pd.notna(r["price"]) else last.get(r["ticker"]), axis=1)
    h["cost_basis"] = pd.to_numeric(h["costBasis"], errors="coerce")
    h["value"] = h["shares"] * h["price"]
    h["unrealised_pl"] = h["value"] - h["cost_basis"]
    h["unrealised_pct"] = h["unrealised_pl"] / h["cost_basis"].where(h["cost_basis"] > 0) * 100
    h["account"] = h["account"].astype(str).map(mask_numbers)
    cols = ["ticker", "account", "shares", "price", "priceDate", "value", "cost_basis", "unrealised_pl", "unrealised_pct"]
    return h[cols].sort_values("value", ascending=False, na_position="last")


def hbar(series, title, path, fmt="${:,.0f}"):
    s = series[series > 0].sort_values()
    fig, ax = plt.subplots(figsize=(8, max(2.5, 0.4 * len(s) + 1)))
    if s.empty:
        ax.text(0.5, 0.5, "No data", ha="center", transform=ax.transAxes)
    else:
        ax.barh([mask_numbers(str(i)) for i in s.index], s.values, color=BLUE)
        tot = s.sum()
        for y, v in enumerate(s.values):
            ax.text(v, y, f"  {fmt.format(v)} ({v / tot * 100:.0f}%)", va="center", fontsize=8)
        ax.set_xlim(0, s.max() * 1.3)
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


def build(data, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    lines = ["Northstar portfolio report (offline; generated from a plain backup export)", f"Backup exported: {data.get('exportedAt', 'unknown')}", ""]
    bal = table(data, "balances", ["date", "name", "kind", "balance"])
    tx = table(data, "transactions", ["date", "amount", "description", "category"])
    hold = table(data, "holdings", ["account", "ticker", "shares", "price", "priceDate", "costBasis"])
    prices = table(data, "priceHistory", ["symbol", "date", "close"])
    made = []

    nw = net_worth_series(bal)
    if not nw.empty:
        nw.round(2).to_csv(out / "net_worth.csv", index_label="Date")
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(nw.index, nw["net_worth"], color=BLUE, label="Net worth")
        ax.plot(nw.index, nw["assets"], color=GREY, lw=1, label="Assets")
        ax.set_title("Net worth over time")
        ax.legend()
        ax.grid(alpha=0.25)
        fig.tight_layout()
        fig.savefig(out / "net_worth.png", dpi=110)
        plt.close(fig)
        made += ["net_worth.png", "net_worth.csv"]
        lines.append(f"Net worth: {nw['net_worth'].iloc[-1]:,.2f} on {nw.index[-1]:%Y-%m-%d} (first snapshot {nw.index[0]:%Y-%m-%d}).")
        b = bal.copy()
        b["date"] = pd.to_datetime(b["date"], errors="coerce")
        b["balance"] = pd.to_numeric(b["balance"], errors="coerce")
        latest = b.sort_values("date").groupby("name").last()
        by_acct = latest[latest["kind"] != "liability"]["balance"]
        hbar(by_acct, "Allocation by account (latest balances, assets)", out / "allocation_by_account.png")
        made.append("allocation_by_account.png")
    else:
        lines.append("Net worth: no balance snapshots in this export.")

    ht = holdings_table(hold, prices)
    if not ht.empty:
        ht.round(4).to_csv(out / "holdings.csv", index=False)
        hbar(ht.groupby("ticker")["value"].sum(), "Allocation by ticker (shares x price in export)", out / "allocation_by_ticker.png")
        made += ["holdings.csv", "allocation_by_ticker.png"]
        v, c = ht["value"].sum(), ht["cost_basis"].sum()
        known = ht["cost_basis"].notna() & ht["value"].notna()
        pl = (ht["value"] - ht["cost_basis"])[known].sum()
        lines.append(f"Holdings: {len(ht)} positions, market value {v:,.2f}; unrealised P/L {pl:,.2f} on {int(known.sum())} positions with a cost basis (total {c:,.2f}).")
        missing = ht[ht["price"].isna()]["ticker"].tolist()
        if missing:
            lines.append(f"  No price in the export for: {', '.join(map(str, missing))} (left out of values).")
    else:
        lines.append("Holdings: none in this export.")

    if not tx.empty:
        tx["date"] = pd.to_datetime(tx["date"], errors="coerce")
        tx["amount"] = pd.to_numeric(tx["amount"], errors="coerce").astype(float)
        tx = tx.dropna(subset=["date", "amount"])
        tx["month"] = tx["date"].dt.to_period("M").astype(str)
        tx["category"] = tx["category"].fillna("Uncategorized")
        real = tx[~tx["category"].map(is_transfer)]
        spend = real[(real["amount"] < 0) & (real["category"] != "Income")]
        inc = real[real["amount"] > 0]
        if not spend.empty:
            sp = spend.assign(spent=-spend["amount"]).pivot_table(index="month", columns="category", values="spent", aggfunc="sum", fill_value=0.0)
            sp["Total"] = sp.sum(axis=1)
            sp.round(2).to_csv(out / "monthly_spending_by_category.csv")
            fig, ax = plt.subplots(figsize=(9, 4.5))
            top = sp.drop(columns="Total")
            keep = top.sum().sort_values(ascending=False).head(8).index
            plot = top[keep].copy()
            if len(top.columns) > len(keep):
                plot["Other"] = top.drop(columns=keep).sum(axis=1)
            plot.plot(kind="bar", stacked=True, ax=ax, colormap="tab20", width=0.8)
            ax.set_title("Monthly spending by category")
            ax.legend(fontsize=7, ncol=2)
            fig.tight_layout()
            fig.savefig(out / "monthly_spending.png", dpi=110)
            plt.close(fig)
            made += ["monthly_spending_by_category.csv", "monthly_spending.png"]
            mm = spend.assign(merchant=spend["description"].map(merchant), spent=-spend["amount"]).groupby("merchant")["spent"].agg(["sum", "count"])
            mm = mm.sort_values("sum", ascending=False).head(25)
            mm.round(2).to_csv(out / "top_merchants.csv", index_label="Merchant")
            made.append("top_merchants.csv")
            lines.append(f"Spending: {sp['Total'].sum():,.2f} over {len(sp)} months (transfers excluded). Top merchant group: {mm.index[0]} ({mm['sum'].iloc[0]:,.2f}).")
        months = sorted(set(real["month"]))
        if months:
            income = inc.groupby("month")["amount"].sum().astype(float).reindex(months, fill_value=0.0)
            spent = (-spend.groupby("month")["amount"].sum()).astype(float).reindex(months, fill_value=0.0)
            sr = pd.DataFrame({"income": income, "spending": spent})
            sr["saved"] = sr["income"] - sr["spending"]
            sr["savings_rate_pct"] = (sr["saved"] / sr["income"].where(sr["income"] > 0) * 100)
            sr.round(2).to_csv(out / "savings_rate_by_month.csv", index_label="Month")
            fig, ax = plt.subplots(figsize=(9, 3.5))
            ax.bar(sr.index, sr["savings_rate_pct"].fillna(0), color=[BLUE if (x or 0) >= 0 else RED for x in sr["savings_rate_pct"]])
            ax.axhline(0, color="black", lw=0.6)
            ax.set_ylabel("% of income")
            ax.set_title("Savings rate by month")
            plt.setp(ax.get_xticklabels(), rotation=60, ha="right", fontsize=7)
            fig.tight_layout()
            fig.savefig(out / "savings_rate.png", dpi=110)
            plt.close(fig)
            made += ["savings_rate_by_month.csv", "savings_rate.png"]
            tot_i, tot_s = sr["income"].sum(), sr["spending"].sum()
            if tot_i > 0:
                lines.append(f"Savings rate overall: {(tot_i - tot_s) / tot_i * 100:.1f}% of income (income {tot_i:,.2f}, spending {tot_s:,.2f}).")
    else:
        lines.append("Transactions: none in this export.")
    lines += ["", "Files: " + ", ".join(made), "", "Illustration only. Not investment, tax or financial advice."]
    (out / "summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(description="Report from a plain Northstar JSON backup (offline).")
    ap.add_argument("backup")
    ap.add_argument("--out", required=True, help="folder to write the report into")
    a = ap.parse_args(argv)
    try:
        data = load_backup(a.backup)
        lines = build(data, a.out)
    except ReportError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    print("\n".join(lines[2:-2]))
    print(f"Report written to {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
