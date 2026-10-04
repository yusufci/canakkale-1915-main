/**
 * Çanakkale 1915 — çekirdek tip sözleşmesi.
 *
 * Birimler ve ölçüler:
 *  - Konum/uzunluk: METRE. Harita yerel eşdikdörtgen izdüşümde saklanır (bkz. core/geo.ts).
 *  - Zaman: 1 tur = 1 GÜN. Tarihler `DayIndex` (senaryo başlangıcından itibaren gün sayısı).
 *  - İnsan gücü: kişi. Top: namlu adedi. Mühimmat: atış adedi.
 *
 * Tasarım notu: HOI4'ten alınan sistemler (cephe genişliği, organizasyon, siperlenme,
 * tahkimat, ikmal, komutan özellikleri, harita modları) tur tabanlı günlük çözüme
 * uyarlanmıştır. HOI4 saatlik tick yerine bir tur = bir gün = 24 muharebe saati sayılır.
 */

// ─────────────────────────────────────────────────────────────── temel ─────

/** Senaryo başlangıcından itibaren geçen gün. 0 = senaryo ilk günü. */
export type DayIndex = number;

/** Yerel izdüşümde metre cinsinden nokta. */
export interface Vec2 {
  x: number;
  y: number;
}

/** WGS84 coğrafi konum. */
export interface LonLat {
  lon: number;
  lat: number;
}

export type Side = 'ottoman' | 'entente';

/** Bayrak/renk/isim için alt milletler. Muharebe hesabında taraf (`Side`) belirleyicidir. */
export type Nation =
  | 'osmanli'
  | 'alman'
  | 'ingiliz'
  | 'fransiz'
  | 'anzac'
  | 'hint'
  | 'newfoundland';

export const SIDE_OF_NATION: Record<Nation, Side> = {
  osmanli: 'ottoman',
  alman: 'ottoman',
  ingiliz: 'entente',
  fransiz: 'entente',
  anzac: 'entente',
  hint: 'entente',
  newfoundland: 'entente',
};

// ──────────────────────────────────────────────────────────────── harita ────

export type LandTerrain =
  | 'ova' // plain
  | 'tepe' // hills
  | 'dag' // mountain / sırt
  | 'kayalik' // broken, rocky ravines (Arıburnu derelerin)
  | 'bataklik' // marsh (Tuz Gölü / Suvla)
  | 'sahil' // beach / landing shelf
  | 'sehir'; // urban

export type SeaTerrain =
  | 'bogaz' // dar boğaz — akıntı, kıyı topçusu menzilinde
  | 'korfez' // koy / körfez
  | 'acik_deniz'; // açık deniz

export type Terrain = LandTerrain | SeaTerrain;

export interface TerrainProfile {
  readonly id: Terrain;
  readonly name: string;
  /** Saldırana çarpan. -0.30 = saldırı gücü %30 düşer. */
  readonly attackMod: number;
  /** Savunana hareket cezası. 1.0 = normal, 2.5 = iki buçuk kat yavaş. */
  readonly moveCost: number;
  /** Bu arazide kullanılabilen azami cephe genişliği (bkz. combat.ts). */
  readonly combatWidth: number;
  /** Siperlenmenin günlük artış çarpanı. */
  readonly digInMod: number;
  /** Deniz ise true. */
  readonly isSea: boolean;
}

export interface Province {
  readonly id: ProvinceId;
  readonly name: string;
  /** Harita üzerinde etiket gösterilsin mi (küçük iller etiketsiz). */
  readonly labelled: boolean;
  readonly isSea: boolean;
  readonly terrain: Terrain;
  /** Metre cinsinden ağırlık merkezi. */
  readonly center: Vec2;
  /** Dış sınır halkası, metre, saat yönünde. */
  readonly polygon: readonly Vec2[];
  /** Kara için ortalama rakım (m). Deniz için ortalama derinlik negatif (m). */
  readonly elevation: number;
  /** Kara için en yüksek nokta (m) — topçu gözetleme avantajı. */
  readonly peak: number;
  readonly neighbours: readonly ProvinceId[];
  /** Karaya çıkarma yapılabilecek sahil ili ise, komşu deniz illeri. */
  readonly beachAccess: readonly ProvinceId[];
  /** Zafer puanı. 0 = değersiz. */
  readonly victoryPoints: number;
  /** İkmal kaynağı ise kapasitesi (adam/gün beslenebilir), değilse 0. */
  readonly supplyHub: number;
  readonly startOwner: Side | null;
  /** Yalnızca deniz illeri: boğazın bu noktadaki genişliği (m). */
  readonly straitWidth?: number;
  /** Yalnızca deniz illeri: yüzey akıntısı (knot). Boğazda Marmara→Ege yönünde ~4 kn. */
  readonly current?: number;
}

