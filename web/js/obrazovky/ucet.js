// Můj účet (všechny role): kdo jsem a změna PINu – starý PIN + nový 2×. Ostatní zařízení se odhlásí,
// toto dostane nové přihlášení. Obrazovka bez skenování (skenovací pole se tu nezobrazuje).
import { volej } from '../api.js';
import { chybaNovehoPinu } from '../pin.js';
import { NAZVY_ROLI } from '../podniky.js';
import { relace, ulozRelaci } from '../uloziste.js';
import { esc, hlavicka, napojHlavicku, prejdi, toast } from '../ui.js';

const POLE_PINU = 'type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" class="big"';

export function zobrazUcet(koren, r) {
  koren.innerHTML = hlavicka('Můj účet', { zpet: '#/' }) + `<main class="ph-body">
    <div class="task"><b>${esc(r.jmeno)}</b><div class="hint">${esc(NAZVY_ROLI[r.role] || r.role)}</div></div>
    <div class="h">Změnit PIN</div>
    <form id="fPin" autocomplete="off">
      <div class="field"><label for="pStary">Současný PIN</label><input id="pStary" name="stary" ${POLE_PINU}></div>
      <div class="field"><label for="pNovy">Nový PIN</label><input id="pNovy" name="novy" ${POLE_PINU}></div>
      <div class="field"><label for="pNovy2">Nový PIN ještě jednou</label><input id="pNovy2" name="novy2" ${POLE_PINU}></div>
      <div class="chyba" id="pChyba" hidden></div>
      <button class="btn block" type="submit">Uložit nový PIN</button>
    </form>
    <p class="hint">PIN si vymysli sám – 4 číslice, ne stejné ani za sebou (1111, 1234, 4321). Po změně se odhlásíš
      na ostatních zařízeních. Zapomenutý PIN ti resetuje manažer nebo správce.</p>
  </main>`;
  napojHlavicku(koren);

  const formular = koren.querySelector('#fPin');
  const chyba = koren.querySelector('#pChyba');
  const ukazChybu = (text) => {
    chyba.textContent = text;
    chyba.hidden = false;
  };
  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    chyba.hidden = true;
    const f = Object.fromEntries(new FormData(formular));
    if (!/^\d{4}$/.test(f.stary)) return ukazChybu('Zadej současný PIN (4 číslice).');
    const spatne = chybaNovehoPinu(f.novy);
    if (spatne) return ukazChybu(spatne);
    if (f.novy !== f.novy2) return ukazChybu('Nový PIN a jeho zopakování se neshodují.');
    if (f.novy === f.stary) return ukazChybu('Nový PIN je stejný jako současný.');
    const tlacitko = formular.querySelector('[type=submit]');
    tlacitko.disabled = true;
    try {
      const nove = await volej('ucet.pin', { stary: f.stary, novy: f.novy });
      ulozRelaci({ ...relace(), ...nove });
      toast('PIN je změněný.');
      prejdi('#/');
    } catch (chybaApi) {
      if (chybaApi.kod === 'TOKEN') return;
      formular.reset();
      tlacitko.disabled = false;
      ukazChybu(chybaApi.message);
    }
  });
}
