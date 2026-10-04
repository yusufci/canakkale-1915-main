import type { ScenarioAirWing, ScenarioFleet, ScenarioLandUnit } from '../core/types.ts';

/**
 * Muharebe düzeni — 19 Şubat 1915 senaryo başlangıcı ve sonraki takviyeler.
 *
 * Kaynaklar:
 *   ÇOMÜ Kronolojisi — https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 *   P. Nykiel — https://www.navyingallipoli.com/Allied_Navy.asp
 *   https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign
 *
 * `arrives` alanı ISO tarihtir; senaryo motoru gün indeksine çevirir.
 */

const COMU = 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html';
const WIKI_NAVAL =
  'https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign';
const NYKIEL_NAVY = 'https://www.navyingallipoli.com/Allied_Navy.asp';

export interface OobLandUnit extends Omit<ScenarioLandUnit, 'arrivesOn'> {
  readonly arrives?: string;
}
export interface OobFleet extends Omit<ScenarioFleet, 'arrivesOn'> {
  readonly arrives?: string;
}
export interface OobAirWing extends Omit<ScenarioAirWing, 'arrivesOn'> {
  readonly arrives?: string;
}

// ══ OSMANLI 5. ORDU ═════════════════════════════════════════════════════
// 5. Ordu 24 Mart 1915'te kuruldu; Liman von Sanders 26 Mart'ta Gelibolu'ya
// geldi. Senaryo başında birlikler Müstahkem Mevki emrindedir.
export const OTTOMAN_LAND: readonly OobLandUnit[] = [
  {
    id: 'os_tumen_1',
    name: '1. Ordu (Payitaht Muhafızları)',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'istanbul',
    src: COMU + ' — Payitaht Muhafız Birlikleri',
  },
  {
    id: 'os_tumen_edirne',
    name: 'Trakya Savunma Tümeni',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'edirne',
    src: COMU + ' — 2. Ordu Trakya Savunma Hattı',
  },
  {
    id: 'os_alay_bandirma',
    name: 'Bandırma Sevk Alayı',
    nation: 'osmanli',
    templateId: 'os_piyade_alay',
    location: 'bandirma',
    src: COMU + ' — Anadolu Demiryolu İkmal ve Sevkiyat Noktası',
  },
  {
    id: 'os_tumen_9',
    name: '9. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'eceabat',
    commanderId: 'halil_sami',
    src: COMU + ' — 25 Nisan 1915 konuşlanma',
  },
  {
    id: 'os_alay_26',
    name: '26. Alay',
    nation: 'osmanli',
    templateId: 'os_piyade_alay',
    location: 'alcitepe',
    src: COMU + ' — Çam Tepe\'den Kerevizdere\'ye, Yarbay Kadri Bey',
  },
  {
    id: 'os_alay_27',
    name: '27. Alay',
    nation: 'osmanli',
    templateId: 'os_piyade_alay',
    location: 'kabatepe',
    commanderId: 'sefik_aker',
    src: COMU + ' — Çam Tepe\'den Azmak Dere ağzına 12 km sahil',
  },
  {
    id: 'os_tumen_19',
    name: '19. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'bigali',
    commanderId: 'mustafa_kemal',
    src: COMU + ' — 20 Ocak 1915, Yarbay Mustafa Kemal',
  },
  {
    id: 'os_alay_57',
    name: '57. Alay',
    nation: 'osmanli',
    templateId: 'os_piyade_alay',
    location: 'bigali',
    commanderId: 'huseyin_avni',
    arrives: '1915-02-23',
    src: COMU + ' — Tekirdağ\'dan Halep ve Reşitpaşa vapurlarıyla',
  },
  {
    id: 'os_tumen_7',
    name: '7. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'bolayir',
    src: COMU,
  },
  {
    id: 'os_tumen_5',
    name: '5. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'gelibolu',
    src: COMU,
  },
  {
    id: 'os_tumen_3',
    name: '3. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'erenkoy',
    src: COMU + ' — XV. Kolordu, Anadolu yakası',
  },
  {
    id: 'os_tumen_11',
    name: '11. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'lapseki',
    src: COMU + ' — XV. Kolordu, Anadolu yakası',
  },
  {
    id: 'os_alay_31',
    name: '31. Alay',
    nation: 'osmanli',
    templateId: 'os_piyade_alay',
    location: 'kumkale',
    src: COMU + ' — 25 Nisan\'da Kumkale\'de 2. Tabur, 240 asker',
  },
  {
    id: 'os_suvari',
    name: 'Müstakil Süvari Tugayı',
    nation: 'osmanli',
    templateId: 'os_suvari_tugay',
    location: 'kucuk_anafarta',
    src: COMU,
  },
  {
    id: 'de_bahriye_mufreze',
    name: 'Alman Bahriye Müfrezesi',
    nation: 'alman',
    templateId: 'de_bahriye',
    location: 'canakkale',
    commanderId: 'merten_pasa',
    src: WIKI_NAVAL + ' — Merten\'in 500 kişilik müfrezesi',
  },
  {
    id: 'os_obus_alay',
    name: '1. Obüs Alayı',
    nation: 'osmanli',
    templateId: 'os_agir_topcu',
    location: 'kepez',
    src: COMU + ' — 3 Mart 1915: "1. Obüs Bataryasından 1 subay şehit"',
  },
  // ── Takviyeler ─────────────────────────────────────────────────────
  {
    id: 'os_tumen_15',
    name: '15. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'gelibolu',
    commanderId: 'von_sodenstern',
    arrives: '1915-05-01',
    src: COMU + ' — 3-4 Mayıs taarruzunda 5.100 kayıp verdi',
  },
  {
    id: 'os_tumen_2',
    name: '2. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'gelibolu',
    arrives: '1915-05-17',
    src: COMU + ' — İstanbul\'dan 19 Mayıs taarruzu için',
  },
  {
    id: 'os_tumen_16',
    name: '16. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'kucuk_anafarta',
    arrives: '1915-06-20',
    src: COMU + ' — Kanlı Sırt muharebelerinde 7.164 kayıp',
  },
  {
    id: 'os_tumen_12',
    name: '12. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'bolayir',
    arrives: '1915-06-23',
    src: COMU,
  },
  {
    id: 'os_tumen_4',
    name: '4. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'alcitepe',
    arrives: '1915-07-01',
    src: COMU,
  },
  {
    id: 'os_tumen_6',
    name: '6. Tümen',
    nation: 'osmanli',
    templateId: 'os_piyade_tumen',
    location: 'buyuk_anafarta',
    arrives: '1915-08-05',
    src: COMU,
  },
];

