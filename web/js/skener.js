// Skenování: jedno trvalé pole pro hardwarový skener Urovo (v index.html, mimo překreslovanou část obrazovky).
// Ověřeno na čtečkách Urovo DT66: sken chodí přes IME (commitText), ne jako stisky kláves. Proto:
// - nikdy inputmode="none" (zavírá cestu, kterou sken chodí) – výchozí režim C (readonly trik), záloha B;
// - pole musí být viditelné a zaměřené; focus() se volá synchronně v obsluze klepnutí (z časovače ho Android ignoruje);
// - jediná cesta příjmu: zaměřené pole + událost input (žádný globální buffer kláves – dvě cesty si kradou text);
// - konec skenu = Enter, nebo pauza 250 ms od posledního input (některé kusy Enter neposílají) – pauza ale jen
//   u rychlého vstupu (skener); pomalé ruční psaní ukončí jen Enter nebo tlačítko OK.
import { toast } from './ui.js';

// Knihovna pro kameru, když prohlížeč nemá BarcodeDetector – pevná verze a kontrolní součet souboru.
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const ZXING_SRI = 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB';

const PAUZA_MS = 250; // konec skenu bez Enteru
const RYCHLE_MS = 50; // skener posílá znaky do ~50 ms po sobě (nebo celý kód najednou přes IME); člověk pomaleji
const READONLY_MS = 50;
const SKRYTI_MS = 400; // obrazovka bez skenování pole po překreslení skryje
const PLATNOST_SKENU_MS = 5000; // sken, pro který se nenajde obrazovka, se pak zahodí s upozorněním
const KONTROLA_STAVU_MS = 500; // jen ukazatel zelená/šedá, fokus se tím neopravuje

// Režim pole (volí se v diagnostice, pamatuje se v zařízení):
// C = obyčejné pole, fokus přes krátké readOnly (nevyskočí klávesnice) – výchozí; B = obyčejné textové pole.
export const REZIMY_POLE = {
  C: 'readonly při fokusu',
  B: 'obyčejné pole'
};
const KLIC_REZIMU = 'cs.rezimSkeneru';
let rezim = nactiRezim();
let casovacReadonly = null;

let obsluha = null; // funkce(kod) aktuální obrazovky; smí vrátit Promise
let zpracovava = false;
const fronta = []; // skeny čekající na zpracování {kod, cas}
let casovacSkryti = null;
let casovacPauzy = null;
let casovacFronty = null;
let skladani = false;
// Rychlost vstupu v poli: null = zatím nevíme (jeden znak), true = sken, false = ruční psaní.
let rychle = null;
let posledniInput = 0;
let delkaPred = 0;

const blok = () => document.getElementById('skener');
const pole = () => document.getElementById('sken');
const otevrenyDialog = () => document.querySelector('.modal');
const jeEditovatelne = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

function nactiRezim() {
  try {
    const r = localStorage.getItem(KLIC_REZIMU);
    return REZIMY_POLE[r] ? r : 'C'; // i dřívější „A“ (inputmode none) → C
  } catch {
    return 'C';
  }
}

export const rezimPole = () => rezim;

/** Přepne režim pole (C/B) a zapamatuje ho. Volá se z klepnutí, takže fokus projde. */
export function nastavRezimPole(novy) {
  if (!REZIMY_POLE[novy]) return;
  rezim = novy;
  try {
    localStorage.setItem(KLIC_REZIMU, novy);
  } catch { /* jen pro tuto chvíli */ }
  zamerPole();
}

/** Zpráva do diagnostiky (událost cs:diag). */
const diag = (text) => window.dispatchEvent(new CustomEvent('cs:diag', { detail: text }));

/**
 * Fokus do pole – volat synchronně z obsluhy klepnutí. Režim C: krátce readOnly, aby nevyskočila klávesnice
 * (vypnutí readOnly časovačem nevadí, fokus už je nastavený).
 */
