// Společné prvky obrazovek: escapování, toast, hlavička s odhlášením, navigace.
import { relace, smazRelaci } from './uloziste.js';
import { volej } from './api.js';

/** Escapuje text pro vložení do HTML. */
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

let casovacToastu;
export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(casovacToastu);
  casovacToastu = setTimeout(() => el.classList.remove('on'), 2800);
}

/** Přejde na obrazovku (hash adresy); stejnou obrazovku jen překreslí. */
export function prejdi(hash) {
  if (location.hash === hash) window.dispatchEvent(new Event('cs:prekresli'));
  else location.hash = hash;
}

/** HTML hlavičky: šipka zpět (cíl jako hash), název, tlačítko odhlášení. */
export function hlavicka(titulek, { zpet } = {}) {
  const r = relace();
  return `<header class="ph-head">
    ${zpet ? `<button class="zpet" data-cil="${esc(zpet)}" aria-label="Zpět">←</button>` : ''}
    <div class="t">${esc(titulek)}</div>
    ${r ? `<button class="odhlasit" aria-label="Odhlásit">${esc(r.jmeno)} ⎋</button>` : ''}
  </header>`;
}

/** Napojí tlačítka hlavičky po vykreslení. */
export function napojHlavicku(koren) {
  koren.querySelector('.zpet')?.addEventListener('click', (e) => prejdi(e.currentTarget.dataset.cil));
  koren.querySelector('.odhlasit')?.addEventListener('click', odhlasit);
}

export function odhlasit() {
  const r = relace();
  if (!r || !confirm(`Odhlásit uživatele ${r.jmeno}?`)) return;
  smazRelaci();
  prejdi('#/');
  volej('logout', {}, { token: r.token }).catch(() => {
    // Offline – token na serveru stejně vyprší o půlnoci.
  });
}
