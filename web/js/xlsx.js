// Excel v prohlížeči (řízení): načtení xlsx / csv pro importy a export .xlsx. Knihovna SheetJS se načítá z CDN
// až při prvním použití – pevná verze a kontrolní součet souboru (verze 0.20.3 opravuje známé chyby ve čtení).
const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
const SHEETJS_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';

let nacitani = null;

/** Načte knihovnu SheetJS (jednou) a vrátí objekt XLSX. */
export function sheetjs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  nacitani = nacitani || new Promise((hotovo, chyba) => {
    const s = document.createElement('script');
    s.src = SHEETJS_URL;
    s.integrity = SHEETJS_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () => hotovo(window.XLSX);
    s.onerror = () => {
      nacitani = null;
      chyba(new Error('Knihovnu pro Excel se nepodařilo načíst (je připojení k internetu?).'));
    };
    document.head.appendChild(s);
  });
  return nacitani;
}

/**
 * Přečte první list souboru jako pole řádků (pole buněk). xlsx: čísla jako čísla, data jako sériové číslo Excelu
 * (převede `hodnotaNaDatum`). csv: vše jako text (úvodní nuly zůstanou), kódování UTF-8 nebo windows-1250,
 * oddělovač ; , nebo tabulátor podle první řádky.
 */
export async function nactiSoubor(soubor) {
  const XLSX = await sheetjs();
  const data = await soubor.arrayBuffer();
  let sesit;
  if (/\.(csv|txt)$/i.test(soubor.name)) {
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    } catch {
      text = new TextDecoder('windows-1250').decode(data);
    }
    text = text.replace(/^﻿/, '');
    const prvni = text.split(/\r?\n/, 1)[0];
    const pocet = (z) => prvni.split(z).length;
    const oddelovac = [';', '\t', ','].sort((a, b) => pocet(b) - pocet(a))[0];
    sesit = XLSX.read(text, { type: 'string', raw: true, FS: oddelovac });
  } else {
    sesit = XLSX.read(data, { type: 'array', cellDates: false });
  }
  const list = sesit.Sheets[sesit.SheetNames[0]];
  if (!list) throw new Error('Soubor neobsahuje žádný list.');
  return XLSX.utils.sheet_to_json(list, { header: 1, raw: true, defval: null, blankrows: false });
}

/** Název sloupce pro porovnání: bez diakritiky, mezer a interpunkce, malými písmeny. */
export const normalizujNazev = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Najde řádek hlavičky (v prvních 10 řádcích) a pozice sloupců. `sloupce` = {klic: {nazvy: [...], povinny}}.
 * Vrátí {radek: index hlavičky, pozice: {klic: index sloupce}}, nebo vyhodí chybu s tím, co chybí.
 */
export function najdiSloupce(radky, sloupce) {
  let nejlepsi = null;
  for (let i = 0; i < Math.min(10, radky.length); i++) {
    const nazvy = (radky[i] || []).map(normalizujNazev);
    const pozice = {};
    Object.entries(sloupce).forEach(([klic, s]) => {
      const j = nazvy.findIndex((n) => s.nazvy.includes(n));
      if (j >= 0) pozice[klic] = j;
    });
    const povinnych = Object.keys(sloupce).filter((k) => sloupce[k].povinny && k in pozice).length;
    if (!nejlepsi || povinnych > nejlepsi.povinnych) nejlepsi = { radek: i, pozice, povinnych };
  }
  const chybi = Object.entries(sloupce).filter(([k, s]) => s.povinny && !(k in (nejlepsi?.pozice || {})));
  if (chybi.length) {
    throw new Error(`V hlavičce souboru chybí sloupce: ${chybi.map(([, s]) => s.popis).join(', ')}. `
      + 'Zkontroluj, že je to správný export a že první řádek obsahuje názvy sloupců.');
  }
  return nejlepsi;
}

/** Hodnota buňky jako text: celé číslo bez „.0“ a exponentu (EAN, čísla položek), jinak oříznutý text. */
export function hodnotaNaText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isInteger(v) ? BigInt(Math.round(v)).toString() : String(v);
  }
  return String(v).trim();
}

/** Hodnota buňky jako číslo (i „1,5“ z CSV), jinak null. */
export function hodnotaNaCislo(v) {
  if (typeof v === 'number') return v;
  const t = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return t !== '' && isFinite(Number(t)) ? Number(t) : null;
}

/**
 * Datum z buňky: sériové číslo Excelu (místní čas, jak ho ukazuje Excel) nebo text „30.10.2026 19:46(:12)“
 * / ISO. Neplatné → null.
 */
export function hodnotaNaDatum(v) {
  if (typeof v === 'number' && v > 0) {
    const u = new Date(Math.round((v - 25569) * 864e5));
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
  }
  const t = String(v ?? '').trim();
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
  const d = t ? new Date(t) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

/**
 * Stáhne sešit .xlsx. listy = [{nazev, hlavicka: [...], radky: [[...]], sirky?: [...]}].
 * Kódy (EAN, čísla položek, lokace) předávej jako text – zůstanou textem i s úvodními nulami.
 */
export async function stahniXlsx(nazevSouboru, listy) {
  const XLSX = await sheetjs();
  const sesit = XLSX.utils.book_new();
  listy.forEach((l) => {
    // Tečky v datu musí být v uvozovkách – „d.m.yyyy“ SheetJS odmítne (tečku bere jako desetinná místa sekund).
    const ws = XLSX.utils.aoa_to_sheet([l.hlavicka, ...l.radky], { cellDates: true, dateNF: 'd"."m"."yyyy h:mm' });
    ws['!cols'] = (l.sirky || l.hlavicka.map((h) => Math.max(10, String(h).length + 2))).map((w) => ({ wch: w }));
    if (l.radky.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: l.radky.length, c: l.hlavicka.length - 1 } }) };
    XLSX.utils.book_append_sheet(sesit, ws, l.nazev.slice(0, 31));
  });
  XLSX.writeFile(sesit, nazevSouboru, { compression: true });
}

/** Text chyby – SheetJS vyhazuje i obyčejné řetězce, ne objekty Error. */
export const textChyby = (e) => (e && e.message) || String(e || 'Neznámá chyba.');
