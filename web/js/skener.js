// Skenování: jedno trvalé pole pro hardwarový skener Urovo (v index.html, mimo překreslovanou část obrazovky).
// Skener (IME) zůstává navázaný na prvek, do kterého psal – pole se proto nikdy nenahrazuje a nemění se mu inputmode.
// Pojistky: sken zachycený i mimo pole, fronta skenů během překreslení, ruční zadání v dialogu a kamera.
import { toast } from './ui.js';

// Knihovna pro kameru, když prohlížeč nemá BarcodeDetector – pevná verze a kontrolní součet souboru.
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const ZXING_SRI = 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB';

const MEZI_ZNAKY_MS = 50; // skener píše rychleji, člověk pomaleji
const PAUZA_MS = 100; // konec skenu bez Enteru
const NAVRAT_FOKUSU_MS = 50;
const SKRYTI_MS = 400; // obrazovka bez skenování pole po překreslení skryje
const PLATNOST_SKENU_MS = 5000; // sken, pro který se nenajde obrazovka, se pak zahodí s upozorněním
const MIN_DELKA = 3;

let obsluha = null; // funkce(kod) aktuální obrazovky; smí vrátit Promise
let zpracovava = false;
const fronta = []; // skeny čekající na zpracování {kod, cas}
let casovacSkryti = null;
let casovacPauzy = null;
let casovacFronty = null;
let skladani = false;
const buffer = { text: '', posledni: 0, casovac: null };

const blok = () => document.getElementById('skener');
const pole = () => document.getElementById('sken');
const otevrenyDialog = () => document.querySelector('.modal');
const jeEditovatelne = (el) => !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

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
    vratFokus();
  } else if (document.activeElement !== pole()) {
    vratFokus();
  }
  zpracujFrontu();
  aktualizujStav();
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
    zobrazen: !blok().hidden,
    obsluha: !!obsluha,
    zpracovava,
    fronta: fronta.map((f) => f.kod),
    vPoli: pole().value,
    buffer: buffer.text,
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
  // Po skenu fokus „odpojit a znovu připojit“, aby skener psal do aktuálního pole.
  vratFokus();
}

function zahodStareSkeny() {
  if (obsluha) return zpracujFrontu();
  const limit = Date.now() - PLATNOST_SKENU_MS;
  const stare = fronta.filter((f) => f.cas <= limit);
  if (!stare.length) return;
  fronta.splice(0, stare.length);
  toast(`Kód ${stare.map((f) => f.kod).join(', ')} tady nejde použít – skenuj v Kontrole lokace.`);
}

/** blur() a po chvíli focus() – obnoví spojení skeneru s polem. Nic nedělá, když uživatel píše jinde. */
export function vratFokus() {
  const p = pole();
  if (!p || blok().hidden || otevrenyDialog() || document.visibilityState !== 'visible') return;
  const aktivni = document.activeElement;
  if (aktivni !== p && jeEditovatelne(aktivni)) return;
  p.blur();
  setTimeout(() => {
    const a = document.activeElement;
    if (blok().hidden || otevrenyDialog() || (a !== p && jeEditovatelne(a))) return;
    p.focus({ preventScroll: true });
    aktualizujStav();
  }, NAVRAT_FOKUSU_MS);
}

function odesliPole() {
  clearTimeout(casovacPauzy);
  const p = pole();
  const kod = p.value;
  p.value = '';
  prijmiKod(kod, 'pole');
}

function naplanujPauzu() {
  clearTimeout(casovacPauzy);
  if (skladani) return;
  casovacPauzy = setTimeout(() => {
    if (pole().value.trim().length >= MIN_DELKA) odesliPole();
  }, PAUZA_MS);
}

function dokonciBuffer() {
  clearTimeout(buffer.casovac);
  const text = buffer.text;
  buffer.text = '';
  if (text.length >= MIN_DELKA) prijmiKod(text, 'mimo pole');
  else vratFokus();
}

function aktualizujStav() {
  const b = blok();
  if (!b) return;
  const pripraven = !b.hidden && !!obsluha && !zpracovava && document.activeElement === pole()
    && document.visibilityState === 'visible' && document.hasFocus();
  b.classList.toggle('pripraven', pripraven);
  b.querySelector('.skener-text').textContent = pripraven ? 'Připraveno ke skenování'
    : zpracovava || (!obsluha && fronta.length) ? 'Zpracovávám…' : 'Pole není aktivní – klepni sem';
}

/* ---------- Události ---------- */

