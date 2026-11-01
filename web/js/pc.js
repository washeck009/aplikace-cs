// Řízení (PC část: vedoucí, manažer, admin) – rám s postranním menu podle makety a společné prvky obrazovek.
// Oprávnění hlídá i server: vedoucí jen čte (přehled, záznamy, úkoly), manažer navíc zadává úkoly,
// admin navíc spravuje uživatele, nastavení a importy.
import { NAZVY_ROLI, PODNIKY, podnikPodleKodu } from './podniky.js';
import { esc, nastavBarvuPodniku, odhlasit, prejdi } from './ui.js';
import { ulozPodnik } from './uloziste.js';

export const ROLE_PC = ['vedouci', 'manazer', 'admin'];
export const ROLE_UKOLY = ['manazer', 'admin']; // zadávání a rušení úkolů

// [klíč, popisek, adresa, jen pro role]
const MENU = [
  ['prehled', '📊 Přehled', '#/pc/prehled'],
  ['ukoly', '📋 Úkoly', '#/pc/ukoly'],
  ['zaznamy', '🗂 Záznamy', '#/pc/zaznamy'],
  ['sprava', '⚙ Správa', '#/pc/sprava', ['manazer', 'admin']], // manažer jen uživatele

  ['importy', '⇪ Importy', '#/pc/importy', ['admin']]
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
      ${MENU.filter((m) => !m[3] || m[3].includes(relace.role)).map(([klic, popisek, cil]) =>
        `<button class="${klic === aktivni ? 'on' : ''}" data-cil="${cil}">${popisek}</button>`).join('')}
      <button data-rozcestnik>← Rozcestník</button>
      <div class="side-pata">Přihlášen: ${esc(relace.jmeno)} (${esc(NAZVY_ROLI[relace.role] || relace.role)})
        <button class="odkaz" data-ucet>Můj účet</button> · <button class="odkaz" data-odhlasit>Odhlásit</button></div>
    </nav>
    <div class="pc-sloupec">
      <div class="pc-pruh"><b>Expirace – řízení</b>${p ? `<span>${esc(p.nazev)}</span>` : ''}</div>
      <main class="main">${obsah}</main>
    </div>
  </div>`;
  koren.querySelectorAll('.side [data-cil]').forEach((b) => b.addEventListener('click', () => prejdi(b.dataset.cil)));
  koren.querySelector('[data-rozcestnik]').addEventListener('click', () => prejdi('#/'));
  koren.querySelector('[data-odhlasit]').addEventListener('click', odhlasit);
  koren.querySelector('[data-ucet]').addEventListener('click', () => prejdi('#/ucet'));
}

/** Přepínač podniku (záložky) – HTML. */
export const prepinacPodniku = (podnik) => `<div class="tabs">${PODNIKY.map((p) =>
  `<button class="chip${p.kod === podnik ? ' on' : ''}" data-podnik="${p.kod}">${esc(p.nazev)}</button>`).join('')}</div>`;

/** Napojí přepínač podniku: uloží volbu a zavolá `znovu()` (překreslení obrazovky). */
export function napojPrepinacPodniku(koren, znovu) {
  koren.querySelectorAll('[data-podnik]').forEach((b) => b.addEventListener('click', () => {
    ulozPodnik(b.dataset.podnik);
    znovu();
  }));
}

/** Obrazovka jen pro některé role – jinak hláška v rámu. Vrátí true, když uživatel smí dál. */
export function overRoli(koren, relace, aktivni, role, nadpis) {
  if (role.includes(relace.role)) return true;
  const kdo = role.length === 1 ? 'admin' : role.includes('vedouci') ? 'vedoucí, manažer a správce' : 'manažer a správce';
  pcRam(koren, relace, aktivni, `<h1>${esc(nadpis)}</h1><div class="chyba">Tuto část vidí jen ${kdo}.</div>`);
  return false;
}

/** Datum a čas „30. 10. 2026 19:46“ (bez času, když je půlnoc a `bezCasu`). */
export function datumCas(iso, bezCasu = false) {
  if (!iso) return '–';
  const d = new Date(iso);
  const datum = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  return bezCasu ? datum : `${datum} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Celé číslo s mezerami po tisících. */
export const cislo = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('cs-CZ'));
