// Řízení (PC část: vedoucí, manažer, admin) – rám s postranním menu podle makety. Zatím je hotová jen obrazovka Úkoly.
import { NAZVY_ROLI, podnikPodleKodu } from './podniky.js';
import { esc, nastavBarvuPodniku, odhlasit, prejdi, toast } from './ui.js';

export const ROLE_PC = ['vedouci', 'manazer', 'admin'];

// [klíč, popisek, adresa (bez ní = připravujeme), jen pro roli]
const MENU = [
  ['prehled', '📊 Přehled'],
  ['ukoly', '📋 Úkoly', '#/pc/ukoly'],
  ['zaznamy', '🗂 Záznamy'],
  ['sprava', '⚙ Správa', null, 'admin']
];

/**
 * Vykreslí rám řízení s obsahem `obsah` (HTML); `aktivni` = klíč položky menu.
 * `podnik` (kód) = horní pruh v barvě podniku s jeho názvem.
 */
export function pcRam(koren, relace, aktivni, obsah, podnik) {
  const p = podnikPodleKodu(podnik);
  nastavBarvuPodniku(p?.kod);
  koren.innerHTML = `<div class="pc">
    <nav class="side">
      <div class="lg">Aplikace CS<br><span class="lg-sub">Expirace – řízení</span></div>
      ${MENU.filter((m) => !m[3] || relace.role === m[3]).map(([klic, popisek, cil]) =>
        `<button class="${klic === aktivni ? 'on' : ''}" data-menu="${klic}"${cil ? ` data-cil="${cil}"` : ''}>${popisek}${cil ? '' : ' <span class="tag">připravujeme</span>'}</button>`).join('')}
      <button data-rozcestnik>← Rozcestník</button>
      <div class="side-pata">Přihlášen: ${esc(relace.jmeno)} (${esc(NAZVY_ROLI[relace.role] || relace.role)})
        <button class="odkaz" data-odhlasit>Odhlásit</button></div>
    </nav>
    <div class="pc-sloupec">
      <div class="pc-pruh"><b>Expirace – řízení</b>${p ? `<span>${esc(p.nazev)}</span>` : ''}</div>
      <main class="main">${obsah}</main>
    </div>
  </div>`;
  koren.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.cil) prejdi(b.dataset.cil);
    else toast('Připravujeme – bude v další verzi.');
  }));
  koren.querySelector('[data-rozcestnik]').addEventListener('click', () => prejdi('#/'));
  koren.querySelector('[data-odhlasit]').addEventListener('click', odhlasit);
}
