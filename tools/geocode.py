#!/usr/bin/env python3
"""Çanakkale tiyatrosundaki yer adlarını Nominatim ile koordinatlandır.

Çıktı: tools/data/places.json  {anahtar: {lon, lat, osm, display, src}}

Dikkat: Eceabat ilçesinde muharebe alanlarının adını taşıyan SOKAKLAR var
("Arıburnu Caddesi", "Kabatepe Sokak", "Conkbayırı Tüneli"...). Düz arama
bunları döndürüp bütün yer adlarını ilçe merkezine yığıyor. Bu yüzden:
  * sonuç kategorisi beyaz listeyle sınırlandırılır (highway/tunnel reddedilir),
  * her yer için beklenen koordinat penceresi (box) verilir, dışı reddedilir.
Hiçbir aday geçmezse yer "eksik" raporlanır — uydurma koordinat üretilmez.

Nominatim kullanım koşulu: saniyede 1 istek, sonuçlar diske önbelleklenir.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "data", "places.json")
UA = "canakkale-1915-game/0.1 (harita verisi derlemesi)"

OK_CATEGORIES = {"place", "natural", "historic", "waterway", "tourism", "boundary", "landuse"}
BAD_TYPES = {
    "residential", "tertiary", "secondary", "primary", "unclassified",
    "service", "track", "tunnel", "path", "footway", "street",
}

# anahtar -> (sorgular, kabul kutusu (w,s,e,n))
Q: dict[str, tuple[list[str], tuple[float, float, float, float]]] = {
    # ── Gelibolu Yarımadası, güney (Seddülbahir / Helles cephesi)
    "seddulbahir": (["Seddülbahir, Eceabat"], (26.15, 40.02, 26.24, 40.07)),
    "alcitepe": (["Alçıtepe, Eceabat"], (26.18, 40.06, 26.27, 40.13)),
    "morto_koyu": (["Morto Koyu, Eceabat"], (26.18, 40.02, 26.26, 40.08)),
    "tekke_burnu": (["Tekke Burnu, Eceabat"], (26.13, 40.02, 26.21, 40.08)),
    "zigindere": (["Zığındere, Eceabat"], (26.15, 40.05, 26.24, 40.12)),
    # ── Arıburnu / Anzak kesimi — ilçe merkezindeki sokak adlarına DİKKAT
    "ariburnu": (["Ari Burnu Cemetery", "Anzac Cove", "Arıburnu Şehitliği, Eceabat"], (26.24, 40.20, 26.32, 40.28)),
    "kabatepe": (["Kabatepe Limanı", "Kabatepe, Eceabat, Çanakkale, Türkiye"], (26.23, 40.17, 26.31, 40.24)),
    "conkbayiri": (["Conkbayırı Şehitliği", "Chunuk Bair"], (26.27, 40.21, 26.35, 40.28)),
    "kocacimentepe": (["Kocaçimentepe", "Koca Çimen Tepe, Eceabat", "Hill 971 Gallipoli"], (26.28, 40.22, 26.36, 40.30)),
    "kanlisirt": (["Kanlısırt Şehitliği", "Lone Pine Cemetery"], (26.25, 40.20, 26.33, 40.27)),
    "bigali": (["Bigalı, Eceabat, Çanakkale, Türkiye", "Bigalı Atatürk Evi"], (26.30, 40.20, 26.40, 40.28)),
    # ── Anafartalar / Suvla
    "buyuk_anafarta": (["Büyük Anafarta, Eceabat"], (26.28, 40.25, 26.38, 40.32)),
    "kucuk_anafarta": (["Küçük Anafarta, Eceabat"], (26.27, 40.27, 26.37, 40.34)),
    "tuz_golu_suvla": (["Tuz Gölü, Küçükanafarta Köyü, Eceabat", "Tuz Gölü, Küçükanafarta"], (26.21, 40.26, 26.31, 40.33)),
    "kirectepe": (["Kireçtepe, Eceabat"], (26.23, 40.31, 26.34, 40.38)),
    "kemikli_burnu": (["Kemikli Burnu", "Suvla Koyu, Eceabat", "Suvla Bay"], (26.19, 40.26, 26.31, 40.36)),
    # ── Boğaz hattı — Rumeli yakası
    "eceabat": (["Eceabat, Çanakkale, Türkiye"], (26.31, 40.16, 26.40, 40.22)),
    "kilitbahir": (["Kilitbahir, Eceabat"], (26.34, 40.12, 26.42, 40.18)),
    "gelibolu": (["Gelibolu, Çanakkale, Türkiye"], (26.62, 40.37, 26.72, 40.45)),
    "bolayir": (["Bolayır, Gelibolu"], (26.70, 40.47, 26.81, 40.56)),
    # ── Boğaz hattı — Anadolu yakası
    "canakkale_sehir": (["Çanakkale Merkez, Çanakkale, Türkiye", "Çanakkale Saat Kulesi"], (26.37, 40.11, 26.46, 40.18)),
    "kepez": (["Kepez, Çanakkale Merkez"], (26.35, 40.06, 26.44, 40.13)),
    "dardanos": (["Dardanos, Çanakkale Merkez"], (26.32, 40.05, 26.41, 40.12)),
    "erenkoy_intepe": (["İntepe, Çanakkale Merkez"], (26.27, 39.98, 26.38, 40.06)),
    "halileli": (["Halileli, Çanakkale Merkez"], (26.23, 39.94, 26.33, 40.02)),
    "kumkale": (["Kumkale, Çanakkale Merkez"], (26.18, 39.95, 26.28, 40.03)),
    "nagara": (["Nara Burnu, Çanakkale"], (26.35, 40.16, 26.45, 40.24)),
    "lapseki": (["Lapseki, Çanakkale"], (26.63, 40.30, 26.74, 40.39)),
    "truva": (["Troya Antik Kenti, Çanakkale"], (26.19, 39.92, 26.29, 40.00)),
    "guzelyali": (["Güzelyalı, Çanakkale Merkez"], (26.30, 40.01, 26.40, 40.09)),
    # ── Adalar / İtilaf üsleri
    "bozcaada": (["Bozcaada, Çanakkale"], (25.99, 39.78, 26.15, 39.90)),
    "gokceada": (["Gökçeada, Çanakkale"], (25.62, 40.09, 26.03, 40.31)),
}


def search(q: str, box: tuple[float, float, float, float] | None) -> list[dict]:
    params: dict = {"format": "jsonv2", "limit": 10, "q": q}
    if box is not None:
        w, s, e, n = box
        # viewbox: sol,üst,sağ,alt ; bounded=1 kutu dışını sunucuda eler
        params["viewbox"] = f"{w},{n},{e},{s}"
        params["bounded"] = 1
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def pick(hits: list[dict], box: tuple[float, float, float, float]) -> dict | None:
    w, s, e, n = box
    for h in hits:
        if h.get("category") not in OK_CATEGORIES:
            continue
        if h.get("type") in BAD_TYPES:
            continue
        lon, lat = float(h["lon"]), float(h["lat"])
        if not (w <= lon <= e and s <= lat <= n):
            continue
        return {
            "lon": lon,
            "lat": lat,
            "osm": f"{h['osm_type']}/{h['osm_id']}",
            "category": f"{h['category']}/{h['type']}",
            "display": h["display_name"],
            "src": "https://nominatim.openstreetmap.org/ (OpenStreetMap, ODbL)",
        }
    return None


def main() -> None:
    cache: dict = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as fh:
            cache = json.load(fh)

    missing = []
    for key, (variants, box) in Q.items():
        if key in cache:
            continue
        hit = None
        # Önce kutuya sınırlı ara; Nominatim bazı köy/doğa nesnelerini bounded
        # modda döndürmüyor, o yüzden sonra sınırsız arayıp kutuyla kendimiz eleriz.
        for q in variants:
            for box_arg in (box, None):
                try:
                    hit = pick(search(q, box_arg), box)
                except Exception as exc:  # noqa: BLE001
                    print(f"  ! {key}: {exc}")
                    hit = None
                time.sleep(1.1)
                if hit:
                    break
            if hit:
                hit["query"] = q
                break
        if hit is None:
            missing.append(key)
            print(f"  ? {key}: BULUNAMADI")
        else:
            cache[key] = hit
            print(
                f"  + {key:16s} {hit['lon']:.5f},{hit['lat']:.5f}"
                f"  [{hit['category']}] {hit['display'][:48]}"
            )

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\n{len(cache)} yer -> {OUT}")
    if missing:
        print("EKSİK:", ", ".join(missing))


if __name__ == "__main__":
    main()
