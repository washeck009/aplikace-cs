// Oprávnění přihlášeného uživatele (seznam klíčů z přihlášení / akce `ja`, nastavuje admin ve Správě → Oprávnění).
// Klient podle nich jen skrývá dlaždice a tlačítka – každou akci kontroluje server.
import { relace } from './uloziste.js';

/** Má přihlášený uživatel aspoň jedno z oprávnění? Admin vždy. */
export function ma(...klice) {
  const r = relace();
  if (!r) return false;
  if (r.role === 'admin') return true;
  // Přihlášení ze starší verze (před 0.4.2) seznam nemá – nic neskrývat, doplní ho `ja` po startu; rozhoduje server.
  if (!Array.isArray(r.opravneni)) return true;
  return klice.some((k) => r.opravneni.includes(k));
}

/** Oprávnění, která otevírají řízení (PC část). */
export const OPRAVNENI_RIZENI = ['prehledy', 'zaznamy', 'ukoly_zadavani', 'sprava_uzivatelu', 'importy', 'nastaveni'];
