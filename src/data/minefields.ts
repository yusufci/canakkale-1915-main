/**
 * Çanakkale Boğazı mayın hatları, Ağustos 1914 – Mart 1915.
 *
 * Tarihler ve döken gemiler: Barış Borlat, "Çanakkale Savaşları Kronolojisi",
 *   ÇOMÜ — https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 * Toplam ve hat sayısı: 18 Mart'a kadar 11 hat, ~403 mayın.
 * İngiliz literatürü "Dar Boğaz yakınında 10 hatta 370 mayın" der:
 *   https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign
 *
 * HAT BAŞINA MAYIN SAYISI kaynaklarda hat hat verilmiyor. Aşağıdaki dağılım
 * toplamı tutturacak şekilde yapılmış OYUN değeridir (`countApprox: true`).
 * Kesin olan: 11. hat (Nusret) = 26 mayın.
 *
 * Uç noktalar, yükseklik ızgarasından ölçülen boğaz enine kesitlerinden
 * türetilmiştir (her kıyıdan 300 m içeri). Dar Boğaz ölçümü 1,40 km çıktı —
 * tarihsel 1.600 yarda (1.500 m) ile uyumlu, veri doğrulanmış sayılır.
 */

export interface MinefieldSpec {
  readonly id: string;
  readonly name: string;
  /** ISO tarih. */
  readonly laidOn: string;
  /** Döken gemi. */
  readonly layer: string;
  readonly mines: number;
  readonly countApprox?: boolean;
  /** [lon, lat] */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** Mayınların su altındaki derinliği (m). */
  readonly depth: number;
  readonly note?: string;
  readonly src: string;
}

const COMU = 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html';

export const MINEFIELDS: readonly MinefieldSpec[] = [
  {
    id: 'hat_1',
    name: '1. Hat',
    laidOn: '1914-08-04',
    layer: 'Selanik',
    mines: 39,
    countApprox: true,
    from: [26.32677, 40.103],
    to: [26.36572, 40.103],
    depth: 4.5,
    note: 'Seferberliğin ikinci günü dökülen ilk hat.',
    src: COMU,
  },
  {
    id: 'hat_2',
    name: '2. Hat',
    laidOn: '1914-08-06',
    layer: 'Selanik',
    mines: 39,
    countApprox: true,
    from: [26.33123, 40.1055],
    to: [26.39422, 40.1055],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_3',
    name: '3. Hat',
    laidOn: '1914-08-15',
    layer: 'İntibah',
    mines: 38,
    countApprox: true,
    from: [26.33535, 40.108],
    to: [26.39594, 40.108],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_4',
    name: '4. Hat',
    laidOn: '1914-09-24',
    layer: 'İntibah',
    mines: 38,
    countApprox: true,
    from: [26.3381, 40.1105],
    to: [26.39731, 40.1105],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_5',
    name: '5. Hat',
    laidOn: '1914-10-01',
    layer: 'İntibah',
    mines: 38,
    countApprox: true,
    from: [26.33981, 40.113],
    to: [26.40006, 40.113],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_6',
    name: '6. Hat',
    laidOn: '1914-11-09',
    layer: 'İntibah',
    mines: 38,
    countApprox: true,
    from: [26.34222, 40.1155],
    to: [26.40349, 40.1155],
    depth: 4.5,
    note:
      'Kasım 1914 başında depolardan çıkarılıp bakımı yapılan 145 mayının bir ' +
      'bölümü bu hatta kullanıldı.',
    src: COMU,
  },
  {
    id: 'hat_7',
    name: '7. Hat',
    laidOn: '1914-12-17',
    layer: 'Nusret',
    mines: 37,
    countApprox: true,
    from: [26.34531, 40.118],
    to: [26.40555, 40.118],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_8',
    name: '8. Hat',
    laidOn: '1914-12-17',
    layer: 'Samsun',
    mines: 37,
    countApprox: true,
    from: [26.34737, 40.1205],
    to: [26.40589, 40.1205],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_9',
    name: '9. Hat',
    laidOn: '1914-12-30',
    layer: 'Nusret',
    mines: 37,
    countApprox: true,
    from: [26.34908, 40.123],
    to: [26.40486, 40.123],
    depth: 4.5,
    src: COMU,
  },
  {
    id: 'hat_10',
    name: '10. Hat',
    laidOn: '1915-02-26',
    layer: 'İntibah',
    mines: 36,
    countApprox: true,
    from: [26.35011, 40.1255],
    to: [26.40418, 40.1255],
    depth: 4.5,
    note: 'Dış tahkimatın susturulmasının ertesi günü dökülen son takviye hattı.',
    src: COMU,
  },
  {
    id: 'hat_11_nusret',
    name: '11. Hat — Nusret',
    laidOn: '1915-03-08',
    layer: 'Nusret',
    mines: 26,
    from: [26.32748, 40.04687],
    to: [26.34052, 40.06813],
    depth: 4.5,
    note:
      'Yüzbaşı Hakkı Bey. Erenköy Körfezi\'nde (Karanlık Liman) Anadolu ' +
      'kıyısına PARALEL, boğazı kesmeyen tek hat. Türk gözetleme postaları ' +
      'düşman gemilerinin çekilirken bu koyda sancağa döndüğünü fark etmişti. ' +
      '26 mayın, yaklaşık 100 m aralıkla, 4,5 m derinlikte. 18 Mart\'ta ' +
      'Bouvet, Irresistible ve Ocean bu hatta kayboldu. ' +
      '(İngiliz kaynakları 20 mayın ve 15 ft derinlik yazar; Türk kaynakları ' +
      '26 mayın der. Oyunda Türk rakamı esas alındı.)',
    src: COMU,
  },
];

/** 18 Mart 1915 sabahı boğazdaki toplam mayın. */
export const TOTAL_MINES_18_MARCH = MINEFIELDS.reduce((n, m) => n + m.mines, 0);

/**
 * Mânia ağı — 5 Şubat 1915'te boğazın güney kesimindeki son mayın hattının
 * önüne denizaltılara karşı kuruldu; sonra Nara'ya taşındı.
 * Mariotte (27 Temmuz) ve E-7 (4 Eylül) bu ağa takılıp kaybedildi.
 */
export const SUB_NET = {
  id: 'mania_agi',
  name: 'Denizaltı Mânia Ağı',
  installedOn: '1915-02-05',
  movedToNarrows: '1915-07-01',
  src: COMU,
} as const;
