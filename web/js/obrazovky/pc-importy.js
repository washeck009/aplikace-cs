// Řízení – Importy z ERP (jen admin, kap. 6.4 a 7): číselník, lokace, stav na lokacích. Soubor xlsx / csv se čte
// v prohlížeči, sloupce se hledají podle názvů v hlavičce (bez ohledu na velikost písmen a háčky). Stav na lokacích
// (desítky tisíc řádků) se tu rovnou sečte za lokaci a položku a odfiltruje na lokace H/P a hlídané zboží – na server
// jde jen to. Každý import: náhled (nic se nezapíše) → Importovat.
import { volej } from '../api.js';
import { normalizujKod } from '../expirace.js';
import { cislo, datumCas, napojPrepinacPodniku, overRoli, pcRam, prepinacPodniku } from '../pc.js';
import { podnikPodleKodu } from '../podniky.js';
import { esc, toast } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';
import { hodnotaNaCislo, hodnotaNaDatum, hodnotaNaText, najdiSloupce, nactiSoubor, textChyby } from '../xlsx.js';

const HASH = '#/pc/importy';
const TIMEOUT_MS = 300000; // velký import stavu může na serveru běžet i minuty
// Stejně jako LOKACE_KONTROLOVANA na serveru: H nebo P a hned číslice (H1, P0…; ne PAL, PRIJEM).
const KONTROLOVANA = /^[HP]\d/;

// Sloupce podle názvů v hlavičce (normalizované: bez diakritiky, mezer a interpunkce, malými písmeny).
const SLOUPCE = {
  polozky: {
    ean: { nazvy: ['ean', 'ean13', 'carovykod', 'kodean'], povinny: true, popis: 'EAN' },
    cislo: { nazvy: ['cislopolozky', 'idpolozky', 'cislopol', 'cislo', 'polozka'], povinny: true, popis: 'Číslo položky' },
    nazev: { nazvy: ['nazevpolozky', 'polnazev', 'nazev', 'nazevzbozi'], popis: 'Název položky' }
  },
  lokace: {
    kod: { nazvy: ['lokace', 'umisteni', 'kodlokace', 'kod'], povinny: true, popis: 'LOKACE' }
  },
  stav: {
    lokace: { nazvy: ['umisteni', 'lokace'], povinny: true, popis: 'UMISTENI' },
    cislo: { nazvy: ['idpolozky', 'cislopolozky'], povinny: true, popis: 'ID_POLOZKY' },
    mnozstvi: { nazvy: ['mnozzaklmj', 'mnozstvi', 'mnoz'], povinny: true, popis: 'MNOZ_ZAKL_MJ' },
    datum: { nazvy: ['datum', 'naskladneno'], popis: 'DATUM' },
    mj: { nazvy: ['zaklmj', 'mj'], popis: 'ZAKL_MJ' },
    nazev: { nazvy: ['polnazev', 'nazevpolozky', 'nazev'], popis: 'POL_NAZEV' }
  }
};

const KARTY = [
  { typ: 'polozky', nazev: 'Číselník', popis: 'EAN, Číslo položky, Název položky. Nové EAN přidá, u existujících změní číslo / název, doplní položky „k doplnění“.' },
  { typ: 'lokace', nazev: 'Lokace', popis: 'Sloupec LOKACE (ostatní sloupce nejsou potřeba – rozklad se udělá z kódu). Jen lokace H/P; regálové aktivní, ostatní H/P neaktivní; BAL, RAMP, PRIJEM… se přeskočí.' },
  { typ: 'stav', nazev: 'Stav na lokacích', popis: 'Export DATUM, UMISTENI, ID_POLOZKY, POL_NAZEV, MNOZ_ZAKL_MJ, ZAKL_MJ. Uzavře zboží, které z lokace zmizelo, založí chybějící lokace H/P, uloží hlídané zboží pro plánovač a FEFO.' }
];

let vykresleni = 0;

