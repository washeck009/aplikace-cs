// Expirace – Blíží se expirace (čtečka): záznamy „Na lokaci“ podle zbývajících dní, filtry podle pásma,
// akce Na lokaci (otevře kontrolu) / Vydáno / Zlikvidováno (přes offline frontu, zapíše se do logu s kým a kdy).
import { volej } from '../api.js';
import { ma } from '../opravneni.js';
import { nactiZaklad, ulozZaklad } from '../db.js';
import { kratkeDatum, nazevZbozi, pasmo, stitekPasma, zbyvaDni } from '../expirace.js';
import { pridejDoFronty, zaznamySFrontou } from '../fronta.js';
import { PODNIKY } from '../podniky.js';
import { pripravSkener } from '../skener.js';
import { dialog, esc, hlavicka, napojHlavicku, prejdi, toast } from '../ui.js';
import { ulozPodnik, zvolenyPodnik } from '../uloziste.js';
import { noveId } from '../zaznamy.js';
import { otevriLokaciPriVstupu } from './kontrola-lokace.js';

const HASH = '#/expirace/blizi';
const FILTRY = [['rx', 'Červené + expirované'], ['y', 'Žluté'], ['vse', 'Vše']];
const MAX_RADKU = 200;
const OBNOVA_MS = 30 * 60 * 1000;

let filtr = 'rx';
let vykresleni = 0;

export async function zobrazBliziSe(koren, relace) {
  const podnik = zvolenyPodnik();
  const cislo = ++vykresleni;
  const aktualni = () => cislo === vykresleni && location.hash === HASH;

  let zaklad = await nactiZaklad(podnik);
  if (aktualni()) await vykresli(koren, relace, zaklad, '');

  // Starší data (nebo žádná) stáhnout znovu – Na lokaci a Vydáno se mají rozhodovat nad čerstvým stavem.
  if (!zaklad || !zaklad.zaznamy || Date.now() - new Date(zaklad.stazeno) > OBNOVA_MS
      || new Date(zaklad.stazeno) < new Date(relace.prihlaseno)) {
    try {
      zaklad = await volej('data.zaklad', { podnik });
      await ulozZaklad(zaklad);
      if (aktualni()) await vykresli(koren, relace, zaklad, '');
    } catch (e) {
      if (e.kod !== 'TOKEN' && aktualni()) await vykresli(koren, relace, zaklad, e.kod === 'SIT' ? 'Bez signálu – data uložená v zařízení.' : e.message);
    }
  }
}

