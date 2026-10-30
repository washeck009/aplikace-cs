// Start aplikace: výběr obrazovky podle adresy (#/...), kontrola přihlášení, offline fronta, service worker.
import { volej } from './api.js';
import { obnovDiagnostiku } from './diagnostika.js';
import { odesliFrontu } from './fronta.js';
import { odpojSkener } from './skener.js';
import { relace, ulozDnesZapocteno, ulozRelaci } from './uloziste.js';
import { aktualizujIkonuFronty, toast } from './ui.js';
import { zobrazPrihlaseni } from './obrazovky/prihlaseni.js';
import { zobrazRozcestnik } from './obrazovky/rozcestnik.js';
import { zobrazExpiraceDomu } from './obrazovky/expirace-domu.js';
import { zobrazKontroluLokace } from './obrazovky/kontrola-lokace.js';
import { zobrazMojeUkoly } from './obrazovky/moje-ukoly.js';
import { zobrazBliziSe } from './obrazovky/blizi-se.js';
import { zobrazPcUkoly } from './obrazovky/pc-ukoly.js';

const OBRAZOVKY = {
  '#/': zobrazRozcestnik,
  '#/expirace': zobrazExpiraceDomu,
  '#/expirace/kontrola': zobrazKontroluLokace,
  '#/expirace/ukoly': zobrazMojeUkoly,
  '#/expirace/blizi': zobrazBliziSe,
  '#/pc': zobrazPcUkoly,
  '#/pc/ukoly': zobrazPcUkoly
};

function vykresli() {
  const koren = document.getElementById('app');
  const r = relace();
  // Skeny během překreslení čekají ve frontě; obrazovka se skenováním si pole znovu zobrazí.
  odpojSkener();
  // PC část má širokou stránku s postranním menu.
  document.body.classList.toggle('pc-rezim', !!r && location.hash.startsWith('#/pc'));
  if (!r) {
    zobrazPrihlaseni(koren);
  } else {
    (OBRAZOVKY[location.hash] || zobrazRozcestnik)(koren, r);
    // Po přihlášení mohou odejít položky, které čekaly na tohoto uživatele.
    odesliFrontu();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', vykresli);
window.addEventListener('cs:prekresli', vykresli);
window.addEventListener('cs:odhlaseno', (e) => {
  toast(e.detail || 'Přihlášení vypršelo, přihlas se znovu.');
  vykresli();
});
window.addEventListener('cs:fronta', (e) => aktualizujIkonuFronty(e.detail));

// Dávka z kontroly lokace dorazila na server – souhrn a nový dnešní počet.
window.addEventListener('cs:davka-odeslana', (e) => {
  const { davka, autor, vysledek } = e.detail;
  if (relace()?.jmeno !== autor) return;
  ulozDnesZapocteno(autor, davka.podnik, vysledek.dnes);
  const preskoceno = vysledek.souhrn?.preskoceno
    ? ` (${vysledek.souhrn.preskoceno} řádků přeskočeno – mezitím se změnily)` : '';
  const splnene = (vysledek.ukoly_splnene || []).length ? ` Úkol splněn ✔ ${vysledek.ukoly_splnene.join(', ')}.` : '';
  toast(vysledek.zapocteno
    ? `Lokace ${vysledek.lokace} odeslána a započtena (dnes ${vysledek.dnes}).${preskoceno}${splnene}`
    : `Lokace ${vysledek.lokace} odeslána – dnes už byla započtena, počítá se jen 1×.${preskoceno}${splnene}`);
  if (location.hash === '#/expirace' || location.hash === '#/expirace/ukoly') vykresli();
});

obnovDiagnostiku();
vykresli();

// Ověření přihlášení na serveru (účet mohl být deaktivován, role změněna). Bez signálu se nic neděje.
if (relace()) {
  volej('ja').then((ja) => {
    const r = relace();
    if (r && r.role !== ja.role) {
      ulozRelaci({ ...r, role: ja.role });
      vykresli();
    }
  }).catch(() => {});
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
