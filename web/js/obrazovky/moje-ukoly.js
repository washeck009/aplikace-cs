// Expirace – Moje úkoly (čtečka): úkoly pro mě a pro „kdokoliv“ ve zvoleném podniku, lokace podle trasy,
// průběh x z y; Začít / pokračovat otevře kontrolu s nabídkou zbývajících lokací.
import { volej } from '../api.js';
import { ma } from '../opravneni.js';
import { cekajiciDavky } from '../fronta.js';
import { PODNIKY } from '../podniky.js';
import { pripravSkener } from '../skener.js';
import { esc, hlavicka, napojHlavicku, prejdi } from '../ui.js';
import { ulozeneUkoly, ulozPodnik, ulozUkoly, zvolenyPodnik } from '../uloziste.js';
import { zacniUkol } from './kontrola-lokace.js';

let vykresleni = 0;

export async function zobrazMojeUkoly(koren, relace) {
  const podnik = zvolenyPodnik();
  const cislo = ++vykresleni;
  const aktualni = () => cislo === vykresleni && location.hash === '#/expirace/ukoly';

  const vykresliSeznam = async (data, zprava) => {
    const ukoly = await sFrontou(data?.ukoly, podnik);
    if (!aktualni()) return;
    koren.innerHTML = hlavicka('Moje úkoly', { zpet: '#/expirace', podnik }) + `<main class="ph-body">
      <div class="seg">${PODNIKY.map((p) =>
        `<button data-podnik="${p.kod}" class="${p.kod === podnik ? 'on' : ''}">${esc(p.nazev)}</button>`).join('')}</div>
      ${zprava ? `<div class="upozorneni">${esc(zprava)}</div>` : ''}
      ${!data ? '<p class="hint">Načítám úkoly…</p>'
        : ukoly.length ? ukoly.map(kartaUkolu).join('') : '<p class="hint">Žádné otevřené úkoly. 👍</p>'}
    </main>`;
    napojHlavicku(koren);
    koren.querySelectorAll('[data-podnik]').forEach((b) => b.addEventListener('click', () => {
      ulozPodnik(b.dataset.podnik);
      zobrazMojeUkoly(koren, relace);
    }));
    koren.querySelectorAll('[data-zacit]').forEach((b) => b.addEventListener('click', () => {
      zacniUkol(ukoly.find((u) => u.id === b.dataset.zacit));
      // Skenovací pole ukázat a zaměřit hned v klepnutí (pravidla skenování v CLAUDE.md).
      pripravSkener();
      prejdi('#/expirace/kontrola');
    }));
  };

  const ulozene = ulozeneUkoly(relace.jmeno, podnik);
  await vykresliSeznam(ulozene, '');
  try {
    const data = await volej('ukoly.moje', { podnik });
    ulozUkoly(relace.jmeno, podnik, data.ukoly, data.nacteno);
    await vykresliSeznam(data, '');
  } catch (e) {
    if (e.kod === 'TOKEN' || !aktualni()) return;
    await vykresliSeznam(ulozene || { ukoly: [] }, e.kod === 'SIT'
      ? `Bez signálu – úkoly z ${ulozene ? new Date(ulozene.nacteno).toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit' }) : '–'}.`
      : e.message);
  }
}

/** Lokace dokončené v dávkách, které ještě čekají na odeslání, se v úkolech ukážou jako hotové. */
async function sFrontou(ukoly, podnik) {
  if (!ukoly) return [];
  const davky = (await cekajiciDavky()).filter((p) => p.data.podnik === podnik);
  return ukoly.map((u) => {
    const hotove = new Set(u.hotove);
    davky.forEach((p) => {
      const kod = p.data.lokace.toUpperCase();
      if (u.lokace.includes(kod) && (!u.zadano || p.data.cas >= u.zadano)) hotove.add(kod);
    });
    return { ...u, hotove: [...hotove] };
  });
}

function kartaUkolu(u) {
  const hotovo = u.lokace.filter((k) => u.hotove.includes(k)).length;
  const vse = hotovo === u.lokace.length;
  const termin = u.termin ? new Date(u.termin + 'T00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }) : 'bez termínu';
  return `<div class="task${vse ? ' done' : ''}">
    <div class="radek-mezi"><b>${esc(u.popis)}</b><span class="pill ${u.typ === 'plánovač' ? 'k' : 'y'}">${esc(u.typ)}</span></div>
    <div class="hint">Zadal: ${esc(u.zadal)} · pro: ${esc(u.komu)} · termín ${esc(termin)}</div>
    ${u.polozka ? `<div class="hint">Jen zboží: ${esc(u.polozka)}</div>` : ''}
    <div class="hint lokace-ukolu">Lokace (podle trasy): ${u.lokace.map((k) =>
      u.hotove.includes(k) ? `<s>${esc(k)}</s>` : `<b>${esc(k)}</b>`).join(', ')}</div>
    <div class="prog"><i style="width:${(100 * hotovo) / u.lokace.length}%"></i></div>
    <div class="hint">${hotovo} z ${u.lokace.length} lokací</div>
    ${vse ? '<div class="hint">✔ Hotovo – čeká na odeslání</div>'
      : !ma('kontrola') ? '<div class="hint">Kontrolu lokací nemáš povolenou.</div>'
        : `<button class="btn block mt" data-zacit="${esc(u.id)}">${hotovo ? 'Pokračovat' : 'Začít'}</button>`}
  </div>`;
}