export type ProvinceId = string;

export interface GameMap {
  readonly origin: LonLat;
  readonly provinces: readonly Province[];
  /** Kıyı çizgisi halkaları (yalnızca çizim için, metre). */
  readonly coastRings: readonly (readonly Vec2[])[];
  /** Metre cinsinden harita sınırları. */
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Çizim için yükseklik ızgarası. */
  readonly relief: ReliefGrid;
  readonly landmarks: readonly Landmark[];
}

export interface ReliefGrid {
  readonly width: number;
  readonly height: number;
  readonly minX: number;
  readonly minY: number;
  readonly cell: number;
  /** width*height, metre cinsinden rakım. Deniz < 0. */
  readonly data: Int16Array;
}

export interface Landmark {
  readonly name: string;
  readonly pos: Vec2;
  readonly kind: 'sehir' | 'koy' | 'tepe' | 'burun' | 'koyun' | 'ada';
  /** Etiketin görünür olduğu asgari yakınlaştırma. */
  readonly minZoom: number;
}

// ───────────────────────────────────────────────────── kara birlikleri ────

/** Tabur sınıfı — tümen şablonlarının yapı taşı (HOI4 battalion muadili). */
export type BattalionKind =
  | 'piyade'
  | 'avci' // nişancı/avcı taburu — daha iyi saldırı
  | 'suvari'
  | 'istihkam' // siper/tahkimat
  | 'sahra_topcu'
  | 'obus' // ağır obüs
  | 'makineli'
  | 'deniz_piyade'; // Royal Naval Division / Fransız denizci

export interface BattalionProfile {
  readonly id: BattalionKind;
  readonly name: string;
  readonly men: number;
  /** Cephe genişliğinden tükettiği pay. */
  readonly width: number;
  /** Yumuşak hedefe saldırı (siperdeki piyade). */
  readonly softAttack: number;
  /** Tahkimata/zırha karşı delme gücü. */
  readonly breakthrough: number;
  readonly defence: number;
  /** Organizasyon havuzuna katkı. */
  readonly organisation: number;
  /** Dayanıklılık havuzuna katkı. */
  readonly hp: number;
  /** Günlük ikmal tüketimi (ton). */
  readonly supplyUse: number;
  /** Top namlusu sayısı (topçu destek hesabı). */
  readonly guns: number;
}

export interface DivisionTemplate {
  readonly id: string;
  readonly name: string;
  readonly nation: Nation;
  /** Tabur sınıfı → adet. */
  readonly battalions: Readonly<Partial<Record<BattalionKind, number>>>;
}

export type UnitId = string;

/** Harita üzerindeki kara birliği. Oyunda ölçek: tümen (≈8–10 bin) veya alay (≈3 bin). */
export interface LandUnit {
  id: UnitId;
  name: string;
  nation: Nation;
  side: Side;
  templateId: string;
  location: ProvinceId;
  /** Mevcut asker. */
  strength: number;
  /** Kadro mevcudu. */
  maxStrength: number;
  /** Organizasyon 0..maxOrganisation. 0 = muharebe edemez, geri çekilir. */
  organisation: number;
  maxOrganisation: number;
  /** 0..maxEntrenchment — siperlenme seviyesi. */
  entrenchment: number;
  /** Tecrübe 0..100. */
  experience: number;
  /** İkmal karşılanma oranı 0..1. */
  supplied: number;
  commanderId: string | null;
  /** Verilen emir. */
  order: LandOrder | null;
  /** Hareket ilerlemesi 0..1. */
  moveProgress: number;
  /** Bu tur muharebeye girdi mi (çizim/rapor için). */
  inCombat: boolean;
  /** Karaya çıkarılmayı bekleyen birlik hangi filoda. */
  embarkedIn: UnitId | null;
}

export type LandOrderKind =
  | 'bekle'
  | 'yuru' // hedef ile taşın
  | 'taarruz' // komşu ile saldır
  | 'siperlen'
  | 'cikarma'; // denizden karaya çıkarma

export interface LandOrder {
  kind: LandOrderKind;
  target: ProvinceId | null;
  /** Çok adımlı yol (yuru emri). */
  path: readonly ProvinceId[];
}