export function zamerPole() {
  const p = pole();
  const b = blok();
  if (!p || b.hidden || otevrenyDialog()) return;
  const aktivni = document.activeElement;
  if (aktivni !== p && jeEditovatelne(aktivni)) return; // uživatel píše jinde
  if (aktivni !== p) {
    if (rezim === 'C') {
      clearTimeout(casovacReadonly);
      p.readOnly = true;
      p.focus({ preventScroll: true });
      casovacReadonly = setTimeout(() => { p.readOnly = false; }, READONLY_MS);
    } else {
      p.readOnly = false;
      p.focus({ preventScroll: true });
    }
  }
  aktualizujStav();
}

/**
 * Zobrazí skenovací pole s popiskem a nastaví, kdo skeny zpracuje.
 * Volá se při každém vykreslení obrazovky se skenováním – opakované volání jen změní popisek a obsluhu.
 */
export function zobrazSkener({ popisek, placeholder = '', priKodu }) {
  clearTimeout(casovacSkryti);
  const b = blok();
  b.querySelector('.skener-popisek').textContent = popisek;
  pole().placeholder = placeholder;
  obsluha = priKodu;
  if (b.hidden) {
    b.hidden = false;
    document.body.classList.add('se-skenerem');
  }
  // Vykreslení po klepnutí (✓, Uložit…) běží synchronně v jeho obsluze – fokus pak projde.
  zamerPole();
  zpracujFrontu();
  aktualizujStav();
}

/**
 * Ukáže a zaměří pole ještě před přechodem na skenovací obrazovku – volat v obsluze klepnutí
 * (dlaždice Kontrola lokace), protože obrazovka se vykreslí až po změně adresy, mimo klepnutí.
 */
export function pripravSkener() {
  clearTimeout(casovacSkryti);
  const b = blok();
  if (b.hidden) {
    b.querySelector('.skener-popisek').textContent = 'Načítám…';
    b.hidden = false;
    document.body.classList.add('se-skenerem');
  }
  zamerPole();
}

/** Skryje skenovací pole (obrazovka, kde se neskenuje, např. formulář). */
export function skryjSkener() {
  clearTimeout(casovacSkryti);
  obsluha = null;
  const b = blok();
  if (!b.hidden) {
    if (document.activeElement === pole()) pole().blur();
    b.hidden = true;
    document.body.classList.remove('se-skenerem');
  }
  aktualizujStav();
}

/**
 * Před překreslením obrazovky (app.js): skeny se do vykreslení nové obrazovky ukládají do fronty.
 * Když nová obrazovka skener nezobrazí, po chvíli se skryje.
 */
export function odpojSkener() {
  obsluha = null;
  clearTimeout(casovacSkryti);
  casovacSkryti = setTimeout(skryjSkener, SKRYTI_MS);
  aktualizujStav();
}

/** Stav pro diagnostiku. */
export function stavSkeneru() {
  return {
    rezim,
    zobrazen: !blok().hidden,
    obsluha: !!obsluha,
    zpracovava,
    fronta: fronta.map((f) => f.kod),
    vPoli: pole().value,
    vstup: rychle === null ? '?' : rychle ? 'rychlý (sken)' : 'ruční psaní',
    readOnly: pole().readOnly,
    inputmode: pole().getAttribute('inputmode') || '-',
    fokusVPoli: document.activeElement === pole()
  };
}

/* ---------- Příjem a zpracování skenů ---------- */

function prijmiKod(surovy, zdroj) {
  const kod = String(surovy ?? '').replace(/[\r\n\t]/g, '').trim();
  if (!kod) return;
  window.dispatchEvent(new CustomEvent('cs:sken', { detail: { kod, zdroj } }));
  // Obrazovka bez skenování (a žádné překreslení neprobíhá) – hned říct, kde skenovat.
  if (blok().hidden && !obsluha) {
    toast(`Kód ${kod} – skenovat lze v Kontrole lokace.`);
    return;
  }
  fronta.push({ kod, cas: Date.now() });
  zpracujFrontu();
}

