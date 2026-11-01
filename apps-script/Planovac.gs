/**
 * Plánovač (kap. 7 specifikace): každé ráno pro každý podnik vytvoří / doplní úkoly typu „plánovač“ pro „kdokoliv“:
 *   a) aktivní lokace bez kontroly déle než planovac_dni_bez_kontroly (nebo nikdy),
 *   b) lokace se záznamem v červeném pásmu (i expirovaným) neověřeným déle než planovac_cervene_overit_dni,
 *   c) lokace, kde podle posledního importu leží zboží z číselníku, ale nejsou na ní žádné záznamy,
 *   d) lokace s hlídaným zbožím naskladněným (DATUM z ERP) po poslední dokončené kontrole lokace – jen naskladnění
 *      za posledních planovac_naskladneno_dni; vypíná se planovac_naskladneno_zapnuto.
 * Na každé pravidlo nejvýš jeden otevřený úkol s max. planovac_max_lokaci_ukol nejnaléhavějšími lokacemi
 * (seřazenými podle trasy); otevřený úkol se jen doplní. Lokace, která už je v otevřeném úkolu, se nepřidá.
 * Plánují se jen aktivní lokace H/P (LOKACE_KONTROLOVANA).
 */

const PLANOVAC_HODINA = 5;
const PLANOVAC_MINUTA = 30;

/** Spouští časový spouštěč i menu. Vrátí souhrn po podnicích. */
function planovac() {
  const souhrn = sZamkem_(function () {
    const ted = new Date();
    return Object.keys(PODNIKY).map(function (podnik) { return naplanujPodnik_(podnik, ted); });
  });
  console.log(JSON.stringify(souhrn));
  return souhrn;
}

function naplanujPodnik_(podnik, ted) {
  zajistiSloupce_('Ukoly');
  const n = nactiNastaveni_(podnik);
  const dniBez = Number(n.planovac_dni_bez_kontroly) || 60;
  const cervenaOveritDni = Number(n.planovac_cervene_overit_dni) || 30;
  const max = Number(n.planovac_max_lokaci_ukol) || 20;
  const hraniceCervena = Number(n.hranice_cervena) || 0;
  const naskladnenoZapnuto = n.planovac_naskladneno_zapnuto === null || n.planovac_naskladneno_zapnuto === undefined
    || jeAno_(n.planovac_naskladneno_zapnuto);
  const naskladnenoDni = Number(n.planovac_naskladneno_dni) || 14;
  const dnes = zacatekDne_(ted);
  const mapa = mapaHlidanychLokaci_(podnik);
  const posledni = posledniKontroly_(podnik);

  // Lokace, které už jsou v otevřeném úkolu podniku – do dalšího se nepřidají.
  const ukoly = nactiList_('Ukoly');
  const otevrene = ukoly.radky.filter(function (r) { return text_(r.podnik) === podnik && jeOtevreny_(r); });
  const vUkolech = {};
  otevrene.forEach(function (r) { seznamKodu_(r.lokace).forEach(function (k) { vUkolech[k] = true; }); });

  const kandidati = {
    b: kandidatiCervene_(podnik, mapa, dnes, hraniceCervena, cervenaOveritDni),
    a: kandidatiBezKontroly_(mapa, posledni, ted, dniBez),
    c: kandidatiZImportu_(podnik, mapa),
    d: naskladnenoZapnuto ? kandidatiNaskladneno_(podnik, mapa, posledni, ted, naskladnenoDni) : []
  };
  const popisy = {
    a: PRAVIDLA_PLANOVACE.a + ' ' + dniBez + ' dní',
    b: PRAVIDLA_PLANOVACE.b + ' (neověřeno ' + cervenaOveritDni + '+ dní)',
    c: PRAVIDLA_PLANOVACE.c + ' (podle importu stavu lokací)',
    d: PRAVIDLA_PLANOVACE.d + ' (nové šarže – zkontroluj expiraci)'
  };
  const nedele = new Date(dnes.getTime() + ((7 - dnes.getDay()) % 7) * DEN_MS);

  const souhrn = { podnik: podnik };
  const zmenene = [];
  const nove = [];
  // Nejnaléhavější pravidlo první – jeho lokace mají přednost.
  PORADI_PRAVIDEL.forEach(function (klic) {
    const volne = kandidati[klic].filter(function (k) { return !vUkolech[k]; });
    const existujici = otevrene.filter(function (r) {
      return text_(r.typ) === TYP_UKOLU.PLANOVAC && text_(r.popis).indexOf(PRAVIDLA_PLANOVACE[klic]) === 0;
    })[0];
    const kanonicky = function (k) { return text_(mapa[k].kod); };

    if (existujici) {
      const lokace = seznamKodu_(existujici.lokace);
      const pridat = volne.slice(0, Math.max(0, max - lokace.length));
      if (pridat.length) {
        existujici.lokace = seradPodleTrasy_(lokace.concat(pridat), mapa)
          .map(function (k) { return mapa[k] ? kanonicky(k) : k; }).join(', ');
        zmenene.push(existujici);
      }
      pridat.forEach(function (k) { vUkolech[k] = true; });
      souhrn[klic] = pridat.length ? 'doplněno ' + pridat.length : 'beze změny (otevřený úkol)';
    } else if (volne.length) {
      const vyber = volne.slice(0, max);
      vyber.forEach(function (k) { vUkolech[k] = true; });
      nove.push({
        id: noveId_(), podnik: podnik, typ: TYP_UKOLU.PLANOVAC, komu: KDOKOLIV,
        lokace: seradPodleTrasy_(vyber, mapa).map(kanonicky).join(', '), polozka: '',
        termin: klic === 'b' ? dnes : nedele, popis: popisy[klic], stav: STAV_UKOLU.OTEVRENY,
        zadal: 'Plánovač', zadano: ted, splneno: '', splnil: '', hotove_lokace: ''
      });
      souhrn[klic] = 'nový úkol (' + vyber.length + ' z ' + volne.length + ' lokací)';
    } else {
      souhrn[klic] = 'nic';
    }
  });
  zapisRadky_(ukoly, zmenene);
  pridejRadky_('Ukoly', nove);
  return souhrn;
}

