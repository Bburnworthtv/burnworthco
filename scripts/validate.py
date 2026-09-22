"""Check the static release without third-party packages or a browser."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import json,re,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'public'
class Page(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.ids=set();self.links=[];self.assets=[];self.h1=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get('id'):
   assert a['id'] not in self.ids,('duplicate id',a['id'])
   self.ids.add(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='a' and a.get('href'):self.links.append(a['href'])
  if tag in ('img','script') and a.get('src'):self.assets.append(a['src'])
  if tag=='img' and a.get('srcset'):
   self.assets.extend(x.strip().split()[0] for x in a['srcset'].split(','))
  if tag=='link' and a.get('rel') in ['stylesheet','icon','apple-touch-icon','manifest']:self.assets.append(a['href'])
pages={};titles=set();descriptions=set();base='https://burnworthco.com'
for f in root.glob('*.html'):
 text=f.read_text();p=Page();p.feed(text);route='/' if f.stem=='index' else '/'+f.stem;pages[route]=p
 assert p.h1==1,(f,'expected one h1',p.h1)
 title=re.search(r'<title>(.*?)</title>',text,re.S)[1]
 desc=re.search(r'<meta name="description" content="([^"]+)"',text)[1]
 assert title not in titles,(f,'duplicate title');titles.add(title)
 assert desc not in descriptions,(f,'duplicate description');descriptions.add(desc)
 assert '/cdn-cgi/' not in text,(f,'edge-injected code retained')
 if f.stem!='404':
  assert re.findall(r'<link rel="canonical" href="([^"]+)"',text)==[base+route],f
  assert 'noindex' not in text,f
  graphs=re.findall(r'<script type="application/ld\+json">(.*?)</script>',text,re.S)
  assert len(graphs)==1,f
  data=json.loads(graphs[0]);nodes=data['@graph']
  assert any(n.get('@type')=='Organization' and n['name']=='Burnworth Co.' for n in nodes),f
 else:assert 'noindex,follow' in text,f
for route,p in pages.items():
 for link in p.links:
  u=urlsplit(link)
  if u.scheme or u.netloc:continue
  target=u.path or route
  assert target in pages,(route,'missing route',link)
  if u.fragment:assert u.fragment in pages[target].ids,(route,'missing fragment',link)
 for asset in p.assets:
  if urlsplit(asset).scheme:continue
  assert (root/asset.lstrip('/')).is_file(),(route,'missing asset',asset)
# _headers: every HTML route needs its own Cache-Control rule, because
# Cloudflare Pages merges all matching rules rather than picking the most
# specific, so a catch-all Cache-Control cannot be used alongside the asset
# rules. Without this check a new page silently inherits no cache policy.
headers_text=(root/'_headers').read_text()
rules={l.strip() for l in headers_text.splitlines() if l.startswith('/') and not l.startswith('//')}
for route in pages:
 if route=='/404':continue
 assert route in rules,(route,'missing a _headers rule')
assert '/404' in rules,('/404','missing a _headers rule')
cc_blocks=[b for b in headers_text.split('\n/') if 'Cache-Control' in b]
assert not any(b.startswith('*') for b in cc_blocks),'Cache-Control on /* collides with the per-path rules'
for icon in json.loads((root/'site.webmanifest').read_text())['icons']:
 assert (root/icon['src'].lstrip('/')).is_file()
urls=[n.text for n in ET.parse(root/'sitemap.xml').findall('.//{*}loc')]
assert set(urls)=={base+p for p in pages if p!='/404'}
assert len(urls)==len(set(urls))
assert 'Sitemap: '+base+'/sitemap.xml' in (root/'robots.txt').read_text()
MAGIC={'.png':(b'\x89PNG',),'.jpg':(b'\xff\xd8',),'.webp':(b'RIFF',),'.woff2':(b'wOF2',),'.txt':None,'.svg':(b'<svg',b'<?xml')}
for f in (root/'assets').glob('*'):
 b=f.read_bytes()
 assert f.suffix in MAGIC,(f,'unexpected asset type')
 assert MAGIC[f.suffix] is None or any(b.startswith(m) for m in MAGIC[f.suffix]),f
 assert f.suffix!='.webp' or b[8:12]==b'WEBP',f
print(f'PASS: {len(pages)} HTML documents; {len(urls)} canonical sitemap URLs; local links, fragments, assets, metadata and JSON-LD valid.')
print('Static checks only. Live status codes, redirects, Cloudflare rules, browser layout and analytics need post-deployment verification.')