function napoj() {
  const p = pole();
  const b = blok();

  // Výška pole (mění se se šířkou a délkou popisku) – o tolik se odsadí obsah a patička s tlačítky.
  new ResizeObserver(() => {
    if (!b.hidden) document.documentElement.style.setProperty('--sken-vyska', b.offsetHeight + 'px');
  }).observe(b);

  p.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      odesliPole();
    }
  });
  // Některé klávesnice (IME) pošlou konec řádku jen jako beforeinput/input, ne jako klávesu Enter.
  p.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
      e.preventDefault();
      odesliPole();
    }
  });
  p.addEventListener('input', () => {
    if (/[\r\n]/.test(p.value)) odesliPole();
    else naplanujPauzu();
  });
  p.addEventListener('compositionstart', () => {
    skladani = true;
    clearTimeout(casovacPauzy);
  });
  p.addEventListener('compositionend', () => {
    skladani = false;
    naplanujPauzu();
  });

  b.addEventListener('click', (e) => {
    if (e.target.closest('[data-klavesnice]')) rucniZadani();
    else if (e.target.closest('[data-kamera]')) kamera();
    else vratFokus();
  });

  // Pojistka: znaky, které přijdou mimo pole (fokus na tlačítku, v dialogu bez pole…), skládat do bufferu.
  // Na přihlášení ne – tam číslice z klávesnice čtečky zadávají PIN.
  document.addEventListener('keydown', (e) => {
    if (e.target === p || jeEditovatelne(e.target) || document.querySelector('.pinpad')) return;
    if (e.key === 'Enter' || e.keyCode === 13) {
      if (buffer.text) {
        e.preventDefault(); // Enter ze skeneru nesmí stisknout tlačítko s fokusem
        dokonciBuffer();
      }
      return;
    }
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const ted = performance.now();
      if (buffer.text && ted - buffer.posledni > MEZI_ZNAKY_MS) buffer.text = ''; // pomalé psání člověka
      buffer.text += e.key;
      buffer.posledni = ted;
      e.preventDefault();
      clearTimeout(buffer.casovac);
      buffer.casovac = setTimeout(dokonciBuffer, PAUZA_MS);
    } else if (e.key === 'Unidentified' || e.keyCode === 229) {
      // Znak přes IME mimo pole se přečíst nedá – aspoň hned vrátit fokus, ať další znaky jdou do pole.
      if (!otevrenyDialog()) p.focus({ preventScroll: true });
    }
  }, true);

  // Po každém klepnutí, návratu do aplikace a zavření dialogu vrátit fokus do pole.
  document.addEventListener('click', () => setTimeout(vratFokus, 0));
  document.addEventListener('visibilitychange', () => {
    aktualizujStav();
    if (document.visibilityState === 'visible') vratFokus();
  });
  window.addEventListener('focus', vratFokus);
  window.addEventListener('blur', aktualizujStav);
  window.addEventListener('cs:dialog-zavren', vratFokus);
  document.addEventListener('focusin', aktualizujStav);
  document.addEventListener('focusout', () => setTimeout(aktualizujStav, 0));
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
    <p class="hint">Kód lokace (např. H2-P-37-1) nebo EAN zboží.</p>
    <input class="rucni-kod" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="done">
    <div class="row"><button class="btn gry" data-zrusit>Zrušit</button><button class="btn" data-pouzit>Použít</button></div>
  </div>`;
  const vstup = m.querySelector('input');
  const zavri = (kod) => {
    m.remove();
    if (kod) prijmiKod(kod, 'ručně');
    window.dispatchEvent(new Event('cs:dialog-zavren'));
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

/* ---------- Kamera ---------- */

async function kamera() {
  const kod = await skenujKamerou();
  if (kod) prijmiKod(kod, 'kamera');
  window.dispatchEvent(new Event('cs:dialog-zavren'));
}

/** Otevře náhled kamery a vrátí první přečtený kód, nebo null (Zrušit, chyba). */
function skenujKamerou() {
  return new Promise((hotovo) => {
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="box kamera">
      <b class="titulek">Namiř kameru na čárový kód</b>
      <video playsinline muted></video>
      <button class="btn gry block" data-zrusit>Zrušit</button>
    </div>`;
    document.body.appendChild(el);
    const video = el.querySelector('video');
    let stream = null;
    let ctecka = null;
    let hotovoUz = false;

    const konec = (kod) => {
      if (hotovoUz) return;
      hotovoUz = true;
      stream?.getTracks().forEach((t) => t.stop());
      try { ctecka?.reset(); } catch { /* už zastavená */ }
      el.remove();
      if (kod && navigator.vibrate) navigator.vibrate(60);
      hotovo(kod || null);
    };
    el.querySelector('[data-zrusit]').addEventListener('click', () => konec(null));

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Prohlížeč nepodporuje kameru.');
      if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).length) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (hotovoUz) return konec(null);
        video.srcObject = stream;
        await video.play();
        const detektor = new BarcodeDetector();
        const smycka = async () => {
          if (hotovoUz) return;
          try {
            const nalezy = await detektor.detect(video);
            if (nalezy.length) return konec(nalezy[0].rawValue);
          } catch { /* snímek se nepovedl, zkusit další */ }
          setTimeout(smycka, 150);
        };
        smycka();
      } else {
        await nactiZxing();
        if (hotovoUz) return;
        ctecka = new window.ZXing.BrowserMultiFormatReader();
        const vysledek = await ctecka.decodeOnceFromConstraints({ video: { facingMode: 'environment' } }, video);
        konec(vysledek.getText());
      }
    })().catch((e) => {
      if (hotovoUz) return;
      toast('Kameru nejde spustit: ' + (e?.message || e));
      konec(null);
    });
  });
}

let zxing = null;
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
