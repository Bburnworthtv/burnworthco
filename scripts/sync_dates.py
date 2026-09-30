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

PAIR = re.compile(r'<loc>([^<]+)</loc>(\s*)<lastmod>([^<]+)</lastmod>')
changed = []
section_dates = {}
for sitemap in sorted(pub.glob('sitemap-*.xml')):
    text = sitemap.read_text()
    def fix(m):
        loc, gap, lastmod = m.groups()
        route = loc.replace('https://burnworthco.com', '') or '/'
        f = pub / ('index.html' if route == '/' else route.lstrip('/') + '.html')
        real = last_change(f) if f.is_file() else lastmod
        if real != lastmod:
            changed.append((route, lastmod, real))
        return f'<loc>{loc}</loc>{gap}<lastmod>{real}</lastmod>'
    text = PAIR.sub(fix, text)
    sitemap.write_text(text)
    section_dates[sitemap.name] = max(d for _, _, d in PAIR.findall(text))

# The index lists each section with the newest lastmod inside it.
index = pub / 'sitemap.xml'
text = index.read_text()
def roll_up(m):
    loc, gap, lastmod = m.groups()
    return f'<loc>{loc}</loc>{gap}<lastmod>{section_dates.get(loc.rsplit("/", 1)[1], lastmod)}</lastmod>'
index.write_text(PAIR.sub(roll_up, text))

for route, old, new in changed:
    print(f'  {route:<42} {old} -> {new}')
print(f'{len(changed)} lastmod value(s) updated' if changed else 'sitemap lastmod already accurate')