async function vykresli(koren, relace, zaklad, zprava) {
  const podnik = zvolenyPodnik();
  const n = zaklad?.nastaveni || {};
  const vse = zaklad ? await zaznamySFrontou(zaklad) : [];
  const vybrane = vse
    .filter((z) => {
      const p = pasmo(z.expirace, n);
      return filtr === 'vse' || (filtr === 'rx' ? p === 'r' || p === 'x' : p === filtr);
    })
    .sort((a, b) => (zbyvaDni(a.expirace) ?? 1e9) - (zbyvaDni(b.expirace) ?? 1e9) || a.lokace.localeCompare(b.lokace));
  const nazevPodniku = PODNIKY.find((p) => p.kod === podnik)?.nazev || podnik;

  koren.innerHTML = hlavicka('Blíží se expirace', { zpet: '#/expirace', podnik }) + `<main class="ph-body">
    <div class="seg">${PODNIKY.map((p) =>
      `<button data-podnik="${p.kod}" class="${p.kod === podnik ? 'on' : ''}">${esc(p.nazev)}</button>`).join('')}</div>
    <div class="chips filtry">${FILTRY.map(([k, t]) =>
      `<button class="chip${filtr === k ? ' on' : ''}" data-filtr="${k}">${t}</button>`).join('')}</div>
    <div class="hint mb">Pásma ${esc(nazevPodniku)}: červená ≤ ${esc(n.hranice_cervena ?? '?')} dní, žlutá ≤ ${esc(n.hranice_zluta ?? '?')} dní.
      Záznamů: ${vybrane.length}.</div>
    ${zprava ? `<div class="upozorneni">${esc(zprava)}</div>` : ''}
    ${!zaklad ? '<p class="hint">Data podniku nejsou stažená.</p>'
      : vybrane.length ? vybrane.slice(0, MAX_RADKU).map((z) => karta(z, zaklad, n)).join('')
        + (vybrane.length > MAX_RADKU ? `<p class="hint">Zobrazeno prvních ${MAX_RADKU} z ${vybrane.length}.</p>` : '')
        : '<p class="hint">Nic.</p>'}
  </main>`;

  napojHlavicku(koren);
  koren.querySelectorAll('[data-podnik]').forEach((b) => b.addEventListener('click', () => {
    ulozPodnik(b.dataset.podnik);
    zobrazBliziSe(koren, relace);
  }));
  koren.querySelectorAll('[data-filtr]').forEach((b) => b.addEventListener('click', async () => {
    filtr = b.dataset.filtr;
    await vykresli(koren, relace, zaklad, zprava);
  }));
  koren.querySelectorAll('[data-na-lokaci]').forEach((b) => b.addEventListener('click', () => {
    otevriLokaciPriVstupu(b.dataset.naLokaci);
    pripravSkener(); // fokus do skenovacího pole v klepnutí (pravidla skenování v CLAUDE.md)
    prejdi('#/expirace/kontrola');
  }));
  koren.querySelectorAll('[data-stav]').forEach((b) => b.addEventListener('click', async () => {
    const z = vse.find((x) => x.id === b.closest('.rec').dataset.id);
    const stav = b.dataset.stav;
    const ano = await dialog({
      titulek: `Označit jako ${stav}?`,
      text: `${nazevZbozi(z, zaklad)} · ${z.lokace} · exp. ${z.expirace}. Záznam zmizí z lokace, zapíše se tvé jméno a čas.`,
      tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'sec' }, { text: stav, hodnota: true, trida: stav === 'Vydáno' ? '' : 'red' }]
    });
    if (!ano) return;
    try {
      await pridejDoFronty([{
        typ: 'stav',
        data: { id_akce: noveId(24), podnik, id: z.id, stav, lokace: z.lokace, cas: new Date().toISOString() }
      }]);
    } catch {
      toast('Změnu se nepodařilo uložit do zařízení – zkus to znovu.');
      return;
    }
    toast(`${stav} – uloženo (${relace.jmeno}).`);
    if (location.hash === HASH) await vykresli(koren, relace, zaklad, zprava);
  }));
}

function karta(z, zaklad, n) {
  const ks = z.pocet_ks !== null && z.pocet_ks !== undefined && z.pocet_ks !== '' ? ` · ${esc(z.pocet_ks)} ks` : '';
  const pred = z.overeno ? Math.round((Date.now() - new Date(z.overeno)) / 864e5) : null;
  return `<div class="rec ${pasmo(z.expirace, n)}" data-id="${esc(z.id)}">
    <div class="nm">${esc(nazevZbozi(z, zaklad))}</div>
    <div class="mt"><b>${esc(z.lokace)}</b> · exp. <b>${esc(z.expirace)}</b> · ${stitekPasma(z.expirace, n)}${ks}</div>
    <div class="mt">Ověřeno ${esc(kratkeDatum(z.overeno))}${pred !== null ? ` (před ${pred} dny)` : ''}${z.overil ? ` · ${esc(z.overil)}` : ''}</div>
    <div class="acts">
      ${ma('kontrola') ? `<button data-na-lokaci="${esc(z.lokace)}">➜ Na lokaci</button>` : ''}
      ${ma('vydano') ? '<button data-stav="Vydáno">Vydáno</button><button data-stav="Zlikvidováno">Zlikvidováno</button>' : ''}
    </div>
  </div>`;
}