/** a) Aktivní lokace bez kontroly déle než `dni` – nikdy nekontrolované první, pak nejdéle nekontrolované. */
function kandidatiBezKontroly_(mapa, posledni, ted, dni) {
  const hranice = ted.getTime() - dni * DEN_MS;
  return Object.keys(mapa)
    .filter(function (k) { return !posledni[k] || posledni[k] < hranice; })
    .sort(function (a, b) { return (posledni[a] || 0) - (posledni[b] || 0) || porovnejTrasu_(a, b, mapa); });
}

/**
 * Čas poslední dokončené kontroly každé lokace podniku (celý log, čte se jen pět sloupců).
 * Nepočítá se uzavření importem ani Vydáno / Zlikvidováno z obrazovky Blíží se expirace.
 */
function posledniKontroly_(podnik) {
  const list = list_('Kontroly');
  const h = hlavickaListu_(list);
  const radku = list.getLastRow() - 1;
  if (radku < 1) return {};
  const sloupec = function (nazev) { return list.getRange(2, h.indexOf(nazev) + 1, radku, 1).getValues(); };
  const casy = sloupec('cas');
  const podniky = sloupec('podnik');
  const lokace = sloupec('lokace');
  const akce = sloupec('akce');
  const poznamky = sloupec('poznamka');
  const posledni = {};
  for (let i = 0; i < radku; i++) {
    const c = casy[i][0];
    if (text_(podniky[i][0]) !== podnik || !(c instanceof Date)) continue;
    const a = text_(akce[i][0]);
    if (a === AKCE_IMPORT_UZAVREL || (text_(poznamky[i][0]) === POZNAMKA_BLIZI_SE && (a === 'vydáno' || a === 'zlikvidováno'))) continue;
    const k = normalizujKod_(lokace[i][0]);
    if (!posledni[k] || c.getTime() > posledni[k]) posledni[k] = c.getTime();
  }
  return posledni;
}

/** Řádky posledního importu stavu lokací podniku (list obsahuje jen jeden import na podnik, pro jistotu se filtruje). */
function posledniImportStavu_(podnik) {
  const importy = nactiList_('Import_stav_lokaci').radky.filter(function (r) { return text_(r.podnik) === podnik; });
  const posledni = importy.reduce(function (m, r) {
    return r.datum_importu instanceof Date && r.datum_importu > m ? r.datum_importu : m;
  }, new Date(0));
  return importy.filter(function (r) {
    return r.datum_importu instanceof Date && r.datum_importu.getTime() === posledni.getTime();
  });
}

/**
 * d) Lokace, kam se podle importu naskladnilo hlídané zboží (naskladneno) po poslední dokončené kontrole lokace –
 * jen naskladnění za posledních `dni`. Nikdy nekontrolované první, pak podle toho, jak dlouho před naskladněním
 * byla lokace naposledy kontrolovaná.
 */
