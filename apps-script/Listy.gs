/**
 * Práce s listy tabulky – vždy podle názvů sloupců v 1. řádku, nikdy podle pořadí.
 * Plus společné pomůcky: zámek, ID, chyby pro uživatele, log chyb.
 */

/** Vrátí list podle názvu, nebo vyhodí srozumitelnou chybu. */
function list_(nazev) {
  const list = SpreadsheetApp.getActive().getSheetByName(nazev);
  if (!list) throw new Error('Chybí list „' + nazev + '“ – spusť v tabulce Aplikace CS → Založit / doplnit listy.');
  return list;
}

/** Názvy sloupců z 1. řádku listu. */
function hlavickaListu_(list) {
  const sloupcu = list.getLastColumn();
  if (!sloupcu) return [];
  return list.getRange(1, 1, 1, sloupcu).getValues()[0].map(function (h) { return String(h).trim(); });
}

/**
 * Načte celý list jako pole objektů {nazev_sloupce: hodnota, _radek: číslo řádku v listu}.
 * Prázdné řádky přeskočí.
 */
function nactiList_(nazev) {
  const list = list_(nazev);
  const hodnoty = list.getDataRange().getValues();
  const hlavicka = (hodnoty.shift() || []).map(function (h) { return String(h).trim(); });
  const radky = [];
  hodnoty.forEach(function (r, i) {
    if (r.every(function (v) { return v === '' || v === null; })) return;
    const o = { _radek: i + 2 };
    hlavicka.forEach(function (h, j) { if (h) o[h] = r[j]; });
    radky.push(o);
  });
  return { list: list, hlavicka: hlavicka, radky: radky };
}

/** Přidá řádky (pole objektů) na konec listu. Chybějící sloupce zůstanou prázdné. */
function pridejRadky_(nazev, objekty) {
  if (!objekty.length) return;
  const list = list_(nazev);
  const hlavicka = hlavickaListu_(list);
  const radky = objekty.map(function (o) {
    return hlavicka.map(function (h) { return (h in o && o[h] !== null && o[h] !== undefined) ? o[h] : ''; });
  });
  const prvni = list.getLastRow() + 1;
  const chybi = prvni + radky.length - 1 - list.getMaxRows();
  if (chybi > 0) list.insertRowsAfter(list.getMaxRows(), chybi);
  // Textový formát nastavit dřív, než se zapíšou hodnoty – jinak by se z kódů staly čísla.
  (TEXTOVE_SLOUPCE[nazev] || []).forEach(function (s) {
    const c = hlavicka.indexOf(s);
    if (c >= 0) list.getRange(prvni, c + 1, radky.length, 1).setNumberFormat('@');
  });
  list.getRange(prvni, 1, radky.length, hlavicka.length).setValues(radky);
}

/** Změní vybrané buňky v jednom řádku: zmeny = {nazev_sloupce: nová hodnota}. */
function upravRadek_(nazev, cisloRadku, zmeny) {
  const list = list_(nazev);
  const hlavicka = hlavickaListu_(list);
  Object.keys(zmeny).forEach(function (k) {
    const c = hlavicka.indexOf(k);
    if (c < 0) throw new Error('V listu „' + nazev + '“ chybí sloupec „' + k + '“.');
    list.getRange(cisloRadku, c + 1).setValue(zmeny[k]);
  });
}

/** Spustí funkci pod zámkem skriptu (všechny zápisy do tabulky). */
function sZamkem_(fn) {
  const zamek = LockService.getScriptLock();
  if (!zamek.tryLock(20000)) throw chyba_('Server je teď zaneprázdněný, zkus to za chvíli znovu.', 'ZANEPRAZDNENO');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    zamek.releaseLock();
  }
}

/** Krátké náhodné ID (12 znaků). */
function noveId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/** Chyba určená uživateli – zpráva se zobrazí v aplikaci, do logu chyb se nezapisuje. */
function chyba_(zprava, kod) {
  const e = new Error(zprava);
  e.kod = kod || 'CHYBA';
  return e;
}

/** Zapíše neočekávanou chybu do listu Log_chyb (a do protokolu Apps Scriptu). */
function zalogujChybu_(akce, err, uzivatel) {
  console.error(akce, err);
  const zamek = LockService.getScriptLock();
  if (!zamek.tryLock(5000)) return;
  try {
    pridejRadky_('Log_chyb', [{
      cas: new Date(),
      akce: akce || '',
      uzivatel: uzivatel || '',
      chyba: String((err && err.stack) || err).slice(0, 2000)
    }]);
  } catch (e) {
    console.error('Log chyb se nepodařilo zapsat', e);
  } finally {
    zamek.releaseLock();
  }
}

/** TRUE / „ano“ / 1 → true; prázdná buňka → vychozi. */
function jeAno_(hodnota, vychozi) {
  if (hodnota === '' || hodnota === null || hodnota === undefined) return !!vychozi;
  if (hodnota === true) return true;
  return ['true', 'ano', '1', 'a', 'yes'].indexOf(String(hodnota).trim().toLowerCase()) >= 0;
}

/** Hodnota buňky jako oříznutý text. */
function text_(hodnota) {
  return hodnota === null || hodnota === undefined ? '' : String(hodnota).trim();
}

/** Čas ve formátu 7:05 (časové pásmo skriptu). */
function cas_(datum) {
  return Utilities.formatDate(datum, Session.getScriptTimeZone(), 'H:mm');
}
