#!/usr/bin/env python3
"""
Construit dist/piano-jeu.html : le jeu complet dans un seul fichier HTML
(styles, scripts et icône intégrés), à copier sur un téléphone Android
et à ouvrir avec Chrome. Fonctionne sans connexion.

À relancer après chaque modification du jeu :
    python3 outils/fichier-unique.py
"""
import base64
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
JEU = ROOT / 'jeu'


def replace_once(text, old, new):
    assert text.count(old) == 1, f'introuvable ou en double : {old}'
    return text.replace(old, new)


def inline_script(match):
    path = (JEU / match.group(1)).resolve()
    code = path.read_text(encoding='utf-8')
    assert '</script' not in code.lower(), f'{path} contient </script>'
    return f'<script>\n{code}</script>'


html = (JEU / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)

css = (JEU / 'jeu.css').read_text(encoding='utf-8')
html = replace_once(html, '<link rel="stylesheet" href="jeu.css">', f'<style>\n{css}</style>')

# Pas d'installation possible depuis un fichier : on retire manifeste et icône iPhone.
html = replace_once(html, '  <link rel="manifest" href="manifest.webmanifest">\n', '')
html = replace_once(html, '  <link rel="apple-touch-icon" href="icones/apple-touch-icon.png">\n', '')

icon = base64.b64encode((JEU / 'icones' / 'icone.svg').read_bytes()).decode()
html = replace_once(html, 'href="icones/icone.svg"', f'href="data:image/svg+xml;base64,{icon}"')

external = re.search(r'(?:src|href)="(?!data:)[^"]*"', html)
assert external is None, f'référence externe restante : {external.group(0)}'

out = ROOT / 'dist' / 'piano-jeu.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out.relative_to(ROOT)} ({out.stat().st_size // 1024} Ko)')
