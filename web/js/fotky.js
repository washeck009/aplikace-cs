// Fotky: výběr z fotoaparátu a zmenšení v prohlížeči (max 1600 px, JPEG 0,8), než jdou do fronty.
const MAX_STRANA = 1600;
const KVALITA = 0.8;

/** Otevře fotoaparát (na PC výběr souboru). Vrátí {dataUrl, base64}, nebo null, když uživatel nic nevybral. */
export function vyfotit() {
  return new Promise((hotovo, chyba) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.addEventListener('change', () => {
      const soubor = input.files?.[0];
      if (!soubor) return hotovo(null);
      zmensi(soubor).then(hotovo, chyba);
    });
    input.addEventListener('cancel', () => hotovo(null));
    input.click();
  });
}

async function zmensi(soubor) {
  const url = URL.createObjectURL(soubor);
  try {
    // <img> respektuje otočení z EXIF, takže fotka z mobilu nebude ležet.
    const img = await new Promise((ok, chyba) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => chyba(new Error('Fotku nejde načíst.'));
      i.src = url;
    });
    const pomer = Math.min(1, MAX_STRANA / Math.max(img.naturalWidth, img.naturalHeight));
    const platno = document.createElement('canvas');
    platno.width = Math.round(img.naturalWidth * pomer);
    platno.height = Math.round(img.naturalHeight * pomer);
    platno.getContext('2d').drawImage(img, 0, 0, platno.width, platno.height);
    const dataUrl = platno.toDataURL('image/jpeg', KVALITA);
    return { dataUrl, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
