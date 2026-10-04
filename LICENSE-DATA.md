# Veri lisansları ve atıf

Kodun lisansı MIT'tir (`LICENSE`). **Veri dosyaları farklı lisanslara tabidir.**
Bu projeyi çatallayan, dağıtan veya barındıran herkesin aşağıdakilere uyması
gerekir.

---

## 1. Harita verisi — ODbL (türetilmiş veritabanı)

**Kapsam:** `src/data/map.json`, `public/relief.png`

Bu dosyalar iki kaynaktan **türetilmiş bir veritabanıdır**:

| Kaynak | Ne alındı | Lisans |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) / [Nominatim](https://nominatim.openstreetmap.org/) | Yer adı ve tabya koordinatları (`tools/data/places.json`, `forts_geo.json` üzerinden il tohumları) | **ODbL 1.0** |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (terrarium, z12) | Yükseklik ızgarası, kıyı çizgisi, tepe gölgelemesi | Karma — aşağıya bakın |

OSM verisi ODbL kapsamında olduğundan ve il sınırları OSM koordinatlarından
tohumlandığından, **türetilmiş veritabanı da ODbL ile dağıtılır.** Yani:

* Atıf zorunludur: *"Harita verisi © OpenStreetMap katılımcıları, ODbL 1.0"*
* Bu veriyi değiştirip dağıtırsanız, değiştirilmiş veritabanını da **ODbL ile**
  yayımlamanız gerekir.
* ODbL metni: <https://opendatacommons.org/licenses/odbl/1-0/>

Oyun bu atfı açılış ekranında ve bu dosyada yapar.

### AWS Terrain Tiles alt kaynakları

Terrain Tiles birden çok veri setinin birleşimidir; başlıcaları bu bölgede:

* **SRTM** (NASA/USGS) — kamu malı
* **ETOPO1** (NOAA) — kamu malı
* Yerel yüksek çözünürlüklü setler — kaynağa göre değişir

Tam liste ve atıf koşulları:
<https://github.com/tilezen/joerd/blob/master/docs/attribution.md>

---

## 2. Tarihsel veri — olgular serbest, metin bize ait

**Kapsam:** `src/data/forts.ts`, `minefields.ts`, `guns.ts`, `oob.ts`,
`commanders.ts`, `events.ts`

Tabya envanteri, top menzilleri, mayın sayıları, muharebe tarihleri gibi
**olgular telif konusu değildir.** Bu dosyalardaki Türkçe açıklama metinleri bu
proje için yazılmıştır ve MIT kapsamındadır.

Her kaydın `src` alanı kaynağını gösterir. Kullanılan kaynaklar:

* **Barış Borlat**, *Çanakkale Savaşları Kronolojisi (28 Haziran 1914 –
  9 Ocak 1916)*, Çanakkale Onsekiz Mart Üniversitesi —
  <https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html>
  Mayın hatlarının tarihleri ve döken gemiler, 18 Mart'ın saat saat akışı,
  25 Nisan konuşlanması, kayıp rakamları.

* **Piotr Nykiel**, *Naval Operations in the Dardanelles 1915* —
  <https://www.navyingallipoli.com/>
  Tabya silah envanteri, top teknik özellikleri, donanma listeleri,
  komutanlar. **Sitenin içeriği © Piotr Nykiel'dir.** Buradan yalnızca olgusal
  veriler (kalibre, adet, menzil, tarih) alınmış, metinler kopyalanmamıştır.

* **Wikipedia**, *Naval operations in the Dardanelles campaign* —
  <https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign>
  CC BY-SA 4.0. Yalnızca olgusal veri alınmıştır; alıntı yapılmamıştır.

---

## 3. Görsel dil — referans, kopya değil

Oyunun renk paleti, [@destanevreni](https://www.instagram.com/destanevreni/)
tarafından yapılmış bir Çanakkale 1915 harita animasyonundan ffmpeg kare
örneklemesiyle **ölçülmüştür** (t=35s, 75s, 110s kareleri).

* Alınan şey: ham renk değerleri (`#030810`, `#ffc354`, `#e4544a` …) ve genel
  görsel yön. Renk değerleri telif konusu değildir.
* **Videonun kendisi bu depoda yoktur** ve dağıtılmaz (`.gitignore` ile dışlanır).
* Videodan hiçbir kare, grafik, yazı tipi dosyası veya ses alınmamıştır.
* Haritanın tamamı bağımsız olarak açık veriden üretilmiştir (bkz. 1. bölüm).

İlhamı için @destanevreni'ye teşekkürler.

---

## 4. Yazı tipleri

* **Archivo** — SIL Open Font License 1.1
* **JetBrains Mono** — SIL Open Font License 1.1

Google Fonts üzerinden CDN ile yüklenir; depoda font dosyası yoktur.

---

## 5. Bağımlılıklar

* **PixiJS** — MIT
* **Vite**, **TypeScript**, **tsx** — MIT / Apache-2.0

---

## Özet

| Ne | Lisans |
| --- | --- |
| `src/**` (map.json hariç), `tools/**`, `test/**` | MIT |
| `src/data/map.json`, `public/relief.png` | **ODbL 1.0** |
| Tarihsel olgular | Telifsiz; kaynaklar `src` alanlarında |
