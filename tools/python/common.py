"""Shared helpers. Offline only: no network modules are used anywhere in this folder."""
import re
import sys

_LONG_DIGITS = re.compile(r"(?<![\d.,])\d{7,}(?!\d|[.,]\d)")
_GROUPED = re.compile(r"(?<!\d)\d{4}(?:[ -]\d{4}){2,3}(?!\d)")


def mask_numbers(text: str) -> str:
    """Mask long digit runs (account / card numbers), keeping only the last 4 digits."""
    def keep4(m):
        digits = re.sub(r"\D", "", m.group(0))
        return "****" + digits[-4:]
    return _LONG_DIGITS.sub(keep4, _GROUPED.sub(keep4, text))


def mask_account(value) -> str:
    s = re.sub(r"\s", "", str(value))
    if len(re.sub(r"\D", "", s)) >= 5:
        return "****" + re.sub(r"\D", "", s)[-4:]
    return str(value)


def eprint(*a):
    print(*a, file=sys.stderr)
