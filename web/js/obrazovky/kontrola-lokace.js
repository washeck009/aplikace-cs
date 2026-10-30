// Expirace – Kontrola lokace: sken lokace → evidované zboží (✓ / ✗ / ✎) → přidání zboží → Lokace hotová.
// Všechny změny jedné lokace odejdou jednou dávkou přes offline frontu (lokace.dokonci).
import { volej } from '../api.js';
import { nactiZaklad, ulozZaklad } from '../db.js';
import {
  jeEan, jeKodLokace, kratkeDatum, napojPoleExpirace, nazevZbozi, normalizujKod, pasmo, platnaExpirace,
  polozkaPodleEan, stitekPasma
} from '../expirace.js';
import { vyfotit } from '../fotky.js';
import { obsahFronty, pridejDoFronty } from '../fronta.js';
import { PODNIKY } from '../podniky.js';
import { pripravSkener, skryjSkener, zobrazSkener } from '../skener.js';
import { dialog, esc, hlavicka, napojHlavicku, prejdi, toast } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';
import { aplikujDavku, noveId } from '../zaznamy.js';

const HASH = '#/expirace/kontrola';
const NA_LOKACI = 'Na lokaci';
const STAVY_UPRAVY = [NA_LOKACI, 'Vydáno', 'Zlikvidováno'];

let koren = null;
// Rozpracovaná kontrola – přežije odchod z obrazovky (např. na Domů a zpět).
let s = null;
// Pořadové číslo načítání lokace – pozdní odpověď starší lokace se zahodí.
let cisloNacteni = 0;
// Co otevřít při příštím vstupu: úkol z Moje úkoly, lokace z Blíží se expirace.
let cekajiciUkol = null;
let cekajiciLokace = null;

const aktivni = () => location.hash === HASH && koren;
const nazevPodniku = () => PODNIKY.find((p) => p.kod === s.podnik)?.nazev || s.podnik;
const nastaveni = () => s.zaklad?.nastaveni;

/** Moje úkoly → Začít/pokračovat: kontrola nabídne zbývající lokace úkolu. */
export function zacniUkol(ukol) {
  cekajiciUkol = ukol;
}

/** Blíží se expirace → Na lokaci: kontrola rovnou otevře lokaci. */
export function otevriLokaciPriVstupu(kod) {
  cekajiciLokace = normalizujKod(kod);
}

export async function zobrazKontroluLokace(el, relace) {
  koren = el;
  // Pole nechat viditelné i během načítání dat (jinak by ho app.js po chvíli skryl a ztratil fokus).
  pripravSkener();
  const podnik = zvolenyPodnik();
  if (!s || s.jmeno !== relace.jmeno || s.podnik !== podnik) {
    s = { jmeno: relace.jmeno, podnik, zaklad: null, krok: 'sken', lokace: null, rozhodnuti: {}, nove: [], formular: null, ukol: null };
  }
  if (cekajiciUkol) {
    s.ukol = cekajiciUkol.podnik === podnik ? { ...cekajiciUkol, hotove: [...cekajiciUkol.hotove] } : null;
    cekajiciUkol = null;
  }
  s.zaklad = (await nactiZaklad(podnik)) || s.zaklad;
  if (!s.zaklad) await stahniZaklad();
  if (!aktivni()) return;
  const kod = cekajiciLokace;
  cekajiciLokace = null;
  if (kod && s.zaklad) {
    if (s.lokace) prepnoutNaLokaci(kod);
    else otevriLokaci(kod);
    return;
  }
  vykresli();
}

/** Bez číselníku by každý EAN vypadal jako neznámý – proto se data podniku musí stáhnout. */
async function stahniZaklad() {
  try {
    const zaklad = await volej('data.zaklad', { podnik: s.podnik });
    await ulozZaklad(zaklad);
    s.zaklad = zaklad;
    s.chybaZakladu = '';
  } catch (e) {
    s.chybaZakladu = e.message;
  }
}

function vykresli() {
  ({ sken: krokSken, lokace: krokLokace, novy: krokNovy, uprava: krokUprava })[s.krok]();
}

/* ---------- 1) Sken lokace ---------- */

