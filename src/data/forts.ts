import type { FortGroup } from '../core/types.ts';

/**
 * Çanakkale Müstahkem Mevki tabyaları, Mart 1915.
 *
 * Silah envanteri: Piotr Nykiel, "Naval Operations in the Dardanelles 1915"
 *   https://www.navyingallipoli.com/Forts.asp  (her tabyanın kendi sayfası)
 * Tabya numaraları (No. n) İngiliz kaynaklarındaki numaralandırmadır:
 *   https://www.navyingallipoli.com/pdfs/forts.pdf
 *
 * Konumlar: OpenStreetMap / Nominatim (ODbL). `approx: true` olanlar OSM'de
 * kayıtlı değildir; kaynakta tarif edilen tabya grubunun içine, belirtilen
 * referans noktasına göre yerleştirilmiştir. Bunlar ÖLÇÜLMÜŞ koordinat
 * DEĞİLDİR ve `posNote` alanında nasıl türetildikleri yazılıdır.
 */

export interface FortSpec {
  readonly id: string;
  readonly name: string;
  readonly nameEn?: string;
  /** İngiliz kaynaklarındaki tabya numarası. */
  readonly fortNo?: string;
  readonly shore: 'rumeli' | 'anadolu';
  readonly group: FortGroup;
  readonly lon: number;
  readonly lat: number;
  /** Konum ölçülmemiş, kaynak tarifinden yerleştirilmişse true. */
  readonly approx?: boolean;
  readonly posNote?: string;
  /** topId -> adet */
  readonly guns: Readonly<Record<string, number>>;
  /** Hareketli obüs bataryası — bombardımandan sonra yer değiştirebilir. */
  readonly mobile?: boolean;
  readonly note?: string;
  readonly src: string;
  readonly geoSrc: string;
}

const OSM = 'https://nominatim.openstreetmap.org/ (OpenStreetMap, ODbL)';

