// Řízení – Záznamy (kap. 6.3): tabulka s hledáním (lokace, EAN, číslo, název), filtry (pásmo, stav), řazením,
// export do Excelu (.xlsx) s aktuálním filtrem a export logu kontrol za období.
import { volej } from '../api.js';
import { pasmo, zbyvaDni } from '../expirace.js';
import { cislo, datumCas, napojPrepinacPodniku, overOpravneni, pcRam, prepinacPodniku } from '../pc.js';
import { podnikPodleKodu } from '../podniky.js';
import { esc, toast } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';
import { stahniXlsx, textChyby } from '../xlsx.js';

const HASH = '#/pc/zaznamy';
const STRANKA = 300;
const NAZVY_PASEM = { x: 'Expirováno', r: 'Expiruje brzy', y: 'Pozor', g: 'OK', k: 'Bez expirace' };
const STAVY = ['Na lokaci', 'Není na lokaci', 'Vydáno', 'Zlikvidováno'];
const SLOUPCE = [
  ['lokace', 'Lokace'], ['nazev', 'Zboží'], ['expirace', 'Expirace'], ['zbyva', 'Zbývá dní'], ['pocet_ks', 'Ks'],
  ['stav', 'Stav'], ['overeno', 'Ověřeno'], ['naskladneno', 'Naskladněno'], ['poznamka', 'Poznámka']
];

// Filtry se pamatují při přepínání obrazovek (ne po zavření aplikace).
const filtr = { hledat: '', pasmo: '', stav: 'Na lokaci', razeni: 'zbyva', sestupne: false, zobrazeno: STRANKA };
let vykresleni = 0;
let data = null;