/** Zpracuje skeny po jednom; během zpracování (načítání, dialog) další čekají ve frontě. */
async function zpracujFrontu() {
  if (zpracovava) return;
  while (fronta.length) {
    if (!obsluha) {
      // Obrazovka se právě překresluje – počkat na ni, ale ne donekonečna.
      clearTimeout(casovacFronty);
      casovacFronty = setTimeout(zahodStareSkeny, PLATNOST_SKENU_MS);
      return;
    }
    const { kod } = fronta.shift();
    zpracovava = true;
    aktualizujStav();
    try {
      await obsluha(kod);
    } catch (e) {
      toast(e?.message || String(e));
    } finally {
      zpracovava = false;
    }
  }
  aktualizujStav();
}

function zahodStareSkeny() {
  if (obsluha) return zpracujFrontu();
  const limit = Date.now() - PLATNOST_SKENU_MS;
  const stare = fronta.filter((f) => f.cas <= limit);
  if (!stare.length) return;
  fronta.splice(0, stare.length);
  toast(`Kód ${stare.map((f) => f.kod).join(', ')} tady nejde použít – skenuj v Kontrole lokace.`);
}

function odesliPole(zdroj) {
  clearTimeout(casovacPauzy);
  const p = pole();
  const kod = p.value;
  p.value = '';
  if (kod.trim()) diag(`${zdroj}: odesláno "${kod}" (${rychle === false ? 'psáno ručně' : 'rychlý vstup'})`);
  rychle = null;
  delkaPred = 0;
  prijmiKod(kod, 'pole');
  aktualizujStav();
}

/**
 * Po každém input: je to sken, nebo ruční psaní? Sken = celý text najednou (IME commitText), nebo znaky
 * do RYCHLE_MS po sobě. Jakmile přijde znak pomaleji (nebo mazání), je to ruční psaní až do odeslání pole.
 */
function zmerRychlost(e) {
  const delka = pole().value.length;
  const cas = e.timeStamp;
  if (!delka) {
    rychle = null;
  } else if (!delkaPred) {
    rychle = delka >= 2 ? true : null;
  } else if (rychle !== false) {
    const pridano = delka - delkaPred;
    if (pridano >= 2 || (pridano > 0 && cas - posledniInput <= RYCHLE_MS)) rychle = true;
    else rychle = false;
  }
  posledniInput = cas;
  delkaPred = delka;
}

/**
 * Konec skenu bez Enteru: 250 ms od posledního input – jen u rychlého vstupu (skener). Během skládání IME
 * se nečeká. Ručně psaný text čeká na Enter nebo OK.
 */
function naplanujPauzu() {
  clearTimeout(casovacPauzy);
  if (skladani || rychle !== true) return;
  casovacPauzy = setTimeout(() => {
    if (rychle === true && pole().value.trim()) odesliPole('pauza');
  }, PAUZA_MS);
}

function aktualizujStav() {
  const b = blok();
  if (!b) return;
  const pripraven = !b.hidden && !!obsluha && !zpracovava && document.activeElement === pole()
    && document.visibilityState === 'visible' && document.hasFocus();
  const rucne = rychle === false && !!pole().value.trim();
  b.classList.toggle('pripraven', pripraven);
  b.classList.toggle('rucne', rucne);
  b.querySelector('.skener-text').textContent = pripraven ? (rucne ? 'Píšeš ručně – potvrď Enterem nebo OK' : 'Připraveno ke skenování')
    : zpracovava || (!obsluha && fronta.length) ? 'Zpracovávám…' : 'Pole není aktivní – klepni sem';
}

/* ---------- Události ---------- */

