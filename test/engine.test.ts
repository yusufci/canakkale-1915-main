import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAP, prov, provinceDist } from '../src/core/geo.ts';
import { TERRAINS } from '../src/data/units.ts';
import { MINEFIELDS } from '../src/data/minefields.ts';
import { FORTS } from '../src/data/forts.ts';
import { GUN_BY_ID } from '../src/data/guns.ts';
import { dayOf, newGame } from '../src/engine/scenario.ts';
import { endTurn } from '../src/engine/turn.ts';
import { CRIPPLED_HULL, liveShips, minefieldsIn, resolveNavalFire } from '../src/engine/naval.ts';
import { computeSupply } from '../src/engine/supply.ts';
import { Rng } from '../src/engine/rng.ts';

/**
 * Bu dosyadaki her test, geliştirme sırasında FİİLEN yaşanmış bir hatayı
 * yeniden yakalamak için var. Hiçbiri "fonksiyon çağrılıyor mu" testi değil.
 */

describe('harita verisi', () => {
  it('her ilin en az bir komşusu var', () => {
    for (const p of MAP.provinces) {
      assert.ok(p.neighbours.length > 0, `${p.id} komşusuz`);
    }
  });

  it('komşuluk simetrik', () => {
    for (const p of MAP.provinces) {
      for (const n of p.neighbours) {
        assert.ok(
          prov(n).neighbours.includes(p.id),
          `${p.id} -> ${n} tek yönlü`,
        );
      }
    }
  });

  it('kara illeri deniz arazisi taşımaz', () => {
    for (const p of MAP.provinces) {
      assert.equal(TERRAINS[p.terrain].isSea, p.isSea, `${p.id} arazi/ortam uyumsuz`);
    }
  });

  it('Dar Boğaz tarihsel genişliğiyle uyumlu (1500 m ± 400)', () => {
    // Yükseklik verisinden ölçülen 1,40 km; kaynaklarda 1.600 yarda (1.500 m).
    const w = prov('d_dar_bogaz').straitWidth;
    assert.ok(w !== undefined && Math.abs(w - 1500) <= 400, `ölçülen ${w}`);
  });
});

describe('tarihsel veri bütünlüğü', () => {
  it('18 Mart öncesi 11 mayın hattı ve 403 mayın', () => {
    assert.equal(MINEFIELDS.length, 11);
    assert.equal(
      MINEFIELDS.reduce((n, m) => n + m.mines, 0),
      403,
    );
  });

  it('Nusret hattı 8 Mart 1915, 26 mayın', () => {
    const n = MINEFIELDS.find((m) => m.id === 'hat_11_nusret');
    assert.ok(n);
    assert.equal(n.mines, 26);
    assert.equal(n.laidOn, '1915-03-08');
  });

  it('her tabyanın topu tanımlı', () => {
    for (const f of FORTS) {
      const ids = Object.keys(f.guns);
      assert.ok(ids.length > 0, `${f.id} topsuz`);
      for (const g of ids) {
        assert.ok(GUN_BY_ID[g], `${f.id}: bilinmeyen top ${g}`);
      }
    }
  });

  it('yaklaşık konumlu tabyalar gerekçe taşır', () => {
    for (const f of FORTS) {
      if (!f.approx) continue;
      assert.ok(f.posNote && f.posNote.length > 40, `${f.id} posNote eksik`);
    }
  });
});