export async function zobrazPcZaznamy(koren, relace) {
  if (!overOpravneni(koren, relace, 'zaznamy', 'Záznamy')) return;
  const cisloVykresleni = ++vykresleni;
  const podnik = zvolenyPodnik();
  const nazev = podnikPodleKodu(podnik)?.nazev || podnik;
  const dnes = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  pcRam(koren, relace, 'zaznamy', `${prepinacPodniku(podnik)}
    <h1>Záznamy – ${esc(nazev)}</h1>
    <div class="sub">Zboží s expirací evidované na lokacích. Hledání a filtry se použijí i na export do Excelu.</div>
    <div class="panel filtry-pc">
      <input id="zHledat" type="search" placeholder="Hledat lokaci, EAN, číslo nebo název" value="${esc(filtr.hledat)}">
      <select id="zPasmo"><option value="">Všechna pásma</option>${Object.entries(NAZVY_PASEM).map(([k, n]) =>
        `<option value="${k}"${filtr.pasmo === k ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <select id="zStav"><option value="">Všechny stavy</option>${STAVY.map((s) =>
        `<option${filtr.stav === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
      <button class="btn" data-export disabled>⬇ Excel</button>
    </div>
    <div id="zObsah"><p class="hint">Načítám záznamy…</p></div>
    <div class="panel"><h2>Log kontrol za období</h2>
      <div class="filtry-pc"><label>od <input id="lOd" type="date" value="${iso(new Date(dnes.getFullYear(), dnes.getMonth(), 1))}"></label>
        <label>do <input id="lDo" type="date" value="${iso(dnes)}"></label>
        <button class="btn sec" data-log>⬇ Stáhnout log (.xlsx)</button></div>
      <div class="hint">Všechny akce (kontroly, změny, Vydáno / Zlikvidováno, uzavření importem) s časem a jménem; nejvýš 366 dní.</div></div>`, podnik);
  napojPrepinacPodniku(koren, () => zobrazPcZaznamy(koren, relace));
  koren.querySelector('[data-log]').addEventListener('click', (e) => stahniLog(e.currentTarget, podnik, nazev,
    koren.querySelector('#lOd').value, koren.querySelector('#lDo').value));

  try {
    data = await volej('zaznamy.seznam', { podnik }, { timeout: 90000 });
  } catch (e) {
    if (e.kod === 'TOKEN' || cisloVykresleni !== vykresleni) return;
    koren.querySelector('#zObsah').innerHTML = `<div class="chyba">${esc(e.message)}</div>`;
    return;
  }
  if (cisloVykresleni !== vykresleni || location.hash !== HASH) return;
  data.zaznamy.forEach((z) => {
    z.zbyva = zbyvaDni(z.expirace);
    z.pasmo = z.stav === 'Na lokaci' ? pasmo(z.expirace, data.nastaveni) : 'k';
    z._hledat = [z.lokace, z.ean, z.cislo_polozky, z.nazev].join(' ').toLowerCase();
  });

  const prekresli = () => vypisTabulku(koren);
  const zmena = () => {
    filtr.hledat = koren.querySelector('#zHledat').value;
    filtr.pasmo = koren.querySelector('#zPasmo').value;
    filtr.stav = koren.querySelector('#zStav').value;
    filtr.zobrazeno = STRANKA;
    prekresli();
  };
  let casovac;
  koren.querySelector('#zHledat').addEventListener('input', () => {
    clearTimeout(casovac);
    casovac = setTimeout(zmena, 200);
  });
  koren.querySelector('#zPasmo').addEventListener('change', zmena);
  koren.querySelector('#zStav').addEventListener('change', zmena);
  const tlacitko = koren.querySelector('[data-export]');
  tlacitko.disabled = false;
  tlacitko.addEventListener('click', () => exportuj(tlacitko, nazev));
  prekresli();
}

function vyfiltrovane() {
  const hledat = filtr.hledat.trim().toLowerCase().split(/\s+/).filter(String);
  const radky = data.zaznamy.filter((z) => (!filtr.stav || z.stav === filtr.stav)
    && (!filtr.pasmo || z.pasmo === filtr.pasmo)
    && hledat.every((h) => z._hledat.includes(h)));
  const k = filtr.razeni;
  const smer = filtr.sestupne ? -1 : 1;
  const hodnota = (z) => (k === 'expirace' ? z.zbyva : z[k]);
  return radky.sort((a, b) => {
    const va = hodnota(a);
    const vb = hodnota(b);
    if (va === vb) return a.lokace.localeCompare(b.lokace, 'cs', { numeric: true });
    if (va === null || va === undefined || va === '') return 1;
    if (vb === null || vb === undefined || vb === '') return -1;
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'cs', { numeric: true })) * smer;
  });
}

function vypisTabulku(koren) {
  const radky = vyfiltrovane();
  const ukazat = radky.slice(0, filtr.zobrazeno);
  const sipka = (k) => (filtr.razeni === k ? (filtr.sestupne ? ' ▼' : ' ▲') : '');
  koren.querySelector('[data-export]').textContent = `⬇ Excel (${cislo(radky.length)})`;
  koren.querySelector('#zObsah').innerHTML = `<div class="panel">
    <div class="hint mb">Zobrazeno ${cislo(ukazat.length)} z ${cislo(radky.length)} (celkem v podniku ${cislo(data.zaznamy.length)}) · načteno ${datumCas(data.nacteno)}</div>
    <div class="tblw"><table class="zaznamy">
      <tr>${SLOUPCE.map(([k, n]) => `<th class="razeni" data-razeni="${k}">${n}${sipka(k)}</th>`).join('')}</tr>
      ${ukazat.length ? ukazat.map(radek).join('') : `<tr><td colspan="${SLOUPCE.length}" class="hint">Nic neodpovídá filtru.</td></tr>`}
    </table></div>
    ${radky.length > ukazat.length ? `<button class="btn sec mt" data-dalsi>Zobrazit dalších ${Math.min(STRANKA, radky.length - ukazat.length)}</button>` : ''}
  </div>`;
  koren.querySelectorAll('[data-razeni]').forEach((th) => th.addEventListener('click', () => {
    if (filtr.razeni === th.dataset.razeni) filtr.sestupne = !filtr.sestupne;
    else {
      filtr.razeni = th.dataset.razeni;
      filtr.sestupne = false;
    }
    vypisTabulku(koren);
  }));
  koren.querySelector('[data-dalsi]')?.addEventListener('click', () => {
    filtr.zobrazeno += STRANKA;
    vypisTabulku(koren);
  });
}

function radek(z) {
  return `<tr>
    <td><b>${esc(z.lokace)}</b></td>
    <td class="sirsi">${esc(z.nazev || 'Položka ' + z.cislo_polozky)}${z.k_doplneni ? ' <span class="pill k">k doplnění</span>' : ''}
      <div class="hint">EAN ${esc(z.ean)} · č. ${esc(z.cislo_polozky)}</div></td>
    <td>${esc(z.expirace)}</td>
    <td class="num">${z.zbyva ?? '–'}${z.stav === 'Na lokaci' && z.pasmo !== 'k' ? ` <span class="pill ${z.pasmo}">${NAZVY_PASEM[z.pasmo]}</span>` : ''}</td>
    <td class="num">${z.pocet_ks ?? ''}</td>
    <td>${esc(z.stav)}${z.zmenil && z.stav !== 'Na lokaci' ? `<div class="hint">${esc(z.zmenil)} · ${datumCas(z.zmeneno, true)}</div>` : ''}</td>
    <td>${datumCas(z.overeno, true)}<div class="hint">${esc(z.overil)}</div></td>
    <td>${z.naskladneno ? datumCas(z.naskladneno, true) : ''}</td>
    <td>${esc(z.poznamka)}${z.foto_url ? ` <a href="${esc(z.foto_url)}" target="_blank" rel="noopener">📷</a>` : ''}</td>
  </tr>`;
}

const datum = (iso) => (iso ? new Date(iso) : null);
const nazevSouboru = (zaklad, podnik) => `${zaklad}-${podnik.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;

async function exportuj(tlacitko, podnik) {
  const radky = vyfiltrovane();
  if (!radky.length) return toast('Filtru neodpovídá žádný záznam.');
  tlacitko.disabled = true;
  try {
    await stahniXlsx(nazevSouboru('zaznamy', podnik), [{
      nazev: 'Záznamy',
      hlavicka: ['Lokace', 'Číslo položky', 'Název', 'EAN', 'Expirace', 'Zbývá dní', 'Pásmo', 'Ks', 'Stav', 'Ověřil', 'Ověřeno',
        'Změnil', 'Změněno', 'Založil', 'Založeno', 'Naskladněno', 'Poznámka', 'Fotka', 'K doplnění'],
      sirky: [14, 14, 36, 15, 9, 9, 13, 6, 14, 16, 16, 16, 16, 16, 16, 16, 30, 20, 10],
      radky: radky.map((z) => [z.lokace, z.cislo_polozky, z.nazev, z.ean, z.expirace, z.zbyva, z.stav === 'Na lokaci' ? NAZVY_PASEM[z.pasmo] : '',
        z.pocet_ks, z.stav, z.overil, datum(z.overeno), z.zmenil, datum(z.zmeneno), z.zalozil, datum(z.zalozeno), datum(z.naskladneno),
        z.poznamka, z.foto_url, z.k_doplneni ? 'ano' : ''])
    }]);
  } catch (e) {
    toast(textChyby(e));
  } finally {
    tlacitko.disabled = false;
  }
}

async function stahniLog(tlacitko, podnik, nazev, od, doDne) {
  if (!od || !doDne) return toast('Vyber období od – do.');
  tlacitko.disabled = true;
  tlacitko.textContent = 'Stahuji…';
  try {
    const log = await volej('kontroly.log', { podnik, od, do: doDne }, { timeout: 90000 });
    if (!log.radky.length) {
      toast('Za vybrané období nejsou žádné záznamy v logu.');
      return;
    }
    await stahniXlsx(`log-kontrol-${nazev.replace(/\s+/g, '-')}-${od}-${doDne}.xlsx`, [{
      nazev: 'Log kontrol',
      hlavicka: ['Čas', 'Kdo', 'Lokace', 'Akce', 'Číslo položky', 'Název', 'EAN', 'Expirace', 'Ks', 'Poznámka', 'Započteno', 'Úkol'],
      sirky: [17, 16, 14, 18, 14, 36, 15, 9, 6, 40, 10, 14],
      radky: log.radky.map((r) => [new Date(r.cas), r.uzivatel, r.lokace, r.akce, r.cislo_polozky, r.nazev, r.ean, r.expirace,
        r.pocet_ks, r.poznamka, r.zapocteno ? 'ano' : '', r.id_ukolu])
    }]);
    toast(`Log stažen (${cislo(log.radky.length)} řádků).`);
  } catch (e) {
    if (e.kod !== 'TOKEN') toast(textChyby(e));
  } finally {
    tlacitko.disabled = false;
    tlacitko.textContent = '⬇ Stáhnout log (.xlsx)';
  }
}
