// Rozcestník modulů hlavní aplikace (zatím jen Expirace). Dlaždice podle oprávnění (Správa → Oprávnění).
import { napojPrepinacDiagnostiky } from '../diagnostika.js';
import { ma, OPRAVNENI_RIZENI } from '../opravneni.js';
import { vychoziObrazovkaRizeni } from '../pc.js';
import { NAZVY_ROLI } from '../podniky.js';
import { VERZE } from '../verze.js';
import { esc, hlavicka, napojHlavicku, prejdi } from '../ui.js';

// opravneni = stačí jedno z nich; nový modul přidá dlaždici se svými klíči.
const MODULY = [
  { cil: '#/expirace', ikona: '⏳', nazev: 'Expirace', popis: 'Kontrola expirací zboží na lokacích',
    opravneni: ['kontrola', 'vydano', 'moje_ukoly'] },
  { cil: () => vychoziObrazovkaRizeni(), ikona: '💻', nazev: 'Expirace – řízení', popis: 'Přehledy, záznamy, úkoly, správa',
    opravneni: OPRAVNENI_RIZENI }
];

export function zobrazRozcestnik(koren, relace) {
  koren.innerHTML = hlavicka('Aplikace CS') + `<main class="ph-body">
    <div class="radek-mezi"><p class="hint">Přihlášen: <b>${esc(relace.jmeno)}</b> · ${esc(NAZVY_ROLI[relace.role] || relace.role)}</p>
      <button class="odkaz" data-ucet>👤 Můj účet</button></div>
    <div class="h">Moduly</div>
    ${MODULY.map((m, i) => (ma(...m.opravneni) ? `<button class="tile" data-modul="${i}">
      <span class="ic">${m.ikona}</span>
      <div><div class="tt">${m.nazev}</div><div class="ss">${m.popis}</div></div>
    </button>` : '')).join('') || '<p class="hint">Nemáš přidělené žádné oprávnění – obrať se na správce.</p>'}
  </main>
  <footer class="pata hint">Aplikace CS · <span data-verze>verze ${VERZE}</span></footer>`;

  napojHlavicku(koren);
  // 5× klepnutí na verzi = diagnostika skenování.
  napojPrepinacDiagnostiky(koren.querySelector('[data-verze]'));
  koren.querySelectorAll('[data-modul]').forEach((b) => b.addEventListener('click', () => {
    const cil = MODULY[Number(b.dataset.modul)].cil;
    prejdi(typeof cil === 'function' ? cil() : cil);
  }));
  koren.querySelector('[data-ucet]').addEventListener('click', () => prejdi('#/ucet'));
}
