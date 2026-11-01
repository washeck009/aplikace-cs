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

/**
 * Doplní do listu sloupce z LISTY, které v něm chybí (nové sloupce z pozdějších etap) – stejně jako setup,
 * aby aplikace fungovala, i když vlastník setup po aktualizaci nespustil.
 */
function zajistiSloupce_(nazev) {
  const list = list_(nazev);
  const hlavicka = hlavickaListu_(list);
  const chybi = LISTY[nazev].filter(function (s) { return hlavicka.indexOf(s) < 0; });
  if (!chybi.length) return;
  list.getRange(1, hlavicka.length + 1, 1, chybi.length).setValues([chybi]).setFontWeight('bold').setBackground('#e6f0fa');
  const radku = list.getMaxRows() - 1;
  chybi.forEach(function (s, i) {
    if (radku > 0 && (TEXTOVE_SLOUPCE[nazev] || []).indexOf(s) >= 0) {
      list.getRange(2, hlavicka.length + 1 + i, radku, 1).setNumberFormat('@');
    }
  });
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

/**
 * Zapíše zpět celé řádky načtené přes nactiList_ (objekty s _radek, upravené v paměti).
 * Objekt z nactiList_ má všechny sloupce, takže se nic nesmaže.
 */
function zapisRadky_(tabulka, objekty) {
  objekty.forEach(function (o) {
    tabulka.list.getRange(o._radek, 1, 1, tabulka.hlavicka.length).setValues([tabulka.hlavicka.map(function (h) {
      return (h in o && o[h] !== null && o[h] !== undefined) ? o[h] : '';
    })]);
  });
}

/**
 * Jako zapisRadky_, ale u mnoha změn (importy) přepíše celý list jedním zápisem – po jednotlivých řádcích
 * by desítky tisíc změn trvaly déle, než Apps Script dovolí. Prázdné řádky zůstanou prázdné.
 */
function zapisRadkyHromadne_(tabulka, objekty) {
  if (objekty.length <= 50) {
    zapisRadky_(tabulka, objekty);
    return;
  }
  const posledni = tabulka.list.getLastRow();
  if (posledni < 2) return;
  const sirka = tabulka.hlavicka.length;
  const radky = [];
  for (let i = 2; i <= posledni; i++) radky.push(new Array(sirka).fill(''));
  tabulka.radky.forEach(function (o) {
    if (o._radek < 2 || o._radek > posledni) return;
    radky[o._radek - 2] = tabulka.hlavicka.map(function (h) {
      return (h in o && o[h] !== null && o[h] !== undefined) ? o[h] : '';
    });
  });
  (TEXTOVE_SLOUPCE[tabulka.list.getName()] || []).forEach(function (s) {
    const c = tabulka.hlavicka.indexOf(s);
    if (c >= 0) tabulka.list.getRange(2, c + 1, radky.length, 1).setNumberFormat('@');
  });
  tabulka.list.getRange(2, 1, radky.length, sirka).setValues(radky);
}

/** Nahradí v listu všechny řádky podniku novými (ostatní podniky zůstanou) – import stavu lokací. */
function nahradRadkyPodniku_(nazev, podnik, objekty) {
  const tabulka = nactiList_(nazev);
  const zbyle = tabulka.radky.filter(function (r) { return text_(r.podnik) !== podnik; });
  const posledni = tabulka.list.getLastRow();
  if (posledni >= 2) tabulka.list.getRange(2, 1, posledni - 1, Math.max(1, tabulka.hlavicka.length)).clearContent();
  pridejRadky_(nazev, zbyle.concat(objekty));
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
