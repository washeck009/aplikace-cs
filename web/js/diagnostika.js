// Diagnostika skenování: posledních 20 událostí klávesnice a stav fokusu v panelu nahoře.
// Zapíná a vypíná se 5× klepnutím na číslo verze v rozcestníku; volba se pamatuje na zařízení.
import { stavSkeneru } from './skener.js';

const KLIC = 'cs.diagnostika';
const UDALOSTI_KLAVESNICE = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'compositionstart', 'compositionend'];
const MAX_UDALOSTI = 20;
const MAX_FOKUS = 6;

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
  data: e.data, inputType: e.inputType, skladani: e.isComposing
}), true));
window.addEventListener('cs:sken', (e) => pridej(udalosti, MAX_UDALOSTI, {
  cas: Date.now(), typ: 'SKEN', key: e.detail.kod, cil: e.detail.zdroj
}));
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

/** 5 klepnutí během 3 s na prvek (číslo verze) přepne diagnostiku. */
export function napojPrepinacDiagnostiky(prvek) {
  let klepnuti = [];
  prvek.addEventListener('click', () => {
    const ted = Date.now();
    klepnuti = klepnuti.filter((t) => ted - t < 3000).concat(ted);
    if (klepnuti.length < 5) return;
    klepnuti = [];
    const zapnout = !jeZapnuto();
    try {
      localStorage.setItem(KLIC, zapnout ? '1' : '0');
    } catch { /* bez úložiště jen pro tuto chvíli */ }
    if (zapnout) zobraz();
    else skryj();
  });
}

/** Při startu aplikace obnoví panel, pokud byl zapnutý. */
export function obnovDiagnostiku() {
  if (jeZapnuto()) zobraz();
}

function text() {
  const s = stavSkeneru();
  const a = document.activeElement;
  let predchozi = null;
  const radky = udalosti.map((u) => {
    const odstup = predchozi ? ` +${u.cas - predchozi}ms` : '';
    predchozi = u.cas;
    const detail = u.typ === 'SKEN' ? `kód="${u.key}" zdroj=${u.cil}`
      : `key=${JSON.stringify(u.key)} code=${u.code || '-'} keyCode=${u.keyCode ?? '-'}`
        + (u.inputType ? ` inputType=${u.inputType}` : '') + (u.data ? ` data=${JSON.stringify(u.data)}` : '')
        + (u.skladani ? ' IME' : '') + ` → ${u.cil}`;
    return `${cas(u.cas)}${odstup} ${u.typ} ${detail}`;
  });
  return `Fokus: ${popisCile(a)} · okno ${document.hasFocus() ? 'aktivní' : 'NEaktivní'} · ${document.visibilityState}\n`
    + `Skener: ${s.zobrazen ? 'zobrazen' : 'skrytý'} · obsluha ${s.obsluha ? 'ano' : 'NE'} · ${s.zpracovava ? 'zpracovává' : 'volný'}`
    + ` · fokus v poli ${s.fokusVPoli ? 'ano' : 'NE'} · v poli "${s.vPoli}" · buffer "${s.buffer}" · fronta [${s.fronta.join(', ')}]\n`
    + `\nUdálosti klávesnice (posledních ${MAX_UDALOSTI}):\n${radky.join('\n') || '–'}\n`
    + `\nZměny fokusu:\n${fokus.map((f) => `${cas(f.cas)} ${f.typ} ${f.cil}`).join('\n') || '–'}`;
}

function zobraz() {
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'diagnostika';
    panel.innerHTML = `<b>Diagnostika skenování</b>
      <div><button data-kopirovat>Kopírovat</button><button data-vymazat>Vymazat</button><button data-vypnout>Vypnout</button></div>
      <pre></pre>`;
    panel.querySelector('[data-kopirovat]').addEventListener('click', () => navigator.clipboard?.writeText(text()).catch(() => {}));
    panel.querySelector('[data-vymazat]').addEventListener('click', () => {
      udalosti.length = 0;
      fokus.length = 0;
    });
    panel.querySelector('[data-vypnout]').addEventListener('click', () => {
      try {
        localStorage.setItem(KLIC, '0');
      } catch { /* nic */ }
      skryj();
    });
  }
  document.body.appendChild(panel);
  clearInterval(casovac);
  const pre = panel.querySelector('pre');
  casovac = setInterval(() => { pre.textContent = text(); }, 300);
  pre.textContent = text();
}

function skryj() {
  clearInterval(casovac);
  panel?.remove();
}
