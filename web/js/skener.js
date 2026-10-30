// Skenování: pole pro hardwarový skener Urovo (režim klávesnice – kód + Enter) a záložní skenování kamerou.
import { esc, toast } from './ui.js';

// Knihovna pro kameru, když prohlížeč nemá BarcodeDetector – pevná verze a kontrolní součet souboru.
const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const ZXING_SRI = 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB';

const VSTUPNI_PRVKY = ['INPUT', 'TEXTAREA', 'SELECT'];

// Skenovací pole na aktuální obrazovce – drží fokus, aby skener vždy psal do něj.
let aktivniPole = null;

/**
 * HTML skenovacího pole. Pole má inputmode="none", takže na čtečce nevyskakuje klávesnice;
 * ⌨ ji zapne pro ruční zadání, 📷 skenuje kamerou.
 */
export function skenovaciPole(popisek, placeholder) {
  return `<div class="scan">
    <label for="sken">${esc(popisek)}</label>
    <div class="scan-radek">
      <input id="sken" inputmode="none" autocomplete="off" autocapitalize="characters" autocorrect="off"
        spellcheck="false" enterkeyhint="go" placeholder="${esc(placeholder)}">
      <button type="button" class="scan-btn" data-klavesnice aria-label="Napsat kód ručně">⌨</button>
      <button type="button" class="scan-btn" data-kamera aria-label="Skenovat kamerou">📷</button>
    </div>
  </div>`;
}

/** Napojí skenovací pole v `koren`: Enter předá kód funkci `priKodu`. */
export function napojSkener(koren, priKodu) {
  const pole = koren.querySelector('#sken');
  aktivniPole = pole;
  pole.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const kod = pole.value.trim();
    pole.value = '';
    pole.inputMode = 'none';
    if (kod) priKodu(kod);
  });
  koren.querySelector('[data-klavesnice]').addEventListener('click', () => {
    // Změna inputmode se projeví až po novém fokusu.
    pole.inputMode = 'text';
    pole.blur();
    pole.focus();
  });
  koren.querySelector('[data-kamera]').addEventListener('click', async () => {
    const kod = await skenujKamerou();
    if (kod) priKodu(kod.trim());
  });
  pole.focus({ preventScroll: true });
}

function vratFokus() {
  if (!aktivniPole?.isConnected || document.querySelector('.modal')) return;
  if (VSTUPNI_PRVKY.includes(document.activeElement?.tagName)) return;
  aktivniPole.focus({ preventScroll: true });
}

// Po každém klepnutí (✓, ✗, …) vrátit fokus do skenovacího pole.
document.addEventListener('click', () => setTimeout(vratFokus, 0));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') vratFokus();
});

// Pojistka: když skener „píše“ a fokus je jinde (na tlačítku), znaky patří do skenovacího pole.
// Enter na tlačítku by jinak tlačítko stiskl.
document.addEventListener('keydown', (e) => {
  if (!aktivniPole?.isConnected || e.target === aktivniPole || document.querySelector('.modal')) return;
  if (VSTUPNI_PRVKY.includes(e.target.tagName)) return;
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    aktivniPole.focus({ preventScroll: true });
    aktivniPole.value += e.key;
  } else if (e.key === 'Enter' && aktivniPole.value) {
    e.preventDefault();
    aktivniPole.focus({ preventScroll: true });
    aktivniPole.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
});

/* ---------- Kamera ---------- */

/** Otevře náhled kamery a vrátí první přečtený kód, nebo null (Zrušit, chyba). */
export function skenujKamerou() {
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
