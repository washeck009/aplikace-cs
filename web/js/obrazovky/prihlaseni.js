// Přihlášení: 1) výběr jména ze seznamu, 2) PIN na klávesnici. Poslední uživatel se pamatuje.
import { volej } from '../api.js';
import { posledniJmeno, ulozPosledniJmeno, ulozRelaci } from '../uloziste.js';
import { esc, hlavicka, prejdi } from '../ui.js';

const KLAVESY = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];

let koren = null;
let stav = {};

export function zobrazPrihlaseni(el) {
  koren = el;
  stav = { jmena: null, chybaSeznamu: null, vybrane: posledniJmeno(), pin: '', zprava: '', chybaPinu: false, overuji: false };
  vykresli();
  nactiJmena();
}

async function nactiJmena() {
  stav.chybaSeznamu = null;
  try {
    stav.jmena = await volej('uzivatele.seznam', {}, { token: '' });
    // Zapamatovaný uživatel mezitím zmizel ze seznamu → zpět na výběr jména.
    if (stav.vybrane && !stav.jmena.includes(stav.vybrane)) stav.vybrane = null;
  } catch (e) {
    stav.chybaSeznamu = e.message;
  }
  if (koren && !stav.vybrane) vykresli();
}

function vykresli() {
  koren.innerHTML = hlavicka('Aplikace CS – přihlášení')
    + `<main class="ph-body">${stav.vybrane ? krokPin() : krokJmeno()}</main>`;

  koren.querySelectorAll('[data-jmeno]').forEach((b) => b.addEventListener('click', () => {
    stav.vybrane = b.dataset.jmeno;
    stav.pin = '';
    stav.zprava = '';
    vykresli();
  }));
  koren.querySelector('[data-znovu]')?.addEventListener('click', () => {
    stav.jmena = null;
    vykresli();
    nactiJmena();
  });
  koren.querySelector('[data-zmenit]')?.addEventListener('click', () => {
    stav.vybrane = null;
    stav.pin = '';
    vykresli();
  });
  koren.querySelectorAll('[data-klavesa]').forEach((b) => b.addEventListener('click', () => klavesa(b.dataset.klavesa)));
  aktualizujPin();
}

function krokJmeno() {
  let obsah;
  if (stav.chybaSeznamu) {
    obsah = `<div class="chyba">${esc(stav.chybaSeznamu)}</div>
      <button class="btn block" data-znovu>Zkusit znovu</button>`;
  } else if (!stav.jmena) {
    obsah = '<p class="hint">Načítám seznam uživatelů…</p>';
  } else if (!stav.jmena.length) {
    obsah = '<p class="hint">Zatím tu nejsou žádní uživatelé. Správce je založí v tabulce (menu Aplikace CS).</p>';
  } else {
    obsah = `<div class="users">${stav.jmena.map((j) => `<button data-jmeno="${esc(j)}">${esc(j)}</button>`).join('')}</div>`;
  }
  return `<div class="h">Kdo jsi?</div>${obsah}`;
}

function krokPin() {
  return `<div class="kdo"><b>${esc(stav.vybrane)}</b><button class="odkaz" data-zmenit>Nejsem to já</button></div>
    <div class="h">Zadej PIN</div>
    <div class="dots"></div>
    <div class="stav-pin"></div>
    <div class="pinpad">${KLAVESY.map((k) => `<button data-klavesa="${k}" aria-label="${k === '⌫' ? 'Smazat' : k}">${k}</button>`).join('')}</div>
    <p class="hint">Přihlášení platí do konce dne.</p>`;
}

/** Překreslí jen tečky, zprávu a stav klávesnice (bez ztráty pozice). */
function aktualizujPin() {
  const tecky = koren?.querySelector('.dots');
  if (!tecky) return;
  tecky.innerHTML = [0, 1, 2, 3].map((i) => `<span class="${i < stav.pin.length ? 'f' : ''}"></span>`).join('');
  const zprava = koren.querySelector('.stav-pin');
  zprava.textContent = stav.zprava;
  zprava.className = 'stav-pin' + (stav.zprava ? (stav.chybaPinu ? ' chyba' : ' hint') : '');
  koren.querySelectorAll('[data-klavesa]').forEach((b) => { b.disabled = stav.overuji; });
}

function klavesa(k) {
  if (stav.overuji) return;
  if (k === '⌫') {
    stav.pin = stav.pin.slice(0, -1);
  } else if (k === 'OK') {
    if (stav.pin.length === 4) prihlas();
    return;
  } else if (stav.pin.length < 4) {
    stav.pin += k;
    stav.zprava = '';
    stav.chybaPinu = false;
  }
  aktualizujPin();
  if (stav.pin.length === 4) prihlas();
}

async function prihlas() {
  stav.overuji = true;
  stav.zprava = 'Ověřuji…';
  stav.chybaPinu = false;
  aktualizujPin();
  try {
    const r = await volej('login', { jmeno: stav.vybrane, pin: stav.pin }, { token: '' });
    ulozRelaci({ ...r, prihlaseno: new Date().toISOString() });
    ulozPosledniJmeno(r.jmeno);
    koren = null;
    prejdi('#/');
    return;
  } catch (e) {
    stav.pin = '';
    stav.zprava = e.message;
    stav.chybaPinu = true;
  }
  stav.overuji = false;
  aktualizujPin();
}

// Fyzická klávesnice (čtečka Urovo má číselnou klávesnici).
window.addEventListener('keydown', (e) => {
  if (!koren?.querySelector('.pinpad')) return;
  if (/^\d$/.test(e.key)) klavesa(e.key);
  else if (e.key === 'Backspace') klavesa('⌫');
  else if (e.key === 'Enter') klavesa('OK');
  else return;
  e.preventDefault();
});