/** Rámeček úkolu: průběh a zbývající lokace podle trasy (klepnutím se lokace otevře). */
function boxUkolu() {
  const u = s.ukol;
  const hotovo = u.lokace.filter((k) => u.hotove.includes(k));
  const zbyva = u.lokace.filter((k) => !u.hotove.includes(k));
  return `<div class="task">
    <div class="radek-mezi"><b>Úkol: ${esc(u.popis)}</b><button class="odkaz" data-konec-ukolu>Ukončit</button></div>
    <div class="prog"><i style="width:${(100 * hotovo.length) / u.lokace.length}%"></i></div>
    <div class="hint">${hotovo.length} z ${u.lokace.length} lokací · zbývající podle trasy (klepni, nebo naskenuj štítek):</div>
    <div class="chips">${zbyva.map((k) => `<button class="chip" data-lokace="${esc(k)}">${esc(k)}</button>`).join('')}</div>
  </div>`;
}

function krokSken() {
  koren.innerHTML = hlavicka('Kontrola – ' + nazevPodniku(), { zpet: s.ukol ? '#/expirace/ukoly' : '#/expirace' }) + `<main class="ph-body">
    ${s.zaklad ? '' : `<div class="chyba">Data podniku nejsou v zařízení stažená${s.chybaZakladu ? ': ' + esc(s.chybaZakladu) : '.'}</div>
      <button class="btn block" data-stahnout>Stáhnout data podniku</button>`}
    ${s.ukol ? boxUkolu() : ''}
    <div class="task odkaz-sken">Naskenuj štítek lokace – pole pro sken je dole (zelený pruh = připraveno).
      Bez skeneru použij 📷 (kamera) nebo ⌨ (ruční zadání).</div>
  </main>`;
  napojHlavicku(koren);
  koren.querySelector('[data-stahnout]')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await stahniZaklad();
    if (aktivni()) vykresli();
  });
  koren.querySelectorAll('[data-lokace]').forEach((b) => b.addEventListener('click', () => {
    if (s.zaklad) otevriLokaci(normalizujKod(b.dataset.lokace));
  }));
  koren.querySelector('[data-konec-ukolu]')?.addEventListener('click', () => {
    s.ukol = null;
    vykresli();
  });
  zobrazSkener({
    popisek: 'Naskenuj štítek lokace',
    placeholder: 'např. H2-P-37-1',
    priKodu: (surovy) => {
      const kod = normalizujKod(surovy);
      if (jeEan(kod)) toast('Tohle je EAN zboží – nejdřív naskenuj štítek lokace.');
      else if (!jeKodLokace(kod)) toast('Neznámý kód: ' + kod);
      else if (!s.zaklad) toast('Nejdřív stáhni data podniku.');
      else return otevriLokaci(kod);
    }
  });
}

/* ---------- 2) Lokace ---------- */

/**
 * Zobrazí lokaci hned z dat v zařízení a na pozadí načte aktuální stav ze serveru.
 * Vrátí se po prvním vykreslení – další sken se nemusí čekat na server.
 */
async function otevriLokaci(kod) {
  const cislo = ++cisloNacteni;
  // Fronta mezitím mohla do uložených dat promítnout odeslané dávky – číst je čerstvě.
  s.zaklad = (await nactiZaklad(s.podnik)) || s.zaklad;
  if (cislo !== cisloNacteni) return;
  const znama = s.zaklad.lokace.find((l) => l.kod.toUpperCase() === kod);
  const zCache = (s.zaklad.zaznamy || []).filter((z) => z.lokace.toUpperCase() === kod);
  Object.assign(s, { krok: 'lokace', rozhodnuti: {}, nove: [], formular: null });
  s.lokace = {
    kod: znama?.kod || kod, existuje: !!znama, k_overeni: znama ? !!znama.k_overeni : true,
    zaznamy: await sFrontou(kod, zCache), nacita: true, zprava: ''
  };
  if (aktivni()) vykresli();
  nactiZeServeru(kod, cislo);
}

async function nactiZeServeru(kod, cislo) {
  try {
    const odp = await volej('lokace.nacti', { podnik: s.podnik, kod });
    if (cislo !== cisloNacteni || !s.lokace) return;
    ulozLokaciDoCache(kod, odp.zaznamy);
    const zaznamy = await sFrontou(kod, odp.zaznamy);
    if (cislo !== cisloNacteni || !s.lokace) return;
    // Rozhodnutí u řádků, které mezitím z lokace zmizely, už nemají smysl.
    Object.keys(s.rozhodnuti).forEach((id) => {
      if (!zaznamy.some((z) => z.id === id)) delete s.rozhodnuti[id];
    });
    s.lokace = { kod: odp.kod, existuje: odp.existuje, k_overeni: odp.k_overeni, zaznamy, nacita: false, zprava: '' };
  } catch (e) {
    if (cislo !== cisloNacteni || !s.lokace || e.kod === 'TOKEN') return;
    s.lokace.nacita = false;
    s.lokace.zprava = e.kod === 'SIT'
      ? `Bez signálu – zobrazuji stav uložený v zařízení (staženo ${kratkyCas(s.zaklad.stazeno)}). Změny se odešlou později.`
      : e.message;
  }
  if (s.krok === 'lokace' && aktivni()) vykresli();
}

