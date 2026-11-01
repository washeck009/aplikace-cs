/**
 * Oprávnění nastavitelná v aplikaci: list Opravneni (řádek = klíč oprávnění, sloupce rolí TRUE/FALSE).
 * Registr klíčů je v MODULY_OPRAVNENI (Konfigurace.gs) – co v listu chybí, má výchozí hodnotu z registru.
 * Admin má vždy vše. Server kontroluje oprávnění u každé akce (Api.gs), klient podle seznamu jen skrývá ovládání.
 */

const KLIC_CACHE_OPRAVNENI = 'opravneni';

/** Všechna oprávnění z registru: [{klic, nazev, popis, modul, vychozi: {role: bool}}]. */
function seznamOpravneni_() {
  const vysledek = [];
  MODULY_OPRAVNENI.forEach(function (m) {
    m.opravneni.forEach(function (o) {
      const vychozi = {};
      ROLE_OPRAVNENI.forEach(function (r) { vychozi[r] = r === 'admin' || o[3].indexOf(r) >= 0; });
      vysledek.push({ klic: o[0], nazev: o[1], popis: o[2], modul: m.modul, vychozi: vychozi });
    });
  });
  return vysledek;
}

/**
 * Matice {role: {klic: true/false}} z listu (krátce v cache); chybějící list, řádek nebo buňka = výchozí hodnota.
 * Admin má vždy vše bez ohledu na list.
 */
function nactiOpravneni_() {
  const cache = CacheService.getScriptCache();
  const ulozena = cache.get(KLIC_CACHE_OPRAVNENI);
  if (ulozena) return JSON.parse(ulozena);

  const zListu = {};
  if (SpreadsheetApp.getActive().getSheetByName('Opravneni')) {
    nactiList_('Opravneni').radky.forEach(function (r) { if (text_(r.klic)) zListu[text_(r.klic)] = r; });
  }
  const matice = {};
  ROLE_OPRAVNENI.forEach(function (role) { matice[role] = {}; });
  seznamOpravneni_().forEach(function (o) {
    const r = zListu[o.klic];
    ROLE_OPRAVNENI.forEach(function (role) {
      const bunka = r ? r[role] : '';
      matice[role][o.klic] = role === 'admin' || (bunka === '' || bunka === null || bunka === undefined ? o.vychozi[role] : jeAno_(bunka));
    });
  });
  try {
    cache.put(KLIC_CACHE_OPRAVNENI, JSON.stringify(matice), CACHE_OPRAVNENI_S);
  } catch (e) { /* cache je jen zrychlení */ }
  return matice;
}

/** Seznam klíčů oprávnění, které má role (neznámá role žádné). */
function opravneniRole_(role) {
  const radek = nactiOpravneni_()[role];
  if (!radek) return [];
  return Object.keys(radek).filter(function (k) { return radek[k]; });
}

/** Má přihlášený uživatel aspoň jedno z oprávnění (klíč nebo pole klíčů)? Admin vždy. */
function maOpravneni_(uzivatel, klice) {
  if (!uzivatel) return false;
  if (uzivatel.role === 'admin') return true;
  const ma = uzivatel.opravneni || opravneniRole_(uzivatel.role);
  return [].concat(klice).some(function (k) { return ma.indexOf(k) >= 0; });
}

/** Setup: doplní do listu Opravneni chybějící klíče s výchozími hodnotami (existující hodnoty nemění), admin = TRUE. */
function doplnOpravneni_() {
  const tabulka = nactiList_('Opravneni');
  const existujici = {};
  tabulka.radky.forEach(function (r) { existujici[text_(r.klic)] = r; });
  const nove = [];
  const zmenene = [];
  seznamOpravneni_().forEach(function (o) {
    const r = existujici[o.klic];
    if (!r) {
      const radek = { klic: o.klic, modul: o.modul, nazev: o.nazev };
      ROLE_OPRAVNENI.forEach(function (role) { radek[role] = o.vychozi[role]; });
      nove.push(radek);
    } else if (r.admin !== true || text_(r.nazev) !== o.nazev || text_(r.modul) !== o.modul) {
      r.admin = true;
      r.nazev = o.nazev;
      r.modul = o.modul;
      zmenene.push(r);
    }
  });
  zapisRadky_(tabulka, zmenene);
  pridejRadky_('Opravneni', nove);
  vymazCacheOpravneni_();
}

