// Pomůcky modulu Expirace: expirace MM/RR, pásma, rozlišení EAN × lokace, názvy položek.

const DEN = 24 * 60 * 60 * 1000;
const NAZVY_PASEM = { x: 'Expirováno', r: 'Expiruje brzy', y: 'Pozor', g: 'OK' };

/** Poslední den měsíce z MM/RR (místní čas), nebo null při neplatném zápisu. */
export function datumExpirace(text) {
  const m = /^(\d{2})\/(\d{2})$/.exec(text || '');
  if (!m) return null;
  const mesic = Number(m[1]);
  if (mesic < 1 || mesic > 12) return null;
  return new Date(2000 + Number(m[2]), mesic, 0);
}

export const platnaExpirace = (text) => datumExpirace(text) !== null;

/** Zbývá dní = expirace − dnes (záporné = po expiraci). */
export function zbyvaDni(text) {
  const d = datumExpirace(text);
  if (!d) return null;
  const dnes = new Date();
  dnes.setHours(0, 0, 0, 0);
  return Math.round((d - dnes) / DEN);
}

/** Pásmo: x = expirováno, r = červená, y = žlutá, g = OK, k = bez platné expirace. */
export function pasmo(text, nastaveni) {
  const d = zbyvaDni(text);
  if (d === null) return 'k';
  if (d < 0) return 'x';
  if (d <= (nastaveni?.hranice_cervena ?? 0)) return 'r';
  if (d <= (nastaveni?.hranice_zluta ?? 0)) return 'y';
  return 'g';
}

export function stitekPasma(text, nastaveni) {
  const p = pasmo(text, nastaveni);
  if (p === 'k') return '<span class="pill k">bez expirace</span>';
  return `<span class="pill ${p}">${NAZVY_PASEM[p]} · ${zbyvaDni(text)} d</span>`;
}

/** Napojí pole expirace: jen číslice, lomítko se doplní samo (MMRR → MM/RR). */
export function napojPoleExpirace(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    input.value = v;
  });
}

/** Naskenovaný kód: bez mezer, velkými písmeny. */
export const normalizujKod = (kod) => String(kod ?? '').trim().toUpperCase().replace(/\s+/g, '');

/** EAN = jen číslice o délce 8, 12, 13 nebo 14 (podle specifikace); vše ostatní je lokace. */
export const jeEan = (kod) => /^\d+$/.test(kod) && [8, 12, 13, 14].includes(kod.length);

export const jeKodLokace = (kod) => !jeEan(kod) && /^[A-Z0-9][A-Z0-9./-]{0,29}$/.test(kod);

/** EAN pro porovnání bez úvodních nul: Excel z EAN uloženého jako číslo nulu zahodí (13 → 12 číslic). */
export const klicEan = (ean) => String(ean ?? '').trim().replace(/^0+(?=\d)/, '');

/** Položka číselníku podle EAN (i s / bez úvodní nuly), nebo null. */
export function polozkaPodleEan(zaklad, ean) {
  if (!zaklad?.polozky) return null;
  return zaklad.polozky.find((p) => p.ean === ean) || zaklad.polozky.find((p) => klicEan(p.ean) === klicEan(ean)) || null;
}

/** Název zboží záznamu – z číselníku podle EAN, jinak podle čísla položky. */
export function nazevZbozi(zaznam, zaklad) {
  const p = polozkaPodleEan(zaklad, zaznam.ean)
    || zaklad?.polozky.find((x) => x.cislo_polozky && x.cislo_polozky === zaznam.cislo_polozky && x.nazev);
  return p?.nazev || zaznam.nazev || `Položka ${zaznam.cislo_polozky || '?'} (bez názvu)`;
}

/** Krátké datum „29. 10.“ (u jiného roku i s rokem). */
export function kratkeDatum(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const rok = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${d.getDate()}. ${d.getMonth() + 1}.${rok}`;
}
