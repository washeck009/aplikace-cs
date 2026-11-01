// Řízení – Úkoly: nový úkol (komu, lokace – jednotlivé, čárkou, rozsah od–do; položka, termín, poznámka),
// přehled úkolů s průběhem, zrušení, pravidla plánovače. Vidí vedoucí, manažer, admin; zadávat a rušit smí jen
// manažer a admin (vedoucí jen čte – ověřuje i server).
import { volej } from '../api.js';
import { napojPrepinacPodniku, pcRam, prepinacPodniku, ROLE_PC, ROLE_UKOLY } from '../pc.js';
import { PODNIKY } from '../podniky.js';
import { dialog, esc, toast } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';

const HASH = '#/pc/ukoly';
const MAX_LOKACI_V_RADKU = 12;

let filtr = 'otevrene';
let vykresleni = 0;

export async function zobrazPcUkoly(koren, relace) {
  const cislo = ++vykresleni;
  if (!ROLE_PC.includes(relace.role)) {
    pcRam(koren, relace, 'ukoly', '<h1>Úkoly</h1><div class="chyba">Tuto část vidí jen vedoucí, manažer a správce.</div>');
    return;
  }
  const podnik = zvolenyPodnik();
  const nazev = PODNIKY.find((p) => p.kod === podnik)?.nazev || podnik;
  pcRam(koren, relace, 'ukoly', `${prepinacPodniku(podnik)}
    <h1>Úkoly – ${esc(nazev)}</h1>
    <div class="sub">Ruční úkoly zadává manažer a správce. Plánovač přidává úkoly každé ráno sám.
      Lokace se odškrtne, když ji po zadání kdokoliv zkontroluje; s poslední lokací je úkol splněný.</div>
    <div id="pcObsah"><p class="hint">Načítám…</p></div>`, podnik);
  napojPrepinacPodniku(koren, () => zobrazPcUkoly(koren, relace));

  let data;
  try {
    data = await volej('ukoly.seznam', { podnik });
  } catch (e) {
    if (e.kod === 'TOKEN' || cislo !== vykresleni) return;
    koren.querySelector('#pcObsah').innerHTML = `<div class="chyba">${esc(e.message)}</div>
      <button class="btn sec" data-znovu>Zkusit znovu</button>`;
    koren.querySelector('[data-znovu]').addEventListener('click', () => zobrazPcUkoly(koren, relace));
    return;
  }
  if (cislo !== vykresleni || location.hash !== HASH) return;
  vykresliObsah(koren, relace, podnik, data);
}

