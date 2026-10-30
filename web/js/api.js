// Klient API Apps Scriptu: POST text/plain (bez CORS preflightu), tělo {action, token, data}.
import { API_URL } from '../config.js';
import { relace, smazRelaci } from './uloziste.js';

export class ChybaApi extends Error {
  constructor(zprava, kod) {
    super(zprava);
    this.kod = kod;
  }
}

/**
 * Zavolá akci API a vrátí `data` z odpovědi, při chybě vyhodí ChybaApi.
 * Kód chyby: SIT (není spojení), TOKEN (přihlášení vypršelo), PIN, ZAMCENO, ROLE, SERVER…
 */
export async function volej(action, data = {}, { token, timeout = 25000 } = {}) {
  if (!API_URL) throw new ChybaApi('V souboru config.js chybí adresa API (viz README).', 'KONFIGURACE');
  const tok = token !== undefined ? token : (relace()?.token || '');

  const prerus = new AbortController();
  const casovac = setTimeout(() => prerus.abort(), timeout);
  let text;
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: tok, data }),
      signal: prerus.signal
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    text = await r.text();
  } catch (e) {
    throw new ChybaApi(e.name === 'AbortError'
      ? 'Server neodpovídá – zkontroluj signál a zkus to znovu.'
      : 'Nepodařilo se spojit se serverem – zkontroluj signál.', 'SIT');
  } finally {
    clearTimeout(casovac);
  }

  let odp;
  try {
    odp = JSON.parse(text);
  } catch {
    throw new ChybaApi('Server vrátil neplatnou odpověď – zkontroluj nasazení Apps Scriptu.', 'SERVER');
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
