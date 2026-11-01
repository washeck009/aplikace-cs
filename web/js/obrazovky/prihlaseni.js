// Přihlášení: 1) výběr jména ze seznamu, 2) PIN na klávesnici. Poslední uživatel se pamatuje.
// Uživatel bez PINu (nový nebo po resetu) si místo zadání PINu PIN nastaví: nový PIN 2× → uloží se → přihlášen.
import { volej } from '../api.js';
import { chybaNovehoPinu } from '../pin.js';
import { posledniJmeno, ulozPosledniJmeno, ulozRelaci } from '../uloziste.js';
import { esc, hlavicka, prejdi } from '../ui.js';

const KLAVESY = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];

let koren = null;
let stav = {};

export function zobrazPrihlaseni(el) {
  koren = el;
  stav = {
    jmena: null, chybaSeznamu: null, vybrane: posledniJmeno(), pin: '', zprava: '', chybaPinu: false, overuji: false,
    // rezim: 'nacitam' (zjišťuje se, jestli má PIN) | 'pin' (přihlášení) | 'nastav' (nastavení nového PINu)
    rezim: 'nacitam', prvniPin: ''
  };
  vykresli();
  nactiJmena();
  if (stav.vybrane) zjistiPin();
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

/** Má vybraný uživatel PIN? Bez signálu se ukáže zadání PINu (přihlášení stejně potřebuje server). */
async function zjistiPin() {
  const jmeno = stav.vybrane;
  stav.rezim = 'nacitam';
  try {
    const info = await volej('login.info', { jmeno }, { token: '' });
    if (stav.vybrane !== jmeno) return;
    stav.rezim = info.pin_nastaven ? 'pin' : 'nastav';
  } catch {
    if (stav.vybrane !== jmeno) return;
    stav.rezim = 'pin';
  }
  if (koren) vykresli();
}

function vyber(jmeno) {
  stav.vybrane = jmeno;
  stav.pin = '';
  stav.prvniPin = '';
  stav.zprava = '';
  stav.chybaPinu = false;
  vykresli();
  if (jmeno) zjistiPin();
}

function vykresli() {
  koren.innerHTML = hlavicka('Aplikace CS – přihlášení')
    + `<main class="ph-body">${stav.vybrane ? krokPin() : krokJmeno()}</main>`;

  koren.querySelectorAll('[data-jmeno]').forEach((b) => b.addEventListener('click', () => vyber(b.dataset.jmeno)));
  koren.querySelector('[data-znovu]')?.addEventListener('click', () => {
    stav.jmena = null;
    vykresli();
    nactiJmena();
  });
  koren.querySelector('[data-zmenit]')?.addEventListener('click', () => vyber(null));
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
  const kdo = `<div class="kdo"><b>${esc(stav.vybrane)}</b><button class="odkaz" data-zmenit>Nejsem to já</button></div>`;
  if (stav.rezim === 'nacitam') return kdo + '<p class="hint">Načítám…</p>';
  const nastav = stav.rezim === 'nastav';
  const nadpis = !nastav ? 'Zadej PIN' : stav.prvniPin ? 'Zadej nový PIN ještě jednou' : 'Nastav si PIN';
  const pomoc = !nastav ? 'Přihlášení platí do konce dne.'
    : 'Ještě nemáš PIN. Vymysli si 4 číslice, které si zapamatuješ – ne 1111 ani 1234. Nikomu je neříkej.';
  return `${kdo}
    <div class="h">${nadpis}</div>
    <div class="dots"></div>
    <div class="stav-pin"></div>
    <div class="pinpad">${KLAVESY.map((k) => `<button data-klavesa="${k}" aria-label="${k === '⌫' ? 'Smazat' : k}">${k}</button>`).join('')}</div>
    <p class="hint">${pomoc}</p>`;
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
  if (stav.overuji || stav.rezim === 'nacitam') return;
  if (k === '⌫') {
    stav.pin = stav.pin.slice(0, -1);
  } else if (k === 'OK') {
    if (stav.pin.length === 4) hotovyPin();
    return;
  } else if (stav.pin.length < 4) {
    stav.pin += k;
    stav.zprava = '';
    stav.chybaPinu = false;
  }
  aktualizujPin();
  if (stav.pin.length === 4) hotovyPin();
}

function hotovyPin() {
  if (stav.rezim === 'pin') prihlas();
  else nastavPin();
}

/** Nastavení PINu: 1. zadání se zkontroluje (ne triviální), 2. zadání musí souhlasit → uložit a přihlásit. */
function nastavPin() {
  if (!stav.prvniPin) {
    const chyba = chybaNovehoPinu(stav.pin);
    if (chyba) {
      stav.pin = '';
      stav.zprava = chyba;
      stav.chybaPinu = true;
      aktualizujPin();
      return;
    }
    stav.prvniPin = stav.pin;
    stav.pin = '';
    stav.zprava = '';
    vykresli();
    return;
  }
  if (stav.pin !== stav.prvniPin) {
    stav.pin = '';
    stav.prvniPin = '';
    stav.zprava = 'PINy se neshodují – vymysli PIN a zadej ho znovu.';
    stav.chybaPinu = true;
    vykresli();
    return;
  }
  odesli('pin.nastav', { jmeno: stav.vybrane, pin: stav.pin });
}

async function prihlas() {
  await odesli('login', { jmeno: stav.vybrane, pin: stav.pin });
}

/** Login / nastavení PINu → uložit přihlášení a na rozcestník. Chybu ukáže pod tečkami. */
async function odesli(akce, data) {
  stav.overuji = true;
  stav.zprava = akce === 'login' ? 'Ověřuji…' : 'Ukládám PIN…';
  stav.chybaPinu = false;
  aktualizujPin();
  try {
    const r = await volej(akce, data, { token: '' });
    ulozRelaci({ ...r, prihlaseno: new Date().toISOString() });
    ulozPosledniJmeno(r.jmeno);
    koren = null;
    prejdi('#/');
    return;
  } catch (e) {
    stav.pin = '';
    stav.zprava = e.message;
    stav.chybaPinu = true;
    stav.overuji = false;
    // PIN mezitím někdo resetoval / nastavil → přepnout režim.
    if (e.kod === 'BEZ_PINU' || e.kod === 'PIN_NASTAVEN') {
      stav.rezim = e.kod === 'BEZ_PINU' ? 'nastav' : 'pin';
      stav.prvniPin = '';
      vykresli();
      return;
    }
    if (akce === 'pin.nastav') stav.prvniPin = '';
  }
  vykresli();
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
