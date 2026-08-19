from pathlib import Path
import os
import shutil
import signal
import subprocess
import tempfile
import time

from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts"
PUBLIC = ROOT / "public"
OUT.mkdir(exist_ok=True)

viewports = {
    "ipad-portrait.png": (768, 1024),
    "ipad-landscape.png": (1024, 768),
}


def capture(filename: str, width: int, height: int, url: str):
    profile = Path(tempfile.mkdtemp(prefix="rivet-chrome-"))
    output = OUT / filename
    output.unlink(missing_ok=True)
    command = [
        CHROME,
        "--headless=new",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=1500",
        f"--user-data-dir={profile}",
        f"--window-size={width},{height}",
        f"--screenshot={output}",
        url,
    ]
    process = subprocess.Popen(
        command,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        for _ in range(150):
            if output.exists() and output.stat().st_size > 0:
                break
            time.sleep(0.1)
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
        shutil.rmtree(profile, ignore_errors=True)

    if not output.exists():
        raise RuntimeError(f"Chrome did not create {output}")
    print(f"{filename}: {width}x{height}, {output.stat().st_size} bytes")


for filename, (width, height) in viewports.items():
    capture(filename, width, height, "http://127.0.0.1:4173/")

# Chrome headless clamps its CSS viewport to 500px. An iframe provides a real
# 320px nested viewport so the app's narrow media queries can be verified.
harness = PUBLIC / "_viewport-320-test.html"
raw_mobile = OUT / "mobile-320-raw.png"
harness.write_text(
    '<!doctype html><meta name="viewport" content="width=device-width">'
    '<style>*{box-sizing:border-box}html,body{margin:0;width:500px;height:700px;overflow:hidden}'
    'iframe{display:block;width:320px;height:700px;border:0}</style>'
    '<iframe title="320 pixel test" src="/"></iframe>',
    encoding="utf-8",
)
try:
    capture(raw_mobile.name, 500, 700, "http://127.0.0.1:4173/_viewport-320-test.html")
    with Image.open(raw_mobile) as image:
        image.crop((0, 0, 320, 700)).save(OUT / "mobile-320.png", optimize=True)
    print(f"mobile-320.png: 320x700, {(OUT / 'mobile-320.png').stat().st_size} bytes")
finally:
    harness.unlink(missing_ok=True)
    raw_mobile.unlink(missing_ok=True)