/** Do záznamů promítne dávky téže lokace a změny stavu, které ještě čekají ve frontě na odeslání. */
async function sFrontou(kod, zaznamy) {
  let vysledek = zaznamy;
  for (const p of await obsahFronty()) {
    if (p.data.podnik !== s.podnik) continue;
    if (p.typ === 'davka' && p.data.lokace.toUpperCase() === kod) vysledek = aplikujDavku(vysledek, p.data, p.autor);
    else if (p.typ === 'stav') vysledek = vysledek.filter((z) => z.id !== p.data.id);
  }
  return vysledek;
}

async function ulozLokaciDoCache(kod, zaznamy) {
  const zaklad = await nactiZaklad(s.podnik);
  if (!zaklad?.zaznamy) return;
  zaklad.zaznamy = zaklad.zaznamy.filter((z) => z.lokace.toUpperCase() !== kod).concat(zaznamy);
  await ulozZaklad(zaklad);
  if (s?.podnik === zaklad.podnik) s.zaklad = zaklad;
}

const maZmeny = () => Object.keys(s.rozhodnuti).length > 0 || s.nove.length > 0;

/** Expirace / ks / poznámka záznamu včetně neuložené úpravy. */
function poUprave(z) {
  const zm = s.rozhodnuti[z.id]?.akce === 'ed' ? s.rozhodnuti[z.id].zmeny : {};
  return {
    expirace: zm.expirace ?? z.expirace,
    pocet_ks: 'pocet_ks' in zm ? zm.pocet_ks : z.pocet_ks,
    poznamka: 'poznamka' in zm ? zm.poznamka : z.poznamka,
    stav: zm.stav || NA_LOKACI
  };
}

function krokLokace() {
  const L = s.lokace;
  const stitekLokace = !L.existuje ? ' · <span class="pill k">nová lokace – založí se k ověření</span>'
    : L.k_overeni ? ' · <span class="pill k">k ověření</span>' : '';
  koren.innerHTML = hlavicka('Lokace', { zpet: HASH }) + `<main class="ph-body">
    <div class="loc">${esc(L.kod)}</div>
    <div class="hint">${esc(nazevPodniku())} · evidováno ${L.zaznamy.length} ${sklonuj(L.zaznamy.length, 'záznam', 'záznamy', 'záznamů')}${stitekLokace}</div>
    ${L.nacita ? '<div class="hint nacitam">Načítám aktuální stav…</div>' : ''}
    ${L.zprava ? `<div class="upozorneni">${esc(L.zprava)}</div>` : ''}
    <div class="h">Co tu evidujeme – rozhodni u každého řádku</div>
    ${L.zaznamy.length ? L.zaznamy.map(kartaZaznamu).join('') : '<p class="hint">Na lokaci zatím nic neevidujeme.</p>'}
    ${s.nove.length ? `<div class="h">Nově přidané</div>${s.nove.map(kartaNoveho).join('')}` : ''}
    <div class="h">Našel jsi tu další zboží?</div>
    <p class="hint">Naskenuj jeho EAN – pole pro sken je dole. Naskenovaná jiná lokace nabídne přechod na ni.</p>
  </main>
  <footer class="foot">
    <button class="btn gry" data-bez>Bez expiračního zboží</button>
    <button class="btn grn" data-hotovo>✔ Lokace hotová</button>
  </footer>`;

  napojHlavicku(koren, { zpet: opustitLokaci });
  koren.querySelectorAll('.rec[data-id] [data-akce]').forEach((b) => b.addEventListener('click', () => {
    const id = b.closest('.rec').dataset.id;
    const akce = b.dataset.akce;
    if (akce === 'ed') return otevriUpravu(id);
    const predtim = s.rozhodnuti[id]?.akce;
    if (predtim === akce) delete s.rozhodnuti[id];
    else s.rozhodnuti[id] = { akce };
    if (predtim === 'ed') toast('Úprava zahozena.');
    vykresli();
  }));
  koren.querySelectorAll('[data-odebrat]').forEach((b) => b.addEventListener('click', () => {
    s.nove = s.nove.filter((n) => n.id !== b.dataset.odebrat);
    vykresli();
  }));
  koren.querySelector('[data-bez]').addEventListener('click', bezExpiracnihoZbozi);
  koren.querySelector('[data-hotovo]').addEventListener('click', lokaceHotova);
  zobrazSkener({
    popisek: `Naskenuj EAN nového zboží na ${L.kod}`,
    placeholder: 'EAN',
    priKodu: (surovy) => {
      const kod = normalizujKod(surovy);
      if (jeEan(kod)) otevriNovy(kod);
      else if (!jeKodLokace(kod)) toast('Neznámý kód: ' + kod);
      else if (kod === s.lokace.kod.toUpperCase()) toast('Tuhle lokaci právě kontroluješ.');
      else return prepnoutNaLokaci(kod);
    }
  });
}

