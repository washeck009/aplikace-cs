// Řízení – Správa (jen admin, kap. 6.4): uživatelé (přidat, role, aktivní, reset PINu – nový PIN se zobrazí jednou),
// nastavení po podnicích, položky k doplnění (doplnit název / spárovat s číslem položky). Importy mají vlastní obrazovku.
import { volej } from '../api.js';
import { datumCas, napojPrepinacPodniku, overRoli, pcRam, prepinacPodniku } from '../pc.js';
import { NAZVY_ROLI, podnikPodleKodu } from '../podniky.js';
import { dialog, esc, toast } from '../ui.js';
import { zvolenyPodnik } from '../uloziste.js';

const HASH = '#/pc/sprava';
const ZALOZKY = [['uzivatele', 'Uživatelé'], ['nastaveni', 'Nastavení podniku'], ['polozky', 'Položky k doplnění']];
const ROLE = ['skladnik', 'vedouci', 'manazer', 'admin'];
let zalozka = 'uzivatele';
let vykresleni = 0;

export async function zobrazPcSprava(koren, relace) {
  if (!overRoli(koren, relace, 'sprava', ['admin'], 'Správa')) return;
  const cisloVykresleni = ++vykresleni;
  const podnik = zvolenyPodnik();
  pcRam(koren, relace, 'sprava', `<h1>Správa</h1>
    <div class="tabs">${ZALOZKY.map(([k, n]) => `<button class="chip${k === zalozka ? ' on' : ''}" data-zalozka="${k}">${n}</button>`).join('')}</div>
    ${zalozka === 'uzivatele' ? '' : prepinacPodniku(podnik)}
    <div id="sObsah"><p class="hint">Načítám…</p></div>`, zalozka === 'uzivatele' ? null : podnik);
  const znovu = () => zobrazPcSprava(koren, relace);
  koren.querySelectorAll('[data-zalozka]').forEach((b) => b.addEventListener('click', () => {
    zalozka = b.dataset.zalozka;
    znovu();
  }));
  napojPrepinacPodniku(koren, znovu);
  const obsah = koren.querySelector('#sObsah');
  const aktualni = () => cisloVykresleni === vykresleni && location.hash === HASH;
  try {
    if (zalozka === 'uzivatele') await uzivatele(obsah, aktualni, znovu);
    else if (zalozka === 'nastaveni') await nastaveni(obsah, podnik, aktualni);
    else await polozky(obsah, podnik, aktualni, znovu);
  } catch (e) {
    if (e.kod !== 'TOKEN' && aktualni()) obsah.innerHTML = `<div class="chyba">${esc(e.message)}</div>`;
  }
}

/** Dialog s novým PINem – ukáže se jen jednou, server ho nikde neuchovává. */
function ukazPin(jmeno, pin) {
  return dialog({
    titulek: `PIN pro ${jmeno}`,
    html: `<div class="pin-jednou">${esc(pin)}</div>
      <p class="hint">Sděl ho uživateli osobně. Po zavření tohoto okna už ho nikde neuvidíš (v tabulce je jen jeho otisk).</p>`,
    tlacitka: [{ text: 'Mám ho, zavřít', hodnota: true }]
  });
}

const vyberRole = (role, attr = '') => `<select ${attr}>${ROLE.map((r) =>
  `<option value="${r}"${r === role ? ' selected' : ''}>${NAZVY_ROLI[r]}</option>`).join('')}</select>`;