function vymazCacheOpravneni_() {
  try {
    CacheService.getScriptCache().remove(KLIC_CACHE_OPRAVNENI);
  } catch (e) { /* nic */ }
}

/** Zápis do listu Log_spravy (kdo, kdy, co). Volat pod zámkem. */
function zapisLogSpravy_(uzivatel, akce, detail) {
  if (!SpreadsheetApp.getActive().getSheetByName('Log_spravy')) zalozListy_();
  pridejRadky_('Log_spravy', [{ cas: new Date(), uzivatel: uzivatel.jmeno, akce: akce, detail: String(detail).slice(0, 45000) }]);
}

/* ---------- Akce API (jen admin) ---------- */

/** Matice oprávnění po modulech + posledních 10 změn z logu. */
function akceOpravneniNacti_() {
  const matice = nactiOpravneni_();
  const moduly = [];
  seznamOpravneni_().forEach(function (o) {
    let m = moduly.filter(function (x) { return x.modul === o.modul; })[0];
    if (!m) moduly.push(m = { modul: o.modul, opravneni: [] });
    const hodnoty = {};
    ROLE_OPRAVNENI.forEach(function (role) { hodnoty[role] = matice[role][o.klic]; });
    m.opravneni.push({ klic: o.klic, nazev: o.nazev, popis: o.popis, hodnoty: hodnoty });
  });
  let zmeny = [];
  if (SpreadsheetApp.getActive().getSheetByName('Log_spravy')) {
    zmeny = nactiList_('Log_spravy').radky.filter(function (r) { return text_(r.akce) === 'oprávnění'; }).slice(-10).reverse()
      .map(function (r) {
        return { cas: r.cas instanceof Date ? r.cas.toISOString() : null, uzivatel: text_(r.uzivatel), detail: text_(r.detail) };
      });
  }
  return { role: ROLE_OPRAVNENI, moduly: moduly, zmeny: zmeny };
}

/**
 * {hodnoty: {klic: {skladnik, vedouci, manazer}}} – uloží změněné buňky (admin se nemění, vždy TRUE)
 * a zapíše do Log_spravy kdo, kdy a co změnil.
 */
function akceOpravneniUloz_(data, uzivatel) {
  const hodnoty = data.hodnoty || {};
  const znamy = {};
  seznamOpravneni_().forEach(function (o) { znamy[o.klic] = o; });
  Object.keys(hodnoty).forEach(function (k) { if (!znamy[k]) throw chyba_('Neznámé oprávnění: ' + k); });

  return sZamkem_(function () {
    zajistiListOpravneni_();
    vymazCacheOpravneni_();
    const puvodni = nactiOpravneni_();
    const tabulka = nactiList_('Opravneni');
    const radky = {};
    tabulka.radky.forEach(function (r) { radky[text_(r.klic)] = r; });
    const zmeny = [];
    const zmenene = [];
    Object.keys(hodnoty).forEach(function (klic) {
      const r = radky[klic];
      let zmena = false;
      ROLE_OPRAVNENI.forEach(function (role) {
        if (role === 'admin' || hodnoty[klic][role] === undefined) return;
        const nova = hodnoty[klic][role] === true;
        if (nova === puvodni[role][klic]) return;
        r[role] = nova;
        zmena = true;
        zmeny.push(znamy[klic].nazev + ' – ' + NAZVY_ROLI[role] + ': ' + (nova ? 'ano' : 'ne'));
      });
      if (zmena) zmenene.push(r);
    });
    if (zmeny.length) {
      zapisRadky_(tabulka, zmenene);
      zapisLogSpravy_(uzivatel, 'oprávnění', zmeny.join('; '));
    }
    vymazCacheOpravneni_();
    const vysledek = akceOpravneniNacti_();
    vysledek.zmeneno = zmeny.length;
    return vysledek;
  });
}

/** List Opravneni musí existovat a mít řádky všech klíčů (aplikace běží i bez nového spuštění setupu). */
function zajistiListOpravneni_() {
  if (!SpreadsheetApp.getActive().getSheetByName('Opravneni') || !SpreadsheetApp.getActive().getSheetByName('Log_spravy')) zalozListy_();
  doplnOpravneni_();
}