// ──────────────────────────────────────────────────── deniz birlikleri ────

export type ShipClass =
  | 'dretnot'
  | 'muharebe_kruvazoru'
  | 'pre_dretnot'
  | 'zirhli_kruvazor'
  | 'hafif_kruvazor'
  | 'muhrip'
  | 'mayin_tarayici'
  | 'mayin_gemisi'
  | 'denizalti'
  | 'ucak_gemisi'
  | 'nakliye';

export interface ShipProfile {
  readonly id: ShipClass;
  readonly name: string;
  /** Deplasman (ton) — hasar havuzu bundan türetilir. */
  readonly displacement: number;
  /** Zırh kuşağı (mm). */
  readonly armour: number;
  /** Ana batarya toplam ağırlık puanı — tabya bastırma gücü. */
  readonly gunPower: number;
  /** Azami etkili menzil (m). */
  readonly gunRange: number;
  readonly speed: number; // knot
  /** Mayına dayanıklılık 0..1 — ne kadar yüksekse tek mayınla batma olasılığı düşük. */
  readonly mineResistance: number;
  /** Tarayabildiği günlük mayın adedi (yalnız tarayıcı). */
  readonly sweepRate: number;
  /** Döşeyebildiği mayın adedi (yalnız mayın gemisi). */
  readonly mineCapacity: number;
  readonly crew: number;
}

export interface Ship {
  id: UnitId;
  name: string;
  nation: Nation;
  cls: ShipClass;
  /** 0..1 — 0 batık. */
  hull: number;
  /** Mühimmat 0..1. */
  ammo: number;
  /** Taşıdığı mayın (mayın gemisi). */
  mines: number;
  /** Batışı/hasarı tarihsel ise bu notu olay kaydında kullan. */
  historicalNote?: string;
}

export interface Fleet {
  id: UnitId;
  name: string;
  nation: Nation;
  side: Side;
  location: ProvinceId;
  ships: Ship[];
  commanderId: string | null;
  order: NavalOrder | null;
  moveProgress: number;
  /** Bu filonun taşıdığı kara birlikleri. */
  embarked: UnitId[];
  inCombat: boolean;
}

export type NavalOrderKind =
  | 'demirle'
  | 'seyret'
  | 'bombardiman' // kıyı hedefini döv
  | 'mayin_tara'
  | 'mayin_dok'
  | 'cikarma_destek'
  | 'zorla_gec'; // boğazı zorla — tarihsel 18 Mart manevrası

export interface NavalOrder {
  kind: NavalOrderKind;
  /** Deniz hedefi (seyret/zorla_gec/mayin_*) veya kara hedefi (bombardiman). */
  target: ProvinceId | null;
  path: readonly ProvinceId[];
  /** Bombardıman için hedef tabya. */
  fortTarget?: string;
}

// ────────────────────────────────────────────────────── tabya & mayın ────

export interface GunProfile {
  readonly id: string;
  readonly name: string;
  readonly calibre: number; // mm
  /** Etkili menzil (m). */
  readonly range: number;
  /** Mermi ağırlığı (kg). */
  readonly shell: number;
  /** Zırh delme puanı. */
  readonly penetration: number;
  /** Atış hızı (atış/dakika). */
  readonly rof: number;
}

export interface FortGun {
  readonly gunId: string;
  count: number;
}

export type FortGroup = 'dis' | 'ara' | 'ic' | 'bolayir' | 'obus';

export interface Fort {
  readonly id: string;
  readonly name: string;
  readonly nameEn?: string;
  readonly fortNo?: string;
  readonly shore: 'rumeli' | 'anadolu';
  readonly group: FortGroup;
  readonly pos: Vec2;
  readonly province: ProvinceId;
  /** Hareketli obüs bataryası ise true — bombardımandan sonra yer değiştirebilir. */
  readonly mobile: boolean;
  guns: FortGun[];
  /** Mühimmat (atış adedi). 1915'te kritik darboğaz. */
  ammo: number;
  maxAmmo: number;
  /** Yapı bütünlüğü 0..1 — 0 ise susturuldu. */
  integrity: number;
  /** Geçici bastırılma 0..1 — her tur toparlanır. */
  suppression: number;
  /** Karşı taraf bu tabyanın yerini biliyor mu. */
  spotted: boolean;
  readonly src: string;
  readonly note?: string;
}

