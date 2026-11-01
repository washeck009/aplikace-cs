// Řízení (PC část) – rám s postranním menu podle makety a společné prvky obrazovek.
// Položky menu a obrazovky podle oprávnění (Správa → Oprávnění); každou akci kontroluje i server.
import { ma } from './opravneni.js';
import { NAZVY_ROLI, PODNIKY, podnikPodleKodu } from './podniky.js';
import { esc, nastavBarvuPodniku, odhlasit, prejdi } from './ui.js';
import { relace as aktualniRelace, ulozPodnik } from './uloziste.js';

// Oprávnění obrazovek řízení (stačí jedno z nich). Nový modul přidá svou položku se svými klíči.
export const OPRAVNENI_OBRAZOVEK = {
  prehled: ['prehledy'],
  ukoly: ['prehledy', 'ukoly_zadavani'],
  zaznamy: ['zaznamy'],
  sprava: ['sprava_uzivatelu', 'nastaveni', 'importy'], // Oprávnění (záložka) jen admin
  importy: ['importy']
};

// [klíč, popisek, adresa]
const MENU = [
  ['prehled', '📊 Přehled', '#/pc/prehled'],
  ['ukoly', '📋 Úkoly', '#/pc/ukoly'],
  ['zaznamy', '🗂 Záznamy', '#/pc/zaznamy'],
  ['sprava', '⚙ Správa', '#/pc/sprava'],
  ['importy', '⇪ Importy', '#/pc/importy']
];

const smiObrazovku = (klic) => ma(...OPRAVNENI_OBRAZOVEK[klic]);

/** První obrazovka řízení, kterou uživatel smí vidět (dlaždice v rozcestníku, adresa #/pc). */
export function vychoziObrazovkaRizeni() {
  return (MENU.find(([klic]) => smiObrazovku(klic)) || MENU[0])[2];
}

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
      ${MENU.filter(([klic]) => smiObrazovku(klic)).map(([klic, popisek, cil]) =>
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

/**
 * Obrazovka řízení `aktivni` (klíč z OPRAVNENI_OBRAZOVEK) – bez oprávnění hláška v rámu.
 * Vrátí true, když uživatel smí dál.
 */
export function overOpravneni(koren, relace, aktivni, nadpis) {
  if (smiObrazovku(aktivni)) return true;
  pcRam(koren, relace, aktivni, `<h1>${esc(nadpis)}</h1>
    <div class="chyba">K této části nemáš oprávnění. Oprávnění přiděluje správce (Správa → Oprávnění).</div>`);
  return false;
}

/** Je přihlášený admin? (Záložka Oprávnění, správa účtů adminů.) */
export const jeAdmin = () => aktualniRelace()?.role === 'admin';

/** Datum a čas „30. 10. 2026 19:46“ (bez času, když je půlnoc a `bezCasu`). */
export function datumCas(iso, bezCasu = false) {
  if (!iso) return '–';
  const d = new Date(iso);
  const datum = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
  return bezCasu ? datum : `${datum} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Celé číslo s mezerami po tisících. */
export const cislo = (n) => (n === null || n === undefined ? '–' : Number(n).toLocaleString('cs-CZ'));