function kandidatiNaskladneno_(podnik, mapa, posledni, ted, dni) {
  const hranice = ted.getTime() - dni * DEN_MS;
  const naskladneno = {};
  posledniImportStavu_(podnik).forEach(function (r) {
    if (!(r.naskladneno instanceof Date)) return;
    const k = normalizujKod_(r.lokace);
    const t = r.naskladneno.getTime();
    if (!mapa[k] || t < hranice || t > ted.getTime()) return;
    if (posledni[k] && posledni[k] >= t) return;
    if (!naskladneno[k] || t > naskladneno[k]) naskladneno[k] = t;
  });
  const odstup = function (k) { return posledni[k] ? naskladneno[k] - posledni[k] : Infinity; };
  return Object.keys(naskladneno).sort(function (a, b) {
    return (odstup(b) - odstup(a)) || porovnejTrasu_(a, b, mapa);
  });
}

/** b) Lokace se záznamem v červeném pásmu (i expirovaným) neověřeným déle než `dni` – nejdřív expirující první. */
function kandidatiCervene_(podnik, mapa, dnes, hraniceCervena, dni) {
  const hraniceOvereni = dnes.getTime() - dni * DEN_MS;
  const nejdriv = {};
  nactiList_('Zaznamy').radky.forEach(function (r) {
    if (text_(r.podnik) !== podnik || !jeNaLokaci_(r)) return;
    const k = normalizujKod_(r.lokace);
    if (!mapa[k]) return;
    const exp = r.expirace instanceof Date ? r.expirace : (parsujExpiraci_(textExpirace_(r)) || {}).datum;
    if (!exp) return;
    const zbyva = Math.round((zacatekDne_(exp) - dnes) / DEN_MS);
    if (zbyva > hraniceCervena) return;
    if (r.overeno instanceof Date && r.overeno.getTime() >= hraniceOvereni) return;
    if (!(k in nejdriv) || zbyva < nejdriv[k]) nejdriv[k] = zbyva;
  });
  return Object.keys(nejdriv).sort(function (a, b) { return nejdriv[a] - nejdriv[b] || porovnejTrasu_(a, b, mapa); });
}

/** c) Podle posledního importu stavu lokací: zboží z číselníku na lokaci, kde nejsou žádné záznamy „Na lokaci“. */
function kandidatiZImportu_(podnik, mapa) {
  const importy = posledniImportStavu_(podnik);
  if (!importy.length) return [];
  const cisla = {};
  nactiList_('Polozky').radky.forEach(function (r) {
    if (text_(r.podnik) === podnik && jeAno_(r.aktivni, true)) cisla[klicCisla_(r.cislo_polozky)] = true;
  });
  const sZaznamy = {};
  nactiList_('Zaznamy').radky.forEach(function (r) {
    if (text_(r.podnik) === podnik && jeNaLokaci_(r)) sZaznamy[normalizujKod_(r.lokace)] = true;
  });
  const vysledek = {};
  importy.forEach(function (r) {
    const k = normalizujKod_(r.lokace);
    if (mapa[k] && cisla[klicCisla_(r.cislo_polozky)] && !sZaznamy[k]) vysledek[k] = true;
  });
  return seradPodleTrasy_(Object.keys(vysledek), mapa);
}

/* ---------- Časový spouštěč ---------- */

/** Nainstaluje denní spouštěč plánovače (5:30, Google ho spustí v rozmezí ±15 min). Starý nahradí. */
function instalujPlanovac() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'planovac') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('planovac').timeBased().everyDays(1).atHour(PLANOVAC_HODINA).nearMinute(PLANOVAC_MINUTA).create();
}

/** true/false, nebo null, když to nejde zjistit (skript ještě nemá oprávnění ke spouštěčům). */
function planovacNainstalovan_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'planovac'; });
  } catch (e) {
    return null;
  }
}

function menuPlanovacTed() {
  const souhrn = planovac();
  const nazvy = { a: 'bez kontroly', b: 'červené pásmo', c: 'z importu', d: 'naskladněno po kontrole' };
  oznam_('Plánovač doběhl.\n' + souhrn.map(function (s) {
    return PODNIKY[s.podnik] + ': ' + PORADI_PRAVIDEL.map(function (k) { return nazvy[k] + ' – ' + s[k]; }).join('; ');
  }).join('\n'));
}

function menuInstalovatPlanovac() {
  instalujPlanovac();
  oznam_('Plánovač se bude spouštět každý den kolem ' + PLANOVAC_HODINA + ':' + PLANOVAC_MINUTA + '.');
}
