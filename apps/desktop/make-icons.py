# Makes the desktop app's icons from apps/web/public/icon.svg (needs ImageMagick): python3 make-icons.py
# Linux: one PNG per size in build-res/icons (electron-builder installs each as hicolor/<size>/apps/userofit123-calculator.png;
# a lone 1024 px PNG went to hicolor/1024x1024, which the hicolor theme doesn't list, so the menu, dock and taskbar showed
# no icon). Windows: build-res/icon.ico with the small sizes drawn from the vector, for the program, its shortcuts and the installer.
import subprocess, os, tempfile
here = os.path.dirname(os.path.abspath(__file__))
svg = os.path.join(here, "../web/public/icon.svg")
icons = os.path.join(here, "build-res/icons"); os.makedirs(icons, exist_ok=True)
tmp = tempfile.mkdtemp()
def png(px, out):
    subprocess.run(['magick', '-background', 'none', '-density', str(max(96, int(96 * px / 100))), svg, '-resize', f'{px}x{px}', '-strip', f'PNG32:{out}'], check=True)
for px in [16, 24, 32, 48, 64, 128, 256, 512]:
    png(px, f'{icons}/{px}x{px}.png')
ico = [f'{tmp}/{px}.png' for px in [16, 24, 32, 48, 64, 128, 256]]
for px, f in zip([16, 24, 32, 48, 64, 128, 256], ico): png(px, f)
subprocess.run(['magick', *ico, os.path.join(here, 'build-res/icon.ico')], check=True)
print('ok')
