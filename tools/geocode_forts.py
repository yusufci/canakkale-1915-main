#!/usr/bin/env python3
"""Tabya / kale konumlarını Nominatim ile koordinatlandır.

Çıktı: tools/data/forts_geo.json
Bulunamayan tabyalar raporlanır; uydurma koordinat üretilmez.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "data", "forts_geo.json")
UA = "canakkale-1915-game/0.1 (tabya konumlari)"

QUERIES: list[tuple[str, list[str]]] = [
    ("seddulbahir", ["Seddülbahir Kalesi, Eceabat", "Seddülbahir Hisarı, Çanakkale"]),
    ("ertugrul", ["Ertuğrul Tabyası, Eceabat, Çanakkale"]),
    ("kumkale", ["Kumkale, Çanakkale Merkez", "Kumkale Köyü, Çanakkale"]),
    ("orhaniye", ["Orhaniye Tabyası, Çanakkale", "Orhaniye, Çanakkale Merkez"]),
    ("dardanos", ["Dardanos Tabyası, Çanakkale", "Hasan Mevsuf Şehitliği, Çanakkale",
                  "Dardanos Şehitliği, Çanakkale", "Çınarlı Köyü - Dardanos Mevkii, Çanakkale"]),
    ("rumeli_mecidiye", ["Rumeli Mecidiye Tabyası, Eceabat, Çanakkale"]),
    ("rumeli_hamidiye", ["Rumeli Hamidiye Tabyası, Eceabat, Çanakkale",
                         "Hamidiye Tabyası, Kilitbahir", "Hamidiye II Tabyası, Eceabat"]),
    ("namazgah", ["Namazgâh Tabyası, Kilitbahir, Çanakkale", "Namazgah Tabyası, Eceabat"]),
    ("kilitbahir_kale", ["Kilitbahir Kalesi, Eceabat, Çanakkale"]),
    ("cimenlik", ["Çimenlik Kalesi, Çanakkale"]),
    ("anadolu_hamidiye", ["Anadolu Hamidiye Tabyası, Çanakkale"]),
    ("anadolu_mecidiye", ["Anadolu Mecidiye Tabyası, Çanakkale",
                          "Mecidiye Tabyası, Çanakkale Merkez", "Mecidiye Tabya, Çanakkale"]),
    ("yildiz_rumeli", ["Yıldız Tabya, Kilitbahir, Çanakkale", "Yıldız Tabyası, Eceabat",
                       "Yıldız Tabya, Eceabat, Çanakkale"]),
    ("nagara_kale", ["Nara Kalesi, Çanakkale", "Nara Burnu, Çanakkale"]),
    ("merkez_bolayir", ["Merkez Tabya, Bolayır, Gelibolu", "Çimpe Kalesi, Bolayır",
                        "Bolayır Tabyası, Gelibolu"]),
    ("yildiz_bolayir", ["Yıldız Tabya, Bolayır, Gelibolu", "Yıldız Tabyası, Bolayır"]),
    ("degirmenburnu", ["Değirmenburnu, Eceabat, Çanakkale", "Değirmen Burnu, Eceabat",
                       "Değirmenburnu Tabyası, Çanakkale"]),
    ("kepez_burnu", ["Kepez Burnu, Çanakkale", "Kepez Burnu, Çanakkale Merkez"]),
    ("rumeli_mesudiye", ["Rumeli Mesudiye Bataryası, Eceabat", "Mesudiye Bataryası, Çanakkale",
                         "Baykuş Tepesi, Eceabat, Çanakkale"]),
    ("hamidiye_sehitligi", ["Hamidiye Tabyası, Çanakkale"]),
]


def geocode(q: str) -> dict | None:
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"format": "jsonv2", "limit": 1, "q": q}
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    if not data:
        return None
    h = data[0]
    return {
        "lon": float(h["lon"]),
        "lat": float(h["lat"]),
        "osm": f"{h['osm_type']}/{h['osm_id']}",
        "display": h["display_name"],
        "query": q,
        "src": "https://nominatim.openstreetmap.org/ (OSM, ODbL)",
    }


def main() -> None:
    cache: dict = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            cache = json.load(fh)

    missing = []
    for key, variants in QUERIES:
        if key in cache:
            continue
        hit = None
        for q in variants:
            try:
                hit = geocode(q)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {key}: {exc}")
                hit = None
            time.sleep(1.1)
            if hit:
                break
        if hit is None:
            missing.append(key)
            print(f"  ? {key}: BULUNAMADI")
        else:
            cache[key] = hit
            print(f"  + {key}: {hit['lon']:.5f},{hit['lat']:.5f}  {hit['display'][:58]}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\n{len(cache)} tabya konumu -> {OUT}")
    if missing:
        print("EKSİK (elle doğrulanmalı):", ", ".join(missing))


if __name__ == "__main__":
    main()
