import type { Commander, CommanderTrait, Nation, Side } from '../core/types.ts';

/**
 * Komutanlar. Yetenek (1–7) ve özellikler OYUN değerleridir; her birinin
 * gerekçesi `bio`/`why` alanında kampanyadaki fiilî performansa dayandırılmıştır.
 *
 * Kaynaklar:
 *   ÇOMÜ Kronolojisi — https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 *   P. Nykiel, Commanders — https://www.navyingallipoli.com/Commanders.asp
 *   https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign
 */

const COMU = 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html';
const NYKIEL_C = 'https://www.navyingallipoli.com/Commanders.asp';
const WIKI_NAVAL =
  'https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign';

export const TRAITS: Readonly<Record<string, CommanderTrait>> = {
  siper_ustasi: {
    id: 'siper_ustasi',
    name: 'Siper Ustası',
    desc: 'Birlikleri bir günde iki kat hızlı siperlenir.',
    mods: { digIn: 2.0, defence: 0.1 },
  },
  taarruz_ruhu: {
    id: 'taarruz_ruhu',
    name: 'Taarruz Ruhu',
    desc: 'Saldırıda +%20 güç, ama kayıplar da artar.',
    mods: { attack: 0.2, defence: -0.05 },
  },
  inatci_savunma: {
    id: 'inatci_savunma',
    name: 'İnatçı Savunma',
    desc: 'Savunmada +%25 güç.',
    mods: { defence: 0.25 },
  },
  ilham_veren: {
    id: 'ilham_veren',
    name: 'İlham Veren',
    desc: 'Organizasyon her gün %40 daha hızlı toparlanır.',
    mods: { orgRecovery: 0.4 },
  },
  sahil_savunmasi: {
    id: 'sahil_savunmasi',
    name: 'Sahil Savunması',
    desc: 'Tabya ateşi ve kıyı savunması +%25.',
    mods: { gunnery: 0.25, defence: 0.15 },
  },
  mayin_harbi: {
    id: 'mayin_harbi',
    name: 'Mayın Harbi',
    desc: 'Mayın dökme kapasitesi ve gizliliği artar.',
    mods: { gunnery: 0.1, logistics: 0.2 },
  },
  temkinli: {
    id: 'temkinli',
    name: 'Temkinli',
    desc: 'Kayıplar azalır, ama taarruz gücü düşer.',
    mods: { attack: -0.15, defence: 0.1 },
  },
  atilgan_amiral: {
    id: 'atilgan_amiral',
    name: 'Atılgan Amiral',
    desc: 'Filo zorlama hareketinde +%20 ilerleme.',
    mods: { attack: 0.2, gunnery: 0.1 },
  },
  top_atisi: {
    id: 'top_atisi',
    name: 'Usta Topçu',
    desc: 'Deniz topçusu isabeti +%20.',
    mods: { gunnery: 0.2 },
  },
  cikarma_uzmani: {
    id: 'cikarma_uzmani',
    name: 'Çıkarma Uzmanı',
    desc: 'Amfibi harekâtta +%25 başarı, daha az kayıp.',
    mods: { amphibious: 0.25 },
  },
  agir_kanli: {
    id: 'agir_kanli',
    name: 'Ağır Kanlı',
    desc: 'Birlikler yavaş hareket eder, fırsatlar kaçar.',
    mods: { speed: -0.3, attack: -0.1 },
  },
  lojistikci: {
    id: 'lojistikci',
    name: 'Lojistikçi',
    desc: 'İkmal verimi +%25.',
    mods: { logistics: 0.25 },
  },
  israfci: {
    id: 'israfci',
    name: 'İsrafçı Taarruz',
    desc: 'Taarruzda kayıplar %30 artar.',
    mods: { attack: 0.1, defence: -0.15 },
  },
};

