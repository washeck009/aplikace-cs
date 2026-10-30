// Offline fronta: fotky a dávky z kontroly lokací se uloží do IndexedDB a odesílají na pozadí.
// Při výpadku signálu se opakují; ikona v hlavičce ukazuje počet neodeslaných (událost cs:fronta).
import { volej } from './api.js';
import { frontaPridej, frontaSmaz, frontaUloz, frontaVse, nactiZaklad, ulozZaklad } from './db.js';
import { relace } from './uloziste.js';
import { aplikujDavku } from './zaznamy.js';

// Chyby, které se samy spraví (signál, přetížený server) – zkouší se znovu s rostoucí prodlevou.
// Ostatní (např. neplatná data) zůstanou ve frontě s chybou, dokud je uživatel nezahodí.
const OPAKOVAT = ['SIT', 'SERVER', 'ZANEPRAZDNENO', 'KONFIGURACE'];
const MAX_PRODLEVA = 15 * 60 * 1000;

let bezi = false;
let znovu = false;
let casovac = null;
let pocet = 0;

/** Počet položek ve frontě (poslední známý). */
export const pocetVeFronte = () => pocet;

/**
 * Přidá položky do fronty a hned je zkusí odeslat.
 * Položka: {typ: 'foto' | 'davka', data}. Fotky musí být před dávkou, která je používá (foto_id).
 */
export async function pridejDoFronty(polozky) {
  const r = relace();
  const ted = new Date().toISOString();
  await frontaPridej(polozky.map((p) => ({
    ...p, autor: r?.jmeno || '', token: r?.token || '', vytvoreno: ted, pokusy: 0
  })));
  await oznam();
  odesliFrontu();
}

export const obsahFronty = () => frontaVse();

/** Neodeslané dávky – promítají se do zobrazení lokace a počtů, dokud je server nemá. */
export async function cekajiciDavky() {
  return (await frontaVse()).filter((p) => p.typ === 'davka');
}

/**
 * Záznamy „Na lokaci“ podniku z dat v zařízení s promítnutými neodeslanými dávkami a změnami stavu
 * (Blíží se expirace, počty na Domů).
 */
export async function zaznamySFrontou(zaklad) {
  let zaznamy = zaklad?.zaznamy || [];
  for (const p of await frontaVse()) {
    if (p.data.podnik !== zaklad.podnik) continue;
    if (p.typ === 'davka') zaznamy = aplikujDavku(zaznamy, p.data, p.autor);
    else if (p.typ === 'stav') zaznamy = zaznamy.filter((z) => z.id !== p.data.id);
  }
  return zaznamy;
}

export async function zahodZFronty(id) {
  const vse = await frontaVse();
  const p = vse.find((x) => x.id === id);
  await frontaSmaz(id);
  if (p?.typ === 'foto') await doplnFotku(p.data.id_fotky, '');
  await oznam();
}

/** Odešle, co jde. `hned` = nečekat na prodlevu po chybě (tlačítko, návrat signálu). */
export async function odesliFrontu({ hned = false } = {}) {
  if (bezi) {
    znovu = znovu || hned;
    return;
  }
  bezi = true;
  clearTimeout(casovac);
  try {
    if (hned) {
      const vse = await frontaVse();
      await frontaUloz(vse.filter((p) => !p.trvalaChyba).map((p) => ({ ...p, dalsiPokus: 0 })));
    }
    for (;;) {
      const p = dalsiKOdeslani(await frontaVse());
      if (!p || !(await odesli(p))) break;
    }
  } catch {
    // Chyba IndexedDB – zkusí se při dalším plánovaném běhu.
  } finally {
    bezi = false;
    await oznam();
    if (znovu) {
      znovu = false;
      odesliFrontu();
    } else {
      naplanuj();
    }
  }
}

function dalsiKOdeslani(vse) {
  const ted = Date.now();
  const jmeno = relace()?.jmeno;
  const cekajiciFotky = new Set(vse.filter((p) => p.typ === 'foto' && !p.trvalaChyba).map((p) => p.data.id_fotky));
  return vse.find((p) => !p.trvalaChyba
    && (p.dalsiPokus || 0) <= ted
    && (!p.cekaNaPrihlaseni || p.autor === jmeno)
    && !(p.typ === 'davka' && p.data.radky.some((r) => r.foto_id && cekajiciFotky.has(r.foto_id))));
}

