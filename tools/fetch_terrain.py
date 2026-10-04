#!/usr/bin/env python3
"""AWS Terrain Tiles (terrarium) indir ve tek bir yükseklik ızgarası üret.

Kaynak: https://registry.opendata.aws/terrain-tiles/  (ODbL / public domain karışık,
SRTM + ETOPO1 batimetri). Terrarium kodlaması:  h = (R*256 + G + B/256) - 32768

Çıktı: tools/data/elev.npz  -> {elev: int16[H,W], bbox: [w,s,e,n], z, x0, y0}
"""
from __future__ import annotations

import io
import math
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

Z = 12
# Çanakkale tiyatrosu: Saros körfezinden Bozcaada'ya, Ege'den Marmara ağzına.
WEST, SOUTH, EAST, NORTH = 25.55, 39.60, 27.20, 40.75

BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
CACHE = os.path.join(os.path.dirname(__file__), "data", "tiles")
OUT = os.path.join(os.path.dirname(__file__), "data", "elev.npz")


def lon2x(lon: float, z: int) -> float:
    return (lon + 180.0) / 360.0 * (1 << z)


def lat2y(lat: float, z: int) -> float:
    r = math.radians(lat)
    return (1.0 - math.asinh(math.tan(r)) / math.pi) / 2.0 * (1 << z)


def x2lon(x: float, z: int) -> float:
    return x / (1 << z) * 360.0 - 180.0


def y2lat(y: float, z: int) -> float:
    n = math.pi * (1.0 - 2.0 * y / (1 << z))
    return math.degrees(math.atan(math.sinh(n)))


def fetch(z: int, x: int, y: int) -> np.ndarray:
    path = os.path.join(CACHE, f"{z}_{x}_{y}.png")
    if not os.path.exists(path):
        url = BASE.format(z=z, x=x, y=y)
        req = urllib.request.Request(url, headers={"User-Agent": "canakkale-1915/0.1"})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=40) as r:
                    blob = r.read()
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 3:
                    print(f"  ! {z}/{x}/{y} başarısız: {exc}", file=sys.stderr)
                    return np.zeros((256, 256), dtype=np.int16)
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "wb") as fh:
            fh.write(blob)
    with open(path, "rb") as fh:
        img = Image.open(io.BytesIO(fh.read())).convert("RGB")
    a = np.asarray(img, dtype=np.float32)
    h = a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0 - 32768.0
    return np.rint(h).astype(np.int16)


def main() -> None:
    x0, x1 = int(math.floor(lon2x(WEST, Z))), int(math.ceil(lon2x(EAST, Z)))
    y0, y1 = int(math.floor(lat2y(NORTH, Z))), int(math.ceil(lat2y(SOUTH, Z)))
    cols, rows = x1 - x0, y1 - y0
    print(f"zoom {Z}: {cols}x{rows} = {cols * rows} karo, {cols * 256}x{rows * 256} px")

    grid = np.zeros((rows * 256, cols * 256), dtype=np.int16)
    jobs = [(x, y) for y in range(y0, y1) for x in range(x0, x1)]

    done = 0
    with ThreadPoolExecutor(max_workers=16) as pool:
        for (x, y), tile in zip(jobs, pool.map(lambda j: fetch(Z, j[0], j[1]), jobs)):
            gy, gx = (y - y0) * 256, (x - x0) * 256
            grid[gy : gy + 256, gx : gx + 256] = tile
            done += 1
            if done % 40 == 0:
                print(f"  {done}/{len(jobs)}")

    bbox = [x2lon(x0, Z), y2lat(y1, Z), x2lon(x1, Z), y2lat(y0, Z)]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    np.savez_compressed(OUT, elev=grid, bbox=np.array(bbox), z=Z, x0=x0, y0=y0)
    land = int((grid >= 0).sum())
    print(
        f"yazıldı {OUT}  şekil={grid.shape}  bbox={bbox}\n"
        f"  yükseklik {grid.min()}..{grid.max()} m, kara oranı {land / grid.size:.1%}"
    )


if __name__ == "__main__":
    main()