function napoj() {
  const p = pole();
  const b = blok();
  p.removeAttribute('inputmode'); // pro jistotu, kdyby zůstal ve starém index.html z cache

  // Výška pole (mění se se šířkou a délkou popisku) – o tolik se odsadí obsah a patička s tlačítky.
  new ResizeObserver(() => {
    if (!b.hidden) document.documentElement.style.setProperty('--sken-vyska', b.offsetHeight + 'px');
  }).observe(b);

  // Enter: když už text v poli je, hned zpracovat; jinak ho dořeší pauza po input (IME může text doručit po Enteru).
  p.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.keyCode !== 13) return;
    diag(`Enter: v poli "${p.value}"${skladani ? ' (IME skládá)' : ''}`);
    setTimeout(() => diag(`Enter +100 ms: v poli "${p.value}"`), 100);
    if (p.value.trim() && !skladani) odesliPole('Enter');
  });
  p.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      e.preventDefault();
      if (p.value.trim()) odesliPole('konec řádku');
    }
  });
  p.addEventListener('input', (e) => {
    if (/[\r\n]/.test(p.value)) {
      p.value = p.value.replace(/[\r\n]/g, '');
      odesliPole('konec řádku');
    } else {
      zmerRychlost(e);
      naplanujPauzu();
      aktualizujStav();
    }
  });
  p.addEventListener('compositionstart', () => {
    skladani = true;
    clearTimeout(casovacPauzy);
  });
  p.addEventListener('compositionend', () => {
    skladani = false;
    naplanujPauzu();
  });

  // OK si fokus nebere – klávesnice zůstane otevřená a pole zaměřené.
  b.addEventListener('mousedown', (e) => {
    if (e.target.closest('[data-ok]')) e.preventDefault();
  });
  b.addEventListener('click', (e) => {
    if (e.target.closest('[data-ok]')) {
      if (p.value.trim()) odesliPole('OK');
    } else if (e.target.closest('[data-klavesnice]')) rucniZadani();
    else if (e.target.closest('[data-kamera]')) kamera();
  });

  // Klepnutí kamkoliv (✓, ✗, zavření dialogu, prázdné místo) → fokus do pole, synchronně v obsluze klepnutí.
  // Klepnutí na obyčejné pole formuláře fokus nechá tam.
  document.addEventListener('click', (e) => {
    if (jeEditovatelne(e.target) && e.target !== p) return;
    zamerPole();
  });
  document.addEventListener('visibilitychange', aktualizujStav);
  window.addEventListener('focus', aktualizujStav);
  window.addEventListener('blur', aktualizujStav);
  document.addEventListener('focusin', aktualizujStav);
  document.addEventListener('focusout', () => setTimeout(aktualizujStav, 0));
  // Jen kontrola stavu pro ukazatel – fokus se tím neopravuje (z časovače ho Android ignoruje).
  setInterval(aktualizujStav, KONTROLA_STAVU_MS);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', napoj);
else napoj();

/* ---------- Ruční zadání ---------- */

