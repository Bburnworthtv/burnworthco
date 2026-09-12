"""Notify IndexNow participants that URLs changed.

Google retired its sitemap ping endpoint in 2023 and its Indexing API only
accepts JobPosting and BroadcastEvent, so Google still needs Search Console.
IndexNow covers Bing, Yandex, Seznam and Naver - and Bing is upstream of
Copilot and part of ChatGPT's search, which is the point for this site.

Dependency-free. Run after a deploy: python3 scripts/indexnow.py
"""
import json, urllib.request, xml.etree.ElementTree as ET
from pathlib import Path

HOST = "burnworthco.com"
root = Path(__file__).resolve().parents[1] / "public"

keys = [p for p in root.glob("*.txt") if len(p.stem) == 32 and p.stem == p.read_text().strip()]
if not keys:
    raise SystemExit("No IndexNow key file found in public/ (a 32-char .txt whose name matches its contents).")
key = keys[0].stem

urls = [u.find("{*}loc").text for u in ET.parse(root / "sitemap.xml").getroot().findall("{*}url")]

payload = {
    "host": HOST,
    "key": key,
    "keyLocation": f"https://{HOST}/{key}.txt",
    "urlList": urls,
}
req = urllib.request.Request(
    "https://api.indexnow.org/indexnow",
    data=json.dumps(payload).encode(),
    headers={"Content-Type": "application/json; charset=utf-8"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    print(f"IndexNow: HTTP {r.status} for {len(urls)} URLs")
    print("200 accepted, 202 accepted pending key validation.")
