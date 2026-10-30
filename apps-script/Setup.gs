/**
 * Menu v tabulce, založení listů a správa uživatelů přes dialogy.
 * Dialogy fungují jen při spuštění z menu v tabulce (ne z editoru Apps Scriptu).
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Aplikace CS')
    .addItem('Založit / doplnit listy (setup)', 'menuSetup')
    .addSeparator()
    .addItem('Přidat uživatele', 'menuPridatUzivatele')
    .addItem('Změnit PIN / odemknout uživatele', 'menuZmenitPin')
    .addSeparator()
    .addItem('Povolit fotky (Google Disk)', 'menuFotky')
    .addSeparator()
    .addItem('Plánovač – spustit teď', 'menuPlanovacTed')
    .addItem('Plánovač – zapnout denní spouštění (5:30)', 'menuInstalovatPlanovac')
    .addToUi();
}

/**
 * Vyžádá oprávnění ke Google Disku a založí složky na fotky obou podniků (pokud nejsou).
 * Bez tohoto povolení webová aplikace fotky nenahraje.
 */
function menuFotky() {
  const slozky = Object.keys(PODNIKY).map(function (podnik) {
    return PODNIKY[podnik] + ': ' + slozkaFotek_(podnik).getName();
  });
  oznam_('Fotky jsou povolené. Složky na Google Disku:\n' + slozky.join('\n'));
}

function menuSetup() {
  setup();
}

/**
 * Založí chybějící listy a sloupce, doplní výchozí nastavení obou podniků
 * a pokud ještě není žádný admin, založí prvního (jméno a PIN přes dialog nebo parametry).
 * Spouštět lze opakovaně – nic existujícího nepřepíše.
 */
function setup(jmenoAdmina, pinAdmina) {
  sZamkem_(function () {
    zalozListy_();
    doplnNastaveni_();
  });

  const maAdmina = nactiList_('Uzivatele').radky.some(function (u) {
    return roleUzivatele_(u) === 'admin' && jeAno_(u.aktivni, true);
  });
  if (maAdmina) {
    oznam_('Listy a nastavení jsou v pořádku. Administrátor už existuje.');
    return;
  }

  if (typeof jmenoAdmina !== 'string') {
    const ui = uiNeboChyba_();
    jmenoAdmina = zeptejSe_(ui, 'První administrátor', 'Jméno administrátora (tak, jak se bude zobrazovat v aplikaci):');
    if (jmenoAdmina === null) return;
    pinAdmina = zeptejSe_(ui, 'PIN administrátora', 'Zadej 4místný PIN (jen číslice). Nikomu ho neukazuj.');
    if (pinAdmina === null) return;
  }
  try {
    pridejUzivatele_(jmenoAdmina, 'admin', pinAdmina);
  } catch (e) {
    oznam_('Administrátor nebyl založen: ' + e.message + ' Spusť setup znovu.');
    return;
  }
  oznam_('Hotovo. Listy jsou založené a administrátor „' + text_(jmenoAdmina) + '“ se může přihlásit.');
}

/** Založí chybějící listy, doplní chybějící sloupce a nastaví formáty. */
function zalozListy_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(LISTY).forEach(function (nazev) {
    const list = ss.getSheetByName(nazev) || ss.insertSheet(nazev);
    const stavajici = hlavickaListu_(list);
    const chybi = LISTY[nazev].filter(function (s) { return stavajici.indexOf(s) < 0; });
    if (chybi.length) list.getRange(1, stavajici.length + 1, 1, chybi.length).setValues([chybi]);

    const hlavicka = hlavickaListu_(list);
    list.getRange(1, 1, 1, hlavicka.length).setFontWeight('bold').setBackground('#e6f0fa');
    list.setFrozenRows(1);

    const radku = list.getMaxRows() - 1;
    if (radku < 1) return;
    const formatuj = function (sloupce, format) {
      (sloupce || []).forEach(function (s) {
        const c = hlavicka.indexOf(s);
        if (c >= 0) list.getRange(2, c + 1, radku, 1).setNumberFormat(format);
      });
    };
    formatuj(TEXTOVE_SLOUPCE[nazev], '@');
    formatuj(DATUMOVE_SLOUPCE[nazev], 'd.M.yyyy H:mm');
    formatuj(DATUMOVE_SLOUPCE_BEZ_CASU[nazev], 'd.M.yyyy');
  });

  // Prázdný výchozí list nové tabulky („List 1“, „Sheet1“) už nepotřebujeme.
  ss.getSheets().forEach(function (list) {
    if (!LISTY[list.getName()] && /^(List|Sheet|Hárok)\s?\d+$/.test(list.getName())
        && list.getLastRow() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(list);
    }
  });
}

