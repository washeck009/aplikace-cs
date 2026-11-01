// Řízení – Správa (kap. 6.4): uživatelé (admin a manažer – přidat jen jméno a roli, role, aktivní, reset PINu; PIN si
// každý nastaví sám), nastavení po podnicích a položky k doplnění (jen admin). Importy mají vlastní obrazovku.
// Manažer spravuje jen účty pod adminem (hlídá i server).
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
  if (!overRoli(koren, relace, 'sprava', ['manazer', 'admin'], 'Správa')) return;
  const cisloVykresleni = ++vykresleni;
  const podnik = zvolenyPodnik();
  // Manažer vidí jen uživatele; nastavení a položky k doplnění jsou jen pro admina.
  const zalozky = relace.role === 'admin' ? ZALOZKY : ZALOZKY.slice(0, 1);
  if (!zalozky.some(([k]) => k === zalozka)) zalozka = 'uzivatele';
  pcRam(koren, relace, 'sprava', `<h1>Správa</h1>
    <div class="tabs">${zalozky.map(([k, n]) => `<button class="chip${k === zalozka ? ' on' : ''}" data-zalozka="${k}">${n}</button>`).join('')}</div>
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

const vyberRole = (role, nabidka, attr = '') => `<select ${attr}>${nabidka.map((r) =>
  `<option value="${r}"${r === role ? ' selected' : ''}>${NAZVY_ROLI[r]}</option>`).join('')}</select>`;

async function uzivatele(obsah, aktualni, znovu) {
  const data = await volej('sprava.uzivatele');
  if (!aktualni()) return;
  const nabidka = data.role_k_prirazeni || ROLE;
  const radek = (u) => {
    const lze = u.muze_spravovat !== false;
    return `<tr data-id="${esc(u.id)}">
      <td><b>${esc(u.jmeno)}</b>${u.id === data.ja ? ' <span class="hint">(ty)</span>' : ''}
        ${u.zamceno_do ? `<div class="chyba-text">zamčeno do ${datumCas(u.zamceno_do)}</div>` : ''}</td>
      <td>${lze ? vyberRole(u.role, nabidka.includes(u.role) ? nabidka : [...nabidka, u.role], 'data-role') : esc(NAZVY_ROLI[u.role] || u.role)}</td>
      <td><input type="checkbox" data-aktivni${u.aktivni ? ' checked' : ''}${lze ? '' : ' disabled'}></td>
      <td>${u.pin_nastaven ? '<span class="pill g">ano</span>' : '<span class="pill y">ne – nastaví si</span>'}</td>
      <td class="akce">${lze ? `<button class="chip" data-ulozit hidden>Uložit</button>
        ${u.pin_nastaven || u.zamceno_do ? `<button class="chip" data-reset>Resetovat PIN${u.zamceno_do ? ' + odemknout' : ''}</button>` : ''}` : ''}</td></tr>`;
  };
  obsah.innerHTML = `<div class="grid2">
    <div class="panel"><h2>Uživatelé</h2><div class="tblw"><table>
      <tr><th>Jméno</th><th>Role</th><th>Aktivní</th><th>PIN nastaven</th><th></th></tr>
      ${data.uzivatele.map(radek).join('')}
    </table></div>
    <div class="hint">PIN si každý nastavuje sám: nový uživatel a uživatel po resetu při příštím přihlášení (vybere jméno →
      Nastav si PIN), změna v Můj účet. Reset PINu smaže PIN a odhlásí uživatele ze všech zařízení.
      Vypnutý uživatel se nepřihlásí. Jméno se nemění (vede se podle něj historie).</div></div>
    <div class="panel"><h2>Přidat uživatele</h2>
      <form id="novyUzivatel" autocomplete="off">
        <div class="field"><label for="nJmeno">Jméno (jak se bude zobrazovat)</label><input id="nJmeno" name="jmeno" required maxlength="60"></div>
        <div class="field"><label for="nRole">Role</label>${vyberRole('skladnik', nabidka, 'id="nRole" name="role"')}</div>
        <div class="chyba" id="nChyba" hidden></div>
        <button class="btn" type="submit">Přidat uživatele</button>
      </form>
      <div class="hint mt">Bez PINu – uživatel si ho nastaví při prvním přihlášení. Ať to udělá hned, dokud účet nemá PIN,
        může si ho nastavit kdokoliv, kdo vybere jeho jméno.</div>
      <div class="hint mt">Skladník: čtečka. Vedoucí: navíc přehled a záznamy, úkoly jen čte. Manažer: navíc zadává úkoly
        a spravuje uživatele (kromě adminů). Admin: vše včetně nastavení a importů.</div></div>
  </div>`;

  obsah.querySelectorAll('tr[data-id]').forEach((tr) => {
    const ulozit = tr.querySelector('[data-ulozit]');
    if (!ulozit) return;
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
    tr.querySelector('[data-reset]')?.addEventListener('click', async () => {
      const jmeno = tr.querySelector('b').textContent;
      const ano = await dialog({
        titulek: `Resetovat PIN – ${jmeno}?`,
        text: 'PIN se smaže, účet se odemkne a uživatel se odhlásí ze všech zařízení. Při dalším přihlášení si nastaví nový PIN sám.',
        tlacitka: [{ text: 'Zpět', hodnota: false, trida: 'gry' }, { text: 'Resetovat PIN', hodnota: true, trida: 'red' }]
      });
      if (!ano) return;
      try {
        await volej('sprava.uzivatel.reset', { id: tr.dataset.id });
        toast(`PIN uživatele ${jmeno} je smazaný – nový si nastaví při přihlášení.`);
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
      toast(`${v.jmeno} přidán – PIN si nastaví při prvním přihlášení.`);
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
