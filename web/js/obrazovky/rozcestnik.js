// Rozcestník modulů hlavní aplikace (zatím jen Expirace).
import { napojPrepinacDiagnostiky } from '../diagnostika.js';
import { ROLE_PC } from '../pc.js';
import { NAZVY_ROLI } from '../podniky.js';
import { VERZE } from '../verze.js';
import { esc, hlavicka, napojHlavicku, prejdi } from '../ui.js';

const MODULY = [
  { cil: '#/expirace', ikona: '⏳', nazev: 'Expirace', popis: 'Kontrola expirací zboží na lokacích' },
  // Jen vedoucí, manažer, admin – skladník dlaždici nevidí (a server mu tyto akce odmítne).
  { cil: '#/pc/prehled', ikona: '💻', nazev: 'Expirace – řízení', popis: 'Přehledy, záznamy, úkoly, správa', role: ROLE_PC }
];

export function zobrazRozcestnik(koren, relace) {
  koren.innerHTML = hlavicka('Aplikace CS') + `<main class="ph-body">
    <div class="radek-mezi"><p class="hint">Přihlášen: <b>${esc(relace.jmeno)}</b> · ${esc(NAZVY_ROLI[relace.role] || relace.role)}</p>
      <button class="odkaz" data-ucet>👤 Můj účet</button></div>
    <div class="h">Moduly</div>
    ${MODULY.filter((m) => !m.role || m.role.includes(relace.role)).map((m) => `<button class="tile" data-modul="${m.cil}">
      <span class="ic">${m.ikona}</span>
      <div><div class="tt">${m.nazev}</div><div class="ss">${m.popis}</div></div>
    </button>`).join('')}
  </main>
  <footer class="pata hint">Aplikace CS · <span data-verze>verze ${VERZE}</span></footer>`;

  napojHlavicku(koren);
  // 5× klepnutí na verzi = diagnostika skenování.
  napojPrepinacDiagnostiky(koren.querySelector('[data-verze]'));
  koren.querySelectorAll('[data-modul]').forEach((b) => b.addEventListener('click', () => prejdi(b.dataset.modul)));
  koren.querySelector('[data-ucet]').addEventListener('click', () => prejdi('#/ucet'));
}
