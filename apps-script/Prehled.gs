/**
 * Řízení (vedoucí, manažer, admin): přehled podniku jednou akcí, záznamy pro tabulku a export, log kontrol za období.
 * Přehled se počítá z celých listů – výsledek drží krátce cache (5 min), tlačítko Obnovit ji obejde.
 */

const PREHLED_CACHE_S = 300;
const PREHLED_TYDNU = 8;
const MAX_FEFO_POLOZEK = 40;
const MAX_DNI_LOGU = 366;

function klicCachePrehledu_(podnik) {
  return 'prehled_' + podnik;
}

function vymazCachePrehledu_() {
  try {
    CacheService.getScriptCache().removeAll(Object.keys(PODNIKY).map(klicCachePrehledu_));
  } catch (e) { /* cache je jen zrychlení */ }
}

/** Pondělí 0:00 týdne, do kterého patří `d` (týden po–ne). */
function zacatekTydne_(d) {
  const z = zacatekDne_(d);
  return new Date(z.getFullYear(), z.getMonth(), z.getDate() - ((z.getDay() + 6) % 7));
}

/** Pásmo záznamu ke dni `den`: x expirováno, r červená, y žlutá, g OK, k bez expirace. */
function pasmoZaznamu_(z, den, n) {
  const exp = z.expirace instanceof Date ? z.expirace : (parsujExpiraci_(textExpirace_(z)) || {}).datum;
  if (!exp) return { pasmo: 'k', zbyva: null };
  const zbyva = Math.round((zacatekDne_(exp) - zacatekDne_(den)) / DEN_MS);
  const pasmo = zbyva < 0 ? 'x' : zbyva <= (Number(n.hranice_cervena) || 0) ? 'r' : zbyva <= (Number(n.hranice_zluta) || 0) ? 'y' : 'g';
  return { pasmo: pasmo, zbyva: zbyva, expirace: exp };
}

/** {podnik, obnovit} → KPI, mapa pokrytí, kontroly po lidech a týdnech, pásma + trend, FEFO, úkoly. */
function akcePrehledData_(data) {
  const podnik = overPodnik_(data.podnik);
  const cache = CacheService.getScriptCache();
  if (!data.obnovit) {
    const ulozeny = cache.get(klicCachePrehledu_(podnik));
    if (ulozeny) {
      try {
        const p = JSON.parse(ulozeny.indexOf('gz:') === 0 ? rozbal_(ulozeny.slice(3)) : ulozeny);
        p.z_cache = true;
        return p;
      } catch (e) { /* poškozená cache – spočítat znovu */ }
    }
  }
  const p = spocitejPrehled_(podnik, new Date());
  ulozDoCache_(cache, klicCachePrehledu_(podnik), JSON.stringify(p));
  return p;
}

/**
 * Cache pojme max. 100 kB na klíč. Přehled velkého skladu (mapa s desítkami tisíc lokací) má víc –
 * zkomprimuje se (gzip + base64, kódy lokací se opakují, takže se zmenší zhruba desetkrát).
 */
function ulozDoCache_(cache, klic, json) {
  try {
    if (json.length < 95000) {
      cache.put(klic, json, PREHLED_CACHE_S);
      return;
    }
    const zabaleno = 'gz:' + Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(json, 'application/json')).getBytes());
    if (zabaleno.length < 95000) cache.put(klic, zabaleno, PREHLED_CACHE_S);
  } catch (e) { /* cache je jen zrychlení */ }
}

function rozbal_(base64) {
  return Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(base64), 'application/x-gzip')).getDataAsString();
}

