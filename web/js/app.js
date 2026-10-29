// Start aplikace: výběr obrazovky podle adresy (#/...), kontrola přihlášení, service worker.
import { volej } from './api.js';
import { relace, ulozRelaci } from './uloziste.js';
import { toast } from './ui.js';
import { zobrazPrihlaseni } from './obrazovky/prihlaseni.js';
import { zobrazRozcestnik } from './obrazovky/rozcestnik.js';
import { zobrazExpiraceDomu } from './obrazovky/expirace-domu.js';

const OBRAZOVKY = {
  '#/': zobrazRozcestnik,
  '#/expirace': zobrazExpiraceDomu
};

function vykresli() {
  const koren = document.getElementById('app');
  const r = relace();
  if (!r) {
    zobrazPrihlaseni(koren);
  } else {
    (OBRAZOVKY[location.hash] || zobrazRozcestnik)(koren, r);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', vykresli);
window.addEventListener('cs:prekresli', vykresli);
window.addEventListener('cs:odhlaseno', (e) => {
  toast(e.detail || 'Přihlášení vypršelo, přihlas se znovu.');
  vykresli();
});

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
