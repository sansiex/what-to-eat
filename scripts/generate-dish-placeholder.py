#!/usr/bin/env python3
"""Generate PNG placeholder from SVG source.

Usage:
  python3 scripts/generate-dish-placeholder.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / "images" / "dish-placeholder.svg"
PNG_PATH = ROOT / "images" / "dish-placeholder.png"


def run_sips_convert(svg_path: Path, png_path: Path) -> None:
    sips = shutil.which("sips")
    if not sips:
        raise RuntimeError("sips not found on this machine.")
    subprocess.run(
        [sips, "-s", "format", "png", str(svg_path), "--out", str(png_path)],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def main() -> int:
    if not SVG_PATH.exists():
        print(f"SVG not found: {SVG_PATH}", file=sys.stderr)
        return 1

    try:
        run_sips_convert(SVG_PATH, PNG_PATH)
    except Exception as exc:  # pragma: no cover - script runtime path
        print(f"Failed to generate PNG: {exc}", file=sys.stderr)
        return 1

    print(f"Generated: {PNG_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