async function uzivatele(obsah, aktualni, znovu) {
  const data = await volej('sprava.uzivatele');
  if (!aktualni()) return;
  obsah.innerHTML = `<div class="grid2">
    <div class="panel"><h2>Uživatelé</h2><div class="tblw"><table>
      <tr><th>Jméno</th><th>Role</th><th>Aktivní</th><th></th></tr>
      ${data.uzivatele.map((u) => `<tr data-id="${esc(u.id)}">
        <td><b>${esc(u.jmeno)}</b>${u.id === data.ja ? ' <span class="hint">(ty)</span>' : ''}
          ${u.zamceno_do ? `<div class="chyba-text">zamčeno do ${datumCas(u.zamceno_do)}</div>` : ''}</td>
        <td>${vyberRole(u.role, 'data-role')}</td>
        <td><input type="checkbox" data-aktivni${u.aktivni ? ' checked' : ''}></td>
        <td class="akce"><button class="chip" data-ulozit hidden>Uložit</button>
          <button class="chip" data-pin>${u.zamceno_do ? 'Odemknout + nový PIN' : 'Nový PIN'}</button></td></tr>`).join('')}
    </table></div>
    <div class="hint">Vypnutý uživatel se nepřihlásí a odhlásí se ze všech zařízení. Jméno se nemění (vede se podle něj historie).</div></div>
    <div class="panel"><h2>Přidat uživatele</h2>
      <form id="novyUzivatel" autocomplete="off">
        <div class="field"><label for="nJmeno">Jméno (jak se bude zobrazovat)</label><input id="nJmeno" name="jmeno" required maxlength="60"></div>
        <div class="field"><label for="nRole">Role</label>${vyberRole('skladnik', 'id="nRole" name="role"')}</div>
        <div class="chyba" id="nChyba" hidden></div>
        <button class="btn" type="submit">Přidat a vygenerovat PIN</button>
      </form>
      <div class="hint mt">Skladník: čtečka. Vedoucí: navíc přehled a záznamy, úkoly jen čte. Manažer: navíc zadává úkoly.
        Admin: vše včetně správy a importů.</div></div>
  </div>`;

  obsah.querySelectorAll('tr[data-id]').forEach((tr) => {
    const ulozit = tr.querySelector('[data-ulozit]');
    tr.querySelectorAll('[data-role], [data-aktivni]').forEach((el) => el.addEventListener('change', () => { ulozit.hidden = false; }));
    ulozit.addEventListener('click', async () => {
      try {
        await volej('sprava.uzivatel.uloz', {
          id: tr.dataset.id, role: tr.querySelector('[data-role]').value, aktivni: tr.querySelector('[data-aktivni]').checked
        });
        toast('Uloženo.');
        znovu();
      } catch (e) {
        toast(e.message);
      }
    });
    tr.querySelector('[data-pin]').addEventListener('click', async () => {
      const jmeno = tr.querySelector('b').textContent;
      const ano = await dialog({
        titulek: `Nový PIN pro ${jmeno}?`,
        text: 'Starý PIN přestane platit, účet se odemkne a uživatel se odhlásí ze všech zařízení.',
        tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'gry' }, { text: 'Vygenerovat PIN', hodnota: true }]
      });
      if (!ano) return;
      try {
        const v = await volej('sprava.uzivatel.pin', { id: tr.dataset.id });
        await ukazPin(v.jmeno, v.pin);
        znovu();
      } catch (e) {
        toast(e.message);
      }
    });
  });

  const formular = obsah.querySelector('#novyUzivatel');
  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chyba = obsah.querySelector('#nChyba');
    chyba.hidden = true;
    try {
      const f = Object.fromEntries(new FormData(formular)); // formular.role by vrátil atribut ARIA, ne pole
      const v = await volej('sprava.uzivatel.uloz', { jmeno: f.jmeno, role: f.role, aktivni: true });
      await ukazPin(v.jmeno, v.pin);
      znovu();
    } catch (chybaApi) {
      chyba.textContent = chybaApi.message;
      chyba.hidden = false;
    }
  });
}

/** Políčko nastavení podle klíče: ano/ne, číslo, nebo text. */
function policko(n) {
  if (n.klic === 'planovac_naskladneno_zapnuto') {
    const ano = ['TRUE', 'true', 'ano', '1'].includes(n.hodnota) || n.hodnota === '';
    return `<select name="${esc(n.klic)}"><option value="TRUE"${ano ? ' selected' : ''}>zapnuto</option><option value="FALSE"${ano ? '' : ' selected'}>vypnuto</option></select>`;
  }
  const cislo = /^(hranice_|planovac_|cil_)/.test(n.klic);
  return `<input name="${esc(n.klic)}" value="${esc(n.hodnota)}"${cislo ? ' inputmode="numeric" pattern="\\d*"' : ''}>`;
}

