<div align="center">

# Çanakkale 1915

**Tur tabanlı stratejik savaş oyunu.** 19 Şubat 1915 – 9 Ocak 1916, Çanakkale Boğazı.

[![Oyna](https://img.shields.io/badge/▶_OYNA-canlı_demo-ffc354?style=for-the-badge&labelColor=000000)](https://canakkale-1915.vercel.app)
[![Kod MIT](https://img.shields.io/badge/kod-MIT-6e8fc0?style=flat-square&labelColor=000000)](LICENSE)
[![Veri ODbL](https://img.shields.io/badge/harita_verisi-ODbL-d94f3d?style=flat-square&labelColor=000000)](LICENSE-DATA.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&labelColor=000000)](tsconfig.json)
[![PixiJS](https://img.shields.io/badge/PixiJS-8-e72264?style=flat-square&labelColor=000000)](https://pixijs.com)

</div>

---

Bir tur bir gündür. HOI4'ten alınan sistemler — cephe genişliği, organizasyon,
siperlenme, tahkimat, ikmal ağı, komutan özellikleri, harita modları — günlük
tur çözümüne uyarlanmıştır. HOI4'ün saatlik tick'i yerine burada tek bir gün
24 muharebe saati sayılır.

Harita uydurma değil: kıyı çizgisi ve rölyef **gerçek yükseklik verisinden**,
yer adları ve tabya konumları **OpenStreetMap'ten** türetildi. Üretilen
haritada Dar Boğaz 1,40 km ölçülüyor — kaynaklardaki 1.600 yarda (1.500 m) ile
uyumlu.

```bash
git clone https://github.com/everyoneexe/canakkale-1915.git
cd canakkale-1915
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # 19 motor regresyon testi
npm run build      # tsc --noEmit + vite build
```

> Harita verisi (`src/data/map.json`, `public/relief.png`) depoda hazır gelir.
> Yeniden üretmek istersen "Harita nasıl üretildi" bölümüne bak — ~400 MB
> indirme gerektiriyor, çıktı ise 900 KB.

## Oynanış

İki taraftan biri seçilir.

* **Osmanlı** — boğazı savun. Mayın dök, tabyaların mühimmatını yönet,
  çıkarmaları sahilde karşıla.
* **İtilaf** — boğazı zorla. Mayınları tara, tabyaları sustur, Marmara'ya çık.

Haritada tıklama kendi birliğini seçer; sağ panelden emir verilir. Hedef
isteyen emirlerde harita hedef seçme kipine girer (iptal: `Esc`). `1`–`5`
harita modunu değiştirir, `Boşluk` turu bitirir, `M` sesi açar/kapatır, `Tab`
sırayla emirsiz birliklere odaklanır.

### Zafer koşulları

| Taraf | Koşul |
| --- | --- |
| İtilaf | Dar Boğaz + Nağara + Marmara Ağzı'nı ele geçirmek |
| İtilaf | Kilitbahir platosu ve Çanakkale'yi almak |
| Osmanlı | İtilaf'ın 6 büyük gemi BATIRMASI (savaş dışı kalan sayılmaz) |
| Osmanlı | 9 Ocak 1916'ya kadar dayanmak |

## Kampanyanın mekaniği

Tarihsel kilit döngü birebir modellenmiştir:

1. **Tabyalar mayın hatlarını korur.** Menzildeki tabya susturulmadıkça
   tarayıcılar çalışamaz — sivil mürettebatlı zırhsız balıkçı tekneleri ateş
   altında işe yanaşmadı (`nerveFactor`, `naval.ts`).
2. **Mayın hatları tabyaları korur.** Mayınlar temizlenmeden zırhlılar dar
   boğaza giremez.
3. **Akıntı taramayı boğar.** 4 knotlık yüzey akıntısına karşı 9 knotlık
   tarayıcı neredeyse duruyor (`currentFactor`).
4. **Kıyı topçusu gemi batırmaz, savaş dışı bırakır.** 18 Mart'ta Inflexible,
   Gaulois, Suffren ve Agamemnon savaş dışı kaldı; batan üç zırhlının üçü de
   mayına gitti. Motor bunu bir kural olarak uygular (`CRIPPLED_HULL`).
5. **Nusret'in hattı görünmez.** 8 Mart'ta dökülen 11. hat, Şubat'tan beri
   bilinen Kepez hatlarının aksine İtilaf'ın haritasında yoktur. Keşif uçuşu
   ya da tarama bulana kadar oyuncuya da gösterilmez.
6. **Mühimmat Osmanlı'nın darboğazı.** Havuz 45.000 atışta tavanlanır;
   Liman von Sanders'in raporu: "Düşman çok cephane az insan harcıyor, biz pek
   çok insan az cephane feda ediyoruz."

## Harita nasıl üretildi

`src/data/map.json` ve `public/relief.png` türetilmiş dosyalardır:

```bash
python3 -m venv .venv && .venv/bin/pip install numpy scipy pillow scikit-image
python3 tools/fetch_terrain.py    # AWS Terrain Tiles z12, ~360 karo
python3 tools/geocode.py          # yer adları  -> tools/data/places.json
python3 tools/geocode_forts.py    # tabyalar    -> tools/data/forts_geo.json
.venv/bin/python tools/build_map.py
```

* **Yükseklik ve kıyı çizgisi**: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
  (terrarium, z12 ≈ 29 m/px). Terrarium'da deniz tam 0 m'dir; kıyı çizgisi
  kenardan flood-fill ile ayrılan 0 m eşiğinden çıkarılır. Böylece rölyef ve
  kıyı tek ve tutarlı bir kaynaktan gelir.
* **Yer adları ve tabya konumları**: OpenStreetMap / Nominatim (ODbL).
* **İl bölünmesi**: tohum işaretli **havza bölütlemesi** (maske içinde jeodezik
  Voronoi). Öklit Voronoi kullanılamaz — düz çizgi mesafesi suyu umursamadığı
  için Bozcaada tohumu karşı kıyıdaki Anadolu sahilini yutuyordu.
* **Doğrulama**: üretilen haritada Dar Boğaz 1,40 km ölçülüyor; kaynaklardaki
  1.600 yarda (1.500 m) ile uyumlu. Erenköy Körfezi 7,43 km; kaynaklarda
  4,5 mil (7,2 km). Bu kontrol `test/engine.test.ts` içinde sabitlenmiştir.

Overpass API denendi ve kullanılamadı (ana sunucu dispatcher hatası veriyor,
`overpass.osm.ch` yalnız İsviçre'yi kapsıyor). Yükseklik verisinden kıyı
türetmek hem çalıştı hem de rölyefle %100 tutarlı sonuç verdi.

## Tarihsel kaynaklar

Veri dosyalarındaki her kayıt `src` alanı taşır.

* Barış Borlat, **Çanakkale Savaşları Kronolojisi (28 Haziran 1914 – 9 Ocak 1916)**,
  Çanakkale Onsekiz Mart Üniversitesi —
  <https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html>
  (mayın hatlarının tarihleri ve döken gemiler, 18 Mart saat saat, 25 Nisan
  konuşlanma, kayıp rakamları)
* Piotr Nykiel, **Naval Operations in the Dardanelles 1915** —
  <https://www.navyingallipoli.com/> (tabya silah envanteri, top teknik
  özellikleri, İtilaf ve Osmanlı donanma listeleri, komutanlar)
* **Naval operations in the Dardanelles campaign**, Wikipedia —
  <https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign>

### Veride bilinçli olarak işaretlenen belirsizlikler

* **Hat başına mayın sayısı** kaynaklarda hat hat verilmiyor. Toplam (403) ve
  hat sayısı (11) kesin; dağılım oyun değeridir ve `countApprox: true` ile
  işaretlidir. Kesin olan tek hat: 11. hat (Nusret) = 26 mayın.
* **Altı tabyanın konumu** OSM'de kayıtlı değil (Rumeli Hamidiye, Anadolu
  Mecidiye, Yıldız ×2, Rumeli Mesudiye, Kepez). Bunlar kaynaktaki tarife göre
  ilgili tabya grubunun içine yerleştirilmiş, `approx: true` ve nasıl
  türetildiğini anlatan `posNote` ile işaretlenmiştir. Ölçülmüş koordinat
  değildirler.
* **Nusret hattı**: İngiliz kaynakları 20 mayın ve 15 ft derinlik yazar, Türk
  kaynakları 26 mayın ve 4,5 m der. Oyunda Türk rakamı esas alındı, fark
  `minefields.ts` içinde not düşüldü.
* **Bouvet'nin batışı**: Nykiel geminin mayına değil Türk topçu ateşine
  gittiğini savunur. Oyun 18 Mart olay metninde iki görüşü de aktarır.
* **Deniz illerinin merkezleri** tarihsel bir iddia değil, oyun tasarımı gereği
  seçilmiş bölme noktalarıdır (`build_map.py` içinde `"tasarım"` olarak etiketli).

## Görsel dil

Renkler [@destanevreni'nin Çanakkale 1915 harita animasyonundan](.) ffmpeg kare
örneklemesiyle birebir çıkarıldı (t=35s, 75s, 110s):

| | |
| --- | --- |
| zemin | `#000000` |
| deniz | `#030810` |
| kara (alçak → zirve) | `#1a1610` → `#57411b` |
| kıyı çizgisi | `#d9a441` |
| vurgu | `#ffc354` |
| mayın | `#e4544a` |
| gemi | `#5d7296` |

Tipografi: başlıklarda Archivo 800, her yerde JetBrains Mono. Rölyef, kuzeybatı
ışıklı tepe gölgelemesiyle çizilir — Conkbayırı ve Kocaçimen'in Arıburnu'na
nasıl hâkim olduğu ancak böyle okunuyor.

## Mimari

```
src/core/      types.ts (sözleşme) · geo.ts (izdüşüm, A*, çokgen)
src/data/      tarihsel veri — her kayıt kaynaklı
src/engine/    turn.ts (çözüm sırası) · combat · naval · air · supply · ai · orders
src/render/    map.ts — Pixi katmanları
src/ui/        panel.ts — seçim paneli
tools/         harita derleme zinciri (Python)
test/          regresyon testleri
```

Tur çözümü **deterministiktir**: aynı durum + aynı emirler = aynı sonuç. RNG
durumu `GameState.rngState` içinde taşınır (`test/engine.test.ts`'te sabit).

### Çözüm sırası (`turn.ts`)

1. Hava (meteorolojik) → 2. yapay zekâ emirleri → 3. hava harekâtı →
4. deniz hareketi, mayınlar, tabya ateşi, tarama, mayın dökme → 5. kara
hareketi → 6. kara muharebeleri ve çıkarmalar → 7. ikmal → 8. toparlanma,
takviye, siperlenme → 9. görüş → 10. olaylar ve zafer kontrolü.

Tabya-donanma ateşi **günde bir kez, tüm harita için birlikte** çözülür. Filo
filo çözülürse menzile giren her filo tabyanın tam çıktısını yer; ilk sürümde
tam bu oldu ve 19 Şubat'ta Ark Royal ile Amethyst battı.

## Yayına alma (Vercel)

Canlı: **<https://canakkale-1915.vercel.app>**

Statik bir site; sunucu tarafı yok. Vercel ayarları `vercel.json` içinde hazır.

[![Vercel'e Dağıt](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Feveryoneexe%2Fcanakkale-1915)

Ya da CLI ile:

```bash
npm i -g vercel
vercel login
vercel --prod
```

| Ayar | Değer |
| --- | --- |
| Framework | Vite |
| Build | `npm run build` |
| Çıktı dizini | `dist` |
| Node | 20+ |

`npm run build` önce `tsc --noEmit` çalıştırır; tip hatası varsa dağıtım
başarısız olur. Bu kasıtlıdır.

### Her push'ta otomatik dağıtım

`vercel git connect` komutu, Vercel hesabınızda bir **GitHub Login
Connection** tanımlı değilse `400` ile başarısız olur. Tek seferlik çözüm:
Vercel panelinde *Settings → Git → Connect Git Repository* ile depoyu bağlayın
(ya da hesaba GitHub ile giriş yöntemi ekleyin). Bağlandıktan sonra `main`
dalına her push üretime çıkar.

Netlify / GitHub Pages / herhangi bir statik barındırıcı da çalışır — tek
gereken `dist/` klasörünü servis etmek. `vite.config.ts` içinde `base: './'`
ayarlı olduğu için alt dizinde barındırma da sorunsuz.

## Yol haritası

Katkıya açık, önem sırasına göre:

- [ ] **Kaydet / yükle.** Durum tamamen serileştirilebilir (`rngState` dahil,
      determinizm testli) — `JSON.stringify(state)` yeterli, sadece arayüze
      bağlanmadı. *Başlamak için en kolay iş.*
- [ ] **Yapay zekâ çıkarmadan sonra pasif.** Köprübaşını tutuyor ama içeriye
      zorlamıyor. `planLandUnit` içindeki taarruz eşiği (`bestRatio > 1.45`)
      ve hedef seçimi geliştirilmeli.
- [ ] **Denge.** Osmanlı tarafı şu an belirgin biçimde daha kolay. Tarihsel
      sonuç bu, ama oyun olarak İtilaf'ın gerçek bir şansı olmalı.
- [ ] **Denizaltı harbi.** AE2, E11, E14, Muavenet-i Milliye, U-21 — hepsi
      olay metinlerinde var ama oynanabilir sistem değil.
- [ ] **Tüm Osmanlı haritası** (aşağıya bakın).
- [x] **Ses ve Gerçekçi Akustik.** Web Audio API ile sıfır harici dosya gecikmesi:
      381/355 mm ağır donanma topu kükremesi, su altı mayın patlaması, telsiz klikleri,
      çatışma alarmı ve Çanakkale Boğazı dalga ambiyansı.
- [ ] **Mobil / dokunmatik.** Arayüz masaüstü için tasarlandı.
- [ ] **İngilizce yerelleştirme.** Metinler şu an kodun içinde gömülü Türkçe.

## Sonraki adım: tüm Osmanlı haritası

Harita verisi tamamen veri odaklıdır. Genişletmek için `tools/build_map.py`
içindeki `SEEDS` listesine yeni il tohumları, `fetch_terrain.py` içindeki
`WEST/SOUTH/EAST/NORTH` kutusuna yeni sınırlar eklemek ve
`THEATRE_RADIUS_M`'yi büyütmek yeterli. Motorda tiyatroya özgü sabit yoktur;
zafer koşulları `scenario.ts` içindeki `VictoryRules` ile senaryo başına verilir.

## Katkı

PR'lar açık. Birkaç kural:

1. **Tarihsel veriye kaynak zorunlu.** Yeni tabya, birlik, olay veya rakam
   ekliyorsan `src` alanını doldur. Kaynak bulamadığın bir koordinat varsa
   uydurma — `approx: true` ve nasıl türettiğini anlatan `posNote` ekle.
2. **`npm test` ve `npm run build` geçmeli.** Testler "fonksiyon çağrıldı mı"
   testi değil; her biri fiilen yaşanmış bir hatayı yakalıyor. Denge değişikliği
   yapıyorsan `test/engine.test.ts` içindeki tarihsel sabitleri (Dar Boğaz
   genişliği, 403 mayın, kıyı topçusunun gemi batırmaması) bozmamalısın.
3. **Determinizmi bozma.** Tur çözümünde `Math.random()` kullanma; `Rng`
   örneğini geçir. "Aynı tohum aynı sonuç" testi bunu koruyor.
4. Arayüz metinleri Türkçe, kod ve tanımlayıcılar İngilizce.

Hata bildirirken hangi gün/tarihte olduğunu ve varsa günlük panelindeki
satırları ekle — tur çözümü deterministik olduğu için tohumla birlikte
yeniden üretilebilir.

## Lisans

| Ne | Lisans |
| --- | --- |
| Kaynak kod | [MIT](LICENSE) |
| `src/data/map.json`, `public/relief.png` | [**ODbL 1.0**](LICENSE-DATA.md) — türetilmiş veritabanı |
| Tarihsel olgular | Telifsiz; kaynaklar `src` alanlarında |

Harita verisi OpenStreetMap'ten türetildiği için **ODbL'nin pay-benzer koşulu
geçerlidir**: veriyi değiştirip dağıtırsan değiştirilmiş hâlini de ODbL ile
yayımlaman gerekir. Ayrıntılar ve tam atıf listesi: [LICENSE-DATA.md](LICENSE-DATA.md).

Harita verisi © OpenStreetMap katılımcıları · Yükseklik verisi: AWS Terrain
Tiles (SRTM/ETOPO1) · Görsel dil için ilham: [@destanevreni](https://www.instagram.com/destanevreni/)