describe('deniz harbi', () => {
  it('kıyı topçusu gemi BATIRMAZ, savaş dışı bırakır', () => {
    // 18 Mart'ta dört gemi savaş dışı kaldı, hiçbiri tabya ateşiyle batmadı.
    const s = newGame('ottoman');
    const fleet = s.fleets['uk_hat_a']!;
    fleet.location = 'd_dar_bogaz';
    fleet.order = { kind: 'bombardiman', target: 'd_dar_bogaz', path: [] };
    const rng = new Rng(1);
    for (let i = 0; i < 120; i++) {
      resolveNavalFire(s, rng);
      for (const f of Object.values(s.forts)) f.ammo = f.maxAmmo;
    }
    for (const sh of fleet.ships) {
      assert.ok(sh.hull > 0, `${sh.name} tabya ateşiyle battı`);
      assert.ok(sh.hull <= CRIPPLED_HULL, `${sh.name} hiç yıpranmadı`);
    }
  });

  it('tabya hasarı filo büyüklüğüyle çarpılmaz, PAYLAŞILIR', () => {
    // Hata: günlük hasar bütçesi gemi sayısıyla çarpılıyordu; 15 tekneli
    // tarama filosu 15 kat hasar alıp iki günde yok oluyordu.
    //
    // Doğru davranış: tabyaların günlük çıktısı sabittir, filoya PAYLAŞTIRILIR.
    // Yani filo büyüdükçe TOPLAM hasar sabit kalır, gemi BAŞINA hasar düşer.
    // (Gemi başına tavan 1 gemilik filoda bağlayıcı olduğu için karşılaştırma
    //  tavanın bağlamadığı iki büyük filo arasında yapılır.)
    const run = (count: number): { total: number; perShip: number } => {
      const s = newGame('ottoman');
      const f = s.fleets['uk_hat_a']!;
      const model = f.ships[1]!; // HMS Agamemnon — pre-dretnot
      f.ships = Array.from({ length: count }, (_, i) => ({
        ...model,
        id: `t${i}`,
        name: `Test ${i}`,
      }));
      f.location = 'd_dar_bogaz';
      f.order = { kind: 'bombardiman', target: 'd_dar_bogaz', path: [] };
      resolveNavalFire(s, new Rng(7));
      const total = f.ships.reduce((n, sh) => n + (1 - sh.hull), 0);
      return { total, perShip: total / count };
    };

    const six = run(6);
    const eighteen = run(18);
    assert.ok(six.total > 0.2, `hasar yok: ${six.total}`);
    // Toplam hasar aynı bütçeden gelir — gemi sayısı üç katına çıkınca
    // toplam en fazla biraz oynar, üç katına ÇIKMAZ.
    assert.ok(
      eighteen.total < six.total * 1.5,
      `6 gemi toplam ${six.total.toFixed(3)}, 18 gemi ${eighteen.total.toFixed(3)}`,
    );
    // Ve gemi başına hasar belirgin biçimde düşer.
    assert.ok(
      eighteen.perShip < six.perShip * 0.6,
      `gemi başına 6:${six.perShip.toFixed(3)} 18:${eighteen.perShip.toFixed(3)}`,
    );
  });

  it('maliyeti bir günlük bütçeyi aşan ilk adımda filo kilitlenmez', () => {
    // Hata: ilk sıçrama 42.400 m, bütçe 42.000 m -> filo sonsuza dek durdu.
    const s = newGame('ottoman');
    const f = s.fleets['uk_hat_c']!;
    f.location = 'd_ege_acik';
    const from = f.location;
    // Tek sıçramada en pahalı komşuyu hedefle.
    const costly = prov(from).neighbours
      .filter((n) => prov(n).isSea)
      .sort((a, b) => provinceDist(from, b) - provinceDist(from, a))[0]!;
    f.order = { kind: 'seyret', target: costly, path: [costly] };
    endTurn(s);
    assert.notEqual(s.fleets['uk_hat_c']!.location, from, 'filo hiç ilerlemedi');
  });

  it('gelecekte dökülecek mayın hattı bugün suda değil', () => {
    const s = newGame('ottoman');
    const nusret = s.minefields['hat_11_nusret']!;
    assert.ok(nusret.laidOn > 0, 'Nusret hattı senaryo başında aktif');
    assert.ok(
      !minefieldsIn(s, nusret.province).some((m) => m.id === 'hat_11_nusret'),
      '8 Mart hattı 19 Şubat günü etkin',
    );
  });

  it('Nusret hattı İtilaf tarafından görülmemiş, Kepez hatları görülmüş', () => {
    const s = newGame('ottoman');
    assert.equal(s.minefields['hat_11_nusret']!.spotted, false);
    assert.equal(s.minefields['hat_1']!.spotted, true);
  });
});

