// Modul Expirace – obrazovka Domů: přepínač podniku, dlaždice, dnešní kontroly, stav stažených dat podniku.
import { volej } from '../api.js';
import { nactiZaklad, ulozZaklad } from '../db.js';
import { pasmo } from '../expirace.js';
import { ma } from '../opravneni.js';
import { cekajiciDavky, zaznamySFrontou } from '../fronta.js';
import { PODNIKY } from '../podniky.js';
import { pripravSkener } from '../skener.js';
import { dnesZapocteno, ulozDnesZapocteno, ulozeneUkoly, ulozPodnik, zvolenyPodnik } from '../uloziste.js';
import { esc, hlavicka, napojHlavicku, prejdi, toast } from '../ui.js';

// Data podniku se znovu stahují po přihlášení a pak nejdéle po 30 minutách.
const OBNOVA_MS = 30 * 60 * 1000;

// Dlaždice podle oprávnění (stačí jedno z nich) – Správa → Oprávnění.
const DLAZDICE = [
  { ikona: '📷', nazev: 'Kontrola lokace', popis: 'Naskenuj lokaci a ověř zboží', cil: '#/expirace/kontrola', opravneni: ['kontrola'] },
  { ikona: '📋', nazev: 'Moje úkoly', popis: 'Od vedoucích a z plánovače', cil: '#/expirace/ukoly', odznak: 'ukoly', opravneni: ['moje_ukoly'] },
  { ikona: '⏳', nazev: 'Blíží se expirace', popis: 'Seřazeno podle data, pro obchůzku', cil: '#/expirace/blizi', odznak: 'blizi',
    opravneni: ['vydano', 'kontrola'] }
];

// Pořadové číslo vykreslení – starší rozběhnuté stahování nepřepíše novější obrazovku.
let vykresleni = 0;

export function zobrazExpiraceDomu(koren, relace) {
  const podnik = zvolenyPodnik();
  const cislo = ++vykresleni;

  koren.innerHTML = hlavicka('Expirace', { zpet: '#/', podnik }) + `<main class="ph-body">
    <div class="seg">${PODNIKY.map((p) =>
      `<button data-podnik="${p.kod}" class="${p.kod === podnik ? 'on' : ''}">${esc(p.nazev)}</button>`).join('')}</div>
    ${DLAZDICE.filter((d) => ma(...d.opravneni)).map((d) => `<button class="tile${d.cil ? '' : ' pripravujeme'}"${d.cil ? ` data-cil="${d.cil}"` : ''}>
      <span class="ic">${d.ikona}</span>
      <div><div class="tt">${d.nazev}</div><div class="ss">${d.popis}</div></div>
      ${d.cil ? '' : '<span class="tag">připravujeme</span>'}
      ${d.odznak ? `<span class="badge" data-odznak="${d.odznak}" hidden></span>` : ''}
    </button>`).join('')}
    <div class="h">Dnes</div>
    <div class="task" id="infoDnes"><span class="hint">Načítám…</span></div>
    <div class="h">Data podniku</div>
    <div class="task" id="infoData"><span class="hint">Načítám…</span></div>
  </main>`;

  napojHlavicku(koren);
  koren.querySelectorAll('[data-podnik]').forEach((b) => b.addEventListener('click', () => {
    ulozPodnik(b.dataset.podnik);
    zobrazExpiraceDomu(koren, relace);
  }));
  koren.querySelectorAll('[data-cil]').forEach((b) => b.addEventListener('click', () => {
    // Skenovací pole ukázat a zaměřit hned v klepnutí – obrazovka se vykreslí až po změně adresy (Android
    // by fokus mimo klepnutí ignoroval).
    if (b.dataset.cil === '#/expirace/kontrola') pripravSkener();
    prejdi(b.dataset.cil);
  }));
  koren.querySelectorAll('.pripravujeme').forEach((b) => b.addEventListener('click', () =>
    toast('Připravujeme – bude v další verzi.')));

  const aktualni = () => cislo === vykresleni && koren.querySelector('#infoData');
  obnovData(koren, podnik, relace, aktualni, false);
  obnovDnes(koren, podnik, relace, aktualni);
}

function nastavOdznak(koren, nazev, pocet) {
  const el = koren.querySelector(`[data-odznak="${nazev}"]`);
  if (!el || pocet === null || pocet === undefined) return;
  el.textContent = pocet;
  el.hidden = false;
}