function spocitejPrehled_(podnik, ted) {
  const n = nactiNastaveni_(podnik);
  const dnes = zacatekDne_(ted);
  const mapa = mapaHlidanychLokaci_(podnik);
  const posledni = posledniKontroly_(podnik);
  const kody = seradPodleTrasy_(Object.keys(mapa), mapa);
  const zaznamy = nactiList_('Zaznamy').radky.filter(function (z) { return text_(z.podnik) === podnik; });
  const polozky = nactiList_('Polozky').radky.filter(function (r) { return text_(r.podnik) === podnik; });
  const nazev = nazvyPolozek_(podnik, polozky);
  const importy = posledniImportStavu_(podnik);

  // Pokrytí: % aktivních lokací H/P s dokončenou kontrolou za 30 a 90 dní; mapa = řádky hala+řada, buňky lokace.
  const dniOd = function (k) { return posledni[k] ? Math.floor((ted.getTime() - posledni[k]) / DEN_MS) : null; };
  const pokryto = function (dni) {
    return kody.filter(function (k) { const d = dniOd(k); return d !== null && d <= dni; }).length;
  };
  const skupiny = {};
  const poradi = [];
  kody.forEach(function (k) {
    const c = castiTrasy_(k, mapa);
    const klic = (c[0] || '') + '-' + (c[1] || '');
    if (!skupiny[klic]) {
      skupiny[klic] = { hala: c[0] || '', rada: c[1] || '', bunky: [] };
      poradi.push(klic);
    }
    skupiny[klic].bunky.push([text_(mapa[k].kod), dniOd(k)]);
  });

  // Kontroly po lidech a týdnech (započtené = 1 lokace / den / člověk).
  const tydenNyni = zacatekTydne_(ted);
  const tydny = [];
  for (let i = PREHLED_TYDNU - 1; i >= 0; i--) tydny.push(new Date(tydenNyni.getFullYear(), tydenNyni.getMonth(), tydenNyni.getDate() - 7 * i));
  const lide = {};
  const soucty = tydny.map(function () { return 0; });
  kontrolyOd_(tydny[0]).forEach(function (k) {
    if (text_(k.podnik) !== podnik || !jeAno_(k.zapocteno) || !(k.cas instanceof Date)) return;
    const i = Math.floor((zacatekTydne_(k.cas) - tydny[0]) / (7 * DEN_MS) + 0.01);
    if (i < 0 || i >= tydny.length) return;
    const kdo = text_(k.uzivatel);
    (lide[kdo] = lide[kdo] || tydny.map(function () { return 0; }))[i]++;
    soucty[i]++;
  });

  // Zboží podle pásem (záznamy Na lokaci) + trend červených a expirovaných ke konci každého týdne (odhad
  // ze současných záznamů: záznam byl na lokaci, když byl založený dřív a odešel až potom).
  const pasma = { x: 0, r: 0, y: 0, g: 0, k: 0 };
  const naLokaci = zaznamy.filter(jeNaLokaci_);
  naLokaci.forEach(function (z) { pasma[pasmoZaznamu_(z, dnes, n).pasmo]++; });
  const trend = tydny.map(function (t, i) {
    const konec = i === tydny.length - 1 ? ted : new Date(t.getTime() + 7 * DEN_MS - 1);
    const vysledek = { r: 0, x: 0 };
    zaznamy.forEach(function (z) {
      if (z.zalozeno instanceof Date && z.zalozeno > konec) return;
      if (!jeNaLokaci_(z) && !(z.zmeneno instanceof Date && z.zmeneno > konec)) return;
      const p = pasmoZaznamu_(z, konec, n).pasmo;
      if (p === 'r' || p === 'x') vysledek[p]++;
    });
    return vysledek;
  });

  // Zboží bez kontroly podle importu + naskladněno po poslední kontrole.
  const hlidana = {};
  polozky.forEach(function (r) { if (jeAno_(r.aktivni, true)) hlidana[klicCisla_(r.cislo_polozky)] = true; });
  const sZaznamem = {};
  naLokaci.forEach(function (z) { sZaznamem[normalizujKod_(z.lokace) + '|' + klicCisla_(z.cislo_polozky)] = true; });
  const naskladnenoPodle = {};
  let bezKontroly = 0;
  const lokaceBezKontroly = {};
  importy.forEach(function (r) {
    const lok = normalizujKod_(r.lokace);
    const klic = lok + '|' + klicCisla_(r.cislo_polozky);
    if (r.naskladneno instanceof Date) naskladnenoPodle[klic] = r.naskladneno;
    if (!mapa[lok] || !hlidana[klicCisla_(r.cislo_polozky)] || sZaznamem[klic]) return;
    bezKontroly++;
    lokaceBezKontroly[lok] = true;
  });
  const naskladnenoDni = Number(n.planovac_naskladneno_dni) || 14;
  const poKontrole = kandidatiNaskladneno_(podnik, mapa, posledni, ted, naskladnenoDni).length;

  // FEFO: stejná položka na víc lokacích nebo s víc expiracemi → pořadí vychystávání (nejdřív expirace,
  // při stejné expiraci dřív naskladněné).
  const skupinyFefo = {};
  naLokaci.forEach(function (z) {
    const k = klicCisla_(z.cislo_polozky);
    if (k) (skupinyFefo[k] = skupinyFefo[k] || []).push(z);
  });
  const fefo = Object.keys(skupinyFefo).map(function (k) {
    const sk = skupinyFefo[k];
    const lokaci = Object.keys(sk.reduce(function (m, z) { m[normalizujKod_(z.lokace)] = true; return m; }, {})).length;
    const expiraci = Object.keys(sk.reduce(function (m, z) { m[textExpirace_(z)] = true; return m; }, {})).length;
    if (sk.length < 2 || (lokaci < 2 && expiraci < 2)) return null;
    const radky = sk.map(function (z) {
      const p = pasmoZaznamu_(z, dnes, n);
      const nask = naskladnenoPodle[normalizujKod_(z.lokace) + '|' + k];
      return { lokace: text_(z.lokace), expirace: textExpirace_(z), zbyva: p.zbyva, pasmo: p.pasmo,
        ks: z.pocet_ks === '' ? null : z.pocet_ks, naskladneno: nask ? nask.toISOString() : null,
        _exp: p.expirace ? p.expirace.getTime() : Infinity, _nask: nask ? nask.getTime() : Infinity };
    }).sort(function (a, b) {
      return (a._exp - b._exp) || (a._nask - b._nask) || porovnejTrasu_(a.lokace, b.lokace, mapa);
    });
    radky.forEach(function (r) { delete r._exp; delete r._nask; });
    return { cislo: text_(sk[0].cislo_polozky), nazev: nazev(sk[0]), lokaci: lokaci, expiraci: expiraci, radky: radky };
  }).filter(Boolean).sort(function (a, b) {
    return (a.radky[0].zbyva === null ? Infinity : a.radky[0].zbyva) - (b.radky[0].zbyva === null ? Infinity : b.radky[0].zbyva);
  });

  // Úkoly: otevřené a kolik lokací je z nich hotových.
  const ukoly = nactiList_('Ukoly').radky.filter(function (r) { return text_(r.podnik) === podnik && jeOtevreny_(r); });
  const lokaciUkolu = ukoly.reduce(function (s, r) { return s + seznamKodu_(r.lokace).length; }, 0);
  const hotovoUkolu = ukoly.reduce(function (s, r) {
    const lok = seznamKodu_(r.lokace);
    return s + seznamKodu_(r.hotove_lokace).filter(function (k) { return lok.indexOf(k) >= 0; }).length;
  }, 0);

  const cil = Number(n.cil_kontrol_tyden) || null;
  return {
    podnik: podnik,
    spocteno: ted.toISOString(),
    nastaveni: { hranice_cervena: n.hranice_cervena, hranice_zluta: n.hranice_zluta, cil_kontrol_tyden: cil },
    kpi: {
      lokaci: kody.length,
      pokryti_30: pokryto(30),
      pokryti_90: pokryto(90),
      kontrol_tyden: soucty[soucty.length - 1],
      cil_tyden: cil,
      cervenych: pasma.r,
      expirovanych: pasma.x,
      bez_kontroly: bezKontroly,
      bez_kontroly_lokaci: Object.keys(lokaceBezKontroly).length,
      naskladneno_po_kontrole: poKontrole,
      k_doplneni: polozky.filter(function (r) { return jeAno_(r.aktivni, true) && jeAno_(r.k_doplneni); }).length,
      ukolu_otevrenych: ukoly.length,
      ukoly_lokaci: lokaciUkolu,
      ukoly_hotovo: hotovoUkolu
    },
    mapa: poradi.map(function (k) { return skupiny[k]; }),
    tydny: tydny.map(function (t) { return datumTextem_(t); }),
    lide: Object.keys(lide).sort(function (a, b) { return a.localeCompare(b, 'cs'); }).map(function (j) { return { jmeno: j, pocty: lide[j] }; }),
    soucty: soucty,
    pasma: pasma,
    trend: trend,
    fefo: fefo.slice(0, MAX_FEFO_POLOZEK),
    fefo_celkem: fefo.length,
    import_stavu: posledniImportInfo_(podnik)
  };
}