export interface Minefield {
  readonly id: string;
  readonly name: string;
  province: ProvinceId;
  /** Hattın iki ucu (metre). */
  readonly from: Vec2;
  readonly to: Vec2;
  mines: number;
  readonly initialMines: number;
  readonly depth: number; // mayın derinliği (m)
  readonly laidOn: DayIndex;
  side: Side;
  /** Karşı taraf hattı tespit etti mi. */
  spotted: boolean;
  readonly src: string;
  readonly note?: string;
}

// ──────────────────────────────────────────────────────────────── hava ────

export type AirRole = 'kesif' | 'gozetleme' | 'bombardiman' | 'avci';

export interface AirWing {
  id: UnitId;
  name: string;
  nation: Nation;
  side: Side;
  role: AirRole;
  /** Uçak adedi. */
  planes: number;
  maxPlanes: number;
  /** Üs ili (kara veya uçak gemisinin bulunduğu deniz ili). */
  base: ProvinceId;
  /** Görev menzili (m). */
  range: number;
  order: AirOrder | null;
}

export interface AirOrder {
  kind: AirRole;
  target: ProvinceId | null;
}

// ─────────────────────────────────────────────────────────── komutanlar ────

export interface CommanderTrait {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  readonly mods: Readonly<Partial<CombatMods>>;
}

export interface CombatMods {
  attack: number;
  defence: number;
  /** Organizasyon toparlanma çarpanı. */
  orgRecovery: number;
  /** Hareket hızı çarpanı. */
  speed: number;
  /** Siperlenme hızı çarpanı. */
  digIn: number;
  /** Deniz hedefleme/isabet çarpanı. */
  gunnery: number;
  /** İkmal verimi çarpanı. */
  logistics: number;
  /** Çıkarma başarısı çarpanı. */
  amphibious: number;
}

export interface Commander {
  readonly id: string;
  readonly name: string;
  readonly rank: string;
  readonly side: Side;
  readonly nation: Nation;
  readonly kind: 'kara' | 'deniz' | 'siyasi';
  readonly bio: string;
  /** 1..7 HOI4 benzeri yetenek. */
  readonly skill: {
    attack: number;
    defence: number;
    planning: number;
    logistics: number;
  };
  readonly traits: readonly string[];
  /** Senaryoya hangi gün katılır. */
  readonly availableFrom: DayIndex;
  readonly src: string;
  /** Atandığı birim (oyun sırasında değişir). */
  assignedTo?: UnitId | null;
}

// ─────────────────────────────────────────────────────── olaylar & oyun ────

export interface HistoricalEvent {
  readonly id: string;
  readonly day: DayIndex;
  readonly date: string; // ISO
  readonly title: string;
  readonly body: string;
  readonly kind: 'deniz' | 'kara' | 'hava' | 'siyasi' | 'ikmal';
  readonly src: string;
  /** Oyun durumuna uygulanacak etki (opsiyonel). */
  readonly effect?: EventEffect;
  /** Oyuncuya sunulan seçenekler. Boşsa sadece bildirim. */
  readonly choices?: readonly EventChoice[];
}

export interface EventChoice {
  readonly label: string;
  readonly desc: string;
  readonly effect: EventEffect;
}

export interface EventEffect {
  /** Yeni birim/filo/mayın tarlası ekle. */
  readonly spawn?: readonly string[];
  /** Taraf moraline etki (-1..1). */
  readonly morale?: Partial<Record<Side, number>>;
  /** İnsan gücü havuzuna etki. */
  readonly manpower?: Partial<Record<Side, number>>;
  /** Tabya mühimmatına etki (oran). */
  readonly fortAmmo?: Partial<Record<Side, number>>;
}

export interface CombatReport {
  readonly id: string;
  readonly day: DayIndex;
  readonly kind: 'kara' | 'deniz' | 'tabya' | 'mayin' | 'hava';
  readonly province: ProvinceId;
  readonly title: string;
  readonly lines: readonly string[];
  readonly losses: Readonly<Record<Side, { men: number; ships: number; guns: number }>>;
  readonly winner: Side | null;
}

export interface SideState {
  readonly side: Side;
  /** Takviye havuzu (kişi). */
  manpower: number;
  /** Günlük takviye akışı. */
  manpowerPerDay: number;
  /** Ulusal birlik / savaş desteği 0..1. 0'a inerse teslim. */
  morale: number;
  /** Tabya/topçu mühimmat havuzu (atış). */
  ammo: number;
  ammoPerDay: number;
  /** Keşif ile elde edilen istihbarat 0..1. */
  intel: number;
}