// ══ İTİLAF KARA KUVVETLERİ ══════════════════════════════════════════════
// 25 Nisan 1915 çıkarması. Denizden gelirler: başlangıçta Limni/Mudros ve
// Bozcaada'da yüklüdürler.
export const ENTENTE_LAND: readonly OobLandUnit[] = [
  {
    id: 'uk_tumen_29',
    name: '29. İngiliz Tümeni',
    nation: 'ingiliz',
    templateId: 'uk_piyade_tumen',
    location: 'bozcaada',
    commanderId: 'hunter_weston',
    arrives: '1915-04-20',
    src: COMU + ' — Seddülbahir asıl çıkarması, ilk hedef Alçıtepe',
  },
  {
    id: 'uk_deniz_tumen',
    name: 'Kraliyet Deniz Tümeni',
    nation: 'ingiliz',
    templateId: 'uk_deniz_tumen',
    location: 'gokceada',
    arrives: '1915-04-20',
    src: COMU + ' — Bolayır oyalama gösterisi, sonra Seddülbahir',
  },
  {
    id: 'au_tumen_1',
    name: '1. Avustralya Tümeni',
    nation: 'anzac',
    templateId: 'anzac_tumen',
    location: 'gokceada',
    commanderId: 'birdwood',
    arrives: '1915-04-20',
    src: COMU + ' — Kabatepe dolayları, hedef Conkbayırı-Kocaçimen',
  },
  {
    id: 'nz_tumen',
    name: 'Yeni Zelanda ve Avustralya Tümeni',
    nation: 'anzac',
    templateId: 'anzac_tumen',
    location: 'gokceada',
    arrives: '1915-04-20',
    src: COMU,
  },
  {
    id: 'fr_tumen_1',
    name: 'Fransız Doğu Sefer Tümeni',
    nation: 'fransiz',
    templateId: 'fr_piyade_tumen',
    location: 'bozcaada',
    commanderId: 'd_amade',
    arrives: '1915-04-20',
    src: COMU + ' — Bir tugayı Kumkale\'ye 48 saatlik oyalama çıkarması',
  },
  {
    id: 'in_tugay_29',
    name: '29. Hint Tugayı',
    nation: 'hint',
    templateId: 'hint_tugay',
    location: 'gokceada',
    arrives: '1915-05-01',
    src: WIKI_NAVAL,
  },
  // ── Ağustos takviyesi: IX. Kolordu, Suvla ──────────────────────────
  {
    id: 'uk_tumen_10',
    name: '10. İngiliz Tümeni',
    nation: 'ingiliz',
    templateId: 'uk_piyade_tumen',
    location: 'gokceada',
    commanderId: 'stopford',
    arrives: '1915-08-04',
    src: COMU + ' — 6 Ağustos gecesi Anafartalar sahillerine çıktı',
  },
  {
    id: 'uk_tumen_11',
    name: '11. İngiliz Tümeni',
    nation: 'ingiliz',
    templateId: 'uk_piyade_tumen',
    location: 'gokceada',
    arrives: '1915-08-04',
    src: COMU,
  },
  {
    id: 'uk_tumen_13',
    name: '13. İngiliz Tümeni',
    nation: 'ingiliz',
    templateId: 'uk_piyade_tumen',
    location: 'gokceada',
    arrives: '1915-08-04',
    src: COMU,
  },
];