/** {podnik} → všechny záznamy podniku pro tabulku Záznamy (hledání, filtry a export dělá prohlížeč). */
function akceZaznamySeznam_(data) {
  const podnik = overPodnik_(data.podnik);
  const n = nactiNastaveni_(podnik);
  const nazev = nazvyPolozek_(podnik, nactiList_('Polozky').radky);
  const naskladneno = {};
  posledniImportStavu_(podnik).forEach(function (r) {
    if (r.naskladneno instanceof Date) naskladneno[normalizujKod_(r.lokace) + '|' + klicCisla_(r.cislo_polozky)] = r.naskladneno.toISOString();
  });
  const iso = function (d) { return d instanceof Date ? d.toISOString() : null; };
  return {
    podnik: podnik,
    nastaveni: { hranice_cervena: n.hranice_cervena, hranice_zluta: n.hranice_zluta },
    zaznamy: nactiList_('Zaznamy').radky.filter(function (z) { return text_(z.podnik) === podnik; }).map(function (z) {
      return {
        id: text_(z.id), lokace: text_(z.lokace), ean: text_(z.ean), cislo_polozky: text_(z.cislo_polozky), nazev: nazev(z),
        expirace: textExpirace_(z), pocet_ks: z.pocet_ks === '' || z.pocet_ks === null ? null : Number(z.pocet_ks),
        stav: text_(z.stav) || STAV.NA_LOKACI, zalozil: text_(z.zalozil), zalozeno: iso(z.zalozeno), overil: text_(z.overil),
        overeno: iso(z.overeno), zmenil: text_(z.zmenil), zmeneno: iso(z.zmeneno), poznamka: text_(z.poznamka),
        foto_url: text_(z.foto_url), k_doplneni: jeAno_(z.k_doplneni),
        naskladneno: naskladneno[normalizujKod_(z.lokace) + '|' + klicCisla_(z.cislo_polozky)] || null
      };
    }),
    nacteno: new Date().toISOString()
  };
}