export const FORTS: readonly FortSpec[] = [
  // ══ DIŞ TAHKİMAT (Boğaz girişi) ═══════════════════════════════════════
  // 25 Şubat 1915'te İtilaf donanması tarafından susturuldu; 26 Şubat'ta
  // İngiliz imha müfrezeleri topları havaya uçurdu.
  {
    id: 'ertugrul',
    name: 'Ertuğrul Tabyası',
    fortNo: 'No. 1',
    shore: 'rumeli',
    group: 'dis',
    lon: 26.1816,
    lat: 40.04467,
    guns: { krupp_240_35: 2 },
    note:
      '19 Şubat 1915\'te Agamemnon\'a beş isabet kaydetti; biri mermi deposunun ' +
      '30 cm yakınında durdu. 25 Şubat\'ta Queen Elizabeth topları tahrip etti.',
    src: 'https://www.navyingallipoli.com/Fort_European_Ertugrul.asp',
    geoSrc: `${OSM} way/667064293`,
  },
  {
    id: 'seddulbahir',
    name: 'Seddülbahir Tabyası',
    fortNo: 'No. 3',
    shore: 'rumeli',
    group: 'dis',
    lon: 26.18779,
    lat: 40.04196,
    guns: { krupp_280_22: 2, krupp_260_22: 2, krupp_240_22: 2, krupp_87_24: 6, aa_37: 2 },
    note:
      '3 Kasım 1914 bombardımanında üst üste iki mermi merkez cephaneliğine ' +
      'isabet etti; 360 ağır mermi ve 11 ton barut infilak etti, 5 subay ve ' +
      '81 er şehit oldu — Çanakkale\'nin "ilk şehitleri".',
    src: 'https://www.navyingallipoli.com/Fort_European_Seddulbahir.asp',
    geoSrc: `${OSM} way/217554476`,
  },
  {
    id: 'orhaniye',
    name: 'Orhaniye Tabyası',
    fortNo: 'No. 4',
    shore: 'anadolu',
    group: 'dis',
    lon: 26.1862,
    lat: 39.99263,
    guns: { krupp_240_35: 2, aa_37: 2 },
    note:
      'Kampanyanın ilk topu buradan atıldı: 19 Şubat 1915, 07.58. Alman ' +
      'komutanı Yüzbaşı Hans Woermann aynı gün şehit düştü.',
    src: 'https://www.navyingallipoli.com/Fort_Asian_Orhaniye.asp',
    geoSrc: `${OSM} way/1135419612`,
  },
  {
    id: 'kumkale',
    name: 'Kumkale Tabyası',
    fortNo: 'No. 6',
    shore: 'anadolu',
    group: 'dis',
    lon: 26.23703,
    lat: 39.98159,
    guns: {
      krupp_280_22: 2,
      krupp_260_22: 2,
      krupp_240_22: 2,
      krupp_210_22: 1,
      krupp_150_26: 1,
    },
    src: 'https://www.navyingallipoli.com/Fort_Asian_Kumkale.asp',
    geoSrc: `${OSM} node/959686363`,
  },

  // ══ ARA TAHKİMAT (Kepez — Erenköy) ════════════════════════════════════
  // Mayın hatlarını koruyan asıl kuvvet. Mayın tarayıcılarını kovalayan
  // bataryalar bunlardır; 18 Mart'ta hiç susturulamadılar.
  {
    id: 'rumeli_mesudiye',
    name: 'Rumeli Mesudiye Bataryası',
    fortNo: 'No. 7',
    shore: 'rumeli',
    group: 'ara',
    lon: 26.283,
    lat: 40.1055,
    approx: true,
    posNote:
      'OSM\'de kayıtlı değil. Nykiel bataryayı "Baykuş Tepesi"ne, Erenköy/İntepe ' +
      'karşısındaki Rumeli kıyısına yerleştiriyor; Alçıtepe (26.2273,40.0949) ile ' +
      'Kilitbahir arasındaki boğaza bakan sırta konuldu.',
    guns: { vickers_150_45: 3 },
    note:
      'Topları 13 Aralık 1914\'te B-11 denizaltısının batırdığı Mesudiye ' +
      'zırhlısından söküldü; mürettebatı da o geminin denizcileriydi.',
    src: 'https://www.navyingallipoli.com/Fort_European_Mesudiye.asp',
    geoSrc: 'kaynak tarifinden yerleştirildi (yaklaşık)',
  },
  {
    id: 'dardanos',
    name: 'Dardanos (Hasan Mevsuf) Bataryası',
    fortNo: 'No. 8',
    shore: 'anadolu',
    group: 'ara',
    lon: 26.3666,
    lat: 40.08418,
    guns: { krupp_150_40: 5 },
    note:
      'İki topu Muin-i Zafer korvetinden, üçü Âsâr-ı Tevfik zırhlısından geldi. ' +
      '18 Mart\'ta şehit düşen komutan Teğmen Hasan Hulûsi ve Asteğmen Mevsuf ' +
      'anısına 16 Mayıs 1915\'te adı "Hasan Mevsuf" oldu.',
    src: 'https://www.navyingallipoli.com/Fort_Asian_Dardanos.asp',
    geoSrc: `${OSM} relation/12312190`,
  },
  {
    id: 'kepez_obus',
    name: 'Kepez Obüs Bataryaları',
    shore: 'anadolu',
    group: 'obus',
    lon: 26.39313,
    lat: 40.09551,
    mobile: true,
    guns: { skoda_149_20: 4, krupp_150_17_obus: 4 },
    note:
      'Hareketli obüsler. Mayın tarayıcılarını kovalayan asıl ateş kaynağı; ' +
      'mevzi değiştirdikleri için donanma bir türlü susturamadı.',
    src: 'https://www.navyingallipoli.com/Artillery_Field.asp',
    geoSrc: `${OSM} Kepez Beldesi`,
  },
  {
    id: 'erenkoy_obus',
    name: 'Erenköy / İntepe Obüs Bataryaları',
    shore: 'anadolu',
    group: 'obus',
    lon: 26.33168,
    lat: 40.01357,
    mobile: true,
    guns: { krupp_150_17_obus: 4, krupp_120_obus: 4, krupp_75_30: 4 },
    note:
      'Erenköy Körfezi\'ne hâkim sırtlar. 18 Mart sabahı ilk karşılığı bu ' +
      'bataryalar verdi (11.15, Triumph\'a karşı).',
    src: 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html',
    geoSrc: `${OSM} İntepe`,
  },
  {
    id: 'halileli_obus',
    name: 'Halileli Bataryaları',
    shore: 'anadolu',
    group: 'obus',
    lon: 26.27642,
    lat: 39.97382,
    mobile: true,
    guns: { krupp_120_obus: 4, krupp_77_27: 4 },
    note: '3 Mart 1915\'te Albion, Prince George ve Triumph tarafından dövüldü.',
    src: 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html',
    geoSrc: `${OSM} Halileli`,
  },

  // ══ İÇ TAHKİMAT (Dar Boğaz: Çanakkale — Kilitbahir) ═══════════════════
  // Boğazın en dar yeri, 1.500 m. Ağır toplar burada.
  {
    id: 'yildiz_rumeli',
    name: 'Yıldız Tabya',
    fortNo: 'No. 9',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.3685,
    lat: 40.1365,
    approx: true,
    posNote:
      'OSM\'de kayıtlı değil. Nykiel "Kilitbahir\'in güneybatısı" diyor; ' +
      'Rumeli Mecidiye (26.3739,40.1411) referansıyla güneybatıya yerleştirildi.',
    guns: { krupp_150_26: 6 },
    src: 'https://www.navyingallipoli.com/Fort_European_Yildiz.asp',
    geoSrc: 'kaynak tarifinden yerleştirildi (yaklaşık)',
  },
  {
    id: 'rumeli_mecidiye',
    name: 'Rumeli Mecidiye Tabyası',
    nameEn: 'Yeni Medjidié',
    fortNo: 'No. 13',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.3739,
    lat: 40.14114,
    guns: { krupp_280_22: 2, krupp_240_35: 4 },
    note:
      'Seyit Onbaşı\'nın tabyası. 18 Mart\'ta vinci parçalanınca 215 kg\'lık ' +
      '240 mm mermileri sırtında taşıdığı anlatılır. Yüzbaşı Hilmi\'nin ' +
      '240/35 topunun Bouvet\'yi batırdığına inanılır.',
    src: 'https://www.navyingallipoli.com/Fort_European_Mecidiye.asp',
    geoSrc: `${OSM} way/1316767903`,
  },
  {
    id: 'rumeli_hamidiye',
    name: 'Rumeli Hamidiye Tabyası',
    nameEn: 'Hamidieh II',
    fortNo: 'No. 16',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.3812,
    lat: 40.1512,
    approx: true,
    posNote:
      'OSM\'de kayıtlı değil. Kilitbahir grubunda, Namazgâh (26.3800,40.1450) ile ' +
      'Değirmenburnu (26.3766,40.1556) arasındaki boğaza bakan kıyı kesimine ' +
      'yerleştirildi.',
    guns: { krupp_355_35: 2 },
    note: 'Boğazın en ağır iki topundan biri burada — 355 mm, 16.900 m menzil.',
    src: 'https://www.navyingallipoli.com/Fort_European_Hamidiye.asp',
    geoSrc: 'kaynak tarifinden yerleştirildi (yaklaşık)',
  },
  {
    id: 'namazgah',
    name: 'Namazgâh Tabyası',
    fortNo: 'No. 17',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.37995,
    lat: 40.14499,
    guns: { krupp_260_22: 2, krupp_240_35: 2, krupp_240_22: 5, krupp_210_22: 7 },
    note:
      'Boğazın en kalabalık tabyası — 16 namlu. 18 Mart 15.15\'te kışlasına ' +
      'düşen mermi çatıyı uçurdu.',
    src: 'https://www.navyingallipoli.com/Fort_European_Namazgah.asp',
    geoSrc: `${OSM} way/333582249`,
  },
  {
    id: 'degirmenburnu',
    name: 'Değirmenburnu Tabyası',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.37655,
    lat: 40.15556,
    guns: { krupp_150_26: 4 },
    src: 'https://www.navyingallipoli.com/pdfs/forts.pdf',
    geoSrc: `${OSM} way/1316826216`,
  },
  {
    id: 'kilitbahir_kale',
    name: 'Kilitbahir Kalesi',
    shore: 'rumeli',
    group: 'ic',
    lon: 26.37926,
    lat: 40.14777,
    guns: { krupp_87_24: 6 },
    note: 'Fatih devri kalesi; 1915\'te hafif top mevzii ve gözetleme noktası.',
    src: 'https://www.navyingallipoli.com/Forts.asp',
    geoSrc: `${OSM} relation/7330312`,
  },
  {
    id: 'anadolu_hamidiye',
    name: 'Anadolu Hamidiye Tabyası',
    nameEn: 'Hamidieh I',
    fortNo: 'No. 19',
    shore: 'anadolu',
    group: 'ic',
    lon: 26.40278,
    lat: 40.1375,
    guns: { krupp_355_35: 2, krupp_240_35: 7 },
    note:
      'Boğazın en güçlü tabyası — 9 ağır namlu. 18 Mart 13.20\'de Bouvet\'yi ' +
      'ateş altına aldı; 14.00\'te gemi yan yattı ve üç dakikada battı.',
    src: 'https://www.navyingallipoli.com/Fort_Asian_Hamidiye.asp',
    geoSrc: `${OSM} way/303002619`,
  },
  {
    id: 'cimenlik',
    name: 'Çimenlik Tabyası',
    nameEn: 'Hamidiye 3 / Chemenlek',
    fortNo: 'No. 20',
    shore: 'anadolu',
    group: 'ic',
    lon: 26.39909,
    lat: 40.14634,
    guns: { krupp_355_35: 1, krupp_240_22: 1, krupp_210_22: 1 },
    note:
      '18 Mart 12.20\'de cephaneliğine isabet aldı, dumansız barut hartuçları ' +
      'tutuştu. Queen Elizabeth kale burcunun köşesini uçurdu.',
    src: 'https://www.navyingallipoli.com/Fort_Asian_Cimenlik.asp',
    geoSrc: `${OSM} way/235113134`,
  },
  {
    id: 'anadolu_mecidiye',
    name: 'Anadolu Mecidiye Tabyası',
    fortNo: 'No. 24',
    shore: 'anadolu',
    group: 'ic',
    lon: 26.4055,
    lat: 40.1672,
    approx: true,
    posNote:
      'OSM\'de kayıtlı değil. İç tahkimatın kuzey ucunda, Çimenlik ' +
      '(26.3991,40.1463) ile Nara Burnu (26.4040,40.1963) arasındaki ' +
      'Anadolu kıyısına yerleştirildi.',
    guns: {
      krupp_280_22: 2,
      krupp_260_22: 3,
      krupp_240_22: 3,
      krupp_210_22: 1,
      krupp_210_64_havan: 6,
    },
    src: 'https://www.navyingallipoli.com/Fort_Asian_Mecidiye.asp',
    geoSrc: 'kaynak tarifinden yerleştirildi (yaklaşık)',
  },
  {
    id: 'nagara',
    name: 'Nağara Kalesi',
    shore: 'anadolu',
    group: 'ic',
    lon: 26.40402,
    lat: 40.19632,
    guns: { krupp_150_26: 4, krupp_87_24: 4 },
    note:
      'Boğazın kuzey kilidi. Denizaltı mânia ağı buradaydı: Mariotte ve E-7 ' +
      'bu ağa takılıp kaybedildi.',
    src: 'https://www.navyingallipoli.com/pdfs/forts.pdf',
    geoSrc: `${OSM} way/232225383`,
  },

  // ══ BOLAYIR GRUBU (Saros / berzah savunması) ══════════════════════════
  {
    id: 'merkez_bolayir',
    name: 'Merkez Tabya (Bolayır)',
    nameEn: 'Fort Sultan',
    shore: 'rumeli',
    group: 'bolayir',
    lon: 26.73424,
    lat: 40.4965,
    guns: { krupp_150_26: 3, krupp_90: 3 },
    note:
      'Boğazdaki tek kara savunması için tasarlanmış tabya — donanmaya değil, ' +
      'berzahtan gelecek orduya karşı.',
    src: 'https://www.navyingallipoli.com/Fort_Bolayir_Merkez.asp',
    geoSrc: `${OSM} node/4353187835`,
  },
  {
    id: 'yildiz_bolayir',
    name: 'Yıldız Tabya (Bolayır)',
    nameEn: 'Fort Napoleon',
    shore: 'rumeli',
    group: 'bolayir',
    lon: 26.7215,
    lat: 40.5095,
    approx: true,
    posNote:
      'OSM\'de kayıtlı değil. Nykiel tabyayı "Gelibolu-Keşan yolundan görülen ' +
      'tepenin üstü", Saros Körfezi\'ne bakan sırt diye tarif ediyor; Merkez ' +
      'Tabya (26.7342,40.4965) referansıyla kuzeybatıya yerleştirildi.',
    guns: { krupp_87_24: 6 },
    src: 'https://www.navyingallipoli.com/Fort_Bolayir_Yildiz.asp',
    geoSrc: 'kaynak tarifinden yerleştirildi (yaklaşık)',
  },
];

/**
 * 1915 başında Müstahkem Mevki'nin kronik darboğazı: mühimmat.
 * Amiral von Usedom, stokun "ancak tek bir ciddi saldırıyı karşılamaya"
 * yettiğini rapor etmişti.
 * Kaynak: https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign
 */
export const FORT_AMMO_PER_HEAVY_GUN = 70;
export const FORT_AMMO_PER_LIGHT_GUN = 160;
/** Ağır sayılan kalibre eşiği (mm). */
export const HEAVY_CALIBRE = 200;