/** Odznak Blíží se expirace = počet záznamů v červeném pásmu + expirovaných (z dat v zařízení + fronty). */
async function spocitejBliziSe(koren, podnik, aktualni) {
  const zaklad = await nactiZaklad(podnik);
  if (!zaklad?.zaznamy || !aktualni()) return;
  const n = zaklad.nastaveni || {};
  const pocet = (await zaznamySFrontou(zaklad)).filter((z) => ['r', 'x'].includes(pasmo(z.expirace, n))).length;
  if (aktualni()) nastavOdznak(koren, 'blizi', pocet);
}

/** Počet dnes započtených lokací: hned poslední známý, pak ze serveru; plus co čeká ve frontě. */
async function obnovDnes(koren, podnik, relace, aktualni) {
  const vypis = async (pocet) => {
    if (!aktualni()) return;
    const dnes = new Date().toDateString();
    const cekajici = new Set((await cekajiciDavky())
      .filter((p) => p.autor === relace.jmeno && p.data.podnik === podnik && new Date(p.data.cas).toDateString() === dnes)
      .map((p) => p.data.lokace.toUpperCase()));
    const zaklad = await nactiZaklad(podnik);
    const cil = zaklad?.nastaveni?.cil_kontrol_tyden;
    if (!aktualni()) return;
    koren.querySelector('#infoDnes').innerHTML = `Zkontrolované lokace dnes: <b>${pocet ?? '–'}</b>${cil ? ` · cíl týdne ${esc(cil)}` : ''}
      ${cekajici.size ? `<div class="hint">Čeká na odeslání: ${cekajici.size} ${cekajici.size === 1 ? 'lokace' : 'lokací'}</div>` : ''}
      <div class="hint">Tatáž lokace se za den počítá jen jednou.</div>`;
  };
  await vypis(dnesZapocteno(relace.jmeno, podnik));
  nastavOdznak(koren, 'ukoly', ulozeneUkoly(relace.jmeno, podnik)?.ukoly.length);
  spocitejBliziSe(koren, podnik, aktualni);
  try {
    const { zapocteno, ukoly } = await volej('kontroly.dnes', { podnik });
    ulozDnesZapocteno(relace.jmeno, podnik, zapocteno);
    await vypis(zapocteno);
    if (aktualni()) nastavOdznak(koren, 'ukoly', ukoly);
  } catch {
    // Bez signálu zůstanou poslední známé počty.
  }
}

/** Ukáže data z cache a podle potřeby je stáhne znovu ze serveru. */
async function obnovData(koren, podnik, relace, aktualni, vynutit) {
  const cache = await nactiZaklad(podnik);
  if (cache && aktualni()) vypisInfo(koren, podnik, relace, aktualni, cache, '');

  const zastarale = !cache
    || !cache.zaznamy
    || new Date(cache.stazeno) < new Date(relace.prihlaseno)
    || Date.now() - new Date(cache.stazeno) > OBNOVA_MS;
  if (!vynutit && !zastarale) return;

  try {
    const zaklad = await volej('data.zaklad', { podnik });
    await ulozZaklad(zaklad);
    if (aktualni()) vypisInfo(koren, podnik, relace, aktualni, zaklad, '');
    spocitejBliziSe(koren, podnik, aktualni);
  } catch (e) {
    if (e.kod === 'TOKEN' || !aktualni()) return;
    vypisInfo(koren, podnik, relace, aktualni, cache, e.message);
  }
}

function vypisInfo(koren, podnik, relace, aktualni, zaklad, chyba) {
  const el = koren.querySelector('#infoData');
  const n = zaklad?.nastaveni || {};
  el.innerHTML = (zaklad ? `Číselník: <b>${zaklad.polozky.length}</b> položek · lokací: <b>${zaklad.lokace.length}</b>
      · na lokacích: <b>${zaklad.zaznamy?.length ?? '?'}</b> záznamů
      <div class="hint">Pásma: červená ≤ ${esc(n.hranice_cervena ?? '?')} dní, žlutá ≤ ${esc(n.hranice_zluta ?? '?')} dní</div>
      <div class="hint">Staženo ${esc(formatCas(zaklad.stazeno))}${chyba ? ' (starší data z tohoto zařízení)' : ''}</div>`
    : '<span class="hint">Data podniku zatím nejsou stažená.</span>')
    + (chyba ? `<div class="chyba">${esc(chyba)}</div>` : '')
    + '<button class="odkaz" data-obnovit>Stáhnout znovu</button>';
  el.querySelector('[data-obnovit]').addEventListener('click', () => {
    el.innerHTML = '<span class="hint">Stahuji…</span>';
    obnovData(koren, podnik, relace, aktualni, true);
  });
}

function formatCas(iso) {
  return new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: 'numeric', minute: '2-digit' });
}
