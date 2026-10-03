"""Refresh the SAFEX maize reference price the app caches offline.

Fetches the public daily SAFEX settlement table through Bright Data's Web Unlocker (if BRIGHTDATA_API_KEY and
BRIGHTDATA_ZONE are set) or directly otherwise. Writes app/public/data/price.json (latest, read by the phone)
and data/safex_history.csv (the series, for evidence plots).

Source: derivative.co.za/safex-prices.html — indicative JSE SAFEX settlements, R/ton, delivered Randfontein.
"""
import csv
import html
import json
import os
import re
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
URL = "https://derivative.co.za/safex-prices.html"
PRICE_JSON = ROOT / "app" / "public" / "data" / "price.json"
HISTORY = ROOT / "data" / "safex_history.csv"


def fetch(url: str) -> str:
    key, zone = os.environ.get("BRIGHTDATA_API_KEY"), os.environ.get("BRIGHTDATA_ZONE")
    if key and zone:
        r = requests.post(
            "https://api.brightdata.com/request",
            headers={"Authorization": f"Bearer {key}"},
            json={"zone": zone, "url": url, "format": "raw"},
            timeout=90,
        )
    else:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (umlimi price refresh)"}, timeout=60)
    r.raise_for_status()
    r.encoding = "utf-8"
    return r.text


def rand(cell: str) -> int:
    """'R 4 058▲ +22' -> 4058"""
    m = re.match(r"R\s*([\d\s  ]+)", cell)
    return int(re.sub(r"\D", "", m.group(1)))


def parse(page: str) -> list[dict]:
    table = re.search(r"<table.*?</table>", page, flags=re.S).group(0)
    rows = []
    for tr in re.findall(r"<tr.*?</tr>", table, flags=re.S):
        cells = [html.unescape(re.sub("<.*?>", "", c)).strip() for c in re.findall(r"<t[dh].*?</t[dh]>", tr, flags=re.S)]
        if len(cells) < 3 or not cells[1].startswith("R"):
            continue
        date = datetime.strptime(cells[0], "%a %d %b %Y").date().isoformat()
        rows.append({"date": date, "white": rand(cells[1]), "yellow": rand(cells[2])})
    return sorted(rows, key=lambda r: r["date"])


def main():
    rows = parse(fetch(URL))
    latest = rows[-1]
    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    with HISTORY.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "white", "yellow"])
        w.writeheader()
        w.writerows(rows)
    ref = json.loads(PRICE_JSON.read_text()) if PRICE_JSON.exists() else {}
    ref.update({
        "updated": latest["date"],
        "source": "JSE SAFEX settlement (via derivative.co.za)",
        "white_r_per_ton": latest["white"],
        "yellow_r_per_ton": latest["yellow"],
    })
    ref.setdefault("transport_r_per_ton_km", 2.5)  # assumption: road freight farm -> silo
    ref.setdefault("handling_r_per_ton", 80)  # location differential example (Grain SA)
    PRICE_JSON.write_text(json.dumps(ref, indent=2) + "\n")
    print(f"{len(rows)} sessions, latest {latest}")


if __name__ == "__main__":
    main()
