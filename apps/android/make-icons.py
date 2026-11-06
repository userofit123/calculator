# Makes the launcher icons from apps/web/public/icon.svg (needs ImageMagick): python3 make-icons.py
# Adaptive (Android 8+): the glyph as foreground, the gradient as background; older phones get the square and round icons.
import subprocess, re, os, tempfile
here = os.path.dirname(os.path.abspath(__file__))
res = os.path.join(here, "android/app/src/main/res")
svg = open(os.path.join(here, "../web/public/icon.svg")).read()
os.chdir(tempfile.mkdtemp())
defs = re.search(r'<defs>.*</defs>', svg).group(0)
glyph = svg[svg.index('<g fill="none"'):svg.rindex('</svg>')]
s = 0.16  # glyph scale on the 108dp adaptive canvas: keeps it inside the 66dp safe circle
fg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate({54-256*s} {54-256*s}) scale({s})">{glyph}</g></svg>'
bg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">{defs}<rect width="108" height="108" fill="url(#g)"/></svg>'
# legacy (before Android 8): the web icon itself, and a round one
legacy = svg
round_ = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{defs}<circle cx="256" cy="256" r="256" fill="url(#g)"/><g transform="translate(25.6 25.6) scale(0.9)">{glyph}</g></svg>'
for n, t in dict(fg=fg, bg=bg, legacy=legacy, round=round_).items(): open(n + '.svg', 'w').write(t)
for d, m in dict(mdpi=1, hdpi=1.5, xhdpi=2, xxhdpi=3, xxxhdpi=4).items():
    out = f'{res}/mipmap-{d}'; os.makedirs(out, exist_ok=True)
    for n, name, dp in [('fg', 'ic_launcher_foreground', 108), ('bg', 'ic_launcher_background', 108), ('legacy', 'ic_launcher', 48), ('round', 'ic_launcher_round', 48)]:
        px = int(dp * m)
        subprocess.run(['magick', '-background', 'none', '-density', str(max(96, int(96 * px / 100))), n + '.svg', '-resize', f'{px}x{px}', '-strip', f'PNG32:{out}/{name}.png'], check=True)
print('ok')