/** Doplní řádky nastavení, které pro podnik ještě chybí (existující hodnoty nemění). */
function doplnNastaveni_() {
  const existujici = {};
  nactiList_('Nastaveni').radky.forEach(function (r) {
    existujici[text_(r.podnik) + '|' + text_(r.klic)] = true;
  });
  const nove = [];
  Object.keys(PODNIKY).forEach(function (podnik) {
    VYCHOZI_NASTAVENI.forEach(function (n) {
      if (existujici[podnik + '|' + n[0]]) return;
      nove.push({ podnik: podnik, klic: n[0], hodnota: podnik === 'DEK' ? n[2] : n[3], popis: n[1] });
    });
  });
  pridejRadky_('Nastaveni', nove);
}

const TEXT_ROLI = 'Napiš číslo nebo název role:\n1 = skladník\n2 = vedoucí\n3 = manažer\n4 = admin (správce)';
const CHYBA_PINU = 'PIN musí mít přesně 4 číslice, např. 0427 – bez písmen a mezer.';

/** PIN z dialogu bez mezer (např. „04 27“). */
function upravPin_(pin) {
  return text_(pin).replace(/\s+/g, '');
}

function chybaRole_(role) {
  return (text_(role) ? 'Roli „' + text_(role) + '“ neznám.' : 'Role není vyplněná.')
    + ' Napiš číslo 1–4 (1 skladník, 2 vedoucí, 3 manažer, 4 admin) nebo název role – velká písmena ani háčky nevadí.';
}

/**
 * Najde uživatele podle jména – velikost písmen nevadí, háčky a čárky taky ne (když je shoda jednoznačná).
 * Když ho nenajde, vyhodí srozumitelnou chybu.
 */
function najdiUzivatelePodleJmena_(radky, jmeno) {
  const hledane = text_(jmeno).replace(/\s+/g, ' ').toLowerCase();
  if (!hledane) throw new Error('Jméno je prázdné – napiš jméno uživatele tak, jak je v listu Uzivatele.');
  const presne = radky.filter(function (u) { return text_(u.jmeno).toLowerCase() === hledane; });
  if (presne.length) return presne[0];
  const bez = bezDiakritiky_(hledane);
  const podobne = radky.filter(function (u) { return bezDiakritiky_(u.jmeno).toLowerCase() === bez; });
  if (podobne.length === 1) return podobne[0];
  if (podobne.length > 1) {
    throw new Error('Jménu „' + text_(jmeno) + '“ odpovídá víc uživatelů ('
      + podobne.map(function (u) { return text_(u.jmeno); }).join(', ') + '). Napiš ho přesně i s háčky a čárkami.');
  }
  throw new Error('Uživatel „' + text_(jmeno) + '“ v listu Uzivatele není. Zkontroluj jméno ve sloupci jmeno '
    + '(velká písmena ani háčky nevadí), nebo ho přidej přes Přidat uživatele.');
}

/** Přidá uživatele s PINem (uloží jen hash se solí). Role i jako „Skladník“ nebo číslo 1–4. */
function pridejUzivatele_(jmeno, role, pin) {
  jmeno = text_(jmeno).replace(/\s+/g, ' ');
  const klicRole = normalizujRoli_(role);
  pin = upravPin_(pin);
  if (!jmeno) throw new Error('Jméno je prázdné – napiš jméno, které se bude zobrazovat v aplikaci.');
  if (!klicRole) throw new Error(chybaRole_(role));
  if (!platnyPin_(pin)) throw new Error(CHYBA_PINU);

  sZamkem_(function () {
    const existuje = nactiList_('Uzivatele').radky.some(function (u) {
      return text_(u.jmeno).toLowerCase() === jmeno.toLowerCase();
    });
    if (existuje) throw new Error('Uživatel „' + jmeno + '“ už v listu Uzivatele je. PIN mu změníš v menu Změnit PIN / odemknout uživatele.');
    const sul = novaSul_();
    pridejRadky_('Uzivatele', [{
      id: noveId_(),
      jmeno: jmeno,
      role: klicRole,
      pin_hash: hashPinu_(String(pin), sul),
      pin_salt: sul,
      aktivni: true,
      chybne_pokusy: 0,
      zamceno_do: ''
    }]);
  });
}

