#!/usr/bin/env python3
"""Baut die Vorschau-Seiten aus shell.html + effects/<name>.js."""
import json, pathlib, sys

SRC = pathlib.Path(__file__).parent
OUT = SRC.parent
PAGES = json.loads((SRC / 'pages.json').read_text())

def build(key):
    p = PAGES[key]
    html = (SRC / 'shell.html').read_text()
    effect = (SRC / 'effects' / f'{key}.js').read_text()
    # gemeinsame Bausteine einbinden: Zeile '//#include name.js' wird durch quellen/lib/name.js ersetzt
    effect = '\n'.join((SRC / 'lib' / l.split()[1]).read_text() if l.startswith('//#include ') else l for l in effect.split('\n'))
    for k, v in [('__TITLE__', p['title']), ('__NAME__', p['name']), ('__SUB__', p['sub']),
                 ('__ACCENT__', p['accent']), ('__ARIA__', p['aria']), ('__KEY__', 'nw-' + key)]:
        html = html.replace(k, v)
    html = html.replace('__EFFECT__', effect)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f'{key}.html'
    out.write_text(html)
    # Skript für den Test separat ablegen
    js = html.split('<script>')[1].split('</script>')[0]
    (SRC / 'out').mkdir(exist_ok=True)  # nur für test.js, nicht einchecken
    (SRC / 'out' / f'{key}.js').write_text(js)
    print(out)

for key in (sys.argv[1:] or PAGES.keys()):
    build(key)
