// Modul Expirace – obrazovka Domů: přepínač podniku, dlaždice, stav stažených dat podniku.
import { volej } from '../api.js';
import { nactiZaklad, ulozZaklad } from '../db.js';
import { PODNIKY } from '../podniky.js';
import { ulozPodnik, zvolenyPodnik } from '../uloziste.js';
import { esc, hlavicka, napojHlavicku, toast } from '../ui.js';

// Data podniku se znovu stahují po přihlášení a pak nejdéle po 30 minutách.
const OBNOVA_MS = 30 * 60 * 1000;

const DLAZDICE = [
  { ikona: '📷', nazev: 'Kontrola lokace', popis: 'Naskenuj lokaci a ověř zboží' },
  { ikona: '📋', nazev: 'Moje úkoly', popis: 'Od vedoucích a z plánovače' },
  { ikona: '⏳', nazev: 'Blíží se expirace', popis: 'Seřazeno podle data, pro obchůzku' }
];

// Pořadové číslo vykreslení – starší rozběhnuté stahování nepřepíše novější obrazovku.
let vykresleni = 0;

export function zobrazExpiraceDomu(koren, relace) {
  const podnik = zvolenyPodnik();
  const cislo = ++vykresleni;

  koren.innerHTML = hlavicka('Expirace', { zpet: '#/' }) + `<main class="ph-body">
    <div class="seg">${PODNIKY.map((p) =>
      `<button data-podnik="${p.kod}" class="${p.kod === podnik ? 'on' : ''}">${esc(p.nazev)}</button>`).join('')}</div>
    ${DLAZDICE.map((d) => `<button class="tile pripravujeme">
      <span class="ic">${d.ikona}</span>
      <div><div class="tt">${d.nazev}</div><div class="ss">${d.popis}</div></div>
      <span class="tag">připravujeme</span>
    </button>`).join('')}
    <div class="h">Data podniku</div>
    <div class="task" id="infoData"><span class="hint">Načítám…</span></div>
  </main>`;

  napojHlavicku(koren);
  koren.querySelectorAll('[data-podnik]').forEach((b) => b.addEventListener('click', () => {
    ulozPodnik(b.dataset.podnik);
    zobrazExpiraceDomu(koren, relace);
  }));
  koren.querySelectorAll('.pripravujeme').forEach((b) => b.addEventListener('click', () =>
    toast('Připravujeme – bude v další verzi.')));

  obnovData(koren, podnik, relace, cislo, false);
}

/** Ukáže data z cache a podle potřeby je stáhne znovu ze serveru. */
async function obnovData(koren, podnik, relace, cislo, vynutit) {
  const aktualni = () => cislo === vykresleni && koren.querySelector('#infoData');
  const cache = await nactiZaklad(podnik);
  if (cache && aktualni()) vypisInfo(koren, podnik, relace, cislo, cache, '');

  const zastarale = !cache
    || new Date(cache.stazeno) < new Date(relace.prihlaseno)
    || Date.now() - new Date(cache.stazeno) > OBNOVA_MS;
  if (!vynutit && !zastarale) return;

  try {
    const zaklad = await volej('data.zaklad', { podnik });
    await ulozZaklad(zaklad);
    if (aktualni()) vypisInfo(koren, podnik, relace, cislo, zaklad, '');
  } catch (e) {
    if (e.kod === 'TOKEN' || !aktualni()) return;
    vypisInfo(koren, podnik, relace, cislo, cache, e.message);
  }
}

function vypisInfo(koren, podnik, relace, cislo, zaklad, chyba) {
  const el = koren.querySelector('#infoData');
  const n = zaklad?.nastaveni || {};
  el.innerHTML = (zaklad ? `Číselník: <b>${zaklad.polozky.length}</b> položek · lokací: <b>${zaklad.lokace.length}</b>
      <div class="hint">Pásma: červená ≤ ${esc(n.hranice_cervena ?? '?')} dní, žlutá ≤ ${esc(n.hranice_zluta ?? '?')} dní</div>
      <div class="hint">Staženo ${esc(formatCas(zaklad.stazeno))}${chyba ? ' (starší data z tohoto zařízení)' : ''}</div>`
    : '<span class="hint">Data podniku zatím nejsou stažená.</span>')
    + (chyba ? `<div class="chyba">${esc(chyba)}</div>` : '')
    + '<button class="odkaz" data-obnovit>Stáhnout znovu</button>';
  el.querySelector('[data-obnovit]').addEventListener('click', () => {
    el.innerHTML = '<span class="hint">Stahuji…</span>';
    obnovData(koren, podnik, relace, cislo, true);
  });
}

function formatCas(iso) {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' });
}
