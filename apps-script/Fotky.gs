/**
 * Fotky z čtečky: JPEG (base64, zmenšený už v prohlížeči) → Google Disk, do složky podniku z listu Nastaveni.
 * Fotka je sdílená „kdokoli s odkazem“ – vedoucí ji otevřou i bez Google účtu.
 */

const MAX_FOTKA_ZNAKU = 8 * 1024 * 1024; // base64 – zmenšená fotka má typicky do 1 MB

/** {podnik, id_fotky, lokace, ean, base64} → {url}. Opakované nahrání téže fotky vrátí stejný soubor. */
function akceFotoNahraj_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  const idFotky = text_(data.id_fotky);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idFotky)) throw chyba_('Chybí ID fotky.');
  const base64 = String(data.base64 || '');
  if (!base64 || base64.length > MAX_FOTKA_ZNAKU) throw chyba_('Fotka chybí nebo je příliš velká.');

  const lokace = normalizujKod_(data.lokace).replace(/[^A-Z0-9.-]/g, '_');
  const ean = text_(data.ean).replace(/\D/g, '');
  const nazev = [lokace, ean, idFotky].filter(String).join('_') + '.jpg';

  const slozka = slozkaFotek_(podnik);
  const existujici = slozka.getFilesByName(nazev);
  if (existujici.hasNext()) return { url: existujici.next().getUrl() };

  const soubor = slozka.createFile(Utilities.newBlob(Utilities.base64Decode(base64), 'image/jpeg', nazev));
  soubor.setDescription(PODNIKY[podnik] + ' · lokace ' + lokace + ' · EAN ' + ean + ' · ' + uzivatel.jmeno);
  try {
    soubor.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    zalogujChybu_('foto.nahraj – sdílení odkazem', e, uzivatel.jmeno);
  }
  return { url: soubor.getUrl() };
}

/**
 * Složka na fotky podniku podle `slozka_fotky_id` v Nastaveni.
 * Je-li hodnota prázdná, založí složku „Aplikace CS – fotky – <podnik>“ a její ID do Nastaveni zapíše.
 */
function slozkaFotek_(podnik) {
  const id = text_(nactiNastaveni_(podnik).slozka_fotky_id);
  if (id) return otevriSlozku_(id, podnik);

  return sZamkem_(function () {
    const nastaveni = nactiList_('Nastaveni');
    const radek = nastaveni.radky.filter(function (r) {
      return text_(r.podnik) === podnik && text_(r.klic) === 'slozka_fotky_id';
    })[0];
    // Mezitím ji mohl založit jiný požadavek.
    if (radek && text_(radek.hodnota)) return otevriSlozku_(text_(radek.hodnota), podnik);

    const slozka = DriveApp.createFolder('Aplikace CS – fotky – ' + PODNIKY[podnik]);
    if (radek) {
      upravRadek_('Nastaveni', radek._radek, { hodnota: slozka.getId() });
    } else {
      pridejRadky_('Nastaveni', [{ podnik: podnik, klic: 'slozka_fotky_id', hodnota: slozka.getId(),
        popis: 'ID složky na Google Disku pro fotky' }]);
    }
    return slozka;
  });
}

function otevriSlozku_(id, podnik) {
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    throw chyba_('Složka na fotky (' + PODNIKY[podnik] + ') nejde otevřít – zkontroluj slozka_fotky_id v listu Nastaveni.');
  }
}
