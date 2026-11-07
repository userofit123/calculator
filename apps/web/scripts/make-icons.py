# Builds apps/web/public/icon.svg and the web PNGs (the desktop and Android scripts read icon.svg afterwards), and prints the
# one-colour path for the in-app logo (src/shell/Logo.vue).
# Run: python3 apps/web/scripts/make-icons.py  (needs ImageMagick's `magick` with librsvg)
import subprocess, os, tempfile
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
TMP = os.path.join(tempfile.gettempdir(), 'calc-maskable.svg')
# lime-to-teal tile (Motus is peach-to-pink, Money Manager indigo-to-violet), a deep navy calculator, amber operator keys
C1, C2 = '#c3f59a', '#22a6a0'
BODY, KEY, SCREEN, OP = '#0e2b3a', '#2d5a66', '#effcdc', '#ffb84a'

# Layout on the 512 tile: a 4 x 4 key grid under a display; the right column holds two operator keys and a tall equals key.
# The keys are kept big (30 px with 9 px gaps) so the grid still reads at 32 px; the body is about half the tile height.
PAD, K, G, DH, DG, R = 22, 30, 9, 54, 16, 40
KW = 4 * K + 3 * G
W, H = KW + 2 * PAD, PAD + DH + DG + 4 * K + 3 * G + PAD
X0, Y0 = 256 - W / 2, 256 - H / 2
DX, DY = X0 + PAD, Y0 + PAD
KY = DY + DH + DG

def shapes():
    """(kind, x, y, w, h, rx) for every part of the glyph, body first."""
    s = [('body', X0, Y0, W, H, R), ('screen', DX, DY, KW, DH, 13), ('result', DX + KW - 70, DY + DH / 2 - 7, 52, 14, 7)]
    for r in range(4):
        for c in range(3):
            s.append(('key', DX + c * (K + G), KY + r * (K + G), K, K, 10))
    x = DX + 3 * (K + G)
    s += [('op', x, KY, K, K, 10), ('op', x, KY + K + G, K, K, 10), ('op', x, KY + 2 * (K + G), K, 2 * K + G, 10)]
    return s

FILL = dict(body=BODY, screen=SCREEN, result=BODY, key=KEY, op=OP)
glyph = ('<g id="glyph" filter="url(#s)">'
         + ''.join(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{rx:g}" fill="{FILL[k]}"/>' for k, x, y, w, h, rx in shapes())
         + '</g>')
# a soft shadow under the calculator lifts it off the tile
defs = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>'
        f'<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="{BODY}" flood-opacity=".35"/></filter></defs>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{defs}<rect width="512" height="512" rx="120" fill="url(#g)"/>{glyph}</svg>\n'
open(f'{P}/icon.svg', 'w').write(svg)
# maskable / apple-touch: full-bleed square (the platform applies its own shape); the glyph is well inside the 80% safe circle
mask = svg.replace('rx="120" fill="url(#g)"', 'fill="url(#g)"')
open(TMP, 'w').write(mask)
def png(src, px, out):
    subprocess.run(['magick', '-background', 'none', '-density', str(max(96, int(96*px/100))), src, '-resize', f'{px}x{px}', '-strip', f'PNG32:{out}'], check=True)
for px in (192, 512, 1024): png(f'{P}/icon.svg', px, f'{P}/icon-{px}.png')
for px in (192, 512): png(TMP, px, f'{P}/icon-maskable-{px}.png')

# In-app logo: one colour (the theme's text-on-accent), so the screen and keys are holes in the body (even-odd fill)
# and the result bar sits inside the screen hole. Mapped to a 24 x 24 box, 18 units tall.
sc = 18 / H
def rr(x, y, w, h, r):
    x, y, w, h, r = 12 + (x - 256) * sc, 3 + (y - Y0) * sc, w * sc, h * sc, r * sc
    f = lambda v: f'{round(v, 2):g}'
    return (f'M{f(x + r)} {f(y)}h{f(w - 2 * r)}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(r)}v{f(h - 2 * r)}a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(r)}'
            f'h{f(-(w - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(-r)}v{f(-(h - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(-r)}z')
print(''.join(rr(*p[1:]) for p in shapes()))