async function nastaveni(obsah, podnik, aktualni) {
  const data = await volej('sprava.nastaveni', { podnik });
  if (!aktualni()) return;
  const nazev = podnikPodleKodu(podnik)?.nazev || podnik;
  obsah.innerHTML = `<div class="panel"><h2>Nastavení – ${esc(nazev)}</h2>
    <form id="fNastaveni" autocomplete="off"><table class="nastaveni">
      ${data.nastaveni.map((n) => `<tr><td><b>${esc(n.popis || n.klic)}</b><div class="hint">${esc(n.klic)}</div></td><td>${policko(n)}</td></tr>`).join('')}
    </table>
    <div class="chyba" id="fChyba" hidden></div>
    <button class="btn mt" type="submit">Uložit nastavení</button></form>
    <div class="hint mt">Pásma se na čtečkách projeví po dalším stažení dat (přihlášení nebo do 30 minut).</div></div>`;
  const formular = obsah.querySelector('#fNastaveni');
  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    const chyba = obsah.querySelector('#fChyba');
    chyba.hidden = true;
    try {
      await volej('sprava.nastaveni.uloz', { podnik, hodnoty: Object.fromEntries(new FormData(formular)) });
      toast('Nastavení uloženo.');
    } catch (chybaApi) {
      chyba.textContent = chybaApi.message;
      chyba.hidden = false;
    }
  });
}

async function polozky(obsah, podnik, aktualni, znovu) {
  const data = await volej('sprava.polozky', { podnik });
  if (!aktualni()) return;
  obsah.innerHTML = `<div class="panel"><h2>Položky k doplnění <span class="hint">(${data.polozky.length})</span></h2>
    <div class="hint mb">Neznámé EAN, které skladníci naskenovali a zadali k nim číslo položky ručně. Doplň název, nebo oprav číslo
      položky a název nech prázdný – převezme se ze známé položky se stejným číslem (spárování). Záznamy s tímto EAN se opraví také.</div>
    ${data.polozky.length ? `<div class="tblw"><table>
      <tr><th>EAN</th><th>Číslo položky</th><th>Název</th><th class="num">Záznamů</th><th></th></tr>
      ${data.polozky.map((p) => `<tr data-ean="${esc(p.ean)}">
        <td>${esc(p.ean)}</td>
        <td><input data-cislo value="${esc(p.cislo_polozky)}" size="14"></td>
        <td class="sirsi"><input data-nazev value="${esc(p.nazev)}" placeholder="${esc(p.navrh_nazvu ? 'prázdné = ' + p.navrh_nazvu : 'název zboží')}"></td>
        <td class="num">${p.zaznamu}</td>
        <td><button class="chip" data-ulozit>Uložit</button></td></tr>`).join('')}
    </table></div>` : '<p class="hint">Nic k doplnění. 👍</p>'}</div>`;
  obsah.querySelectorAll('tr[data-ean]').forEach((tr) => tr.querySelector('[data-ulozit]').addEventListener('click', async () => {
    try {
      const v = await volej('sprava.polozka.uloz', {
        podnik, ean: tr.dataset.ean, cislo_polozky: tr.querySelector('[data-cislo]').value, nazev: tr.querySelector('[data-nazev]').value
      });
      toast(v.k_doplneni ? 'Uloženo, ale bez názvu zůstává k doplnění (číslo položky nikde jinde není).'
        : `Doplněno: ${v.nazev}${v.zaznamu ? ` (opraveno ${v.zaznamu} záznamů)` : ''}.`);
      znovu();
    } catch (e) {
      toast(e.message);
    }
  }));
}
