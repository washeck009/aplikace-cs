// Pomůcky modulu Expirace: expirace MM/RR, pásma, rozlišení lokace × kód zboží, hledání v číselníku, názvy položek.

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

/**
 * Rozlišení skenu: lokace = kód ve formátu lokace – H nebo P s číslicí a části oddělené pomlčkami (H2-P-37-1,
 * P0-K-45-1). Všechno ostatní je kód zboží: EAN, interní čárový kód DEK104710, číslo položky.
 * Stejné pravidlo je na serveru (LOKACE_FORMAT v Konfigurace.gs).
 */
export const LOKACE_FORMAT = /^[HP]\d+(-[A-Z0-9./]+)+$/;
export const jeKodLokace = (kod) => LOKACE_FORMAT.test(kod);
export const jeKodZbozi = (kod) => /^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(kod) && !jeKodLokace(kod);

/**
 * Klíč kódu pro porovnání (čárový kód i číslo položky): velkými písmeny bez mezer, čistě číselný bez úvodních nul –
 * Excel z čísla nulu zahodí (EAN 13 → 12 číslic), čtečka ji ale naskenuje.
 */
export const klicKodu = (kod) => {
  const t = normalizujKod(kod);
  return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, '') : t;
};

/**
 * Položka číselníku podle kódu zboží – hledá se v čárových kódech (`ean`) i v číslech položek (u části zboží je
 * čárovým kódem přímo číslo položky). Vrátí řádek číselníku, nebo null.
 */
export function polozkaPodleKodu(zaklad, kod) {
  if (!zaklad?.polozky || !kod) return null;
  const k = klicKodu(kod);
  return zaklad.polozky.find((p) => klicKodu(p.ean) === k)
    || zaklad.polozky.find((p) => klicKodu(p.cislo_polozky) === k && p.nazev && !p.k_doplneni)
    || zaklad.polozky.find((p) => klicKodu(p.cislo_polozky) === k)
    || null;
}

/** Čárový kód, pod kterým se zboží eviduje: z číselníku (bez čárového kódu číslo položky), jinak naskenovaný. */
export const kanonickyKod = (polozka, naskenovany) =>
  (polozka ? normalizujKod(polozka.ean) || normalizujKod(polozka.cislo_polozky) : normalizujKod(naskenovany));

/** Název zboží záznamu – z číselníku podle čárového kódu, jinak podle čísla položky. */
export function nazevZbozi(zaznam, zaklad) {
  const p = polozkaPodleKodu(zaklad, zaznam.ean)
    || zaklad?.polozky.find((x) => x.cislo_polozky && klicKodu(x.cislo_polozky) === klicKodu(zaznam.cislo_polozky) && x.nazev);
  return p?.nazev || zaznam.nazev || `Položka ${zaznam.cislo_polozky || '?'} (bez názvu)`;
}

/** Krátké datum „29. 10.“ (u jiného roku i s rokem). */
export function kratkeDatum(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const rok = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
  return `${d.getDate()}. ${d.getMonth() + 1}.${rok}`;
}