/** Dialog s obyčejným textovým polem – skenovací pole zůstává beze změny. */
function rucniZadani() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true">
    <b class="titulek">Zadat kód ručně</b>
    <p class="hint">Kód lokace (např. H2-P-37-1) nebo čárový kód zboží (EAN, DEK…, číslo položky).</p>
    <input class="rucni-kod" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done">
    <div class="row"><button class="btn gry" data-zrusit>Zrušit</button><button class="btn" data-pouzit>Použít</button></div>
  </div>`;
  const vstup = m.querySelector('input');
  const zavri = (kod) => {
    m.remove();
    zamerPole(); // klepnutí / Enter v dialogu – pořád v obsluze uživatelské akce
    if (kod) prijmiKod(kod, 'ručně');
  };
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-zrusit]')) zavri('');
    else if (e.target.closest('[data-pouzit]')) zavri(vstup.value);
  });
  vstup.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      zavri(vstup.value);
    }
  });
  document.body.appendChild(m);
  vstup.focus();
}

/* ---------- Kamera (jen za tlačítkem 📷, po skenu, Zrušit i odchodu z aplikace se vždy vypne) ---------- */
// Vlastní stream (vyšší rozlišení, ostření, přepnutí kamery, svítilna) a nad ním jeden ze dvou motorů:
// BarcodeDetector (vestavěný v Chrome) nebo ZXing (záloha). Motor, rozlišení a kamera jdou do diagnostiky.

// Formáty čárových kódů na zboží a štítcích (BarcodeDetector názvy → ZXing BarcodeFormat).
const FORMATY_KAMERY = {
  ean_13: 'EAN_13', ean_8: 'EAN_8', upc_a: 'UPC_A', upc_e: 'UPC_E',
  code_128: 'CODE_128', code_39: 'CODE_39', itf: 'ITF', qr_code: 'QR_CODE'
};
const KLIC_KAMERY = 'cs.kamera'; // zvolená zadní kamera (deviceId), pamatuje se v zařízení
const NEPRECTENO_MS = 10000; // po této době bez přečtení zápis do diagnostiky
const INTERVAL_DETEKCE_MS = 150;
const INTERVAL_ZXING_MS = 250; // ZXing dekóduje v hlavním vlákně – nechat čtečce čas

/** Diagnostika zapnutá (5× verze) – stejný klíč jako v diagnostika.js (import by udělal kruhovou závislost). */
const diagnostikaZapnuta = () => {
  try {
    return localStorage.getItem('cs.diagnostika') === '1';
  } catch {
    return false;
  }
};

/** Záznam do oddílu Kamera v diagnostice (zapisuje se vždy, panel ho ukáže a Odeslat výpis pošle do Log_chyb). */
const diagKamera = (text) => window.dispatchEvent(new CustomEvent('cs:kamera', { detail: text }));

async function kamera() {
  const kod = await skenujKamerou();
  if (kod) prijmiKod(kod, 'kamera');
}

/** Zadní kamery zařízení (podle názvu); když žádná název nemá, všechny kamery. Názvy jsou až po povolení kamery. */
async function zadniKamery() {
  const vse = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const zadni = vse.filter((d) => /back|rear|environment|zadn|facing back/i.test(d.label));
  return zadni.length ? zadni : vse;
}

/** Motor: BarcodeDetector s formáty, které zařízení umí, jinak ZXing (TRY_HARDER + POSSIBLE_FORMATS). */
async function vytvorMotor(vynutitZxing) {
  if (!vynutitZxing && 'BarcodeDetector' in window) {
    const umi = await BarcodeDetector.getSupportedFormats().catch(() => []);
    const formaty = Object.keys(FORMATY_KAMERY).filter((f) => umi.includes(f));
    if (formaty.length) {
      const detektor = new BarcodeDetector({ formats: formaty });
      return { nazev: 'BarcodeDetector', formaty, cti: async (video) => (await detektor.detect(video))[0]?.rawValue || null };
    }
  }
  await nactiZxing();
  const Z = window.ZXing;
  const formaty = Object.keys(FORMATY_KAMERY);
  const napovedy = new Map();
  napovedy.set(Z.DecodeHintType.TRY_HARDER, true);
  napovedy.set(Z.DecodeHintType.POSSIBLE_FORMATS, formaty.map((f) => Z.BarcodeFormat[FORMATY_KAMERY[f]]));
  const ctecka = new Z.MultiFormatReader();
  ctecka.setHints(napovedy);
  const platno = document.createElement('canvas');
  const kresli = platno.getContext('2d', { willReadFrequently: true });
  return {
    nazev: 'ZXing',
    formaty,
    // Celý snímek v plném rozlišení videa (malé kódy na vzdálenějším zboží).
    cti: async (video) => {
      platno.width = video.videoWidth;
      platno.height = video.videoHeight;
      kresli.drawImage(video, 0, 0);
      try {
        const bitmapa = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(platno)));
        return ctecka.decodeWithState(bitmapa).getText();
      } catch (e) {
        if (e instanceof Z.NotFoundException || e?.name === 'NotFoundException') return null;
        throw e;
      }
    }
  };
}

/** Otevře náhled kamery a vrátí první přečtený kód, nebo null (Zrušit, chyba, odchod z aplikace). */
function skenujKamerou() {
  return new Promise((hotovo) => {
    const diag = diagnostikaZapnuta();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="box kamera">
      <b class="titulek">Namiř kameru na čárový kód</b>
      <video playsinline muted></video>
      <div class="kamera-diag" ${diag ? '' : 'hidden'}>Spouštím kameru…</div>
      <div class="row kamera-tlacitka">
        <button class="btn gry" data-prepnout hidden>🔄 Přepnout kameru</button>
        <button class="btn gry" data-svitilna hidden>🔦 Svítilna</button>
      </div>
      ${diag ? `<div class="row kamera-tlacitka"><button class="btn gry" data-motor>Motor ⇄</button>
        <button class="btn gry" data-odeslat>Odeslat výpis</button></div>` : ''}
      <button class="btn gry block" data-zrusit>Zrušit</button>
    </div>`;
    document.body.appendChild(el);
    const video = el.querySelector('video');
    const radekDiag = el.querySelector('.kamera-diag');
    const tlPrepnout = el.querySelector('[data-prepnout]');
    const tlSvitilna = el.querySelector('[data-svitilna]');
    let stream = null;
    let stopa = null;
    let motor = null;
    let svitilna = false;
    let hotovoUz = false;
    let start = 0;
    let zapsanoNeprecteno = false;
    let casovac = null;

    const zastavStream = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      stopa = null;
      video.srcObject = null;
    };
    const popis = () => {
      const s = stopa?.getSettings?.() || {};
      const c = stopa?.getCapabilities?.() || {};
      return `motor ${motor?.nazev || '?'} · video ${video.videoWidth}×${video.videoHeight}`
        + ` · kamera "${stopa?.label || '?'}" · ostření ${s.focusMode || '–'}${c.torch ? ' · svítilna ano' : ''}`
        + ` · formáty ${motor?.formaty.join(', ') || '?'}`;
    };
    const ukazDiag = () => { radekDiag.textContent = popis(); };
    const priSkryti = () => {
      if (document.visibilityState === 'hidden') konec(null);
    };
    const konec = (kod) => {
      if (hotovoUz) return;
      hotovoUz = true;
      clearTimeout(casovac);
      // Kameru vždy vypnout – po skenu, Zrušit i odchodu z aplikace.
      zastavStream();
      document.removeEventListener('visibilitychange', priSkryti);
      el.remove();
      if (kod) {
        diagKamera(`přečteno za ${Math.round((Date.now() - start) / 100) / 10} s: "${kod}" (${motor?.nazev})`);
        if (navigator.vibrate) navigator.vibrate(60);
      }
      hotovo(kod || null);
    };

    /** Spustí (nebo vymění) stream – vyšší rozlišení, zadní kamera, případně konkrétní zvolená. */
    const spustStream = async (deviceId) => {
      zastavStream();
      const zaklad = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { ...zaklad, deviceId: { exact: deviceId } } : { ...zaklad, facingMode: { ideal: 'environment' } },
          audio: false
        });
      } catch (e) {
        if (!deviceId) throw e;
        // Zapamatovaná kamera už není (jiné zařízení, odpojená) – výchozí zadní.
        stream = await navigator.mediaDevices.getUserMedia({ video: { ...zaklad, facingMode: { ideal: 'environment' } }, audio: false });
      }
      if (hotovoUz) return zastavStream();
      stopa = stream.getVideoTracks()[0];
      video.srcObject = stream;
      await video.play();
      const umi = stopa.getCapabilities?.() || {};
      if (umi.focusMode?.includes('continuous')) {
        await stopa.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      svitilna = false;
      tlSvitilna.hidden = !umi.torch;
      tlSvitilna.classList.remove('on');
      start = Date.now();
      zapsanoNeprecteno = false;
      ukazDiag();
      diagKamera('spuštěna: ' + popis());
    };

    const smycka = async () => {
      if (hotovoUz) return;
      if (motor && stopa && video.readyState >= 2) {
        try {
          const kod = await motor.cti(video);
          if (kod) return konec(kod);
        } catch (e) {
          diagKamera(`chyba čtení (${motor.nazev}): ${e?.message || e}`);
        }
        if (!zapsanoNeprecteno && Date.now() - start > NEPRECTENO_MS) {
          zapsanoNeprecteno = true;
          diagKamera(`kód se nepřečetl do ${NEPRECTENO_MS / 1000} s – ${popis()}`);
          if (diag) radekDiag.textContent = popis() + ' · 10 s nic';
        }
      }
      casovac = setTimeout(smycka, motor?.nazev === 'ZXing' ? INTERVAL_ZXING_MS : INTERVAL_DETEKCE_MS);
    };

    // Zrušit je klepnutí – fokus do pole projde (document click po odstranění dialogu).
    el.querySelector('[data-zrusit]').addEventListener('click', () => konec(null));
    tlPrepnout.addEventListener('click', async () => {
      try {
        const kamery = await zadniKamery();
        const aktualni = stopa?.getSettings?.().deviceId;
        const dalsi = kamery[(kamery.findIndex((k) => k.deviceId === aktualni) + 1) % kamery.length];
        if (!dalsi || dalsi.deviceId === aktualni) return toast('Jiná zadní kamera tu není.');
        try {
          localStorage.setItem(KLIC_KAMERY, dalsi.deviceId);
        } catch { /* jen pro tuto chvíli */ }
        await spustStream(dalsi.deviceId);
        toast('Kamera: ' + (stopa?.label || dalsi.label || 'další'));
      } catch (e) {
        toast('Kameru nejde přepnout: ' + (e?.message || e));
      }
    });
    tlSvitilna.addEventListener('click', () => {
      svitilna = !svitilna;
      stopa?.applyConstraints({ advanced: [{ torch: svitilna }] })
        .then(() => tlSvitilna.classList.toggle('on', svitilna))
        .catch(() => toast('Svítilnu nejde zapnout.'));
    });
    el.querySelector('[data-motor]')?.addEventListener('click', async () => {
      motor = await vytvorMotor(motor?.nazev === 'BarcodeDetector').catch((e) => {
        toast(e.message);
        return motor;
      });
      start = Date.now();
      zapsanoNeprecteno = false;
      ukazDiag();
      diagKamera('přepnut motor: ' + popis());
    });
    el.querySelector('[data-odeslat]')?.addEventListener('click', () => window.dispatchEvent(new Event('cs:diag-odeslat')));
    document.addEventListener('visibilitychange', priSkryti);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Prohlížeč nepodporuje kameru.');
      let ulozena = null;
      try {
        ulozena = localStorage.getItem(KLIC_KAMERY);
      } catch { /* bez úložiště výchozí kamera */ }
      motor = await vytvorMotor(false);
      await spustStream(ulozena);
      if (hotovoUz) return;
      tlPrepnout.hidden = (await zadniKamery()).length < 2;
      smycka();
    })().catch((e) => {
      if (hotovoUz) return;
      diagKamera('nejde spustit: ' + (e?.message || e));
      toast('Kameru nejde spustit: ' + (e?.message || e));
      konec(null);
    });
  });
}

let zxing = null;
/** ZXing ze service workeru (stáhne se s aplikací do cache – funguje i bez signálu), kontrolní součet ověří prohlížeč. */
function nactiZxing() {
  if (window.ZXing) return Promise.resolve();
  zxing = zxing || new Promise((hotovo, chyba) => {
    const s = document.createElement('script');
    s.src = ZXING_URL;
    s.integrity = ZXING_SRI;
    s.crossOrigin = 'anonymous';
    s.onload = () => hotovo();
    s.onerror = () => {
      zxing = null;
      chyba(new Error('Knihovnu pro kameru se nepodařilo načíst (je signál?).'));
    };
    document.head.appendChild(s);
  });
  return zxing;
}