function kartaZaznamu(z) {
  const r = s.rozhodnuti[z.id];
  const a = poUprave(z);
  const odchazi = a.stav !== NA_LOKACI;
  const ks = a.pocet_ks !== null && a.pocet_ks !== undefined && a.pocet_ks !== '' ? `${esc(a.pocet_ks)} ks` : 'ks neuvedeno';
  const tl = (akce, trida, text) =>
    `<button class="${trida}${r?.akce === akce ? ' sel' : ''}" data-akce="${akce}">${text}</button>`;
  return `<div class="rec ${odchazi ? 'k' : pasmo(a.expirace, nastaveni())}" data-id="${esc(z.id)}">
    <div class="nm">${esc(nazevZbozi(z, s.zaklad))}</div>
    <div class="mt">Exp. <b>${esc(a.expirace || '?')}</b> · ${stitekPasma(a.expirace, nastaveni())} · ${ks}</div>
    <div class="mt">Ověřeno ${esc(kratkeDatum(z.overeno))}${z.overil ? ` (${esc(z.overil)})` : ''}${z.k_doplneni ? ' · <span class="pill k">k doplnění</span>' : ''}${z.foto_url || r?.foto ? ' · 📷' : ''}</div>
    ${a.poznamka ? `<div class="mt">📝 ${esc(a.poznamka)}</div>` : ''}
    ${r?.akce === 'ed' ? `<div class="mt upraveno">✎ ${odchazi ? esc(a.stav) : 'Upraveno'} – uloží se s dokončením lokace</div>` : ''}
    <div class="acts">${tl('ok', 'ok', '✓ Je tu')}${tl('no', 'no', '✗ Není tu')}${tl('ed', 'ed', '✎ Upravit')}</div>
  </div>`;
}

function kartaNoveho(n) {
  const ks = n.pocet_ks !== null ? ` · ${esc(n.pocet_ks)} ks` : '';
  return `<div class="rec ${pasmo(n.expirace, nastaveni())}">
    <div class="nm">${esc(n.nazev || `Položka ${n.cislo_polozky}`)} <span class="pill g">nové ✓</span></div>
    <div class="mt">Exp. <b>${esc(n.expirace)}</b> · ${stitekPasma(n.expirace, nastaveni())}${ks}</div>
    <div class="mt">EAN ${esc(n.ean)} · č. pol. ${esc(n.cislo_polozky)}${n.k_doplneni ? ' · <span class="pill k">k doplnění</span>' : ''}${n.foto ? ' · 📷' : ''}</div>
    ${n.poznamka ? `<div class="mt">📝 ${esc(n.poznamka)}</div>` : ''}
    <div class="acts"><button data-odebrat="${esc(n.id)}">Odebrat</button></div>
  </div>`;
}

async function opustitLokaci() {
  if (maZmeny()) {
    const zahodit = await dialog({
      titulek: 'Zahodit rozpracovanou lokaci?',
      text: `Změny na lokaci ${s.lokace.kod} se neuloží.`,
      tlacitka: [{ text: 'Zůstat', hodnota: false, trida: 'sec' }, { text: 'Zahodit', hodnota: true, trida: 'red' }]
    });
    if (!zahodit) return;
  }
  zavritLokaci();
}

