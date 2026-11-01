// Řízení – Přehled podniku (kap. 6.1): KPI, mapa pokrytí, kontroly po lidech a týdnech proti cíli, zboží podle pásem
// + trend, FEFO upozornění, plnění úkolů. Vše spočítá server jednou akcí prehled.data (krátce drží v cache).
import { volej } from '../api.js';
import { cislo, datumCas, napojPrepinacPodniku, overOpravneni, pcRam, prepinacPodniku } from '../pc.js';
import { podnikPodleKodu } from '../podniky.js';
import { esc } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';

const HASH = '#/pc/prehled';
const NAZVY_PASEM = { x: 'Expirováno (na lokaci)', r: 'Expiruje brzy', y: 'Pozor', g: 'OK', k: 'Bez platné expirace' };
let vykresleni = 0;

export async function zobrazPcPrehled(koren, relace, { obnovit = false } = {}) {
  if (!overOpravneni(koren, relace, 'prehled', 'Přehled')) return;
  const cisloVykresleni = ++vykresleni;
  const podnik = zvolenyPodnik();
  const nazev = podnikPodleKodu(podnik)?.nazev || podnik;
  pcRam(koren, relace, 'prehled', `${prepinacPodniku(podnik)}
    <div class="radek-mezi"><h1>Přehled – ${esc(nazev)}</h1><button class="chip" data-obnovit>↻ Obnovit</button></div>
    <div class="sub" id="pSpocteno">Počítám…</div>
    <div id="pObsah"><p class="hint">Načítám přehled… (u velkého skladu to může trvat i 20 s)</p></div>`, podnik);
  const znovu = (o) => zobrazPcPrehled(koren, relace, o);
  napojPrepinacPodniku(koren, () => znovu());
  koren.querySelector('[data-obnovit]').addEventListener('click', () => znovu({ obnovit: true }));

  let p;
  try {
    p = await volej('prehled.data', { podnik, obnovit }, { timeout: 120000 });
  } catch (e) {
    if (e.kod === 'TOKEN' || cisloVykresleni !== vykresleni) return;
    koren.querySelector('#pObsah').innerHTML = `<div class="chyba">${esc(e.message)}</div>`;
    return;
  }
  if (cisloVykresleni !== vykresleni || location.hash !== HASH) return;
  koren.querySelector('#pSpocteno').textContent = `Spočteno ${datumCas(p.spocteno)}${p.z_cache ? ' (uložený výpočet, nejvýš 5 minut starý)' : ''}`
    + (p.import_stavu ? ` · poslední import stavu lokací ${datumCas(p.import_stavu.cas)} (stav k ${datumCas(p.import_stavu.k_datu)})` : ' · stav lokací zatím nebyl importován');
  koren.querySelector('#pObsah').innerHTML = kpi(p) + mapaPokryti(p)
    + `<div class="grid2">${kontrolyPoLidech(p)}${pasma(p)}</div>` + fefo(p);
}

const procento = (a, b) => (b ? Math.round((100 * a) / b) : 0);

function dlazdice(hodnota, popis, { pod = '', trida = '' } = {}) {
  return `<div class="kpi ${trida}"><div class="v">${hodnota}</div><div class="l">${popis}</div>${pod ? `<div class="l">${pod}</div>` : ''}</div>`;
}

