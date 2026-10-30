// PC část (vedoucí, manažer, admin) – rám s postranním menu podle makety. Zatím je hotová jen obrazovka Úkoly.
import { NAZVY_ROLI } from './podniky.js';
import { esc, odhlasit, prejdi, toast } from './ui.js';

export const ROLE_PC = ['vedouci', 'manazer', 'admin'];

// [klíč, popisek, adresa (bez ní = připravujeme), jen pro roli]
const MENU = [
  ['prehled', '📊 Přehled'],
  ['ukoly', '📋 Úkoly', '#/pc/ukoly'],
  ['zaznamy', '🗂 Záznamy'],
  ['sprava', '⚙ Správa', null, 'admin']
];

/** Vykreslí rám PC části s obsahem `obsah` (HTML); `aktivni` = klíč položky menu. */
export function pcRam(koren, relace, aktivni, obsah) {
  koren.innerHTML = `<div class="pc">
    <nav class="side">
      <div class="lg">Aplikace CS<br><span class="lg-sub">Expirace</span></div>
      ${MENU.filter((m) => !m[3] || relace.role === m[3]).map(([klic, popisek, cil]) =>
        `<button class="${klic === aktivni ? 'on' : ''}" data-menu="${klic}"${cil ? ` data-cil="${cil}"` : ''}>${popisek}${cil ? '' : ' <span class="tag">připravujeme</span>'}</button>`).join('')}
      <button data-rozcestnik>← Rozcestník</button>
      <div class="side-pata">Přihlášen: ${esc(relace.jmeno)} (${esc(NAZVY_ROLI[relace.role] || relace.role)})
        <button class="odkaz" data-odhlasit>Odhlásit</button></div>
    </nav>
    <main class="main">${obsah}</main>
  </div>`;
  koren.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.cil) prejdi(b.dataset.cil);
    else toast('Připravujeme – bude v další verzi.');
  }));
  koren.querySelector('[data-rozcestnik]').addEventListener('click', () => prejdi('#/'));
  koren.querySelector('[data-odhlasit]').addEventListener('click', odhlasit);
}
