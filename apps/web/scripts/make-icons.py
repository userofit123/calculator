# Builds apps/web/public/icon.svg and the web PNGs (the desktop and Android scripts read icon.svg afterwards), and prints the
# one-colour path for the in-app logo (src/shell/Logo.vue).
# Run: python3 apps/web/scripts/make-icons.py  (needs ImageMagick's `magick` with librsvg)
import subprocess, os, tempfile
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
TMP = os.path.join(tempfile.gettempdir(), 'calc-maskable.svg')
# lime-to-teal tile (Motus is peach-to-pink, Money Manager indigo-to-violet), the four operators in deep navy, the plus in amber
C1, C2 = '#c3f59a', '#22a6a0'
INK, ACCENT = '#0e2b3a', '#ffb84a'

# The four operators in a 2 x 2 grid on the 512 tile: + and - on top, x and / below. Bold round-capped strokes (36 px) so
# every sign still reads at 16-32 px. Parts are ('line', x1, y1, x2, y2, colour) and ('dot', cx, cy, r, colour).
SW = 36
PARTS = [
    ('line', 130, 180, 230, 180, ACCENT), ('line', 180, 130, 180, 230, ACCENT),  # plus
    ('line', 282, 180, 382, 180, INK),                                          # minus
    ('line', 142, 294, 218, 370, INK), ('line', 142, 370, 218, 294, INK),       # times
    ('line', 282, 332, 382, 332, INK), ('dot', 332, 288, 19, INK), ('dot', 332, 376, 19, INK),  # divide
]

def part_svg(p):
    if p[0] == 'line':
        _, x1, y1, x2, y2, c = p
        return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{c}" stroke-width="{SW}" stroke-linecap="round"/>'
    _, cx, cy, r, c = p
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{c}"/>'

glyph = '<g id="glyph" filter="url(#s)">' + ''.join(part_svg(p) for p in PARTS) + '</g>'
# a soft shadow under the signs lifts them off the tile
defs = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C1}"/><stop offset="1" stop-color="{C2}"/></linearGradient>'
        f'<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="{INK}" flood-opacity=".35"/></filter></defs>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{defs}<rect width="512" height="512" rx="120" fill="url(#g)"/>{glyph}</svg>\n'
open(f'{P}/icon.svg', 'w').write(svg)
# maskable / apple-touch: full-bleed square (the platform applies its own shape); the glyph is well inside the 80% safe circle
mask = svg.replace('rx="120" fill="url(#g)"', 'fill="url(#g)"')
open(TMP, 'w').write(mask)
def png(src, px, out):
    subprocess.run(['magick', '-background', 'none', '-density', str(max(96, int(96*px/100))), src, '-resize', f'{px}x{px}', '-strip', f'PNG32:{out}'], check=True)
for px in (192, 512, 1024): png(f'{P}/icon.svg', px, f'{P}/icon-{px}.png')
for px in (192, 512): png(TMP, px, f'{P}/icon-maskable-{px}.png')

# In-app logo: the same signs in one colour (the theme's text-on-accent), each stroke a capsule outline, all wound the same
# way so the overlaps of + and x stay filled (non-zero fill). Mapped to a 24 x 24 box: the glyph's 288 px span becomes 18 units.
import math
SC, CX, CY = 18 / 288, 256, 253.5
f = lambda v: f'{round(v, 2):g}'
def pt(x, y): return (12 + (x - CX) * SC, 12 + (y - CY) * SC)
def capsule(x1, y1, x2, y2, r):
    (ax, ay), (bx, by) = pt(x1, y1), pt(x2, y2)
    d = math.hypot(bx - ax, by - ay); nx, ny = -(by - ay) / d * r, (bx - ax) / d * r
    return (f'M{f(ax + nx)} {f(ay + ny)}L{f(bx + nx)} {f(by + ny)}A{f(r)} {f(r)} 0 0 0 {f(bx - nx)} {f(by - ny)}'
            f'L{f(ax - nx)} {f(ay - ny)}A{f(r)} {f(r)} 0 0 0 {f(ax + nx)} {f(ay + ny)}Z')
def dot(cx, cy, r):
    (x, y), r = pt(cx, cy), r * SC
    return f'M{f(x + r)} {f(y)}A{f(r)} {f(r)} 0 0 0 {f(x - r)} {f(y)}A{f(r)} {f(r)} 0 0 0 {f(x + r)} {f(y)}Z'
print(''.join(capsule(*p[1:5], SW / 2 * SC) if p[0] == 'line' else dot(*p[1:4]) for p in PARTS))