/** Odešle jednu položku. Vrátí false, když nemá smysl pokračovat dalšími (není signál). */
async function odesli(p) {
  const r = relace();
  // Dávku podepisuje autor: jeho aktuální přihlášení, jinak token z doby vzniku.
  const token = r && r.jmeno === p.autor ? r.token : p.token;
  try {
    if (p.typ === 'foto') {
      const { url } = await volej('foto.nahraj', p.data, { token, timeout: 90000 });
      await doplnFotku(p.data.id_fotky, url);
      await frontaSmaz(p.id);
    } else if (p.typ === 'stav') {
      // Vydáno / Zlikvidováno z obrazovky Blíží se expirace.
      await volej('zaznam.stav', p.data, { token, timeout: 60000 });
      await frontaSmaz(p.id);
      await promitniDoCache(p);
    } else {
      const vysledek = await volej('lokace.dokonci', p.data, { token, timeout: 60000 });
      await frontaSmaz(p.id);
      await promitniDoCache(p);
      window.dispatchEvent(new CustomEvent('cs:davka-odeslana', { detail: { davka: p.data, autor: p.autor, vysledek } }));
    }
    return true;
  } catch (e) {
    if (e.kod === 'TOKEN') {
      // Přihlášení autora vypršelo – položka počká, až se autor na tomto zařízení znovu přihlásí.
      await frontaUloz([{ ...p, cekaNaPrihlaseni: true, chyba: 'Čeká na přihlášení: ' + p.autor }]);
      return true;
    }
    if (OPAKOVAT.includes(e.kod)) {
      const pokusy = (p.pokusy || 0) + 1;
      await frontaUloz([{
        ...p, pokusy, cekaNaPrihlaseni: false, chyba: e.message,
        dalsiPokus: Date.now() + Math.min(MAX_PRODLEVA, 15000 * 2 ** (pokusy - 1))
      }]);
      return e.kod !== 'SIT' && e.kod !== 'KONFIGURACE';
    }
    await frontaUloz([{ ...p, trvalaChyba: true, cekaNaPrihlaseni: false, chyba: e.message }]);
    // Fotka, která nejde nahrát, nesmí zablokovat dávku – ta odejde bez ní.
    if (p.typ === 'foto') await doplnFotku(p.data.id_fotky, '');
    return true;
  }
}

/** Do dávek, které čekají na fotku, doplní její adresu (nebo odkaz na fotku zruší). */
async function doplnFotku(idFotky, url) {
  const davky = (await frontaVse()).filter((p) => p.typ === 'davka' && p.data.radky.some((r) => r.foto_id === idFotky));
  if (!davky.length) return;
  await frontaUloz(davky.map((p) => ({
    ...p,
    data: {
      ...p.data,
      radky: p.data.radky.map((r) => {
        if (r.foto_id !== idFotky) return r;
        const { foto_id: _, ...zbytek } = r;
        return url ? { ...zbytek, foto_url: url } : zbytek;
      })
    }
  })));
}

/** Odeslanou dávku / změnu stavu promítne do uložených dat podniku, aby se bez signálu ukazoval nový stav. */
async function promitniDoCache(p) {
  const zaklad = await nactiZaklad(p.data.podnik);
  if (!zaklad?.zaznamy) return;
  if (p.typ === 'stav') {
    zaklad.zaznamy = zaklad.zaznamy.filter((z) => z.id !== p.data.id);
    await ulozZaklad(zaklad);
    return;
  }
  const kod = p.data.lokace.toUpperCase();
  if (!zaklad.lokace.some((l) => l.kod.toUpperCase() === kod)) {
    zaklad.lokace.push({ kod: p.data.lokace, k_overeni: true });
  }
  p.data.radky.filter((r) => r.akce === 'nový' && r.k_doplneni).forEach((r) => {
    if (!zaklad.polozky.some((x) => x.ean === r.ean)) {
      zaklad.polozky.push({ ean: r.ean, cislo_polozky: r.cislo_polozky, nazev: '', k_doplneni: true });
    }
  });
  zaklad.zaznamy = aplikujDavku(zaklad.zaznamy, p.data, p.autor);
  await ulozZaklad(zaklad);
}

async function oznam() {
  const vse = await frontaVse();
  pocet = vse.length;
  window.dispatchEvent(new CustomEvent('cs:fronta', {
    detail: { pocet, chyby: vse.filter((p) => p.trvalaChyba).length }
  }));
}

function naplanuj() {
  frontaVse().then((vse) => {
    const cekajici = vse.filter((p) => !p.trvalaChyba);
    if (!cekajici.length) return;
    const nejdriv = Math.min(...cekajici.map((p) => p.dalsiPokus || 0));
    clearTimeout(casovac);
    casovac = setTimeout(() => odesliFrontu(), Math.min(60000, Math.max(5000, nejdriv - Date.now())));
  });
}

window.addEventListener('online', () => odesliFrontu({ hned: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') odesliFrontu();
});
oznam();