function kpi(p) {
  const k = p.kpi;
  const cil = k.cil_tyden;
  return `<div class="kpis">
    ${dlazdice(procento(k.pokryti_30, k.lokaci) + ' %', 'Pokrytí lokací 30 dní', { pod: `${cislo(k.pokryti_30)} z ${cislo(k.lokaci)} lokací` })}
    ${dlazdice(procento(k.pokryti_90, k.lokaci) + ' %', 'Pokrytí lokací 90 dní', { pod: `${cislo(k.pokryti_90)} z ${cislo(k.lokaci)}` })}
    ${dlazdice(cislo(k.kontrol_tyden) + (cil ? ` / ${cislo(cil)}` : ''), 'Kontroly tento týden', {
      pod: cil ? `cíl ${procento(k.kontrol_tyden, cil)} %` : 'cíl není nastavený', trida: cil && k.kontrol_tyden < cil ? 'kpi-y' : '' })}
    ${dlazdice(cislo(k.cervenych), 'Záznamy v červeném pásmu', { trida: k.cervenych ? 'kpi-r' : '' })}
    ${dlazdice(cislo(k.expirovanych), 'Expirované a stále na lokaci', { trida: k.expirovanych ? 'kpi-x' : '' })}
    ${dlazdice(cislo(k.bez_kontroly), 'Zboží na skladě bez kontroly', { pod: `na ${cislo(k.bez_kontroly_lokaci)} lokacích (podle importu)` })}
    ${dlazdice(cislo(k.naskladneno_po_kontrole), 'Naskladněno po poslední kontrole', { pod: 'lokací (pravidlo d)' })}
    ${dlazdice(`${cislo(k.ukoly_hotovo)} / ${cislo(k.ukoly_lokaci)}`, 'Úkoly – hotové lokace', {
      pod: `${cislo(k.ukolu_otevrenych)} otevřených úkolů · ${procento(k.ukoly_hotovo, k.ukoly_lokaci)} %` })}
    ${dlazdice(cislo(k.k_doplneni), 'Položky k doplnění', { pod: 'neznámé EAN ze čtečky' })}
  </div>`;
}

/** Barva buňky podle dní od poslední kontroly (≤30, 31–60, 61–90, >90, nikdy). */
function tridaDni(dni) {
  if (dni === null) return 'h-n';
  if (dni <= 30) return 'h-1';
  if (dni <= 60) return 'h-2';
  if (dni <= 90) return 'h-3';
  return 'h-4';
}

function mapaPokryti(p) {
  if (!p.mapa.length) {
    return '<div class="panel"><h2>Mapa pokrytí</h2><p class="hint">Podnik zatím nemá žádné aktivní lokace H/P – naimportuj lokace nebo stav lokací.</p></div>';
  }
  const radky = p.mapa.map((s) => `<div class="heat-radek"><div class="heat-popis">${esc(s.hala)} · ${esc(s.rada)}</div><div class="heat-bunky">${
    s.bunky.map(([kod, dni]) => `<i class="${tridaDni(dni)}" title="${esc(kod)} – ${dni === null ? 'nikdy nekontrolováno'
      : dni === 0 ? 'kontrolováno dnes' : `před ${dni} ${dni === 1 ? 'dnem' : 'dny'}`}"></i>`).join('')}</div></div>`).join('');
  return `<div class="panel"><h2>Mapa pokrytí <span class="hint">(řádek = hala · řada, čtvereček = lokace; najetím myší detail)</span></h2>
    <div class="heat">${radky}</div>
    <div class="lgd"><span><i class="h-1"></i>≤ 30 dní</span><span><i class="h-2"></i>31–60</span><span><i class="h-3"></i>61–90</span>
      <span><i class="h-4"></i>&gt; 90</span><span><i class="h-n"></i>nikdy</span></div></div>`;
}