async function prepnoutNaLokaci(kod) {
  if (maZmeny()) {
    const prejit = await dialog({
      titulek: `Přejít na lokaci ${kod}?`,
      text: `Rozpracované změny na lokaci ${s.lokace.kod} se zahodí. Nejdřív ji můžeš dokončit tlačítkem Lokace hotová.`,
      tlacitka: [{ text: 'Zůstat', hodnota: false, trida: 'sec' }, { text: 'Přejít', hodnota: true }]
    });
    if (!prejit) return;
  }
  // Počkat na vykreslení nové lokace – další sken ve frontě už patří k ní.
  await otevriLokaci(kod);
}

function zavritLokaci() {
  cisloNacteni++;
  Object.assign(s, { krok: 'sken', lokace: null, rozhodnuti: {}, nove: [], formular: null });
  if (aktivni()) vykresli();
}

async function lokaceHotova() {
  const L = s.lokace;
  const neoznacene = L.zaznamy.filter((z) => !s.rozhodnuti[z.id]);
  if (neoznacene.length) {
    const vse = await dialog({
      titulek: `Neoznačené řádky: ${neoznacene.length}`,
      text: 'U každého řádku je potřeba rozhodnout. Zbytek můžeš potvrdit najednou.',
      tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'sec' }, { text: 'Vše ostatní je tu', hodnota: true, trida: 'grn' }]
    });
    if (!vse) return;
    neoznacene.forEach((z) => { s.rozhodnuti[z.id] = { akce: 'ok' }; });
  }
  // Prázdná lokace bez nového zboží = bez expiračního zboží.
  dokonci(L.zaznamy.length || s.nove.length ? 'hotovo' : 'bez_zbozi');
}

async function bezExpiracnihoZbozi() {
  const L = s.lokace;
  if (s.nove.length) {
    toast('Přidal jsi tu zboží – lokaci dokonči tlačítkem Lokace hotová.');
    return;
  }
  if (L.zaznamy.length) {
    const ano = await dialog({
      titulek: `Na lokaci je evidováno ${L.zaznamy.length} ${sklonuj(L.zaznamy.length, 'záznam', 'záznamy', 'záznamů')}`,
      text: 'Opravdu tu žádné expirační zboží není? Všechny záznamy se označí „Není na lokaci“.',
      tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'sec' }, { text: 'Ano, nic tu není', hodnota: true, trida: 'red' }]
    });
    if (!ano) return;
  }
  dokonci('bez_zbozi');
}

/** Sestaví dávku (+ fotky), uloží ji do fronty a vrátí se na sken další lokace. */
async function dokonci(typ) {
  const L = s.lokace;
  const radky = [];
  const fotky = [];
  const pocty = { ok: 0, no: 0, ed: 0 };
  const sFotkou = (foto, ean) => {
    if (!foto) return {};
    const id = noveId(16);
    fotky.push({ typ: 'foto', data: { id_fotky: id, podnik: s.podnik, lokace: L.kod, ean, base64: foto.base64 } });
    return { foto_id: id };
  };

  for (const z of L.zaznamy) {
    const r = typ === 'bez_zbozi' ? { akce: 'no' } : s.rozhodnuti[z.id];
    pocty[r.akce]++;
    if (r.akce === 'ok') radky.push({ akce: 'potvrzeno', id: z.id });
    else if (r.akce === 'no') radky.push({ akce: 'není na lokaci', id: z.id });
    else radky.push({ akce: 'změna', id: z.id, ...r.zmeny, ...sFotkou(r.foto, z.ean) });
  }
  for (const n of s.nove) {
    radky.push({
      akce: 'nový', id: n.id, ean: n.ean, cislo_polozky: n.cislo_polozky, expirace: n.expirace,
      pocet_ks: n.pocet_ks, poznamka: n.poznamka, k_doplneni: n.k_doplneni, ...sFotkou(n.foto, n.ean)
    });
  }

  const davka = { id_davky: noveId(24), podnik: s.podnik, lokace: L.kod, typ, cas: new Date().toISOString(), radky };
  try {
    await pridejDoFronty([...fotky, { typ: 'davka', data: davka }]);
  } catch {
    toast('Změny se nepodařilo uložit do zařízení – zkus to znovu.');
    return;
  }

  const casti = [];
  if (pocty.ok) casti.push(`${pocty.ok}× je tu`);
  if (pocty.no) casti.push(`${pocty.no}× není tu`);
  if (pocty.ed) casti.push(`${pocty.ed}× upraveno`);
  if (s.nove.length) casti.push(`${s.nove.length} nové`);
  toast(typ === 'bez_zbozi'
    ? `Lokace ${L.kod}: bez expiračního zboží – uloženo, odesílám…`
    : `Lokace ${L.kod} uložena: ${casti.join(', ')}. Odesílám…`);

  // Úkol: lokaci odškrtnout; když je hotový celý, zpět na Moje úkoly (server ho po odeslání uzavře).
  const kodLokace = L.kod.toUpperCase();
  if (s.ukol && s.ukol.lokace.includes(kodLokace) && !s.ukol.hotove.includes(kodLokace)) {
    s.ukol.hotove.push(kodLokace);
    if (s.ukol.lokace.every((k) => s.ukol.hotove.includes(k))) {
      toast(`Úkol splněn ✔ ${s.ukol.popis}`);
      s.ukol = null;
      zavritLokaci();
      prejdi('#/expirace/ukoly');
      return;
    }
  }
  zavritLokaci();
}