export interface CommanderSpec extends Omit<Commander, 'availableFrom' | 'assignedTo'> {
  /** ISO tarih — bu günden itibaren atanabilir. */
  readonly from: string;
  /** Bu tarihten sonra sahneden çekilir. */
  readonly until?: string;
  /** Yetenek puanlarının gerekçesi. */
  readonly why: string;
}

function cmd(
  id: string,
  name: string,
  rank: string,
  nation: Nation,
  side: Side,
  kind: 'kara' | 'deniz' | 'siyasi',
  skill: [number, number, number, number],
  traits: string[],
  from: string,
  bio: string,
  why: string,
  src: string,
  until?: string,
): CommanderSpec {
  return {
    id,
    name,
    rank,
    nation,
    side,
    kind,
    bio,
    why,
    skill: { attack: skill[0], defence: skill[1], planning: skill[2], logistics: skill[3] },
    traits,
    from,
    ...(until ? { until } : {}),
    src,
  };
}

export const COMMANDERS: readonly CommanderSpec[] = [
  // ══ OSMANLI / ALMAN ═══════════════════════════════════════════════════
  cmd(
    'cevat_pasa', 'Cevat Paşa (Çobanlı)', 'Albay', 'osmanli', 'ottoman', 'deniz',
    [3, 6, 6, 4], ['sahil_savunmasi', 'mayin_harbi'], '1914-08-09',
    'Çanakkale Müstahkem Mevki Komutanı, 9 Ağustos 1914\'ten itibaren. ' +
    '18 Mart\'ta uygulanan boğaz savunma planının asıl yazarı.',
    'Nykiel onu "savunma planının gerçek yazarı" diye niteler: ağır tabyaları ' +
    'yıpratma, asıl işi mayın hatlarına ve hareketli obüslere yaptırma fikri ' +
    'onundur. Savunma ve planlama 6; taarruz tecrübesi yok, 3.',
    NYKIEL_C,
  ),
  cmd(
    'mustafa_kemal', 'Mustafa Kemal', 'Yarbay', 'osmanli', 'ottoman', 'kara',
    [6, 6, 6, 4], ['taarruz_ruhu', 'ilham_veren', 'inatci_savunma'], '1915-01-20',
    '20 Ocak 1915\'te 19. Tümen Komutanı oldu. 25 Nisan sabahı emir ' +
    'beklemeden Conkbayırı\'na yürüdü. 1 Haziran\'da albay, 8 Ağustos\'ta ' +
    'Anafartalar Grubu Komutanı.',
    'Kampanyanın tek komutanı ki hem yerinde karşı taarruz (25 Nisan ' +
    'Conkbayırı, 10 Ağustos süngü hücumu) hem inatçı savunma yaptı ve ' +
    'ikisinde de sonuç aldı. Taarruz/savunma/planlama 6; ikmal onun işi değildi.',
    COMU,
  ),
  cmd(
    'esat_pasa', 'Esat Paşa (Bülkat)', 'Tümgeneral', 'osmanli', 'ottoman', 'kara',
    [4, 6, 5, 4], ['inatci_savunma', 'siper_ustasi'], '1915-03-24',
    'III. Kolordu Komutanı. 17 Mayıs 1915\'te Arıburnu Cephesi ' +
    'Komutanlığını Mustafa Kemal\'den devraldı.',
    'Arıburnu\'nda düşmanı sekiz ay kıyı şeridine kilitledi. Savunma 6; ' +
    '19 Mayıs taarruzu 9.970 kayıpla sonuçsuz kaldığı için taarruz 4.',
    COMU,
  ),
  cmd(
    'liman_von_sanders', 'Otto Liman von Sanders', 'Mareşal', 'alman', 'ottoman', 'kara',
    [4, 5, 6, 5], ['temkinli', 'lojistikci'], '1915-03-26',
    '26 Mart 1915\'te Plevne vapuruyla Gelibolu\'ya gelip 5. Ordu ' +
    'Komutanlığına başladı. Kuvvetlerini kıyıya yaymak yerine ihtiyatta ' +
    'topladı — çıkarmalara karşı doğru karar çıktı.',
    'Yarımadayı üç gruba bölüp ihtiyatları merkezde tutma planı 25 Nisan\'da ' +
    'işe yaradı: planlama 6. Ama Anafartalar\'da Ahmet Fevzi\'yi geç değiştirdi, ' +
    'taarruz 4.',
    COMU,
  ),
  cmd(
    'von_usedom', 'Guido von Usedom', 'Koramiral', 'alman', 'ottoman', 'deniz',
    [2, 5, 5, 6], ['mayin_harbi', 'sahil_savunmasi'], '1914-09-01',
    'Sahil Savunması ve Mayınlar Genel Müfettişi. Mühimmatın "ancak tek bir ' +
    'ciddi saldırıyı karşılamaya" yettiğini görüp savunmayı mayın hatlarına ' +
    'dayandırdı.',
    'Boğazın mayın savunmasını kuran adam. Lojistik 6, taarruz 2.',
    WIKI_NAVAL,
  ),
  cmd(
    'merten_pasa', 'Johannes Merten', 'Koramiral', 'alman', 'ottoman', 'deniz',
    [2, 5, 4, 4], ['sahil_savunmasi', 'top_atisi'], '1914-09-15',
    'Çanakkale\'de Weber\'in yerine geçti; modern topları kullanacak Alman ' +
    'bahriye müfrezesini getirdi.',
    'Ekim 1914\'e gelindiğinde ana bataryaların çoğunda Alman personel vardı; ' +
    'topçu eğitimi onun eseri. Topçuluk özelliği verildi.',
    WIKI_NAVAL,
  ),
  cmd(
    'halil_sami', 'Halil Sami Bey', 'Albay', 'osmanli', 'ottoman', 'kara',
    [3, 5, 4, 3], ['inatci_savunma'], '1915-02-01',
    '9. Tümen Komutanı. 25 Nisan\'da yarımadanın güneyi ve Arıburnu kıyıları ' +
    'onun sorumluluğundaydı.',
    '12 km\'lik sahili tek taburla (Binbaşı İsmet\'in 2. Taburu) tutmak ' +
    'zorunda kaldı ve çıkarmayı iki saat geciktirdi. Savunma 5.',
    COMU,
  ),
  cmd(
    'sefik_aker', 'Şefik Aker', 'Yarbay', 'osmanli', 'ottoman', 'kara',
    [4, 5, 4, 3], ['siper_ustasi'], '1915-02-01',
    '27. Alay Komutanı. Çam Tepe\'den Azmak Dere ağzına kadar 12 km\'lik ' +
    'kuzey sahilinden sorumluydu; Arıburnu\'na ilk karşı koyan alay.',
    '25 Nisan sabahı Anzak çıkarmasını ilk karşılayan ve 19. Tümen gelene ' +
    'kadar hattı tutan birlik. Savunma 5.',
    COMU,
  ),
  cmd(
    'huseyin_avni', 'Hüseyin Avni Bey', 'Yarbay', 'osmanli', 'ottoman', 'kara',
    [5, 5, 3, 2], ['taarruz_ruhu'], '1915-02-23',
    '57. Alay Komutanı. Alayı 23 Şubat 1915\'te Halep ve Reşitpaşa ' +
    'vapurlarıyla Tekirdağ\'dan Çanakkale\'ye geldi. 13 Ağustos 1915\'te ' +
    'karargâhına düşen obüs mermisiyle şehit oldu.',
    '57. Alay Arıburnu\'nda kelimenin tam anlamıyla eridi. Taarruz 5.',
    COMU, '1915-08-13',
  ),
  cmd(
    'vehip_pasa', 'Vehip Paşa', 'Tümgeneral', 'osmanli', 'ottoman', 'kara',
    [4, 5, 5, 4], ['inatci_savunma', 'lojistikci'], '1915-07-09',
    '9 Temmuz 1915\'te Güney Grubu komutasını Weber\'den devraldı.',
    'Seddülbahir cephesini mevzi savaşında istikrara kavuşturdu. Dengeli puanlar.',
    COMU,
  ),
  cmd(
    'ahmet_fevzi', 'Ahmet Fevzi (Tümay)', 'Albay', 'osmanli', 'ottoman', 'kara',
    [2, 4, 3, 3], ['agir_kanli'], '1915-08-01',
    'Saros Grubu Komutanı. 8 Ağustos 1915 akşamı Anafartalar\'a taarruz ' +
    'emrini "birlikler hazır değil" diyerek yerine getirmedi ve görevden alındı; ' +
    'yerine Mustafa Kemal atandı.',
    'Kampanyanın en pahalı tereddüdü. Ağır Kanlı özelliği ve düşük taarruz.',
    COMU, '1915-08-08',
  ),
  cmd(
    'von_sodenstern', 'Von Sodenstern', 'Albay', 'alman', 'ottoman', 'kara',
    [3, 4, 2, 3], ['israfci'], '1915-04-25',
    '3-4 Mayıs 1915\'te Seddülbahir\'de aceleye getirdiği taarruz 15. ' +
    'Tümen\'den 5.100 asker kaybına mal oldu.',
    'Planlama 2 — kaynakta "iyi planlamadan, hatta aceleye getirerek" deniyor.',
    COMU,
  ),
  cmd(
    'hakki_bey', 'Yüzbaşı Hakkı Bey', 'Yüzbaşı', 'osmanli', 'ottoman', 'deniz',
    [3, 4, 6, 4], ['mayin_harbi'], '1914-09-03',
    'Nusret mayın gemisinin kaptanı. 7/8 Mart 1915 gecesi düşman ' +
    'projektörleri altında Erenköy Körfezi\'ne 26 mayını Anadolu kıyısına ' +
    'paralel döktü. 14 Eylül 1915\'te Kasımpaşa Askerî Hastanesi\'nde vefat etti.',
    'Tek bir gece harekâtı savaşın gidişatını değiştirdi: planlama 6.',
    COMU, '1915-09-14',
  ),
  cmd(
    'muzaffer_adil', 'Yüzbaşı Muzaffer (Adil)', 'Yüzbaşı', 'osmanli', 'ottoman', 'deniz',
    [4, 4, 3, 3], ['top_atisi'], '1915-01-01',
    'Barbaros Hayrettin zırhlısının komutanı. 6 Mart 1915\'te HMS Queen ' +
    'Elizabeth ile ateş teatisine girip hasar verdirdi.',
    'Eski bir zırhlıyla dönemin en modern savaş gemisine isabet sağladı.',
    NYKIEL_C,
  ),
  cmd(
    'enver_pasa', 'Enver Paşa', 'Harbiye Nazırı', 'osmanli', 'ottoman', 'siyasi',
    [5, 2, 2, 3], ['israfci', 'taarruz_ruhu'], '1914-08-02',
    'Harbiye Nazırı ve Başkomutan Vekili. 11 Mayıs 1915\'te cepheye gelip ' +
    'Arıburnu\'ndaki düşmanın "bir an önce denize dökülmesini" emretti — ' +
    '19 Mayıs taarruzu 9.970 kayıpla sonuçsuz kaldı.',
    'Siyasi baskıyla taarruz dayatır: taarruz 5, savunma/planlama 2.',
    COMU,
  ),
  cmd(
    'nihat_pasa', 'Nihat Paşa (Anılmış)', 'Albay', 'osmanli', 'ottoman', 'deniz',
    [3, 5, 4, 4], ['sahil_savunmasi'], '1915-10-03',
    '3 Ekim 1915\'te Çanakkale (Akdeniz) Boğazı Müstahkem Mevki Komutanı oldu.',
    'Kampanyanın son döneminde savunmayı devraldı. Dengeli savunma puanları.',
    COMU,
  ),

  // ══ İTİLAF ════════════════════════════════════════════════════════════
  cmd(
    'carden', 'Sackville Carden', 'Koramiral', 'ingiliz', 'entente', 'deniz',
    [4, 3, 3, 3], ['atilgan_amiral'], '1915-01-11',
    '11 Ocak 1915\'te boğazı yalnız donanmayla zorlama planını sundu. ' +
    '15 Mart\'ta sağlık sebebiyle görevden ayrıldı, yerine De Robeck geçti.',
    'Planı "tabyaları donanma tek başına susturur" varsayımına dayanıyordu; ' +
    'bu varsayım yanlış çıktı. Planlama 3.',
    NYKIEL_C, '1915-03-16',
  ),
  cmd(
    'de_robeck', 'John de Robeck', 'Tuğamiral', 'ingiliz', 'entente', 'deniz',
    [3, 4, 4, 4], ['temkinli'], '1915-03-16',
    '16 Mart 1915\'ten itibaren Birleşik Filo Komutanı. 18 Mart\'tan sonra ' +
    '"kara kuvveti olmadan olmaz" diyerek deniz harekâtını durdurdu.',
    'Zaten şüpheciydi; 18 Mart\'ta üç zırhlı kaybedince durdu. Temkinli.',
    WIKI_NAVAL,
  ),
  cmd(
    'keyes', 'Roger Keyes', 'Komodor', 'ingiliz', 'entente', 'deniz',
    [6, 3, 4, 3], ['atilgan_amiral'], '1915-02-19',
    'Filo Kurmay Başkanı ve mayın tarama kuvvetinin sorumlusu. 18 Mart ' +
    'akşamı "düşmanın yenildiğini biliyordum" diye yazdı; sonuna kadar ' +
    'harekâtın sürdürülmesini savundu.',
    'Kampanyanın en ısrarlı saldırganı. Taarruz 6, savunma 3.',
    WIKI_NAVAL,
  ),
  cmd(
    'guepratte', 'Émile Guépratte', 'Tuğamiral', 'fransiz', 'entente', 'deniz',
    [5, 3, 3, 3], ['atilgan_amiral', 'top_atisi'], '1915-02-19',
    'Fransız filosunun komutanı. 18 Mart\'ta B hattını 5-6 km\'ye kadar ' +
    'tabyaların üstüne sürdü — ve Bouvet\'yi orada kaybetti.',
    'En yakın mesafeden ateş eden hat onunkiydi: atılgan.',
    NYKIEL_C,
  ),
  cmd(
    'wemyss', 'Rosslyn Wemyss', 'Koramiral', 'ingiliz', 'entente', 'deniz',
    [5, 4, 4, 5], ['atilgan_amiral', 'lojistikci'], '1915-11-01',
    'Limni (Mudros) üs komutanı, Kasım 1915\'te De Robeck\'in yerine vekâlet ' +
    'etti. De Robeck 12 zırhlı kaybı öngörürken o "en çok üç" diyordu.',
    'Hem iyimser hem iyi bir üs lojistikçisi.',
    WIKI_NAVAL,
  ),
  cmd(
    'hamilton', 'Ian Hamilton', 'Orgeneral', 'ingiliz', 'entente', 'kara',
    [4, 3, 4, 2], ['cikarma_uzmani', 'temkinli'], '1915-03-17',
    'Akdeniz Seferî Kuvvetleri Başkomutanı. 25 Nisan çıkarmalarını planladı. ' +
    '14 Ekim 1915\'te görevden alındı.',
    'Çıkarmayı yürüttü ama karargâhı gemide tuttuğu için kıyıdaki durumu geç ' +
    'öğrendi; ikmal 2.',
    COMU, '1915-10-14',
  ),
  cmd(
    'birdwood', 'William Birdwood', 'Korgeneral', 'ingiliz', 'entente', 'kara',
    [4, 5, 4, 4], ['siper_ustasi'], '1915-04-25',
    'Anzak Kolordusu Komutanı. Arıburnu\'nda tutunmayı ve Aralık 1915\'te ' +
    'tek kayıp vermeden tahliyeyi başardı.',
    'Tahliye kampanyanın tek kusursuz harekâtıydı. Savunma 5.',
    COMU,
  ),
  cmd(
    'hunter_weston', 'Aylmer Hunter-Weston', 'Korgeneral', 'ingiliz', 'entente', 'kara',
    [4, 3, 2, 2], ['israfci'], '1915-04-25',
    '29. Tümen, sonra VIII. Kolordu Komutanı. Seddülbahir\'de arka arkaya ' +
    'cepheden taarruzlar yaptırdı.',
    '28 Haziran–5 Temmuz muharebelerinde iki taraf toplam 16.000 kayıp verdi. ' +
    'Planlama 2, İsrafçı.',
    COMU,
  ),
  cmd(
    'stopford', 'Frederick Stopford', 'Korgeneral', 'ingiliz', 'entente', 'kara',
    [2, 3, 2, 2], ['agir_kanli'], '1915-08-06',
    'IX. Kolordu Komutanı. 6 Ağustos gecesi Anafartalar sahillerine çıktı ve ' +
    '7 Ağustos akşamına kadar içeriye en fazla 800 m ilerleyebildi.',
    'Boş tepeleri almak için bir gün bekledi; Mustafa Kemal o boşluğu doldurdu. ' +
    'Ağır Kanlı, taarruz 2.',
    COMU, '1915-08-15',
  ),
  cmd(
    'd_amade', 'Albert d\'Amade', 'Tümgeneral', 'fransiz', 'entente', 'kara',
    [3, 3, 3, 3], ['cikarma_uzmani'], '1915-03-17',
    'Fransız Doğu Sefer Kuvveti Komutanı. 25 Nisan\'da Kumkale\'ye oyalama ' +
    'çıkarması yaptı; 27 Nisan\'da çekildi. 30 Mayıs 1915\'te görevden alındı.',
    'Kumkale çıkarması amacına ulaştı ama kalıcı sonuç vermedi.',
    COMU, '1915-05-30',
  ),
  cmd(
    'gouraud', 'Henri Gouraud', 'Tümgeneral', 'fransiz', 'entente', 'kara',
    [5, 4, 4, 4], ['taarruz_ruhu'], '1915-05-30',
    'd\'Amade\'ın yerine geldi. 21-22 Haziran\'da 83 Rakımlı Tepe\'yi aldı.',
    'Fransızların tek somut arazi kazancı onun döneminde geldi.',
    COMU,
  ),
  cmd(
    'monro', 'Charles Monro', 'Orgeneral', 'ingiliz', 'entente', 'kara',
    [2, 4, 5, 5], ['temkinli', 'lojistikci'], '1915-10-15',
    'Hamilton\'ın yerine atandı. Cepheyi gezip tahliye tavsiyesinde bulundu; ' +
    'tahliye kusursuz yürütüldü.',
    '"Geldi, gördü, kaçtı" denildi — ama tahliye planlaması 5, lojistik 5.',
    COMU,
  ),
  cmd(
    'churchill', 'Winston Churchill', 'Bahriye Nazırı', 'ingiliz', 'entente', 'siyasi',
    [6, 1, 3, 3], ['atilgan_amiral', 'israfci'], '1915-01-11',
    'Bahriye Nazırı; harekâtın siyasi mimarı. 18 Mart kayıplarından sonra bile ' +
    '"gemiler harcanabilir" diyerek devam edilmesini istedi. Fisher\'ın ' +
    'istifasının ardından görevden alındı.',
    'Siyasi irade olarak taarruzu dayatır: taarruz 6, savunma 1.',
    WIKI_NAVAL,
  ),
];
