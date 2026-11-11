// Klient API Apps Scriptu: POST text/plain (bez CORS preflightu), tělo {action, token, data}.
// Čtecí volání a přihlášení se při výpadku sítě / vypršení času jednou zopakují (Apps Script se po nečinnosti
// probouzí i několik sekund). Doba každého volání jde do diagnostiky (událost cs:api).
import { API_URL } from '../config.js';
import { relace, smazRelaci } from './uloziste.js';

export class ChybaApi extends Error {
  constructor(zprava, kod) {
    super(zprava);
    this.kod = kod;
  }
}

// Akce, které nic nemění (nebo je opakování bezpečné – přihlášení jen vydá další token): při chybě sítě se jednou
// zopakují. Zápisy (dávky, fotky, Vydáno…) opakuje offline fronta sama a server je idempotentní.
const BEZPECNE_OPAKOVAT = new Set(['ping', 'uzivatele.seznam', 'login', 'login.info', 'ja', 'data.zaklad', 'lokace.nacti',
  'kontroly.dnes', 'ukoly.moje', 'ukoly.seznam', 'prehled.data', 'zaznamy.seznam', 'kontroly.log', 'import.info',
  'sprava.uzivatele', 'sprava.nastaveni', 'sprava.polozky', 'opravneni.nacti']);
const PRODLEVA_PRED_OPAKOVANIM_MS = 1000;

/** Chyba spojení (bez sítě nebo vypršel čas) – data se dají ukázat ze zařízení. */
export const jeBezSite = (e) => e?.kod === 'SIT' || e?.kod === 'CAS';

/** Doba volání do diagnostiky (5× verze). */
const zmer = (action, ms, vysledek, pokus) =>
  window.dispatchEvent(new CustomEvent('cs:api', { detail: { akce: action, ms: Math.round(ms), vysledek, pokus } }));

/** Jeden pokus o volání – vrátí odpověď serveru {ok, data | error, kod}, nebo vyhodí ChybaApi (síť, čas, HTTP). */
async function pokus(action, data, tok, timeout) {
  if (navigator.onLine === false) {
    throw new ChybaApi('Zařízení je bez připojení (offline) – zkontroluj Wi-Fi nebo mobilní data.', 'SIT');
  }
  const prerus = new AbortController();
  const casovac = setTimeout(() => prerus.abort(), timeout);
  let r;
  try {
    r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: tok, data }),
      signal: prerus.signal
    });
  } catch (e) {
    throw e.name === 'AbortError'
      ? new ChybaApi(`Server neodpověděl do ${Math.round(timeout / 1000)} s (vypršel čas) – mohl se probouzet, zkus to znovu.`, 'CAS')
      : new ChybaApi('Bez spojení se serverem – zkontroluj signál.', 'SIT');
  } finally {
    clearTimeout(casovac);
  }
  if (!r.ok) {
    throw new ChybaApi(r.status === 429 ? 'Server je zaneprázdněný (příliš mnoho požadavků) – zkus to za chvíli.'
      : `Server je dočasně nedostupný (HTTP ${r.status}) – zkus to za chvíli.`, r.status === 429 ? 'ZANEPRAZDNENO' : 'HTTP');
  }
  try {
    return JSON.parse(await r.text());
  } catch {
    throw new ChybaApi('Server vrátil neplatnou odpověď – zkontroluj nasazení Apps Scriptu.', 'SERVER');
  }
}

/**
 * Zavolá akci API a vrátí `data` z odpovědi, při chybě vyhodí ChybaApi.
 * Kód chyby: SIT (bez spojení), CAS (vypršel čas), HTTP (server dočasně nedostupný), ZANEPRAZDNENO (zámek / limit),
 * TOKEN (přihlášení vypršelo), PIN, ZAMCENO, ROLE, SERVER…
 * `opakovat` (výchozí podle BEZPECNE_OPAKOVAT): při SIT / CAS / HTTP jednou zopakovat.
 */
export async function volej(action, data = {}, { token, timeout = 25000, opakovat = BEZPECNE_OPAKOVAT.has(action) } = {}) {
  if (!API_URL) throw new ChybaApi('V souboru config.js chybí adresa API (viz README).', 'KONFIGURACE');
  const tok = token !== undefined ? token : (relace()?.token || '');

  let odp;
  for (let cislo = 1; ; cislo++) {
    const zacatek = performance.now();
    try {
      odp = await pokus(action, data, tok, timeout);
      zmer(action, performance.now() - zacatek, odp.ok ? 'OK' : odp.kod, cislo);
      break;
    } catch (e) {
      zmer(action, performance.now() - zacatek, e.kod, cislo);
      const lzeOpakovat = opakovat && cislo === 1 && ['SIT', 'CAS', 'HTTP'].includes(e.kod) && navigator.onLine !== false;
      if (!lzeOpakovat) throw e;
      await new Promise((hotovo) => setTimeout(hotovo, PRODLEVA_PRED_OPAKOVANIM_MS));
    }
  }

  if (!odp.ok) {
    // Odhlásit jen při neplatném tokenu aktuálního přihlášení (fronta posílá i starší tokeny).
    if (odp.kod === 'TOKEN' && tok && tok === relace()?.token) {
      smazRelaci();
      window.dispatchEvent(new CustomEvent('cs:odhlaseno', { detail: odp.error }));
    }
    throw new ChybaApi(odp.error || 'Neznámá chyba.', odp.kod);
  }
  return odp.data;
}

/** Probudí server (Apps Script po nečinnosti startuje i několik sekund) – na pozadí, chyby se ignorují. */
export function probudServer() {
  if (!API_URL) return;
  volej('ping', {}, { token: '', timeout: 30000, opakovat: false }).catch(() => {});
}