/* ---------- 3) Nové zboží ---------- */

function otevriNovy(ean) {
  const existujici = s.lokace.zaznamy.filter((z) => z.ean === ean && poUprave(z).stav === NA_LOKACI);
  s.formular = {
    ean, polozka: polozkaPodleEan(s.zaklad, ean), cislo_polozky: '', expirace: '', pocet_ks: '', poznamka: '', foto: null,
    // Upozornění, že stejné zboží už tu je (s jinou expirací je to v pořádku – dva záznamy).
    upozorneni: existujici.length ? `Na lokaci už je evidováno s expirací ${existujici.map((z) => poUprave(z).expirace).join(', ')}.` : ''
  };
  s.krok = 'novy';
  vykresli();
}

function krokNovy() {
  skryjSkener(); // ve formuláři se píše do jeho polí
  const f = s.formular;
  const p = f.polozka;
  koren.innerHTML = hlavicka('Nové zboží – ' + s.lokace.kod, { zpet: HASH }) + `<main class="ph-body">
    ${p ? `<div class="task"><b>${esc(p.nazev || `Položka ${p.cislo_polozky}`)}</b>
        <div class="hint">EAN ${esc(f.ean)} · č. pol. ${esc(p.cislo_polozky)}${p.k_doplneni ? ' · k doplnění' : ''}</div></div>`
      : `<div class="task varovani"><b>⚠ Neznámý EAN ${esc(f.ean)}</b>
        <div class="hint">Zadej číslo položky z etikety. Záznam se uloží s příznakem „k doplnění“, číselník doplní správce.</div></div>
      <div class="field"><label for="fCislo">Číslo položky</label>
        <input id="fCislo" inputmode="numeric" autocomplete="off" value="${esc(f.cislo_polozky)}">
        <div class="hint" id="fCisloNazev"></div></div>`}
    ${f.upozorneni ? `<p class="hint">${esc(f.upozorneni)}</p>` : ''}
    ${poleFormulare(f)}
  </main>
  <footer class="foot"><button class="btn gry" data-zrusit>Zrušit</button><button class="btn" data-ulozit>Uložit</button></footer>`;

  napojFormular(ulozitNovy);
  const cislo = koren.querySelector('#fCislo');
  if (cislo) {
    const ukazNazev = () => {
      const x = s.zaklad.polozky.find((q) => q.cislo_polozky === cislo.value.trim() && q.nazev);
      koren.querySelector('#fCisloNazev').textContent = x ? 'V číselníku: ' + x.nazev : '';
    };
    cislo.addEventListener('input', ukazNazev);
    ukazNazev();
  }
  (cislo && !f.cislo_polozky ? cislo : koren.querySelector('#fExp')).focus();
}