const kratkyTyden = (iso) => {
  const [r, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}.`;
};

function kontrolyPoLidech(p) {
  const cil = p.nastaveni.cil_kontrol_tyden;
  const hlavicka = p.tydny.map((t) => `<th class="num">${kratkyTyden(t)}</th>`).join('');
  const lide = p.lide.length ? p.lide.map((l) => `<tr><td>${esc(l.jmeno)}</td>${l.pocty.map((n) => `<td class="num">${n || ''}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${p.tydny.length + 1}" class="hint">Za posledních 8 týdnů žádné kontroly.</td></tr>`;
  const soucty = p.soucty.map((n) => `<td class="num${cil && n < cil ? ' pod-cilem' : ''}"><b>${n}</b></td>`).join('');
  return `<div class="panel"><h2>Kontroly po lidech a týdnech</h2>
    <div class="hint mb">Započtené kontroly (1 lokace za den na člověka), týden od pondělí${cil ? `; cíl ${cil} za týden` : ''}.</div>
    <div class="tblw"><table><tr><th>Kdo</th>${hlavicka}</tr>${lide}
      <tr class="soucet"><td><b>Celkem</b></td>${soucty}</tr>
      ${cil ? `<tr><td class="hint">Cíl</td>${p.tydny.map(() => `<td class="num hint">${cil}</td>`).join('')}</tr>` : ''}</table></div></div>`;
}

function pasma(p) {
  const celkem = Object.values(p.pasma).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(p.pasma));
  const sloupce = ['x', 'r', 'y', 'g', 'k'].map((k) => `<div class="pasmo-radek"><span class="pill ${k}">${NAZVY_PASEM[k]}</span>
    <div class="pasmo-pruh"><i class="b-${k}" style="width:${(100 * p.pasma[k]) / max}%"></i></div><b>${cislo(p.pasma[k])}</b></div>`).join('');
  const maxT = Math.max(1, ...p.trend.map((t) => t.r + t.x));
  const trend = p.trend.map((t, i) => `<div class="trend-sloupec" title="týden od ${kratkyTyden(p.tydny[i])}: ${t.r} v červeném pásmu, ${t.x} expirovaných">
    <div class="trend-hodnota">${t.r + t.x}</div>
    <div class="trend-bar"><i class="b-x" style="height:${(100 * t.x) / maxT}%"></i><i class="b-r" style="height:${(100 * t.r) / maxT}%"></i></div>
    <div class="trend-popis">${kratkyTyden(p.tydny[i])}</div></div>`).join('');
  return `<div class="panel"><h2>Zboží na lokacích podle pásem <span class="hint">(${cislo(celkem)} záznamů)</span></h2>${sloupce}
    <h2 class="mt">Trend: červené + expirované po týdnech</h2>
    <div class="trend">${trend}</div>
    <div class="hint">Odhad ze současných záznamů – stav na konci každého týdne.</div></div>`;
}

function fefo(p) {
  if (!p.fefo.length) {
    return '<div class="panel"><h2>FEFO – odkud vychystávat</h2><p class="hint">Žádná položka není na víc lokacích ani s víc expiracemi.</p></div>';
  }
  const radky = p.fefo.map((f) => `<div class="fefo">
    <div><b>${esc(f.nazev || 'Položka ' + f.cislo)}</b> <span class="hint">č. ${esc(f.cislo)} · ${f.lokaci} ${f.lokaci === 1 ? 'lokace' : f.lokaci < 5 ? 'lokace' : 'lokací'}, ${f.expiraci} ${f.expiraci === 1 ? 'expirace' : f.expiraci < 5 ? 'expirace' : 'expirací'}</span></div>
    <ol>${f.radky.map((r) => `<li><b>${esc(r.lokace)}</b> · <span class="pill ${r.pasmo}">${esc(r.expirace || 'bez expirace')}${r.zbyva !== null ? ` · ${r.zbyva} d` : ''}</span>
      ${r.ks !== null ? ` · ${cislo(r.ks)} ks` : ''}${r.naskladneno ? ` · <span class="hint">naskladněno ${datumCas(r.naskladneno, true)}</span>` : ''}</li>`).join('')}</ol></div>`).join('');
  return `<div class="panel"><h2>FEFO – odkud vychystávat <span class="hint">(nejdřív nejbližší expirace, při stejné expiraci dřív naskladněné${p.fefo_celkem > p.fefo.length ? `; prvních ${p.fefo.length} z ${p.fefo_celkem}` : ''})</span></h2>
    <div class="fefo-mrizka">${radky}</div></div>`;
}
