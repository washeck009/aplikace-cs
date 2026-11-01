/**
 * Menu v tabulce, založení listů a správa uživatelů přes dialogy.
 * Dialogy fungují jen při spuštění z menu v tabulce (ne z editoru Apps Scriptu).
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Aplikace CS')
    .addItem('Založit / doplnit listy (setup)', 'menuSetup')
    .addSeparator()
    .addItem('Přidat uživatele', 'menuPridatUzivatele')
    .addItem('Resetovat PIN / odemknout uživatele', 'menuResetovatPin')
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
 * a pokud ještě není žádný admin, založí prvního (jméno přes dialog nebo parametr; PIN si nastaví při prvním
 * přihlášení – `pinAdmina` jen pro testy). Spouštět lze opakovaně – nic existujícího nepřepíše.
 */
function setup(jmenoAdmina, pinAdmina) {
  sZamkem_(function () {
    zalozListy_();
    doplnNastaveni_();
    doplnOpravneni_();
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
  }
  try {
    pridejUzivatele_(jmenoAdmina, 'admin', pinAdmina);
  } catch (e) {
    oznam_('Administrátor nebyl založen: ' + e.message + ' Spusť setup znovu.');
    return;
  }
  oznam_('Hotovo. Listy jsou založené. Administrátor „' + text_(jmenoAdmina) + '“ si PIN nastaví hned při prvním '
    + 'přihlášení v aplikaci (vybere své jméno → Nastav si PIN) – udělej to co nejdřív.');
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

/**
 * Přidá uživatele – jen jméno a role, bez PINu: PIN si uživatel nastaví sám při prvním přihlášení v aplikaci.
 * Role i jako „Skladník“ nebo číslo 1–4. `pin` je nepovinný (jen pro testy a skripty – uloží se hash se solí).
 */
function pridejUzivatele_(jmeno, role, pin) {
  jmeno = text_(jmeno).replace(/\s+/g, ' ');
  const klicRole = normalizujRoli_(role);
  pin = upravPin_(pin);
  if (!jmeno) throw new Error('Jméno je prázdné – napiš jméno, které se bude zobrazovat v aplikaci.');
  if (!klicRole) throw new Error(chybaRole_(role));
  if (pin && !platnyPin_(pin)) throw new Error(CHYBA_PINU);

  sZamkem_(function () {
    const existuje = nactiList_('Uzivatele').radky.some(function (u) {
      return text_(u.jmeno).toLowerCase() === jmeno.toLowerCase();
    });
    if (existuje) throw new Error('Uživatel „' + jmeno + '“ už v listu Uzivatele je. Zapomenutý PIN vyřeší Resetovat PIN.');
    const sul = pin ? novaSul_() : '';
    pridejRadky_('Uzivatele', [{
      id: noveId_(),
      jmeno: jmeno,
      role: klicRole,
      pin_hash: pin ? hashPinu_(String(pin), sul) : '',
      pin_salt: sul,
      aktivni: true,
      chybne_pokusy: 0,
      zamceno_do: ''
    }]);
  });
}

/** Reset PINu podle jména (menu tabulky): smaže PIN, odemkne účet, odhlásí ze všech zařízení. Vrátí jméno z listu. */
function resetujPin_(jmeno) {
  return sZamkem_(function () {
    const u = najdiUzivatelePodleJmena_(nactiList_('Uzivatele').radky, jmeno);
    resetujPinUzivatele_(u);
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
  try {
    pridejUzivatele_(jmeno, role);
    ui.alert('Hotovo', 'Uživatel „' + text_(jmeno) + '“ přidán jako ' + NAZVY_ROLI[normalizujRoli_(role)]
      + '. PIN si nastaví sám při prvním přihlášení v aplikaci (vybere své jméno → Nastav si PIN).', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Uživatel nebyl přidán', e.message, ui.ButtonSet.OK);
  }
}

function menuResetovatPin() {
  const ui = uiNeboChyba_();
  const titulek = 'Resetovat PIN / odemknout';
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
  const kdo = text_(najdiUzivatelePodleJmena_(radky, jmeno).jmeno);
  const ano = ui.alert(titulek, 'Smazat PIN uživatele „' + kdo + '“? Odhlásí se ze všech zařízení a při dalším přihlášení '
    + 'si nastaví nový PIN sám.', ui.ButtonSet.OK_CANCEL);
  if (ano !== ui.Button.OK) return;
  try {
    resetujPin_(jmeno);
    ui.alert('Hotovo', 'PIN uživatele „' + kdo + '“ je smazaný a účet odemčený. Při dalším přihlášení si nastaví nový PIN.',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('PIN nebyl resetován', e.message, ui.ButtonSet.OK);
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