export async function zobrazPcImporty(koren, relace) {
  if (!overRoli(koren, relace, 'importy', ['admin'], 'Importy')) return;
  const cisloVykresleni = ++vykresleni;
  const podnik = zvolenyPodnik();
  const nazev = podnikPodleKodu(podnik)?.nazev || podnik;
  pcRam(koren, relace, 'importy', `${prepinacPodniku(podnik)}
    <h1>Importy – ${esc(nazev)}</h1>
    <div class="sub">Import se vždy zapíše do zvoleného podniku (<b>${esc(nazev)}</b>) – Stachema a Stavebniny DEK mají oddělené exporty.
      Soubor se nejdřív jen zkontroluje (náhled), zapíše se až po potvrzení.</div>
    <div class="panel" id="iInfo"><span class="hint">Načítám stav…</span></div>
    <div class="grid3">${KARTY.map((k) => `<div class="panel import-karta" data-typ="${k.typ}">
      <h2>${k.nazev}</h2><div class="hint mb">${k.popis}</div>
      ${k.typ === 'polozky' ? '<label class="volba"><input type="checkbox" data-deaktivovat> položky, které v souboru nejsou, označit jako neaktivní</label>' : ''}
      ${k.typ === 'stav' ? '<div class="field"><label>Stav ke dni (čas exportu – zboží založené / ověřené později se neuzavře)</label><input type="datetime-local" data-kdatu></div>' : ''}
      <input type="file" accept=".xlsx,.xls,.csv,.txt" data-soubor>
    </div>`).join('')}</div>
    <div id="iNahled"></div>`, podnik);
  napojPrepinacPodniku(koren, () => zobrazPcImporty(koren, relace));
  const aktualni = () => cisloVykresleni === vykresleni && location.hash === HASH;

  let info = null;
  const nactiInfo = async () => {
    try {
      info = await volej('import.info', { podnik }, { timeout: 90000 });
    } catch (e) {
      if (e.kod !== 'TOKEN' && aktualni()) koren.querySelector('#iInfo').innerHTML = `<div class="chyba">${esc(e.message)}</div>`;
      return;
    }
    if (!aktualni()) return;
    const s = info.posledni_stav;
    koren.querySelector('#iInfo').innerHTML = `<div class="kpis kpis-male">
      <div class="kpi"><div class="v">${cislo(info.polozek)}</div><div class="l">položek v číselníku</div><div class="l">${cislo(info.k_doplneni)} k doplnění</div></div>
      <div class="kpi"><div class="v">${cislo(info.lokaci_aktivnich)}</div><div class="l">aktivních lokací H/P</div><div class="l">${cislo(info.lokaci)} lokací celkem</div></div>
      <div class="kpi"><div class="v">${s ? datumCas(s.k_datu, true) : '–'}</div><div class="l">poslední stav lokací</div>
        <div class="l">${s ? `nahrál ${esc(s.kdo)} ${datumCas(s.cas)} · ${cislo(s.hlidanych)} hlídaných, uzavřeno ${cislo(s.uzavreno)}` : 'zatím nenahrán'}</div></div>
    </div>`;
  };
  nactiInfo();

  koren.querySelectorAll('.import-karta').forEach((karta) => {
    const vstup = karta.querySelector('[data-soubor]');
    vstup.addEventListener('change', async () => {
      const soubor = vstup.files[0];
      if (!soubor) return;
      const kDatu = karta.querySelector('[data-kdatu]');
      if (kDatu && !kDatu.dataset.zmeneno) kDatu.value = proDatetimeLocal(new Date(soubor.lastModified));
      const nahled = koren.querySelector('#iNahled');
      try {
        if (karta.dataset.typ === 'stav' && !info) await nactiInfo();
        nahled.innerHTML = `<div class="panel"><p class="hint">Čtu soubor ${esc(soubor.name)}…</p></div>`;
        nahled.scrollIntoView({ behavior: 'smooth' });
        const radky = await nactiSoubor(soubor);
        const pozadavek = sestavPozadavek(karta.dataset.typ, radky, {
          podnik, info, deaktivovat: karta.querySelector('[data-deaktivovat]')?.checked, kDatu: kDatu?.value
        });
        nahled.innerHTML = `<div class="panel"><p class="hint">Kontroluji na serveru (${cislo(pozadavek.pocetRadku)} řádků)…</p></div>`;
        const v = await volej('import.' + karta.dataset.typ, pozadavek.data, { timeout: TIMEOUT_MS });
        if (!aktualni()) return;
        ukazNahled(nahled, karta.dataset.typ, soubor.name, nazev, v, pozadavek, async (tlacitko) => {
          tlacitko.disabled = true;
          tlacitko.textContent = 'Importuji…';
          try {
            const vysledek = await volej('import.' + karta.dataset.typ, { ...pozadavek.data, potvrdit: true }, { timeout: TIMEOUT_MS });
            ukazNahled(nahled, karta.dataset.typ, soubor.name, nazev, vysledek, pozadavek);
            toast('Import dokončen.');
            vstup.value = '';
            nactiInfo();
            info = null;
          } catch (e) {
            tlacitko.disabled = false;
            tlacitko.textContent = 'Importovat';
            toast(e.message);
          }
        }, () => {
          nahled.innerHTML = '';
          vstup.value = '';
        });
      } catch (e) {
        if (e.kod === 'TOKEN') return;
        nahled.innerHTML = `<div class="panel"><div class="chyba">${esc(textChyby(e))}</div></div>`;
        vstup.value = '';
      }
    });
    karta.querySelector('[data-kdatu]')?.addEventListener('change', (e) => { e.target.dataset.zmeneno = '1'; });
  });
}

const proDatetimeLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  + `T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Klíč čísla položky jako na serveru: číselné bez úvodních nul, jinak velkými písmeny. */
const klicCisla = (c) => {
  const t = String(c ?? '').trim().toUpperCase();
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t;
};

/** Z řádků souboru sestaví požadavek na server: {data, pocetRadku, mapovani}. */
function sestavPozadavek(typ, radky, { podnik, info, deaktivovat, kDatu }) {
  const { radek: iHlavicky, pozice } = najdiSloupce(radky, SLOUPCE[typ]);
  const hlavicka = radky[iHlavicky] || [];
  const mapovani = Object.entries(SLOUPCE[typ]).map(([k, s]) => [s.popis, k in pozice ? String(hlavicka[pozice[k]]) : '—']);
  const telo = radky.slice(iHlavicky + 1);
  const bunka = (r, k) => (k in pozice ? r[pozice[k]] : null);
  const prazdny = (r) => !r || r.every((v) => v === null || v === '');

  if (typ === 'polozky') {
    const data = [];
    telo.forEach((r, i) => {
      if (prazdny(r)) return;
      data.push([hodnotaNaText(bunka(r, 'ean')), hodnotaNaText(bunka(r, 'cislo')), hodnotaNaText(bunka(r, 'nazev')), iHlavicky + i + 2]);
    });
    return { data: { podnik, radky: data, deaktivovat: !!deaktivovat }, pocetRadku: data.length, mapovani };
  }

  if (typ === 'lokace') {
    const kody = [];
    telo.forEach((r, i) => {
      const kod = hodnotaNaText(bunka(r, 'kod'));
      if (kod) kody.push([kod, iHlavicky + i + 2]);
    });
    return { data: { podnik, kody }, pocetRadku: kody.length, mapovani };
  }

  // Stav na lokacích: sečíst za lokaci + položku (stejná položka bývá na lokaci ve víc řádcích – různé balení),
  // naskladněno = nejnovější DATUM. Na server jen lokace H/P a hlídané zboží.
  if (!kDatu) throw new Error('Vyplň „Stav ke dni“ – čas, kdy byl export z ERP udělaný.');
  const hlidana = new Set(info?.hlidana_cisla || []);
  const lokace = new Set();
  const souhrn = new Map();
  const stat = { radku: 0, preskoceno: 0, chybne: 0, nehlidanych: 0 };
  const chyby = [];
  telo.forEach((r, i) => {
    if (prazdny(r)) return;
    stat.radku++;
    const lok = normalizujKod(hodnotaNaText(bunka(r, 'lokace')));
    const cisloPolozky = hodnotaNaText(bunka(r, 'cislo'));
    const mnozstvi = hodnotaNaCislo(bunka(r, 'mnozstvi'));
    if (!lok || !cisloPolozky || mnozstvi === null) {
      stat.chybne++;
      if (chyby.length < 10) chyby.push(`řádek ${iHlavicky + i + 2}: ${!lok ? 'chybí UMISTENI' : !cisloPolozky ? 'chybí ID_POLOZKY' : 'neplatné množství'}`);
      return;
    }
    if (!KONTROLOVANA.test(lok)) {
      stat.preskoceno++;
      return;
    }
    lokace.add(lok);
    const k = klicCisla(cisloPolozky);
    if (!hlidana.has(k)) {
      stat.nehlidanych++;
      return;
    }
    const klic = lok + '|' + k;
    const datum = hodnotaNaDatum(bunka(r, 'datum'));
    const s = souhrn.get(klic) || { lok, cislo: cisloPolozky, mnozstvi: 0, datum: null, mj: hodnotaNaText(bunka(r, 'mj')), nazev: hodnotaNaText(bunka(r, 'nazev')) };
    s.mnozstvi += mnozstvi;
    if (datum && (!s.datum || datum > s.datum)) s.datum = datum;
    souhrn.set(klic, s);
  });
  const kDatuIso = new Date(kDatu).toISOString();
  return {
    data: {
      podnik, k_datu: kDatuIso, statistika: { radku: stat.radku, preskoceno: stat.preskoceno, chybne: stat.chybne },
      lokace: [...lokace],
      radky: [...souhrn.values()].map((s) => [s.lok, s.cislo, s.mnozstvi, s.datum ? s.datum.toISOString() : '', s.mj, s.nazev])
    },
    pocetRadku: stat.radku,
    mapovani,
    stat,
    chyby
  };
}

function radekSouhrnu(popis, hodnota, trida = '') {
  return `<tr class="${trida}"><td>${popis}</td><td class="num"><b>${hodnota}</b></td></tr>`;
}

function seznamChyb(v) {
  if (!v.chyb) return '';
  return `<details class="mt" open><summary class="chyba-text">Chybné řádky: ${cislo(v.chyb)} (do importu nepůjdou)</summary>
    <ul>${v.chyby.map((c) => `<li>${c.radek ? `řádek ${c.radek}: ` : ''}${esc(c.chyba)}</li>`).join('')}${v.chyb > v.chyby.length ? `<li>… a dalších ${v.chyb - v.chyby.length}</li>` : ''}</ul></details>`;
}

/** Náhled (v.provedeno = false) nebo výsledek importu. */
function ukazNahled(kam, typ, souborNazev, podnikNazev, v, pozadavek, potvrdit, zrusit) {
  const hotovo = !!v.provedeno;
  let souhrn = '';
  let detail = '';
  if (typ === 'polozky') {
    souhrn = radekSouhrnu('Řádků v souboru', cislo(v.radku))
      + radekSouhrnu('Nové položky', cislo(v.nove))
      + radekSouhrnu('Změněné (číslo / název / znovu aktivní)', cislo(v.zmenene))
      + radekSouhrnu('Doplněné položky „k doplnění“', cislo(v.doplnene))
      + radekSouhrnu('Beze změny', cislo(v.beze_zmeny))
      + (v.duplicit ? radekSouhrnu('Opakované řádky (přeskočeno)', cislo(v.duplicit)) : '')
      + (v.deaktivuje ? radekSouhrnu('Označí se jako neaktivní', cislo(v.deaktivuje), 'varovani') : '')
      + (v.zaznamu_upravi ? radekSouhrnu('Záznamy, které převezmou číslo položky', cislo(v.zaznamu_upravi)) : '');
    detail = (v.ean12 ? `<div class="upozorneni">${cislo(v.ean12)} EAN má 12 číslic – v Excelu mohl ztratit úvodní nulu
        (např. ${v.ean12_ukazka.map(esc).join(', ')}). Nevadí: čtečka je najde i se skenovanou nulou. Lepší je exportovat EAN jako text.</div>` : '')
      + (v.ukazka_novych.length ? `<details class="mt"><summary>Ukázka nových položek</summary><ul>${v.ukazka_novych.map(([e, c, n]) =>
        `<li>${esc(e)} · ${esc(c)} · ${esc(n)}</li>`).join('')}</ul></details>` : '');
  } else if (typ === 'lokace') {
    souhrn = radekSouhrnu('Lokací v souboru', cislo(v.radku))
      + radekSouhrnu('Nové lokace', `${cislo(v.nove)}${v.nove_neaktivni ? ` (z toho ${cislo(v.nove_neaktivni)} neaktivních)` : ''}`)
      + radekSouhrnu('Doplněné (rozklad, zrušené „k ověření“)', cislo(v.zmenene))
      + radekSouhrnu('Beze změny', cislo(v.beze_zmeny))
      + radekSouhrnu('Přeskočené (ne H/P)', `${cislo(v.preskoceno)}${v.preskoceno ? ' – ' + Object.entries(v.preskoceno_prefixy).map(([p, n]) => `${esc(p)} ${n}`).join(', ') : ''}`)
      + (v.vypne ? radekSouhrnu('Vypnou se lokace mimo H/P (už v listu)', cislo(v.vypne), 'varovani') : '')
      + radekSouhrnu('Lokace H/P v listu, které v souboru nejsou (nemění se)', cislo(v.nejsou_v_importu));
    detail = v.ukazka_novych.length ? `<details class="mt"><summary>Ukázka nových lokací</summary><ul>${v.ukazka_novych.map(([k, a]) =>
      `<li>${esc(k)}${a ? '' : ' <span class="pill k">neaktivní – není regálová</span>'}</li>`).join('')}</ul></details>` : '';
  } else {
    const s = pozadavek.stat;
    souhrn = radekSouhrnu('Řádků v souboru', cislo(v.radku))
      + radekSouhrnu('Přeskočené (lokace mimo H/P: BAL, RAMP, PRIJEM…)', cislo(v.preskoceno))
      + (s ? radekSouhrnu('Nehlídané zboží (není v číselníku)', cislo(s.nehlidanych)) : '')
      + (v.chybne ? radekSouhrnu('Chybné řádky', cislo(v.chybne), 'varovani') : '')
      + radekSouhrnu('Lokací H/P', cislo(v.lokaci))
      + radekSouhrnu('Hlídané zboží (lokace + položka)', cislo(v.hlidanych))
      + radekSouhrnu('Uzavře se (zboží z lokace zmizelo)', cislo(v.uzavre), v.uzavre ? 'varovani' : '')
      + radekSouhrnu('Nové lokace', `${cislo(v.nove_lokace)}${v.nove_lokace_neaktivni ? ` (${cislo(v.nove_lokace_neaktivni)} neaktivních)` : ''}`)
      + radekSouhrnu('Doplní se prázdné názvy v číselníku', cislo(v.doplni_nazvu))
      + radekSouhrnu('Zboží na skladě bez kontroly', `${cislo(v.bez_kontroly)} na ${cislo(v.bez_kontroly_lokaci)} lokacích`);
    detail = `<div class="hint mt">Stav ke dni: <b>${datumCas(v.k_datu)}</b>${v.minule ? ` · minulý import: stav k ${datumCas(v.minule.k_datu)}, ${cislo(v.minule.hlidanych)} hlídaných` : ''}</div>`
      + (pozadavek.chyby?.length ? `<details class="mt"><summary class="chyba-text">Chybné řádky (ukázka)</summary><ul>${pozadavek.chyby.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>` : '')
      + (v.uzavre_ukazka.length ? `<details class="mt"${hotovo ? '' : ' open'}><summary>Co se uzavře${v.uzavre > v.uzavre_ukazka.length ? ` (prvních ${v.uzavre_ukazka.length})` : ''}</summary>
        <ul>${v.uzavre_ukazka.map((z) => `<li><b>${esc(z.lokace)}</b> · ${esc(z.nazev || 'položka ' + z.cislo)} · č. ${esc(z.cislo)} · exp. ${esc(z.expirace)}</li>`).join('')}</ul></details>` : '');
  }
  const varovani = (v.varovani || []).map((t) => `<div class="upozorneni">⚠ ${esc(t)}</div>`).join('');
  kam.innerHTML = `<div class="panel nahled-importu${hotovo ? ' hotovo' : ''}">
    <h2>${hotovo ? '✔ Importováno' : 'Náhled importu'} – ${esc(KARTY.find((k) => k.typ === typ).nazev)} → ${esc(podnikNazev)}</h2>
    <div class="hint mb">Soubor ${esc(souborNazev)} · sloupce: ${pozadavek.mapovani.map(([co, kde]) => `${esc(co)} = <b>${esc(kde)}</b>`).join(', ')}</div>
    ${varovani}
    <table class="souhrn">${souhrn}</table>
    ${detail}${seznamChyb(v)}
    ${hotovo ? '' : `<div class="row mt"><button class="btn gry" data-zrusit>Zrušit</button><button class="btn" data-potvrdit>Importovat</button></div>`}
  </div>`;
  kam.querySelector('[data-potvrdit]')?.addEventListener('click', (e) => potvrdit(e.currentTarget));
  kam.querySelector('[data-zrusit]')?.addEventListener('click', zrusit);
}