/** {podnik, od, do (RRRR-MM-DD, včetně)} → řádky logu Kontroly za období (pro export do Excelu). */
function akceKontrolyLog_(data) {
  const podnik = overPodnik_(data.podnik);
  const den = function (t) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text_(t));
    if (!m) throw chyba_('Datum ve tvaru RRRR-MM-DD.');
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  const od = den(data.od);
  const doDne = new Date(den(data.do).getTime() + DEN_MS);
  if (doDne <= od) throw chyba_('Datum „do“ musí být stejné nebo pozdější než „od“.');
  if ((doDne - od) / DEN_MS > MAX_DNI_LOGU) throw chyba_('Období může mít nejvýš ' + MAX_DNI_LOGU + ' dní.');

  const zaznamy = {};
  nactiList_('Zaznamy').radky.forEach(function (z) { if (text_(z.podnik) === podnik) zaznamy[text_(z.id)] = z; });
  const nazev = nazvyPolozek_(podnik, nactiList_('Polozky').radky);
  const radky = kontrolyOd_(od).filter(function (k) {
    return text_(k.podnik) === podnik && k.cas instanceof Date && k.cas < doDne;
  }).sort(function (a, b) { return a.cas - b.cas; }).map(function (k) {
    const z = zaznamy[text_(k.id_zaznamu)];
    return {
      cas: k.cas.toISOString(), uzivatel: text_(k.uzivatel), lokace: text_(k.lokace), akce: text_(k.akce),
      ean: z ? text_(z.ean) : '', cislo_polozky: z ? text_(z.cislo_polozky) : '', nazev: z ? nazev(z) : '',
      expirace: z ? textExpirace_(z) : '', pocet_ks: k.pocet_ks === '' ? null : k.pocet_ks, poznamka: text_(k.poznamka),
      zapocteno: jeAno_(k.zapocteno), id_ukolu: text_(k.id_ukolu)
    };
  });
  return { podnik: podnik, od: text_(data.od), do: text_(data.do), radky: radky };
}
