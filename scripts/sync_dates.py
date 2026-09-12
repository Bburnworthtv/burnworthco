"""Derive per-URL sitemap lastmod from git, so the field stays true.

A sitemap where every URL shares one date tells a crawler nothing, and once the
dates are demonstrably wrong the field gets ignored for the whole domain. Run
this after committing content changes; it is dependency-free and idempotent.
"""
import subprocess, datetime, re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pub = root / 'public'

def last_change(path: Path) -> str:
    """Last commit date for this file, or today if it is dirty or untracked."""
    rel = str(path.relative_to(root))
    dirty = subprocess.run(['git', 'status', '--porcelain', '--', rel],
                           cwd=root, capture_output=True, text=True).stdout.strip()
    if dirty:
        return datetime.date.today().isoformat()
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', rel],
                         cwd=root, capture_output=True, text=True).stdout.strip()
    return out or datetime.date.today().isoformat()

sitemap = pub / 'sitemap.xml'
text = sitemap.read_text()
changed = []
for loc, lastmod in re.findall(r'<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>', text):
    route = loc.replace('https://burnworthco.com', '') or '/'
    f = pub / ('index.html' if route == '/' else route.lstrip('/') + '.html')
    if not f.is_file():
        continue
    real = last_change(f)
    if real != lastmod:
        text = text.replace(f'<loc>{loc}</loc><lastmod>{lastmod}</lastmod>',
                            f'<loc>{loc}</loc><lastmod>{real}</lastmod>')
        changed.append((route, lastmod, real))

sitemap.write_text(text)
for route, old, new in changed:
    print(f'  {route:<42} {old} -> {new}')
print(f'{len(changed)} lastmod value(s) updated' if changed else 'sitemap lastmod already accurate')