function ulozitNovy() {
  const f = s.formular;
  prectiFormular();
  const cislo = f.polozka ? f.polozka.cislo_polozky : f.cislo_polozky.trim();
  if (!cislo) return chybaPole('#fCislo', 'Zadej číslo položky z etikety.');
  if (!overPoleFormulare()) return;

  const stejny = s.lokace.zaznamy.find((z) => z.ean === f.ean && poUprave(z).expirace === f.expirace);
  if (stejny && poUprave(stejny).stav === NA_LOKACI) {
    // Klíč lokace + EAN + expirace už existuje – místo duplicity potvrdit existující záznam.
    if (s.rozhodnuti[stejny.id]?.akce !== 'ed') s.rozhodnuti[stejny.id] = { akce: 'ok' };
    toast(`Tohle zboží s expirací ${f.expirace} už tu evidujeme – označeno ✓ Je tu.`);
    return zpetNaLokaci();
  }
  if (s.nove.some((n) => n.ean === f.ean && n.expirace === f.expirace)) {
    toast('Tohle zboží s touto expirací už jsi přidal.');
    return zpetNaLokaci();
  }

  const nazevPodleCisla = s.zaklad.polozky.find((q) => q.cislo_polozky === cislo && q.nazev)?.nazev;
  s.nove.push({
    id: noveId(), ean: f.ean, cislo_polozky: cislo, nazev: f.polozka?.nazev || nazevPodleCisla || '',
    expirace: f.expirace, pocet_ks: f.pocet_ks === '' ? null : Number(f.pocet_ks), poznamka: f.poznamka.trim(),
    k_doplneni: !f.polozka || !!f.polozka.k_doplneni, foto: f.foto
  });
  toast('Přidáno a rovnou označeno ✓');
  zpetNaLokaci();
}

/* ---------- 4) Úprava záznamu ---------- */

function otevriUpravu(id) {
  const z = s.lokace.zaznamy.find((x) => x.id === id);
  const a = poUprave(z);
  const r = s.rozhodnuti[id];
  s.formular = {
    id, expirace: a.expirace || '', pocet_ks: a.pocet_ks === null || a.pocet_ks === undefined ? '' : String(a.pocet_ks),
    poznamka: a.poznamka || '', stav: a.stav, foto: r?.akce === 'ed' ? r.foto || null : null
  };
  s.krok = 'uprava';
  vykresli();
}

function krokUprava() {
  skryjSkener();
  const f = s.formular;
  const z = s.lokace.zaznamy.find((x) => x.id === f.id);
  koren.innerHTML = hlavicka('Upravit záznam', { zpet: HASH }) + `<main class="ph-body">
    <div class="task"><b>${esc(nazevZbozi(z, s.zaklad))}</b>
      <div class="hint">${esc(s.lokace.kod)} · EAN ${esc(z.ean)} · č. pol. ${esc(z.cislo_polozky)}</div></div>
    ${poleFormulare(f, { uprava: true, fotoUrl: z.foto_url })}
    <p class="hint">Změna se uloží s tvým jménem a časem, až dokončíš lokaci.</p>
  </main>
  <footer class="foot"><button class="btn gry" data-zrusit>Zrušit</button><button class="btn" data-ulozit>Uložit</button></footer>`;
  napojFormular(ulozitUpravu);
}

function ulozitUpravu() {
  const f = s.formular;
  prectiFormular();
  if (!overPoleFormulare()) return;
  const z = s.lokace.zaznamy.find((x) => x.id === f.id);

  if (f.stav === NA_LOKACI && f.expirace !== z.expirace) {
    const kolize = s.lokace.zaznamy.some((x) => x.id !== z.id && x.ean === z.ean
        && poUprave(x).expirace === f.expirace && poUprave(x).stav === NA_LOKACI && s.rozhodnuti[x.id]?.akce !== 'no')
      || s.nove.some((n) => n.ean === z.ean && n.expirace === f.expirace);
    if (kolize) {
      return chybaPole('#fExp', `Tohle zboží s expirací ${f.expirace} už na lokaci je – označ ho ✓ a tento záznam ✗.`);
    }
  }

  const ks = f.pocet_ks === '' ? null : Number(f.pocet_ks);
  const zmeny = { stav: f.stav };
  if (f.expirace !== z.expirace) zmeny.expirace = f.expirace;
  if (ks !== (z.pocet_ks ?? null)) zmeny.pocet_ks = ks;
  if (f.poznamka.trim() !== (z.poznamka || '')) zmeny.poznamka = f.poznamka.trim();

  if (f.stav === NA_LOKACI && Object.keys(zmeny).length === 1 && !f.foto) {
    s.rozhodnuti[f.id] = { akce: 'ok' };
    toast('Beze změny – označeno ✓ Je tu.');
  } else {
    s.rozhodnuti[f.id] = { akce: 'ed', zmeny, foto: f.foto };
    toast(f.stav === NA_LOKACI ? 'Upraveno – uloží se s dokončením lokace.' : `Označeno: ${f.stav}`);
  }
  zpetNaLokaci();
}

