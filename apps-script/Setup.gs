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
    return text_(u.role) === 'admin' && jeAno_(u.aktivni, true);
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

/** Přidá uživatele s PINem (uloží jen hash se solí). */
function pridejUzivatele_(jmeno, role, pin) {
  jmeno = text_(jmeno);
  role = text_(role).toLowerCase();
  if (!jmeno) throw new Error('Jméno nesmí být prázdné.');
  if (!ROLE_UROVEN[role]) throw new Error('Neznámá role „' + role + '“. Povolené: ' + Object.keys(ROLE_UROVEN).join(', ') + '.');
  if (!platnyPin_(pin)) throw new Error('PIN musí mít přesně 4 číslice.');

  sZamkem_(function () {
    const existuje = nactiList_('Uzivatele').radky.some(function (u) {
      return text_(u.jmeno).toLowerCase() === jmeno.toLowerCase();
    });
    if (existuje) throw new Error('Uživatel „' + jmeno + '“ už existuje.');
    const sul = novaSul_();
    pridejRadky_('Uzivatele', [{
      id: noveId_(),
      jmeno: jmeno,
      role: role,
      pin_hash: hashPinu_(String(pin), sul),
      pin_salt: sul,
      aktivni: true,
      chybne_pokusy: 0,
      zamceno_do: ''
    }]);
  });
}

/** Nastaví uživateli nový PIN, zruší zámek a odhlásí ho ze všech zařízení. */
function zmenPin_(jmeno, pin) {
  if (!platnyPin_(pin)) throw new Error('PIN musí mít přesně 4 číslice.');
  sZamkem_(function () {
    const u = nactiList_('Uzivatele').radky.filter(function (r) {
      return text_(r.jmeno).toLowerCase() === text_(jmeno).toLowerCase();
    })[0];
    if (!u) throw new Error('Uživatel „' + text_(jmeno) + '“ neexistuje.');
    const sul = novaSul_();
    upravRadek_('Uzivatele', u._radek, {
      pin_hash: hashPinu_(String(pin), sul),
      pin_salt: sul,
      chybne_pokusy: 0,
      zamceno_do: ''
    });
    zrusTokenyUzivatele_(text_(u.id));
  });
}

function menuPridatUzivatele() {
  const ui = uiNeboChyba_();
  const jmeno = zeptejSe_(ui, 'Nový uživatel', 'Jméno (tak, jak se bude zobrazovat v aplikaci):');
  if (jmeno === null) return;
  const role = zeptejSe_(ui, 'Nový uživatel', 'Role – napiš jednu z: skladnik, vedouci, manazer, admin');
  if (role === null) return;
  const pin = zeptejSe_(ui, 'Nový uživatel', 'PIN – 4 číslice. Sděl ho uživateli osobně.');
  if (pin === null) return;
  try {
    pridejUzivatele_(jmeno, role, pin);
    ui.alert('Uživatel „' + text_(jmeno) + '“ přidán.');
  } catch (e) {
    ui.alert('Nepodařilo se: ' + e.message);
  }
}

function menuZmenitPin() {
  const ui = uiNeboChyba_();
  const jmeno = zeptejSe_(ui, 'Změnit PIN', 'Jméno uživatele:');
  if (jmeno === null) return;
  const pin = zeptejSe_(ui, 'Změnit PIN', 'Nový PIN – 4 číslice:');
  if (pin === null) return;
  try {
    zmenPin_(jmeno, pin);
    ui.alert('PIN změněn, účet odemčen. Uživatel se musí znovu přihlásit.');
  } catch (e) {
    ui.alert('Nepodařilo se: ' + e.message);
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

/** Upozornění v tabulce, nebo do protokolu, když dialog nejde zobrazit. */
function oznam_(text) {
  try {
    SpreadsheetApp.getUi().alert(text);
  } catch (e) {
    console.log(text);
  }
}