// ══ DONANMALAR ══════════════════════════════════════════════════════════
export const FLEETS: readonly OobFleet[] = [
  {
    id: 'uk_hat_a',
    name: 'A Hattı (İngiliz 1. Tümen)',
    nation: 'ingiliz',
    location: 'd_bozcaada_acigi',
    commanderId: 'carden',
    ships: [
      { name: 'HMS Queen Elizabeth', cls: 'dretnot', note: '8 × 381 mm; 18 Mart\'ta Çanakkale gümrük binasını ve Çimenlik burcunu vurdu' },
      { name: 'HMS Agamemnon', cls: 'pre_dretnot', note: '25 Şubat\'ta Ertuğrul Tabyası\'ndan beş isabet aldı; 18 Mart\'ta savaş dışı kaldı' },
      { name: 'HMS Lord Nelson', cls: 'pre_dretnot', note: '7 Mart\'ta isabet alıp hasar gördü' },
      { name: 'HMS Inflexible', cls: 'muharebe_kruvazoru', note: '18 Mart 16.00\'da mayına çarptı, 1.600 ton su aldı, Bozcaada\'ya oturtuldu' },
      { name: 'HMS Prince George', cls: 'pre_dretnot' },
      { name: 'HMS Triumph', cls: 'pre_dretnot', note: '25 Mayıs 1915\'te U-21 tarafından Kabatepe açıklarında batırıldı' },
    ],
    src: NYKIEL_NAVY,
  },
  {
    id: 'fr_hat_b',
    name: 'B Hattı (Fransız Tümeni)',
    nation: 'fransiz',
    location: 'd_bozcaada_acigi',
    commanderId: 'guepratte',
    ships: [
      { name: 'Suffren', cls: 'pre_dretnot', note: '18 Mart\'ta ağır hasar' },
      { name: 'Bouvet', cls: 'pre_dretnot', note: '18 Mart 14.00 — üç dakikada battı, 639 ölü, 48 kurtulan' },
      { name: 'Gaulois', cls: 'pre_dretnot', note: '18 Mart\'ta ağır hasar, karaya oturtuldu' },
      { name: 'Charlemagne', cls: 'pre_dretnot' },
    ],
    src: 'https://www.navyingallipoli.com/French_Battleships.asp',
  },
  {
    id: 'uk_hat_c',
    name: 'C Hattı (İngiliz 2. Tümen)',
    nation: 'ingiliz',
    location: 'd_gokceada_acigi',
    ships: [
      { name: 'HMS Vengeance', cls: 'pre_dretnot' },
      { name: 'HMS Irresistible', cls: 'pre_dretnot', note: '18 Mart\'ta mayına çarptı; mürettebat alındı, gemi battı' },
      { name: 'HMS Albion', cls: 'pre_dretnot' },
      { name: 'HMS Ocean', cls: 'pre_dretnot', note: '18 Mart 18.05 — mayın dümeni kilitledi, battı' },
      { name: 'HMS Swiftsure', cls: 'pre_dretnot' },
      { name: 'HMS Majestic', cls: 'pre_dretnot', note: '27 Mayıs 1915\'te U-21 tarafından batırıldı' },
      { name: 'HMS Cornwallis', cls: 'pre_dretnot', note: '19 Şubat 1915\'teki ilk yaylım ateşi kampanyayı resmen başlattı' },
    ],
    src: 'https://www.navyingallipoli.com/British_Pre_Dreadnought_Battleships.asp',
  },
  {
    id: 'uk_tarama',
    name: 'Mayın Tarama Filosu',
    nation: 'ingiliz',
    location: 'd_bozcaada_acigi',
    commanderId: 'keyes',
    ships: [
      { name: 'HMS Amethyst', cls: 'hafif_kruvazor', note: '13/14 Mart gecesi ağır hasar, 19 ocakçı öldü' },
      { name: 'HMS Wear', cls: 'muhrip' },
      { name: 'HMS Mosquito', cls: 'muhrip' },
      ...Array.from({ length: 12 }, (_, i) => ({
        name: `Tarayıcı No. ${320 + i}`,
        cls: 'mayin_tarayici' as const,
      })),
    ],
    src:
      WIKI_NAVAL +
      ' — zırhsız balıkçı tekneleri, sivil mürettebat; ateş altında ' +
      'çalışmaya yanaşmadılar, 4 knotlık akıntıyı da aşamadılar',
  },
  {
    id: 'uk_ark_royal',
    name: 'Deniz Uçağı Grubu',
    nation: 'ingiliz',
    location: 'd_bozcaada_acigi',
    ships: [
      { name: 'HMS Ark Royal', cls: 'ucak_gemisi', note: '16-17 Mart\'ta mayın tespit etti ama Nusret hattını göremedi' },
    ],
    src: WIKI_NAVAL,
  },
  // ── Osmanlı ────────────────────────────────────────────────────────
  {
    id: 'os_mayin_filosu',
    name: 'Mayın Filosu',
    nation: 'osmanli',
    location: 'd_nagara',
    commanderId: 'hakki_bey',
    ships: [
      { name: 'Nusret', cls: 'mayin_gemisi', note: '7/8 Mart 1915 — 11. hat, 26 mayın' },
      { name: 'İntibah', cls: 'mayin_gemisi' },
      { name: 'Samsun', cls: 'mayin_gemisi', note: '14 Ağustos 1915\'te E-2 tarafından batırıldı' },
      { name: 'Selanik', cls: 'mayin_gemisi' },
    ],
    src: COMU,
  },
  {
    id: 'os_donanma',
    name: 'Boğaz Filosu',
    nation: 'osmanli',
    location: 'd_marmara_agzi',
    commanderId: 'muzaffer_adil',
    ships: [
      { name: 'Barbaros Hayrettin', cls: 'pre_dretnot', note: '8 Ağustos 1915\'te Bolayır açıklarında E-11 tarafından batırıldı' },
      { name: 'Turgut Reis', cls: 'pre_dretnot' },
      { name: 'Muavenet-i Milliye', cls: 'muhrip', note: '12/13 Mayıs 1915\'te Morto Koyu\'nda HMS Goliath\'ı torpilledi' },
      { name: 'Sultanhisar', cls: 'muhrip', note: '29 Nisan 1915\'te AE2 denizaltısını batırdı' },
    ],
    src: COMU,
  },
  {
    id: 'os_payitaht_filosu',
    name: 'Marmara & Payitaht Filosu',
    nation: 'osmanli',
    location: 'd_istanbul_bogazi',
    commanderId: 'wilhelm_souchon',
    ships: [
      { name: 'Yavuz Sultan Selim', cls: 'muharebe_kruvazoru', note: '10 × 280 mm; Osmanlı donanmasının sancak gemisi (SMS Goeben)' },
      { name: 'Midilli', cls: 'hafif_kruvazor', note: '12 × 105 mm; yüksek süratli hafif kruvazör (SMS Breslau)' },
      { name: 'Berk-i Satvet', cls: 'muhrip' },
      { name: 'Peyk-i Şevket', cls: 'muhrip' },
    ],
    src: COMU + ' — Osmanlı Donanması Payitaht İhtiyat Grubu',
  },
];

