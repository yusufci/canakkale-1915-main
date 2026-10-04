import type { EventEffect } from '../core/types.ts';

/**
 * Kampanya kronolojisi. Tarihi gelen olay bildirim olarak düşer; bazılarının
 * oyun etkisi vardır. Seçenekli olanlarda oyuncu tarihten sapabilir.
 *
 * Kaynak: Barış BORLAT, "Çanakkale Savaşları Kronolojisi (28 Haziran 1914 –
 * 9 Ocak 1916)", Çanakkale Onsekiz Mart Üniversitesi.
 *   https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 * Deniz harekâtı ayrıntıları için ayrıca:
 *   https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign
 */

const COMU = 'https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html';
const WIKI = 'https://en.wikipedia.org/wiki/Naval_operations_in_the_Dardanelles_campaign';

export interface EventSpec {
  readonly id: string;
  /** ISO tarih. */
  readonly date: string;
  readonly title: string;
  readonly body: string;
  readonly kind: 'deniz' | 'kara' | 'hava' | 'siyasi' | 'ikmal';
  readonly src: string;
  readonly effect?: EventEffect;
  readonly choices?: readonly {
    readonly label: string;
    readonly desc: string;
    readonly effect: EventEffect;
  }[];
}

export const EVENTS: readonly EventSpec[] = [
  {
    id: 'ev_19_subat',
    date: '1915-02-19',
    title: 'Boğaz Muharebeleri Başladı',
    body:
      'İngiliz ve Fransız filosu 12 zırhlı ve kruvazörle Çanakkale önlerine ' +
      'gelip saldırı düzenine geçti. İlk top 07.58\'de Orhaniye Tepe ' +
      'bataryasının 240 mm Krupp\'undan atıldı. Yedi buçuk saatte İtilaf bin ' +
      'mermiden fazla attı; Türk tarafı Orhaniye ve Ertuğrul\'dan ancak 38 ' +
      'mermiyle karşılık verebildi. Orhaniye batarya komutanı Alman Yüzbaşı ' +
      'Woermann dahil 1 subay öldü, 1 subay ve 2 er şehit, 11 yaralı.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_25_subat',
    date: '1915-02-25',
    title: 'Dış Tahkimat Susturuldu',
    body:
      'Saat 07.30\'da 8 İngiliz ve 4 Fransız gemisi boğaza yöneldi. İlyas ' +
      'Burnu fenerinin 10.600 m lodosunda demirleyen Queen Elizabeth 10.13\'te ' +
      'Seddülbahir\'i dövmeye başladı. Orhaniye gün boyu ancak bir mermi ' +
      'atabildi; Ertuğrul 74 mermi attı. Osmanlılar dış tahkimatı boşalttı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { ottoman: -0.04, entente: 0.04 } },
  },
  {
    id: 'ev_26_subat_imha',
    date: '1915-02-26',
    title: 'İmha Müfrezeleri ve 10. Mayın Hattı',
    body:
      'İngiliz deniz piyadeleri Seddülbahir ve Kumkale tabyalarına çıkıp ' +
      'topları havaya uçurdu; neredeyse hiç direnişle karşılaşmadılar. ' +
      'Aynı gün İntibah 10. mayın hattını döktü.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_4_mart_mehmet_cavus',
    date: '1915-03-04',
    title: 'Mehmet Çavuş',
    body:
      'İtilaf kuvvetleri altmış kadar askerle Seddülbahir\'e çıkmaya başladı. ' +
      'Obüs bataryasının ateşi ve 27. Alay 10. Bölük çavuşlarından Mustafa ' +
      'oğlu Mehmed\'in yarım takımı düşmanı durdurdu. Tüfeğinin mekanizması ' +
      'bozulan Mehmet Çavuş düşmana taş ve sopayla saldırdı. İngilizler ' +
      'baskında 23 deniz piyadesi kaybetti.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: 0.03 } },
  },
  {
    id: 'ev_6_mart_barbaros',
    date: '1915-03-06',
    title: 'Barbaros, Queen Elizabeth\'e Karşı',
    body:
      'Yüzbaşı Muzaffer komutasındaki Barbaros Hayrettin zırhlısı, dönemin en ' +
      'modern savaş gemisi HMS Queen Elizabeth ile ateş teatisine girdi ve ' +
      'hasar verdirdi. Gece Amethyst ve muhriplerin koruduğu mayın tarama ' +
      'girişimi, koruma bataryalarının yoğun ateşiyle başarısız oldu.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_8_mart_nusret',
    date: '1915-03-08',
    title: 'Nusret — 11. Mayın Hattı',
    body:
      '7/8 Mart gecesi Yüzbaşı Hakkı Bey komutasındaki Nusret mayın gemisi, ' +
      'düşman projektörleri altında Erenköy Körfezi\'ne — Karanlık Liman\'a — ' +
      '26 mayın döktü. Hat boğazı kesmiyordu: Anadolu kıyısına PARALELDİ. ' +
      'Türk gözetleme postaları düşman gemilerinin çekilirken bu koyda sancağa ' +
      'döndüğünü fark etmişti. Hava keşfi hattı göremedi.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { ottoman: 0.05 } },
  },
  {
    id: 'ev_13_mart_amethyst',
    date: '1915-03-13',
    title: 'Amethyst Vuruldu',
    body:
      'Türk topçusu 369 mermi harcadı. Gece 00.30\'da mayın tarama filosunu ' +
      'koruyan Amethyst, Dardanos ve Kepez ışıldaklarını ateş altına aldı; ' +
      'Türk bataryalarının karşılığıyla geri çekildi. Birleşik Filo çoğu ' +
      'Amethyst\'te olmak üzere 27 ölü, 43 yaralı verdi.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_16_mart_carden',
    date: '1915-03-16',
    title: 'Carden Gitti, De Robeck Geldi',
    body:
      'Amiral Carden sağlık sebebiyle görevden alındı; yerine yardımcısı ' +
      'Amiral De Robeck atandı. De Robeck, tabyaların yalnız donanmayla ' +
      'susturulabileceğinden zaten şüpheliydi.',
    kind: 'siyasi',
    src: COMU,
  },
  {
    id: 'ev_18_mart',
    date: '1915-03-18',
    title: '18 MART — Boğaz Geçilmedi',
    body:
      'Güneş doğmadan Yüzbaşı Serno ve Yüzbaşı Schneider keşfe çıkıp filonun ' +
      'ilerleyişini bildirdi. 11.15\'te Triumph Halileli sırtlarına ilk ' +
      'mermiyi attı. 11.30\'da dört Fransız gemisi de girdi — boğazda 10 ' +
      'muharebe gemisi. 12.20\'de Çimenlik cephaneliği isabet aldı. 13.20\'de ' +
      'Anadolu Hamidiye, Dardanos\'a yaklaşmak isteyen Bouvet\'yi ateş altına ' +
      'aldı; 14.00\'te gemi yan yattı ve ÜÇ DAKİKADA battı — 639 ölü, 48 ' +
      'kurtulan. 15.15\'te Namazgâh kışlasının çatısı uçtu. 16.30\'da ' +
      'Irresistible iskeleye yattı. 18.05\'te Ocean\'ın dümeni mayınla ' +
      'kilitlendi. 18.00\'de düşman çekilmeye başladı.\n\n' +
      'Bilanço — Türk: 79 kayıp; Alman: 18; toplam 97. İtilaf: Bouvet, Ocean ' +
      've Irresistible battı; Inflexible, Gaulois, Suffren ve Agamemnon savaş ' +
      'dışı kaldı; yaklaşık 800 insan kaybı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { ottoman: 0.2, entente: -0.2 } },
  },
  {
    id: 'ev_23_mart_karar',
    date: '1915-03-23',
    title: 'Kara Birlikleri Olmadan Olmaz',
    body:
      'De Robeck Amiralliğe telgraf çekip kara kuvveti istedi. Dardanel ' +
      'Komisyonu\'na sonradan verdiği ifadede asıl gerekçesini şöyle açıkladı: ' +
      'başarı hâlinde filo Marmara\'da, kendisine teslim olmayan bir düşmanla ' +
      'baş başa kalacak ve ele geçirdiği yeri tutacak asker bulunmayacaktı.',
    kind: 'siyasi',
    src: WIKI,
  },
  {
    id: 'ev_26_mart_sanders',
    date: '1915-03-26',
    title: 'Liman von Sanders Gelibolu\'da',
    body:
      'Mareşal Liman von Sanders Plevne vapuruyla Gelibolu\'ya gelip 5. Ordu ' +
      'Komutanlığında göreve başladı. Kuvvetleri kıyı boyunca yaymak yerine ' +
      'üç grupta ve ihtiyatta topladı.',
    kind: 'siyasi',
    src: COMU,
  },
  {
    id: 'ev_17_nisan_e15',
    date: '1915-04-17',
    title: 'E-15 Ele Geçirildi',
    body:
      'Boğazı geçmeye çalışan İngiliz E-15 denizaltısı fazla derine dalıp ' +
      'akıntıya kapıldı ve Kepez önlerinde Dardanos bataryasının topları ' +
      'altında karaya oturdu. Yedi mürettebat öldü, kalanı esir alındı.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_25_nisan',
    date: '1915-04-25',
    title: '25 NİSAN — Çıkarma',
    body:
      'Müttefikler Seddülbahir koylarına ve Arıburnu\'na, Fransızlar ' +
      'Kumkale\'ye oyalama çıkarması yaptı. Anzak Kolordusu Kabatepe ' +
      'dolaylarından ilk hedef olarak Conkbayırı-Kocaçimen hattını alacak, ' +
      '29. İngiliz Tümeni Alçıtepe\'ye yürüyecekti.\n\n' +
      'Kumkale sahili, 3.000\'den fazla Fransız askerine karşı, ihtiyatların ' +
      'yetişeceği iki saat boyunca toplam 240 Türk askeri tarafından savunuldu. ' +
      'Gece AE2 denizaltısı boğazı geçmeyi ilk başaran gemi oldu.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { entente: 0.05 } },
  },
  {
    id: 'ev_27_nisan_karsi',
    date: '1915-04-27',
    title: '19. Tümen Karşı Taarruzda',
    body:
      'Yüksek Sırt–Merkeztepe–Kırmızısırt–Kanlısırt hattı üzerinde 07.30\'da ' +
      'Anzak Kolordusuna karşı taarruza geçildi. Gece de süren muharebelerin ' +
      'ilginç sonucu: oluşan mevzi hatları, küçük dalgalanmalar dışında ' +
      'savaşın sonuna kadar değişmeyecekti.',
    kind: 'kara',
    src: COMU,
  },
  {
    id: 'ev_30_nisan_ae2',
    date: '1915-04-30',
    title: 'AE2 Batırıldı',
    body:
      'Boğazı geçmeyi ilk başaran AE2 denizaltısı, Marmara\'da Sultanhisar ' +
      'torpidobotu tarafından batırıldı; mürettebat esir alındı.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_3_mayis_sodenstern',
    date: '1915-05-03',
    title: 'Pahalı Bir Taarruz',
    body:
      'Albay Von Sodenstern\'in iyi planlanmamış, aceleye getirilmiş ' +
      'Seddülbahir taarruzu 15. Tümen\'den 5.100 asker kaybına mal oldu.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: -0.05 }, manpower: { ottoman: -5100 } },
  },
  {
    id: 'ev_13_mayis_goliath',
    date: '1915-05-13',
    title: 'Muavenet-i Milliye, Goliath\'ı Batırdı',
    body:
      '12/13 Mayıs gecesi Muavenet-i Milliye torpidosunun komutanı Yüzbaşı ' +
      'Ahmet Bey ve Yüzbaşı Firle, Morto Koyu\'nda İngiliz Goliath zırhlısını ' +
      'torpilleyerek batırdı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { ottoman: 0.06, entente: -0.05 } },
  },
  {
    id: 'ev_19_mayis',
    date: '1915-05-19',
    title: '19 Mayıs Taarruzu',
    body:
      'Enver Paşa\'nın 11 Mayıs teftişinde verdiği "düşmanı bir an önce denize ' +
      'dökün" emri üzerine, 03.30\'da Arıburnu Cephesi\'nin tamamında taarruza ' +
      'geçildi. Her an bir Türk taarruzu bekleyen hazırlıklı düşmanın tüfek ve ' +
      'makineli ateşiyle kurduğu mermi barajı aşılamadı. Dört buçuk saatte ' +
      '3.420 şehit, 6.064 yaralı, 486 kayıp — toplam 9.970.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: -0.08 }, manpower: { ottoman: -9970 } },
  },
  {
    id: 'ev_24_mayis_ateskes',
    date: '1915-05-24',
    title: 'Dokuz Saatlik Ateşkes',
    body:
      'Arıburnu\'nda 19 Mayıs taarruzunun ölülerinin defni için dokuz saatlik ' +
      'ateşkes yapıldı. İki taraf askerleri aynı toprakta yan yana çalıştı.',
    kind: 'siyasi',
    src: COMU,
  },
  {
    id: 'ev_25_mayis_u21',
    date: '1915-05-25',
    title: 'U-21: Triumph',
    body:
      'Alman Yüzbaşı Otto Hersing komutasındaki U-21, Kabatepe açıklarında ' +
      'İngiliz Triumph zırhlısını torpilleyerek batırdı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { entente: -0.05 } },
  },
  {
    id: 'ev_27_mayis_majestic',
    date: '1915-05-27',
    title: 'U-21: Majestic',
    body:
      'U-21 iki gün sonra Majestic zırhlısını da batırdı. Ağır gemiler ' +
      'Mudros\'a çekildi; kıyı desteği ciddi biçimde azaldı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { entente: -0.06 } },
  },
  {
    id: 'ev_28_haziran_zigindere',
    date: '1915-06-28',
    title: 'Zığındere — Kampanyanın En Kanlısı',
    body:
      '00.20\'de başlayan İngiliz bombardımanı 09.00\'dan sonra şiddetlendi. ' +
      'Savunma mevzileri ve tel örgüler yerle bir oldu, telefon hatları koptu. ' +
      '5 Temmuz\'a kadar süren muharebelerde toplam kayıp 16.000 kişiye ulaştı; ' +
      '5 Temmuz taarruzunda taarruz gücünün %40\'ı kaybedildi.',
    kind: 'kara',
    src: COMU,
    effect: { manpower: { ottoman: -8000, entente: -8000 } },
  },
  {
    id: 'ev_12_temmuz_cephane',
    date: '1915-07-12',
    title: '"Çok Cephane, Az İnsan"',
    body:
      'İngiliz ve Fransız birlikleri 04.30\'da üç saat boyunca karadan, ' +
      'denizden ve on dört kadar uçakla havadan bombardıman yaptı; 60.000\'e ' +
      'yakın top mermisi harcadılar.\n\n' +
      'Liman von Sanders\'in Enver Paşa\'ya raporu: "Düşman anlatılamayacak ' +
      'derecede çok cephane ve az insan harcıyor. Merak nedeniyle düşmanın bir ' +
      'dakikada obüs ve gemi toplarıyla 150 mermi attığı sayılmıştır. Biz ise ' +
      'pek çok insan, az cephane feda ediyoruz."',
    kind: 'ikmal',
    src: COMU,
    effect: { fortAmmo: { ottoman: -0.15 } },
  },
  {
    id: 'ev_6_agustos_anafartalar',
    date: '1915-08-06',
    title: 'Anafartalar Çıkarması',
    body:
      'İngilizler 22.00\'den itibaren Anafartalar sahillerine çıktı. Aynı akşam ' +
      'Kanlı Sırt\'ta Anzak taarruzu başladı: 15.00\'ten itibaren obüs, havan ve ' +
      'gemi toplarıyla yapılan bombardıman siperlerin üstündeki kalasları ' +
      'çökertti, mazgalları kapattı.',
    kind: 'kara',
    src: COMU,
  },
  {
    id: 'ev_8_agustos_kemal',
    date: '1915-08-08',
    title: 'Mustafa Kemal, Anafartalar Grubu Komutanı',
    body:
      'Saros Grubu Komutanı Albay Ahmet Fevzi, "birlikler hazır değil" ' +
      'gerekçesiyle taarruz emrini yerine getirmedi ve görevden alındı. ' +
      'Akşam 19. Tümen Komutanı Albay Mustafa Kemal Anafartalar Grubu ' +
      'Komutanlığına atandı.\n\n' +
      'Aynı gün Barbaros Hayrettin, Bolayır açıklarında E-11 tarafından ' +
      'torpillenerek battı.',
    kind: 'siyasi',
    src: COMU,
    choices: [
      {
        label: 'Hemen taarruz et (tarihsel)',
        desc:
          '9 Ağustos sabahı 04.00\'te, İngilizlerden önce. Hazırlıksız ama ' +
          'düşmanı da hazırlıksız yakalar.',
        effect: { morale: { ottoman: 0.08 } },
      },
      {
        label: 'Bir gün hazırlan',
        desc:
          'Birlikler toparlansın. Ama İngilizler 9 Ağustos\'ta asıl taarruzu ' +
          'yapacak ve tepeleri alacak.',
        effect: { morale: { ottoman: -0.05, entente: 0.08 } },
      },
    ],
  },
  {
    id: 'ev_10_agustos_conkbayiri',
    date: '1915-08-10',
    title: 'Conkbayırı Süngü Hücumu',
    body:
      'Sabah 04.30\'da Conkbayırı\'nda düşmana süngü hücumu yapıldı; ' +
      'İngilizler yerlerinden söküldü. Yeni Zelanda Tugayı Şahin Sırtı\'nın ' +
      'batısında gereğinden fazla zaman kaybetmiş ve o sırada BOŞ olan ' +
      'Conkbayırı\'nı ele geçirme fırsatını yitirmişti.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: 0.1, entente: -0.08 } },
  },
  {
    id: 'ev_13_agustos_avni',
    date: '1915-08-13',
    title: '57. Alay Komutanı Şehit',
    body:
      '57. Alay Komutanı Yarbay Hüseyin Avni Bey, karargâhına düşen bir obüs ' +
      'mermisiyle şehit oldu.',
    kind: 'kara',
    src: COMU,
  },
  {
    id: 'ev_28_agustos_mevzi',
    date: '1915-08-28',
    title: 'Cephe Dondu',
    body:
      'Bomba Tepe muharebesinden sonra, düşmanın son askerini tahliye etmesine ' +
      'kadar geçen sürede Çanakkale Cephesi\'ndeki çarpışmalar tamamen mevzi ' +
      'muharebesi şeklinde geçti.',
    kind: 'kara',
    src: COMU,
  },
  {
    id: 'ev_14_eylul_hakki',
    date: '1915-09-14',
    title: 'Yüzbaşı Hakkı Bey Vefat Etti',
    body:
      'Nusret mayın gemisinin kaptanı Tophaneli İbrahimoğlu Yüzbaşı Hakkı, ' +
      'Kasımpaşa Askerî Hastanesi\'nde vefat etti. Aynı gün E-7 denizaltısı ' +
      'Nara\'daki mânia ağına takıldı.',
    kind: 'deniz',
    src: COMU,
  },
  {
    id: 'ev_14_ekim_hamilton',
    date: '1915-10-14',
    title: 'Hamilton Görevden Alındı',
    body:
      'Sir Ian Hamilton görevden alındı; ertesi gün yerine General Monro ' +
      'atandı. Monro cepheyi gezip tahliye tavsiyesinde bulunacaktı.',
    kind: 'siyasi',
    src: COMU,
  },
  {
    id: 'ev_30_ekim_mustecip',
    date: '1915-10-30',
    title: 'Müstecip Onbaşı',
    body:
      'Fransız Turquoise denizaltısı kıyı topçusunun isabetli atışlarıyla ' +
      'hasar görüp ele geçirildi. Gemiye, onu vuran erin adına atfen ' +
      '"Müstecip Onbaşı" adı verildi. Ele geçen belgelerden E-20\'nin randevu ' +
      'noktası öğrenildi; 6 Kasım\'da UB-14 oraya gidip E-20\'yi batırdı.',
    kind: 'deniz',
    src: COMU,
    effect: { morale: { ottoman: 0.04 } },
  },
  {
    id: 'ev_25_kasim_firtina',
    date: '1915-11-25',
    title: 'Büyük Fırtına',
    body:
      'Gece yağan yoğun yağmur iki tarafta da önemli kayıplara yol açtı. ' +
      'Siperleri sel bastı; donarak ölenler oldu. Tahliye kararını hızlandıran ' +
      'etkenlerden biri oldu.',
    kind: 'ikmal',
    src: COMU,
    effect: { manpower: { ottoman: -1500, entente: -2500 } },
  },
  {
    id: 'ev_7_aralik_tahliye_karari',
    date: '1915-12-07',
    title: 'Tahliye Kararı',
    body:
      'İngiliz kabinesi kampanyayı terk etme kararı aldı. Savaş Komitesi ' +
      '23 Kasım\'da bütün birliklerin çekilmesini tavsiye etmişti.',
    kind: 'siyasi',
    src: WIKI,
  },
  {
    id: 'ev_20_aralik_tahliye',
    date: '1915-12-20',
    title: 'Arıburnu ve Anafartalar Tahliye Edildi',
    body:
      'İtilaf kuvvetleri Arıburnu ve Anafartalar cephelerini boşalttı. ' +
      'Tahliye kampanyanın en kusursuz yürütülen harekâtı oldu — neredeyse ' +
      'hiç kayıp verilmedi.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: 0.15, entente: -0.1 } },
  },
  {
    id: 'ev_9_ocak_son',
    date: '1916-01-09',
    title: 'Seddülbahir Tahliye Edildi — Çanakkale Geçilmedi',
    body:
      'Son İtilaf askeri Seddülbahir\'den ayrıldı. Sekiz buçuk aylık kara ' +
      'muharebelerinin ve on bir aylık deniz harekâtının sonunda boğaz ' +
      'geçilmemişti.',
    kind: 'kara',
    src: COMU,
    effect: { morale: { ottoman: 0.3, entente: -0.3 } },
  },
];
