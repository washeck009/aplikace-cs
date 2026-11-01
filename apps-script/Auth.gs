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

/** Triviální PIN: všechny číslice stejné (1111) nebo vzestupná / sestupná řada (0123, 1234, 4321, 9876). */
function jeTrivialniPin_(pin) {
  const c = String(pin).split('').map(Number);
  const rada = function (krok) { return c.every(function (x, i) { return i === 0 || x - c[i - 1] === krok; }); };
  return rada(0) || rada(1) || rada(-1);
}

/** Kontrola PINu, který si uživatel volí sám (nastavení, změna). */
function overNovyPin_(pin) {
  if (!platnyPin_(pin)) throw chyba_('PIN musí mít přesně 4 číslice.');
  if (jeTrivialniPin_(pin)) {
    throw chyba_('Tenhle PIN se dá snadno uhodnout (stejné číslice nebo řada jako 1234 / 4321). Zvol jiný.', 'SLABY_PIN');
  }
}

/** Má uživatel nastavený PIN? Bez PINu si ho nastaví sám při prvním přihlášení. */
function maPin_(u) {
  return !!text_(u.pin_hash) && !!text_(u.pin_salt);
}

/**
 * Ověří PIN uživatele (volat pod zámkem). Při chybě započítá pokus a po ZAMEK_POKUSU zamkne účet;
 * vyhodí chybu pro uživatele. Při úspěchu vynuluje pokusy.
 */
function overPinUzivatele_(u, pin) {
  const ted = new Date();
  if (u.zamceno_do instanceof Date && u.zamceno_do > ted) {
    throw chyba_('Účet je zamčený do ' + cas_(u.zamceno_do) + ' (příliš mnoho chybných PINů).', 'ZAMCENO');
  }
  if (hashPinu_(String(pin), text_(u.pin_salt)) !== text_(u.pin_hash)) {
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
}

/** Uloží nový PIN (hash se solí) a odemkne účet. */
function ulozPin_(u, pin) {
  const sul = novaSul_();
  u.pin_hash = hashPinu_(String(pin), sul);
  u.pin_salt = sul;
  upravRadek_('Uzivatele', u._radek, { pin_hash: u.pin_hash, pin_salt: sul, chybne_pokusy: 0, zamceno_do: '' });
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

// Role podle čísla v dialogu (1–4) a české názvy pro hlášky.
const ROLE_PODLE_CISLA = ['skladnik', 'vedouci', 'manazer', 'admin'];
const NAZVY_ROLI = { skladnik: 'skladník', vedouci: 'vedoucí', manazer: 'manažer', admin: 'admin (správce)' };

function bezDiakritiky_(text) {
  return text_(text).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Role z dialogu nebo z listu: „skladník“, „Vedoucí“, „MANAŽER“, „správce“ i číslo 1–4.
 * Vrátí klíč role (skladnik, vedouci, manazer, admin), nebo '' když roli nezná.
 */
function normalizujRoli_(vstup) {
  const t = bezDiakritiky_(vstup).toLowerCase().replace(/\s+/g, '');
  if (/^[1-4]$/.test(t)) return ROLE_PODLE_CISLA[Number(t) - 1];
  if (t === 'spravce' || t === 'administrator') return 'admin';
  return ROLE_UROVEN[t] ? t : '';
}

/** Role uživatele z listu; neznámá role zůstane, jak je (oprávnění pak nemá žádné). */
function roleUzivatele_(u) {
  return normalizujRoli_(u.role) || text_(u.role);
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
    role: roleUzivatele_(uzivatel),
    // Klient podle seznamu skrývá dlaždice a tlačítka; rozhoduje vždy server.
    opravneni: opravneniRole_(roleUzivatele_(uzivatel)),
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
    role: roleUzivatele_(u),
    opravneni: opravneniRole_(roleUzivatele_(u)),
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
    if (!maPin_(u)) throw chyba_('Ještě nemáš nastavený PIN – nastav si ho.', 'BEZ_PINU');
    overPinUzivatele_(u, pin);
    return vytvorToken_(u);
  });
}

/** Po výběru jména: má uživatel PIN? Bez PINu ukáže aplikace „Nastav si PIN“. */
function akceLoginInfo_(data) {
  const u = najdiUzivatele_(data.jmeno);
  if (!u) throw chyba_('Uživatel není v seznamu (nebo je vypnutý).');
  return { jmeno: text_(u.jmeno), pin_nastaven: maPin_(u) };
}

/**
 * {jmeno, pin} – první nastavení PINu uživatelem bez PINu (nový uživatel nebo po resetu). Jen když PIN nemá;
 * pak rovnou přihlásí. Triviální PINy (1111, 1234, 4321…) odmítne.
 */
function akcePinNastav_(data) {
  const pin = String(data.pin || '');
  overNovyPin_(pin);
  return sZamkem_(function () {
    const u = najdiUzivatele_(data.jmeno);
    if (!u) throw chyba_('Uživatel není v seznamu (nebo je vypnutý).');
    if (maPin_(u)) throw chyba_('PIN už je nastavený. Přihlas se jím, nebo požádej vedoucího o reset PINu.', 'PIN_NASTAVEN');
    ulozPin_(u, pin);
    zrusTokenyUzivatele_(text_(u.id));
    return vytvorToken_(u);
  });
}

/**
 * Můj účet – změna PINu (všechny role): {stary, novy}. Špatný starý PIN se počítá do zámku účtu jako při přihlášení.
 * Ostatní přihlášení uživatele se zruší; vrátí nový token pro toto zařízení.
 */
function akceUcetPin_(data, uzivatel) {
  const novy = String(data.novy || '');
  overNovyPin_(novy);
  if (String(data.stary || '') === novy) throw chyba_('Nový PIN je stejný jako současný.');
  return sZamkem_(function () {
    const u = nactiList_('Uzivatele').radky.filter(function (r) { return text_(r.id) === uzivatel.id; })[0];
    if (!u || !maPin_(u)) throw chyba_('Účet nemá PIN – odhlas se a nastav si ho při přihlášení.');
    overPinUzivatele_(u, String(data.stary || ''));
    ulozPin_(u, novy);
    zrusTokenyUzivatele_(text_(u.id));
    return vytvorToken_(u);
  });
}

/**
 * Reset PINu (Správa nebo menu tabulky): smaže PIN, odemkne účet a odhlásí uživatele ze všech zařízení.
 * Při dalším přihlášení si uživatel nastaví nový PIN sám. Volat pod zámkem.
 */
function resetujPinUzivatele_(u) {
  u.pin_hash = '';
  u.pin_salt = '';
  upravRadek_('Uzivatele', u._radek, { pin_hash: '', pin_salt: '', chybne_pokusy: 0, zamceno_do: '' });
  zrusTokenyUzivatele_(text_(u.id));
}

function akceLogout_(data, uzivatel) {
  PropertiesService.getScriptProperties().deleteProperty(uzivatel._klic);
  return true;
}

function akceJa_(data, uzivatel) {
  return { jmeno: uzivatel.jmeno, role: uzivatel.role, opravneni: uzivatel.opravneni, platnost: uzivatel.platnost };
}