// ══ HAVA ════════════════════════════════════════════════════════════════
export const AIR_WINGS: readonly OobAirWing[] = [
  {
    id: 'os_hava_bolugu',
    name: 'Çanakkale Tayyare Bölüğü',
    nation: 'alman',
    role: 'kesif',
    planes: 4,
    base: 'canakkale',
    src:
      COMU +
      ' — 18 Mart sabahı Yüzbaşı Serno ve Deniz Kurmay Yüzbaşı Schneider ' +
      'Bozcaada yönünde keşfe çıkıp filonun ilerleyişini bildirdi',
  },
  {
    id: 'uk_rnas_3',
    name: 'RNAS 3. Filo (Bozcaada)',
    nation: 'ingiliz',
    role: 'kesif',
    planes: 6,
    base: 'bozcaada',
    arrives: '1915-03-01',
    src: WIKI_NAVAL + ' — 16-17 Mart keşif uçuşları',
  },
  {
    id: 'uk_gozetleme',
    name: 'Topçu Gözetleme Müfrezesi',
    nation: 'ingiliz',
    role: 'gozetleme',
    planes: 4,
    base: 'bozcaada',
    arrives: '1915-04-20',
    src: WIKI_NAVAL + ' — Ark Royal uçakları deniz topçusuna gözetmenlik yaptı',
  },
  {
    id: 'uk_bombardiman',
    name: 'Bombardıman Müfrezesi',
    nation: 'ingiliz',
    role: 'bombardiman',
    planes: 4,
    base: 'gokceada',
    arrives: '1915-07-01',
    src:
      COMU +
      ' — 12 Temmuz 1915: "on dört kadar uçakla havadan üç saat bombardıman"',
  },
];