export type Weather = 'acik' | 'puslu' | 'yagmur' | 'firtina';

export interface WeatherProfile {
  readonly id: Weather;
  readonly name: string;
  /** Deniz topçusu isabet çarpanı. */
  readonly gunnery: number;
  /** Hava görevi yapılabilirlik 0..1. */
  readonly flying: number;
  /** Kara hareket çarpanı. */
  readonly movement: number;
  /** Mayın tarama verimi çarpanı. */
  readonly sweeping: number;
}

export type Phase = 'emir' | 'cozum' | 'bitti';

export interface GameState {
  day: DayIndex;
  /** ISO tarih — senaryo başlangıcı + day. */
  date: string;
  phase: Phase;
  weather: Weather;
  /** Oyuncunun oynadığı taraf. */
  playerSide: Side;
  provinces: Record<ProvinceId, ProvinceState>;
  landUnits: Record<UnitId, LandUnit>;
  fleets: Record<UnitId, Fleet>;
  airWings: Record<UnitId, AirWing>;
  forts: Record<string, Fort>;
  minefields: Record<string, Minefield>;
  commanders: Record<string, Commander>;
  sides: Record<Side, SideState>;
  /** Çözülmüş muharebe raporları (en yeni başta). */
  reports: CombatReport[];
  /** Tetiklenmiş olaylar. */
  firedEvents: string[];
  /** Bekleyen olay kuyruğu (oyuncuya gösterilecek). */
  pendingEvents: HistoricalEvent[];
  /** Deterministik RNG durumu. */
  rngState: number;
  outcome: Outcome | null;
}

export interface ProvinceState {
  owner: Side | null;
  controller: Side | null;
  /** İkmal karşılanma 0..1. */
  supply: number;
  /** Tahkimat seviyesi 0..10 (HOI4 fort level muadili). */
  fortLevel: number;
  /** Her taraf için görüş: bu ili görüyor mu. */
  seen: Record<Side, boolean>;
  /** Hangi gün en son görüldü. */
  lastSeen: Record<Side, DayIndex>;
}

export interface Outcome {
  readonly winner: Side;
  readonly reason: string;
  readonly day: DayIndex;
}

// ──────────────────────────────────────────────────────────── senaryo ────

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  readonly startDate: string; // ISO
  readonly endDate: string; // ISO
  readonly playerSide: Side;
  readonly map: GameMap;
  readonly templates: readonly DivisionTemplate[];
  readonly landUnits: readonly ScenarioLandUnit[];
  readonly fleets: readonly ScenarioFleet[];
  readonly airWings: readonly ScenarioAirWing[];
  readonly forts: readonly Fort[];
  readonly minefields: readonly Minefield[];
  readonly commanders: readonly Commander[];
  readonly events: readonly HistoricalEvent[];
  readonly sides: Readonly<Record<Side, SideState>>;
  readonly victory: VictoryRules;
}

export interface ScenarioLandUnit {
  readonly id: UnitId;
  readonly name: string;
  readonly nation: Nation;
  readonly templateId: string;
  readonly location: ProvinceId;
  readonly commanderId?: string;
  readonly arrivesOn?: DayIndex;
  readonly src?: string;
}

export interface ScenarioFleet {
  readonly id: UnitId;
  readonly name: string;
  readonly nation: Nation;
  readonly location: ProvinceId;
  readonly commanderId?: string;
  readonly arrivesOn?: DayIndex;
  readonly ships: readonly { name: string; cls: ShipClass; note?: string }[];
  readonly src?: string;
}

export interface ScenarioAirWing {
  readonly id: UnitId;
  readonly name: string;
  readonly nation: Nation;
  readonly role: AirRole;
  readonly planes: number;
  readonly base: ProvinceId;
  readonly arrivesOn?: DayIndex;
  readonly src?: string;
}

export interface VictoryRules {
  /** Entente bu illerin hepsini ele geçirirse boğaz zorlandı sayılır. */
  readonly ententeStraitProvinces: readonly ProvinceId[];
  /** Entente bu kadar büyük gemi kaybederse filo çekilir. */
  readonly ententeCapitalShipLimit: number;
  /** Osmanlı bu illeri kaybederse yarımada düşer. */
  readonly ottomanMustHold: readonly ProvinceId[];
  /** Son güne kadar dayanırsa Osmanlı kazanır. */
  readonly lastDay: DayIndex;
}
