/**
 * Přihlášení: PIN (hash se solí), tokeny do konce dne, zámek po chybných PINech, role.
 */

/** SHA-256 ze soli a PINu jako hex řetězec. */
function hashPinu_(pin, sul) {
  return sha256Hex_(sul + ':' + pin);
}

function sha256Hex_(text) {
  const bajty = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bajty.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function novaSul_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function platnyPin_(pin) {
  return /^\d{4}$/.test(String(pin));
}

/** Dnešní půlnoc (konec dne v časovém pásmu skriptu). */
function konecDne_() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Najde aktivního uživatele podle jména (bez ohledu na velikost písmen). */
function najdiUzivatele_(jmeno) {
  const hledane = text_(jmeno).toLowerCase();
  return nactiList_('Uzivatele').radky.filter(function (u) {
    return jeAno_(u.aktivni, true) && text_(u.jmeno).toLowerCase() === hledane;
  })[0] || null;
}

function maRoli_(uzivatel, minimalniRole) {
  return (ROLE_UROVEN[uzivatel.role] || 0) >= (ROLE_UROVEN[minimalniRole] || 99);
}

/* ---------- Tokeny ---------- */

function vytvorToken_(uzivatel) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const platnost = konecDne_();
  const vlastnosti = PropertiesService.getScriptProperties();
  uklidTokeny_(vlastnosti);
  vlastnosti.setProperty(PREFIX_TOKENU + sha256Hex_(token),
    JSON.stringify({ id: text_(uzivatel.id), platnost: platnost.getTime() }));
  return {
    token: token,
    jmeno: text_(uzivatel.jmeno),
    role: text_(uzivatel.role),
    platnost: platnost.toISOString()
  };
}

/** Smaže tokeny, kterým skončila platnost. */
function uklidTokeny_(vlastnosti) {
  const vse = vlastnosti.getProperties();
  const ted = Date.now();
  Object.keys(vse).forEach(function (k) {
    if (k.indexOf(PREFIX_TOKENU) !== 0) return;
    try {
      if (JSON.parse(vse[k]).platnost < ted) vlastnosti.deleteProperty(k);
    } catch (e) {
      vlastnosti.deleteProperty(k);
    }
  });
}

/** Zruší všechna přihlášení uživatele (po změně PINu). */
function zrusTokenyUzivatele_(idUzivatele) {
  const vlastnosti = PropertiesService.getScriptProperties();
  const vse = vlastnosti.getProperties();
  Object.keys(vse).forEach(function (k) {
    if (k.indexOf(PREFIX_TOKENU) !== 0) return;
    try {
      if (JSON.parse(vse[k]).id === String(idUzivatele)) vlastnosti.deleteProperty(k);
    } catch (e) { /* poškozený záznam smaže úklid */ }
  });
}

/** Ověří token a vrátí přihlášeného uživatele {id, jmeno, role, platnost}. */
function overToken_(token) {
  if (!token) throw chyba_('Nejsi přihlášený.', 'TOKEN');
  const vlastnosti = PropertiesService.getScriptProperties();
  const klic = PREFIX_TOKENU + sha256Hex_(String(token));
  const ulozeny = vlastnosti.getProperty(klic);
  if (!ulozeny) throw chyba_('Přihlášení vypršelo, přihlas se znovu.', 'TOKEN');
  const t = JSON.parse(ulozeny);
  if (t.platnost < Date.now()) {
    vlastnosti.deleteProperty(klic);
    throw chyba_('Přihlášení vypršelo, přihlas se znovu.', 'TOKEN');
  }
  const u = nactiList_('Uzivatele').radky.filter(function (r) { return text_(r.id) === t.id; })[0];
  if (!u || !jeAno_(u.aktivni, true)) {
    vlastnosti.deleteProperty(klic);
    throw chyba_('Účet není aktivní.', 'TOKEN');
  }
  return {
    id: t.id,
    jmeno: text_(u.jmeno),
    role: text_(u.role),
    platnost: new Date(t.platnost).toISOString(),
    _klic: klic
  };
}

/* ---------- Akce API ---------- */

/** Jména aktivních uživatelů pro přihlašovací obrazovku (nic dalšího). */
function akceSeznamUzivatelu_() {
  return nactiList_('Uzivatele').radky
    .filter(function (u) { return jeAno_(u.aktivni, true) && text_(u.jmeno); })
    .map(function (u) { return text_(u.jmeno); })
    .sort(function (a, b) { return a.localeCompare(b, 'cs'); });
}

/** Jméno + PIN → token platný do konce dne. Po 5 chybách zámek na 10 minut. */
function akceLogin_(data) {
  const jmeno = text_(data.jmeno);
  const pin = String(data.pin || '');
  if (!jmeno || !platnyPin_(pin)) throw chyba_('Vyber jméno a zadej 4místný PIN.');

  return sZamkem_(function () {
    const u = najdiUzivatele_(jmeno);
    if (!u) throw chyba_('Neplatné jméno nebo PIN.', 'PIN');

    const ted = new Date();
    if (u.zamceno_do instanceof Date && u.zamceno_do > ted) {
      throw chyba_('Účet je zamčený do ' + cas_(u.zamceno_do) + ' (příliš mnoho chybných PINů).', 'ZAMCENO');
    }

    if (hashPinu_(pin, text_(u.pin_salt)) !== text_(u.pin_hash)) {
      const pokusy = (Number(u.chybne_pokusy) || 0) + 1;
      if (pokusy >= ZAMEK_POKUSU) {
        const zamekDo = new Date(ted.getTime() + ZAMEK_MINUT * 60000);
        upravRadek_('Uzivatele', u._radek, { chybne_pokusy: 0, zamceno_do: zamekDo });
        throw chyba_('Špatný PIN. Účet je zamčený na ' + ZAMEK_MINUT + ' minut (do ' + cas_(zamekDo) + ').', 'ZAMCENO');
      }
      upravRadek_('Uzivatele', u._radek, { chybne_pokusy: pokusy });
      throw chyba_('Špatný PIN. Zbývá pokusů: ' + (ZAMEK_POKUSU - pokusy) + '.', 'PIN');
    }

    if (u.chybne_pokusy || u.zamceno_do) upravRadek_('Uzivatele', u._radek, { chybne_pokusy: 0, zamceno_do: '' });
    return vytvorToken_(u);
  });
}

function akceLogout_(data, uzivatel) {
  PropertiesService.getScriptProperties().deleteProperty(uzivatel._klic);
  return true;
}

function akceJa_(data, uzivatel) {
  return { jmeno: uzivatel.jmeno, role: uzivatel.role, platnost: uzivatel.platnost };
}