/** Nastaví uživateli nový PIN, zruší zámek a odhlásí ho ze všech zařízení. Vrátí jméno z listu. */
function zmenPin_(jmeno, pin) {
  pin = upravPin_(pin);
  if (!platnyPin_(pin)) throw new Error(CHYBA_PINU);
  return sZamkem_(function () {
    const u = najdiUzivatelePodleJmena_(nactiList_('Uzivatele').radky, jmeno);
    const sul = novaSul_();
    upravRadek_('Uzivatele', u._radek, {
      pin_hash: hashPinu_(String(pin), sul),
      pin_salt: sul,
      chybne_pokusy: 0,
      zamceno_do: ''
    });
    zrusTokenyUzivatele_(text_(u.id));
    return text_(u.jmeno);
  });
}

function menuPridatUzivatele() {
  const ui = uiNeboChyba_();
  const titulek = 'Nový uživatel';
  const jmeno = zeptejSeDokud_(ui, titulek, 'Jméno (tak, jak se bude zobrazovat v aplikaci):', function (t) {
    return t ? '' : 'Jméno je prázdné.';
  });
  if (jmeno === null) return;
  const role = zeptejSeDokud_(ui, titulek, 'Role pro „' + jmeno + '“. ' + TEXT_ROLI, function (t) {
    return normalizujRoli_(t) ? '' : chybaRole_(t);
  });
  if (role === null) return;
  const pin = zeptejSeDokud_(ui, titulek, 'PIN – 4 číslice. Sděl ho uživateli osobně.', function (t) {
    return platnyPin_(upravPin_(t)) ? '' : CHYBA_PINU;
  });
  if (pin === null) return;
  try {
    pridejUzivatele_(jmeno, role, pin);
    ui.alert('Hotovo', 'Uživatel „' + text_(jmeno) + '“ přidán jako ' + NAZVY_ROLI[normalizujRoli_(role)]
      + '. Přihlásí se jménem a PINem.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Uživatel nebyl přidán', e.message, ui.ButtonSet.OK);
  }
}

function menuZmenitPin() {
  const ui = uiNeboChyba_();
  const titulek = 'Změnit PIN / odemknout';
  const radky = nactiList_('Uzivatele').radky;
  const jmeno = zeptejSeDokud_(ui, titulek, 'Jméno uživatele (velká písmena ani háčky nevadí):', function (t) {
    try {
      najdiUzivatelePodleJmena_(radky, t);
      return '';
    } catch (e) {
      return e.message;
    }
  });
  if (jmeno === null) return;
  const pin = zeptejSeDokud_(ui, titulek, 'Nový PIN – 4 číslice:', function (t) {
    return platnyPin_(upravPin_(t)) ? '' : CHYBA_PINU;
  });
  if (pin === null) return;
  try {
    const kdo = zmenPin_(jmeno, pin);
    ui.alert('Hotovo', 'PIN uživatele „' + kdo + '“ je změněný a účet odemčený. Na všech zařízeních se musí přihlásit znovu.',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('PIN nebyl změněn', e.message, ui.ButtonSet.OK);
  }
}

/* ---------- Dialogy ---------- */

function uiNeboChyba_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    throw new Error('Dialog nejde otevřít z editoru. Spusť to z tabulky: menu Aplikace CS.');
  }
}

/** Zeptá se dialogem; vrátí oříznutý text, nebo null při Zrušit. */
function zeptejSe_(ui, titulek, otazka) {
  const odpoved = ui.prompt(titulek, otazka, ui.ButtonSet.OK_CANCEL);
  if (odpoved.getSelectedButton() !== ui.Button.OK) return null;
  return odpoved.getResponseText().trim();
}

/**
 * Ptá se, dokud odpověď neprojde kontrolou (`chyba(text)` vrátí '' = v pořádku, jinak text chyby,
 * který se ukáže v dalším dotazu). Vrátí odpověď, nebo null při Zrušit.
 */
function zeptejSeDokud_(ui, titulek, otazka, chyba) {
  let text = otazka;
  for (;;) {
    const odpoved = zeptejSe_(ui, titulek, text);
    if (odpoved === null) return null;
    const problem = chyba(odpoved);
    if (!problem) return odpoved;
    text = '⚠ ' + problem + '\n\n' + otazka;
  }
}

/** Upozornění v tabulce, nebo do protokolu, když dialog nejde zobrazit. */
function oznam_(text) {
  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (e) {
    console.log(text);
  }
}