describe('ikmal', () => {
  it('tartışmalı sahildeki köprübaşı denizden beslenir', () => {
    // Hata: çıkarma yapan birlik il hâlâ düşman kontrolünde olduğu için
    // %0 ikmalle kalıp eriyordu.
    const s = newGame('ottoman');
    const u = s.landUnits['uk_tumen_29']!;
    u.embarkedIn = null;
    u.location = 'kumkale';
    assert.equal(s.provinces['kumkale']!.controller, 'ottoman');
    const { capacity } = computeSupply(s);
    assert.ok(
      capacity['kumkale']!.entente > 0,
      'köprübaşına denizden ikmal akmıyor',
    );
  });
});

describe('kampanya', () => {
  it('başlangıç durumu tutarlı', () => {
    const s = newGame('ottoman');
    assert.equal(s.day, 0);
    assert.equal(s.date, '1915-02-19');
    assert.equal(Object.keys(s.forts).length, FORTS.length);
    for (const f of Object.values(s.fleets)) {
      assert.ok(prov(f.location).isSea, `${f.id} karada`);
    }
  });

  it('varışı sonraki tarihte olan hava filosu sahada değil', () => {
    const s = newGame('ottoman');
    const late = s.airWings['uk_bombardiman']!;
    assert.equal(late.planes, 0, 'Temmuz filosu Şubat günü sahada');
    const early = s.airWings['os_hava_bolugu']!;
    assert.ok(early.planes > 0);
  });

  it('aynı tohum aynı sonucu verir (deterministik)', () => {
    const play = (): string => {
      const s = newGame('ottoman', 4242);
      for (let i = 0; i < 40; i++) endTurn(s);
      return JSON.stringify({
        gun: s.day,
        osm: s.sides.ottoman.morale,
        ent: s.sides.entente.morale,
        gemi: Object.values(s.fleets).reduce((n, f) => n + liveShips(f).length, 0),
        mayin: Object.values(s.minefields).reduce((n, m) => n + m.mines, 0),
      });
    };
    assert.equal(play(), play());
  });

  it('kampanya sonuna kadar çöküp kilitlenmeden oynanır', () => {
    const s = newGame('ottoman');
    let guard = 0;
    while (!s.outcome && guard++ < 400) endTurn(s);
    assert.ok(s.outcome, 'kampanya bitmedi');
    assert.ok(s.day <= dayOf('1916-01-09') + 1, `gün ${s.day}`);
  });

  it('tarihsel çıkarma gününden önce İtilaf karaya çıkmaz', () => {
    const s = newGame('ottoman');
    const landing = dayOf('1915-04-25');
    while (s.day < landing) {
      endTurn(s);
      for (const u of Object.values(s.landUnits)) {
        if (u.side !== 'entente' || u.embarkedIn || u.strength <= 0) continue;
        assert.ok(
          prov(u.location).isSea === false &&
            (u.location === 'bozcaada' || u.location === 'gokceada'),
          `${u.name} ${s.date} günü ${u.location} ilinde — çıkarmadan önce`,
        );
      }
    }
  });
});

describe('ses ve muharebe raporları', () => {
  it('ses motoru metotları ortamsız çalışırken çökmez', async () => {
    const { sound } = await import('../src/engine/audio.ts');
    assert.doesNotThrow(() => {
      sound.init();
      sound.playHeavyCannon();
      sound.playLightGun();
      sound.playMineExplosion();
      sound.playOrderClick();
      sound.playShipAlarm();
      sound.playInfantrySkirmish();
      sound.playTurnChime();
      sound.playVictory();
      sound.playDefeat();
      sound.toggleMute();
      sound.toggleMute();
    });
  });

  it('tur çözümü muharebe raporları üretir ve sözleşmeye uyar', () => {
    const s = newGame('ottoman', 1915);
    let totalReports = 0;
    for (let i = 0; i < 35; i++) {
      const res = endTurn(s);
      totalReports += res.reports.length;
      for (const r of res.reports) {
        assert.ok(['kara', 'deniz', 'tabya', 'mayin', 'hava'].includes(r.kind));
        assert.ok(r.province.length > 0);
        assert.ok(r.title.length > 0);
      }
    }
    assert.ok(totalReports > 0, 'muharebe raporu üretilmedi');
  });
});

