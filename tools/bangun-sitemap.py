#!/usr/bin/env python3
"""Regenerate sitemap.xml from the fixed public demos and generated marketing routes."""
from datetime import date
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'
ET.register_namespace('', NS)
# Keep only the current interactive category demos in search. Legacy standalone
# mockups in katalog-demo/ and the retired Ice Blue demo are noindex and excluded.
CORE = [
    '/',
    '/demo/aqiqah.html',
    '/demo/khitanan-basic.html',
    '/demo/khitanan-premium.html',
    '/demo/ultah-anak.html',
    '/demo/wedding-premium.html',
]

def main():
    routes = json.loads((ROOT / 'tools/public-page-urls.json').read_text(encoding='utf-8'))
    urls = list(dict.fromkeys(CORE + routes))
    root = ET.Element(f'{{{NS}}}urlset')
    modified = date.today().isoformat()
    for route in urls:
        url = ET.SubElement(root, f'{{{NS}}}url')
        ET.SubElement(url, f'{{{NS}}}loc').text = 'https://asproject.my.id' + (route if route != '/' else '/')
        ET.SubElement(url, f'{{{NS}}}lastmod').text = modified
        priority = '1.0' if route == '/' else ('0.9' if route in ('/harga/', '/katalog/') else ('0.8' if route.startswith('/undangan/') else ('0.7' if route.startswith('/template/') else '0.6')))
        ET.SubElement(url, f'{{{NS}}}priority').text = priority
    ET.indent(root, space='  ')
    target = ROOT / 'sitemap.xml'
    target.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode') + '\n', encoding='utf-8')
    print(f'Wrote {len(urls)} public URLs to {target.relative_to(ROOT)}.')

if __name__ == '__main__':
    main()
