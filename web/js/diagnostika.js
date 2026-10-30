// Diagnostika skenování: události klávesnice a IME, hodnota pole, stav fokusu; přepínač režimu pole A/B/C.
// Zapíná a vypíná se 5× klepnutím na číslo verze v rozcestníku; volba se pamatuje na zařízení.
import { volej } from './api.js';
import { nastavRezimPole, REZIMY_POLE, rezimPole, stavSkeneru } from './skener.js';
import { toast } from './ui.js';
import { VERZE } from './verze.js';

const KLIC = 'cs.diagnostika';
const UDALOSTI_KLAVESNICE = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input',
  'compositionstart', 'compositionupdate', 'compositionend'];
const MAX_UDALOSTI = 30;
const MAX_FOKUS = 8;

const udalosti = [];
const fokus = [];
let panel = null;
let casovac = null;

function popisCile(t) {
  if (!t || t === document) return 'document';
  if (t === window) return 'window';
  if (!t.tagName) return String(t);
  const trida = typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\s+/)[0] : '';
  return t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + trida;
}

function cas(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString('cs-CZ', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function pridej(seznam, max, zaznam) {
  seznam.push(zaznam);
  if (seznam.length > max) seznam.shift();
}

UDALOSTI_KLAVESNICE.forEach((typ) => document.addEventListener(typ, (e) => pridej(udalosti, MAX_UDALOSTI, {
  cas: Date.now(), typ, key: e.key, code: e.code, keyCode: e.keyCode, cil: popisCile(e.target),
  data: e.data, inputType: e.inputType, skladani: e.isComposing,
  hodnota: 'value' in (e.target || {}) ? e.target.value : undefined
}), true));
window.addEventListener('cs:sken', (e) => pridej(udalosti, MAX_UDALOSTI, {
  cas: Date.now(), typ: 'SKEN', text: `kód="${e.detail.kod}" zdroj=${e.detail.zdroj}`
}));
window.addEventListener('cs:diag', (e) => pridej(udalosti, MAX_UDALOSTI, { cas: Date.now(), typ: 'POLE', text: e.detail }));
['focusin', 'focusout'].forEach((typ) => document.addEventListener(typ, (e) =>
  pridej(fokus, MAX_FOKUS, { cas: Date.now(), typ, cil: popisCile(e.target) }), true));
['focus', 'blur'].forEach((typ) => window.addEventListener(typ, (e) => {
  if (e.target === window) pridej(fokus, MAX_FOKUS, { cas: Date.now(), typ: 'okno ' + typ, cil: '' });
}));
document.addEventListener('visibilitychange', () =>
  pridej(fokus, MAX_FOKUS, { cas: Date.now(), typ: 'viditelnost', cil: document.visibilityState }));

function jeZapnuto() {
  try {
    return localStorage.getItem(KLIC) === '1';
  } catch {
    return false;
  }
}

function ulozZapnuto(zapnuto) {
  try {
    localStorage.setItem(KLIC, zapnuto ? '1' : '0');
  } catch { /* bez úložiště jen pro tuto chvíli */ }
}

/** 5 klepnutí během 3 s na prvek (číslo verze) přepne diagnostiku. */
export function napojPrepinacDiagnostiky(prvek) {
  let klepnuti = [];
  prvek.addEventListener('click', () => {
    const ted = Date.now();
    klepnuti = klepnuti.filter((t) => ted - t < 3000).concat(ted);
    if (klepnuti.length < 5) return;
    klepnuti = [];
    const zapnout = !jeZapnuto();
    ulozZapnuto(zapnout);
    if (zapnout) zobraz();
    else skryj();
  });
}

/** Při startu aplikace obnoví panel, pokud byl zapnutý. */
export function obnovDiagnostiku() {
  if (jeZapnuto()) zobraz();
}

function popisUdalosti(u) {
  if (u.text) return u.text;
  return `key=${JSON.stringify(u.key)} code=${u.code || '-'} keyCode=${u.keyCode ?? '-'}`
    + (u.inputType ? ` inputType=${u.inputType}` : '')
    + (u.data !== undefined && u.data !== null ? ` data=${JSON.stringify(u.data)}` : '')
    + (u.skladani ? ' IME' : '')
    + ` → ${u.cil}`
    + (u.hodnota !== undefined ? ` hodnota=${JSON.stringify(u.hodnota)}` : '');
}

function text() {
  const s = stavSkeneru();
  const a = document.activeElement;
  let predchozi = null;
  const radky = udalosti.map((u) => {
    const odstup = predchozi ? ` +${u.cas - predchozi}ms` : '';
    predchozi = u.cas;
    return `${cas(u.cas)}${odstup} ${u.typ} ${popisUdalosti(u)}`;
  });
  return `Verze ${VERZE} · režim pole ${s.rezim} (${REZIMY_POLE[s.rezim]}) · ${navigator.userAgent}\n`
    + `Fokus: ${popisCile(a)} · okno ${document.hasFocus() ? 'aktivní' : 'NEaktivní'} · ${document.visibilityState}\n`
    + `Skener: ${s.zobrazen ? 'zobrazen' : 'skrytý'} · obsluha ${s.obsluha ? 'ano' : 'NE'} · ${s.zpracovava ? 'zpracovává' : 'volný'}`
    + ` · fokus v poli ${s.fokusVPoli ? 'ano' : 'NE'} · v poli "${s.vPoli}" · buffer "${s.buffer}" · fronta [${s.fronta.join(', ')}]\n`
    + `\nUdálosti (posledních ${MAX_UDALOSTI}):\n${radky.join('\n') || '–'}\n`
    + `\nZměny fokusu:\n${fokus.map((f) => `${cas(f.cas)} ${f.typ} ${f.cil}`).join('\n') || '–'}`;
}

function vykresliRezim() {
  panel.querySelectorAll('[data-rezim]').forEach((b) => b.classList.toggle('on', b.dataset.rezim === rezimPole()));
}

function zobraz() {
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'diagnostika';
    panel.innerHTML = `<b>Diagnostika skenování</b>
      <div class="diag-radek">Režim pole: ${Object.entries(REZIMY_POLE).map(([k, popis]) =>
        `<button data-rezim="${k}">${k}: ${popis}</button>`).join('')}</div>
      <div class="diag-radek"><button data-odeslat>Odeslat výpis</button><button data-kopirovat>Kopírovat</button>
        <button data-vymazat>Vymazat</button><button data-vypnout>Vypnout</button></div>
      <pre></pre>`;
    panel.querySelectorAll('[data-rezim]').forEach((b) => b.addEventListener('click', () => {
      nastavRezimPole(b.dataset.rezim);
      vykresliRezim();
      toast(`Režim pole ${b.dataset.rezim}: ${REZIMY_POLE[b.dataset.rezim]}`);
    }));
    panel.querySelector('[data-odeslat]').addEventListener('click', odeslatVypis);
    panel.querySelector('[data-kopirovat]').addEventListener('click', () => {
      navigator.clipboard?.writeText(text()).then(() => toast('Zkopírováno.'), () => toast('Kopírování nejde – použij Odeslat výpis.'));
    });
    panel.querySelector('[data-vymazat]').addEventListener('click', () => {
      udalosti.length = 0;
      fokus.length = 0;
    });
    panel.querySelector('[data-vypnout]').addEventListener('click', () => {
      ulozZapnuto(false);
      skryj();
    });
  }
  vykresliRezim();
  document.body.appendChild(panel);
  clearInterval(casovac);
  const pre = panel.querySelector('pre');
  casovac = setInterval(() => { pre.textContent = text(); }, 300);
  pre.textContent = text();
}

/** Uloží výpis do listu Log_chyb přes API (na čtečce nefunguje schránka). */
async function odeslatVypis(e) {
  const tlacitko = e.currentTarget;
  tlacitko.disabled = true;
  try {
    await volej('diagnostika.odesli', { text: text() });
    toast('Výpis uložen do tabulky (list Log_chyb).');
  } catch (chyba) {
    toast('Výpis se nepodařilo odeslat: ' + chyba.message);
  } finally {
    tlacitko.disabled = false;
  }
}

function skryj() {
  clearInterval(casovac);
  panel?.remove();
}
