// Drobná data v localStorage: přihlášení, poslední uživatel na zařízení, zvolený podnik.
import { PODNIKY } from './podniky.js';

const KLICE = {
  relace: 'cs.relace',
  jmeno: 'cs.posledniJmeno',
  podnik: 'cs.podnik'
};

function cti(klic) {
  try {
    return JSON.parse(localStorage.getItem(klic));
  } catch {
    return null;
  }
}

function pis(klic, hodnota) {
  try {
    if (hodnota === null || hodnota === undefined) localStorage.removeItem(klic);
    else localStorage.setItem(klic, JSON.stringify(hodnota));
  } catch {
    // Úložiště nedostupné (anonymní okno) – aplikace funguje dál, jen si nic nepamatuje.
  }
}

/** Platné přihlášení {token, jmeno, role, platnost, prihlaseno}, nebo null. */
export function relace() {
  const r = cti(KLICE.relace);
  if (!r || !r.token) return null;
  if (new Date(r.platnost) <= new Date()) {
    pis(KLICE.relace, null);
    return null;
  }
  return r;
}

export const ulozRelaci = (r) => pis(KLICE.relace, r);
export const smazRelaci = () => pis(KLICE.relace, null);

export const posledniJmeno = () => cti(KLICE.jmeno);
export const ulozPosledniJmeno = (jmeno) => pis(KLICE.jmeno, jmeno);

export function zvolenyPodnik() {
  const p = cti(KLICE.podnik);
  return PODNIKY.some((x) => x.kod === p) ? p : PODNIKY[0].kod;
}
export const ulozPodnik = (podnik) => pis(KLICE.podnik, podnik);
