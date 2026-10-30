// Společné prvky obrazovek: escapování, toast, dialog, hlavička s frontou a odhlášením, navigace.
import { relace, smazRelaci } from './uloziste.js';
import { volej } from './api.js';
import { obsahFronty, odesliFrontu, pocetVeFronte, zahodZFronty } from './fronta.js';

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
  casovacToastu = setTimeout(() => el.classList.remove('on'), 3200);
}

/** Přejde na obrazovku (hash adresy); stejnou obrazovku jen překreslí. */
export function prejdi(hash) {
  if (location.hash === hash) window.dispatchEvent(new Event('cs:prekresli'));
  else location.hash = hash;
}

/**
 * Dialog zespodu obrazovky. tlacitka = [{text, hodnota, trida}]; vrátí hodnotu stisknutého tlačítka
 * (Zpět na telefonu / klepnutí mimo = null).
 */
export function dialog({ titulek, text = '', html = '', tlacitka }) {
  return new Promise((hotovo) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="box" role="dialog" aria-modal="true">
      <b class="titulek">${esc(titulek)}</b>
      ${text ? `<p class="hint">${esc(text)}</p>` : ''}${html}
      <div class="row">${tlacitka.map((t, i) =>
        `<button class="btn ${t.trida || ''}" data-i="${i}">${esc(t.text)}</button>`).join('')}</div>
    </div>`;
    const zavri = (hodnota) => {
      el.remove();
      hotovo(hodnota);
    };
    el.addEventListener('click', (e) => {
      if (e.target === el) zavri(null);
      const b = e.target.closest('[data-i]');
      if (b) zavri(tlacitka[Number(b.dataset.i)].hodnota);
    });
    // Tlačítka schválně bez fokusu – Enter ze skeneru je nesmí stisknout.
    document.activeElement?.blur();
    document.body.appendChild(el);
  });
}

/** HTML hlavičky: šipka zpět (cíl jako hash), název, neodeslané změny, odhlášení. */
export function hlavicka(titulek, { zpet } = {}) {
  const r = relace();
  return `<header class="ph-head">
    ${zpet ? `<button class="zpet" data-cil="${esc(zpet)}" aria-label="Zpět">←</button>` : ''}
    <div class="t">${esc(titulek)}</div>
    ${r ? `<button class="fronta" hidden aria-label="Neodeslané změny">⇡ <span></span></button>
      <button class="odhlasit" aria-label="Odhlásit">${esc(r.jmeno)} ⎋</button>` : ''}
  </header>`;
}

/** Napojí tlačítka hlavičky po vykreslení. `zpet` = vlastní akce místo přechodu na data-cil. */
export function napojHlavicku(koren, { zpet } = {}) {
  koren.querySelector('.zpet')?.addEventListener('click', (e) => (zpet ? zpet() : prejdi(e.currentTarget.dataset.cil)));
  koren.querySelector('.odhlasit')?.addEventListener('click', odhlasit);
  koren.querySelector('.fronta')?.addEventListener('click', zobrazFrontu);
  aktualizujIkonuFronty({ pocet: pocetVeFronte() });
}

/** Ikona fronty v hlavičce – volá se při každé změně fronty (událost cs:fronta). */
export function aktualizujIkonuFronty({ pocet, chyby = 0 }) {
  document.querySelectorAll('.ph-head .fronta').forEach((b) => {
    b.hidden = !pocet;
    b.classList.toggle('chyba-fronty', chyby > 0);
    b.querySelector('span').textContent = pocet;
  });
}

async function zobrazFrontu() {
  const vse = await obsahFronty();
  const cas = (iso) => new Date(iso).toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit' });
  const radek = (p) => {
    const co = p.typ === 'foto'
      ? `📷 Fotka · ${esc(p.data.lokace)}`
      : `📦 Lokace <b>${esc(p.data.lokace)}</b>`;
    const stav = p.trvalaChyba ? `<span class="chyba-text">Chyba: ${esc(p.chyba)}</span>`
      : p.cekaNaPrihlaseni ? `Čeká na přihlášení: ${esc(p.autor)}`
        : p.chyba ? `Zkusím znovu (${esc(p.chyba)})` : 'Čeká na odeslání';
    return `<div class="fronta-radek"><div>${co} · ${cas(p.vytvoreno)} · ${esc(p.autor)}<div class="hint">${stav}</div></div>
      ${p.trvalaChyba ? `<button class="btn gry" data-zahodit="${p.id}">Zahodit</button>` : ''}</div>`;
  };
  const html = vse.length ? vse.map(radek).join('') : '<p class="hint">Vše je odeslané.</p>';
  dialog({
    titulek: `Neodeslané změny: ${vse.length}`,
    text: 'Odesílají se samy, jakmile je signál. Aplikaci můžeš normálně používat dál.',
    html: `<div class="fronta-seznam">${html}</div>`,
    tlacitka: [{ text: 'Zavřít', hodnota: null, trida: 'gry' }, { text: 'Odeslat teď', hodnota: 'odeslat' }]
  }).then((v) => {
    if (v === 'odeslat') {
      toast('Odesílám…');
      odesliFrontu({ hned: true });
    }
  });
  document.querySelectorAll('[data-zahodit]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Zahodit tuto položku? Změny z ní se do tabulky nezapíšou.')) return;
    await zahodZFronty(Number(b.dataset.zahodit));
    b.closest('.fronta-radek').remove();
  }));
}

export async function odhlasit() {
  const r = relace();
  if (!r) return;
  const neodeslane = (await obsahFronty()).filter((p) => p.autor === r.jmeno).length;
  const otazka = neodeslane
    ? `Máš ${neodeslane} neodeslaných změn. Odešlou se, až se na tomto zařízení znovu přihlásíš.\n\nOdhlásit uživatele ${r.jmeno}?`
    : `Odhlásit uživatele ${r.jmeno}?`;
  if (!confirm(otazka)) return;
  smazRelaci();
  prejdi('#/');
  volej('logout', {}, { token: r.token }).catch(() => {
    // Offline – token na serveru stejně vyprší o půlnoci.
  });
}
