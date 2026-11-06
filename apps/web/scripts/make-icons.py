# Builds apps/web/public/icon.svg and the web PNGs (the desktop and Android scripts read icon.svg afterwards).
# Run: python3 apps/web/scripts/make-icons.py  (needs ImageMagick's `magick`)
import subprocess, os, tempfile
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
TMP = os.path.join(tempfile.gettempdir(), 'calc-maskable.svg')
C1, C2, INK = '#86e3c9', '#2f9cc6', '#052a38'
keys = ''.join(f'<rect x="{x-13}" y="{y-13}" width="26" height="26" rx="7"/>' for y in (262, 304, 346) for x in (212, 256, 300))
defs = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>'
        f'<mask id="m"><rect width="512" height="512" fill="#fff"/><g fill="#000"><rect x="206" y="174" width="100" height="44" rx="11"/>{keys}</g></mask></defs>')
glyph = f'<g id="glyph"><rect x="178" y="138" width="156" height="236" rx="34" fill="{INK}" mask="url(#m)"/></g>'
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{defs}<rect width="512" height="512" rx="120" fill="url(#g)"/>{glyph}</svg>\n'
open(f'{P}/icon.svg', 'w').write(svg)
# maskable / apple-touch: full-bleed square (the platform applies its own shape); the glyph is well inside the 80% safe circle
mask = svg.replace('rx="120" fill="url(#g)"', 'fill="url(#g)"')
open(TMP, 'w').write(mask)
def png(src, px, out):
    subprocess.run(['magick', '-background', 'none', '-density', str(max(96, int(96*px/100))), src, '-resize', f'{px}x{px}', '-strip', f'PNG32:{out}'], check=True)
for px in (192, 512, 1024): png(f'{P}/icon.svg', px, f'{P}/icon-{px}.png')
for px in (192, 512): png(TMP, px, f'{P}/icon-maskable-{px}.png')
print('ok')