function zaDvaDny() {
  const d = new Date(Date.now() + 2 * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function datum(iso) {
  return iso ? new Date(iso.length === 10 ? iso + 'T00:00' : iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '–';
}

function vykresliObsah(koren, relace, podnik, data) {
  const p = data.planovac || {};
  const ukoly = data.ukoly.filter((u) => filtr === 'vse' || u.stav === 'otevřený');
  // Vedoucí úkoly jen vidí (server rozhoduje podle role; ROLE_UKOLY je záloha pro starší server).
  const muzeZadavat = data.muze_zadavat ?? ROLE_UKOLY.includes(relace.role);
  const otevrene = data.ukoly.filter((u) => u.stav === 'otevřený');
  const lokaci = otevrene.reduce((s, u) => s + u.lokace.length, 0);
  const hotovo = otevrene.reduce((s, u) => s + u.lokace.filter((k) => u.hotove.includes(k)).length, 0);
  koren.querySelector('#pcObsah').innerHTML = `<div class="grid2">
    ${muzeZadavat ? '' : `<div class="panel"><h2>Plnění úkolů</h2>
      <div class="kpis kpis-male"><div class="kpi"><div class="v">${otevrene.length}</div><div class="l">otevřených úkolů</div></div>
        <div class="kpi"><div class="v">${hotovo} / ${lokaci}</div><div class="l">hotových lokací</div>
          <div class="prog"><i style="width:${lokaci ? (100 * hotovo) / lokaci : 0}%"></i></div></div></div>
      <div class="hint">Úkoly zadává a ruší manažer nebo správce.</div></div>`}
    <div class="panel"${muzeZadavat ? '' : ' hidden'}><h2>Nový úkol</h2>
      <form id="novyUkol" autocomplete="off">
        <div class="field"><label for="uKomu">Pro koho</label><select id="uKomu" name="komu">
          <option value="kdokoliv">kdokoliv</option>
          ${data.uzivatele.map((j) => `<option>${esc(j)}</option>`).join('')}</select></div>
        <div class="field"><label for="uLokace">Lokace – jedna, víc oddělených čárkou, nebo rozsah v rámci řady</label>
          <textarea id="uLokace" name="lokace" rows="2" placeholder="např. H2-J-07-1 až H2-J-20-4, H2-P-37-1"></textarea></div>
        <div class="field"><label for="uPolozka">Jen konkrétní zboží (nepovinné)</label>
          <input id="uPolozka" name="polozka" placeholder="EAN nebo číslo položky"></div>
        <div class="field"><label for="uTermin">Termín</label><input id="uTermin" name="termin" type="date" value="${zaDvaDny()}"></div>
        <div class="field"><label for="uPopis">Poznámka pro skladníka</label><textarea id="uPopis" name="popis" rows="2"></textarea></div>
        <div class="chyba" id="uChyba" hidden></div>
        <button class="btn" type="submit">Zadat úkol</button>
      </form>
    </div>
    <div class="panel"><h2>Pravidla plánovače</h2>
      <table>
        <tr><th>Pravidlo</th><th>Hodnota</th></tr>
        <tr><td>Lokace nekontrolovaná déle než</td><td>${esc(p.dni_bez_kontroly ?? '?')} dní</td></tr>
        <tr><td>Červené pásmo ověřit alespoň</td><td>1× za ${esc(p.cervene_overit_dni ?? '?')} dní</td></tr>
        <tr><td>Zboží na skladě bez kontroly (import ERP)</td><td>ano</td></tr>
        <tr><td>Naskladněno po poslední kontrole (import ERP)</td><td>${p.naskladneno_zapnuto === false ? 'vypnuto'
          : `naskladnění za posledních ${esc(p.naskladneno_dni ?? 14)} dní`}</td></tr>
        <tr><td>Max. lokací v jednom úkolu</td><td>${esc(p.max_lokaci_ukol ?? '?')}</td></tr>
        <tr><td>Denní spouštění (5:30)</td><td>${p.spoustec === true ? '✔ zapnuto' : p.spoustec === false ? '<b class="chyba-text">vypnuto</b>' : 'nezjištěno'}</td></tr>
      </table>
      <div class="hint">Na každé pravidlo nejvýš jeden otevřený úkol pro „kdokoliv“. Hodnoty upravuje správce v listu Nastaveni,
        spouštění zapíná v tabulce menu Aplikace CS → Plánovač.</div>
    </div>
  </div>
  <div class="panel">
    <div class="radek-mezi"><h2>Přehled úkolů</h2>
      <div class="tabs">${[['otevrene', 'Otevřené'], ['vse', 'Vše (30 dní)']].map(([k, t]) =>
        `<button class="chip${filtr === k ? ' on' : ''}" data-filtr="${k}">${t}</button>`).join('')}</div></div>
    <div class="tblw"><table>
      <tr><th>Úkol</th><th>Typ</th><th>Zadal</th><th>Pro</th><th>Termín</th><th>Hotovo</th><th>Stav</th><th></th></tr>
      ${ukoly.length ? ukoly.map((u) => radekUkolu(u, muzeZadavat)).join('') : '<tr><td colspan="8" class="hint">Žádné úkoly.</td></tr>'}
    </table></div>
  </div>`;

  const formular = koren.querySelector('#novyUkol');
  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chyba = koren.querySelector('#uChyba');
    const tlacitko = formular.querySelector('[type=submit]');
    const hodnoty = Object.fromEntries(new FormData(formular));
    chyba.hidden = true;
    tlacitko.disabled = true;
    try {
      const u = await volej('ukoly.zadej', { podnik, ...hodnoty });
      toast(`Úkol zadán – ${u.lokace.length} ${u.lokace.length < 5 ? 'lokace' : 'lokací'} pro ${u.komu}.`);
      zobrazPcUkoly(koren, relace);
    } catch (chybaApi) {
      chyba.textContent = chybaApi.message;
      chyba.hidden = false;
      tlacitko.disabled = false;
    }
  });
  koren.querySelectorAll('[data-filtr]').forEach((b) => b.addEventListener('click', () => {
    filtr = b.dataset.filtr;
    vykresliObsah(koren, relace, podnik, data);
  }));
  koren.querySelectorAll('[data-zrusit]').forEach((b) => b.addEventListener('click', async () => {
    const u = data.ukoly.find((x) => x.id === b.dataset.zrusit);
    const ano = await dialog({
      titulek: 'Zrušit úkol?',
      text: `${u.popis} (pro ${u.komu}, hotovo ${u.hotove.length} z ${u.lokace.length}). Zruší se s tvým jménem a časem.`,
      tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'sec' }, { text: 'Zrušit úkol', hodnota: true, trida: 'red' }]
    });
    if (!ano) return;
    try {
      await volej('ukoly.zrus', { id: u.id });
      toast('Úkol zrušen.');
      zobrazPcUkoly(koren, relace);
    } catch (e) {
      toast(e.message);
    }
  }));
}

function radekUkolu(u, muzeRusit) {
  const hotovo = u.lokace.filter((k) => u.hotove.includes(k)).length;
  const lokace = u.lokace.slice(0, MAX_LOKACI_V_RADKU).map((k) => (u.hotove.includes(k) ? `<s>${esc(k)}</s>` : esc(k))).join(', ')
    + (u.lokace.length > MAX_LOKACI_V_RADKU ? ` … +${u.lokace.length - MAX_LOKACI_V_RADKU}` : '');
  const stav = u.stav === 'otevřený' ? 'y' : u.stav === 'splněný' ? 'g' : 'k';
  const kdy = u.stav === 'splněný' ? `<div class="hint">${datum(u.splneno)} · ${esc(u.splnil)}</div>`
    : u.stav === 'zrušený' ? `<div class="hint">zrušil ${esc(u.splnil)}</div>` : '';
  return `<tr>
    <td class="sirsi"><b>${esc(u.popis)}</b>${u.polozka ? ` <span class="hint">· zboží ${esc(u.polozka)}</span>` : ''}
      <div class="hint">${lokace}</div></td>
    <td>${esc(u.typ)}</td><td>${esc(u.zadal)}<div class="hint">${datum(u.zadano)}</div></td><td>${esc(u.komu)}</td>
    <td>${datum(u.termin)}</td>
    <td>${hotovo} / ${u.lokace.length}<div class="prog"><i style="width:${(100 * hotovo) / u.lokace.length}%"></i></div></td>
    <td><span class="pill ${stav}">${esc(u.stav)}</span>${kdy}</td>
    <td>${u.stav === 'otevřený' && muzeRusit ? `<button class="chip" data-zrusit="${esc(u.id)}">Zrušit</button>` : ''}</td>
  </tr>`;
}
