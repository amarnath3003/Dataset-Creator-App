#!/usr/bin/env python3
"""Render docs/demo/demo.html to an optimised looping GIF.

Drives headless Chrome once per frame (`demo.html?f=N`) at 2x device scale,
downsamples with Lanczos for clean text, then encodes a single-global-palette
GIF so Pillow can diff-encode the mostly-static UI into a small file.

Usage:  python docs/demo/render_demo.py [--frames N] [--fps 12] [--width 900]
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
DEMO = HERE / "demo.html"
OUT = HERE / "demo.gif"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    for name in ("google-chrome", "chromium", "chrome"):
        p = shutil.which(name)
        if p:
            return p
    sys.exit("No Chrome/Edge binary found - install one or edit CHROME_CANDIDATES.")


def total_frames() -> int:
    """Read the frame count straight out of the demo's scene table."""
    src = DEMO.read_text(encoding="utf-8")
    lens = [int(n) for n in re.findall(r"len:(\d+)", src)]
    if not lens:
        sys.exit("Could not parse scene lengths from demo.html")
    return sum(lens)


def shoot(chrome: str, frame: int, w: int, h: int, scale: int, tmp: Path) -> Path:
    png = tmp / f"f{frame:04d}.png"
    # Each capture gets its own profile dir - parallel Chrome instances that share
    # one will intermittently bail out before writing the screenshot.
    for attempt in range(3):
        profile = tmp / f"prof{frame:04d}_{attempt}"
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-extensions",
            "--disable-lcd-text",
            f"--user-data-dir={profile}",
            f"--force-device-scale-factor={scale}",
            f"--window-size={w},{h}",
            "--virtual-time-budget=1200",
            f"--screenshot={png}",
            f"{DEMO.as_uri()}?f={frame}",
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        if png.exists():
            return png
    raise RuntimeError(f"frame {frame} did not render after 3 attempts")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", type=int, default=0, help="0 = read from demo.html")
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--width", type=int, default=900)
    ap.add_argument("--height", type=int, default=560)
    ap.add_argument("--scale", type=int, default=2, help="capture device scale factor")
    ap.add_argument("--out-width", type=int, default=880, help="final GIF width")
    ap.add_argument("--colors", type=int, default=256)
    ap.add_argument("--jobs", type=int, default=5)
    ap.add_argument("--keep", action="store_true", help="keep the PNG frames")
    args = ap.parse_args()

    n = args.frames or total_frames()
    chrome = find_chrome()
    print(f"chrome  : {chrome}")
    print(f"frames  : {n} @ {args.fps}fps  ({n / args.fps:.1f}s loop)")

    tmp = Path(tempfile.mkdtemp(prefix="demoframes_"))
    try:
        print("capture : ", end="", flush=True)
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            futs = [
                pool.submit(shoot, chrome, i, args.width, args.height, args.scale, tmp)
                for i in range(n)
            ]
            for i, f in enumerate(futs):
                f.result()
                if i % 10 == 0:
                    print(".", end="", flush=True)
        print(" done")

        ow = args.out_width
        oh = round(ow * args.height / args.width)
        frames = []
        for i in range(n):
            im = Image.open(tmp / f"f{i:04d}.png").convert("RGB")
            if im.size != (ow, oh):
                im = im.resize((ow, oh), Image.LANCZOS)
            frames.append(im)

        # One global palette for every frame: keeps colours stable so Pillow can
        # emit small inter-frame diffs instead of a full image each time. The
        # palette is built from a montage spread across the whole timeline, and
        # FASTOCTREE beats MEDIANCUT/MAXCOVERAGE here - it allocates enough of the
        # ramp to the near-black neumorphic gradients to keep them from banding.
        idxs = [round(k * (n - 1) / 11) for k in range(12)]
        sample = Image.new("RGB", (ow, oh * len(idxs)))
        for k, idx in enumerate(idxs):
            sample.paste(frames[idx], (0, k * oh))
        pal = sample.quantize(colors=args.colors, method=Image.FASTOCTREE)
        quant = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]

        quant[0].save(
            OUT,
            save_all=True,
            append_images=quant[1:],
            duration=round(1000 / args.fps),
            loop=0,
            optimize=True,
            disposal=1,
        )
        size = OUT.stat().st_size
        print(f"wrote   : {OUT}  {ow}x{oh}  {size / 1_048_576:.2f} MB")

        if args.keep:
            dest = HERE / "frames"
            dest.mkdir(exist_ok=True)
            for p in sorted(tmp.glob("f*.png")):
                shutil.copy2(p, dest / p.name)
            print(f"frames  : {dest}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