/* ---------- Společné pro formuláře ---------- */

function poleFormulare(f, { uprava = false, fotoUrl = '' } = {}) {
  return `<div class="field"><label for="fExp">Expirace (měsíc/rok)${uprava ? ' – oprava překlepu' : ''}</label>
      <input id="fExp" class="big" inputmode="numeric" placeholder="MM/RR" maxlength="5" autocomplete="off" value="${esc(f.expirace)}"></div>
    <div class="field"><label for="fKs">Počet kusů${uprava ? '' : ' (nepovinné)'}</label>
      <input id="fKs" inputmode="numeric" autocomplete="off" value="${esc(f.pocet_ks)}"></div>
    <div class="field"><label for="fPozn">Poznámka${uprava ? '' : ' (nepovinné)'}</label>
      <input id="fPozn" autocomplete="off" maxlength="500" value="${esc(f.poznamka)}"></div>
    ${uprava ? `<div class="field"><label for="fStav">Stav</label><select id="fStav">${STAVY_UPRAVY.map((st) =>
      `<option${st === f.stav ? ' selected' : ''}>${esc(st)}</option>`).join('')}</select></div>` : ''}
    <div class="foto-pole">
      ${f.foto ? `<img class="nahled" src="${f.foto.dataUrl}" alt="Nová fotka">`
        : fotoUrl ? `<p class="hint">Uložená fotka: <a href="${esc(fotoUrl)}" target="_blank" rel="noopener">otevřít</a></p>` : ''}
      <div class="row">
        <button type="button" class="btn sec" data-foto>📷 ${f.foto || fotoUrl ? 'Nová fotka' : `Přidat fotku${uprava ? '' : ' (nepovinné)'}`}</button>
        ${f.foto ? '<button type="button" class="btn gry" data-foto-pryc>Odebrat fotku</button>' : ''}
      </div>
    </div>`;
}

function napojFormular(ulozit) {
  napojHlavicku(koren, { zpet: zpetNaLokaci });
  napojPoleExpirace(koren.querySelector('#fExp'));
  koren.querySelector('[data-zrusit]').addEventListener('click', zpetNaLokaci);
  koren.querySelector('[data-ulozit]').addEventListener('click', ulozit);
  // Enter (i z číselné klávesnice čtečky) skočí na další pole, na posledním uloží.
  const pole = [...koren.querySelectorAll('main input')];
  pole.forEach((p, i) => p.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i < pole.length - 1) pole[i + 1].focus();
    else ulozit();
  }));
  koren.querySelector('[data-foto]').addEventListener('click', async () => {
    prectiFormular();
    try {
      const foto = await vyfotit();
      if (!foto) return;
      s.formular.foto = foto;
    } catch (e) {
      toast(e.message);
      return;
    }
    if (aktivni()) vykresli();
  });
  koren.querySelector('[data-foto-pryc]')?.addEventListener('click', () => {
    prectiFormular();
    s.formular.foto = null;
    vykresli();
  });
}

function prectiFormular() {
  const f = s.formular;
  const hodnota = (sel) => koren.querySelector(sel)?.value;
  f.expirace = (hodnota('#fExp') ?? f.expirace).trim();
  f.pocet_ks = (hodnota('#fKs') ?? f.pocet_ks).trim();
  f.poznamka = hodnota('#fPozn') ?? f.poznamka;
  f.stav = hodnota('#fStav') ?? f.stav;
  if (koren.querySelector('#fCislo')) f.cislo_polozky = hodnota('#fCislo');
}

function overPoleFormulare() {
  const f = s.formular;
  if (!platnaExpirace(f.expirace)) return chybaPole('#fExp', 'Expirace ve tvaru MM/RR, měsíc 01–12.');
  if (f.pocet_ks !== '' && !/^\d{1,6}$/.test(f.pocet_ks)) return chybaPole('#fKs', 'Počet kusů – jen celé číslo.');
  return true;
}

function chybaPole(sel, text) {
  toast(text);
  koren.querySelector(sel)?.focus();
  return false;
}

function zpetNaLokaci() {
  s.formular = null;
  s.krok = 'lokace';
  vykresli();
}

/* ---------- Drobnosti ---------- */

function sklonuj(n, jeden, dva, pet) {
  if (n === 1) return jeden;
  return n >= 2 && n <= 4 ? dva : pet;
}

function kratkyCas(iso) {
  return iso ? new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' }) : '?';
}
