/**
 * @OnlyCurrentDoc
 * JSON API pro PWA: POST {action, token, data} → {ok, data} nebo {ok: false, error, kod}.
 * Klient posílá Content-Type text/plain (CORS bez preflightu), tělo je JSON.
 */

/**
 * Seznam akcí. Bez `prihlaseni` = bez přihlášení; `prihlaseni: true` = stačí platné přihlášení;
 * `opravneni` = klíč oprávnění (nebo pole – stačí jedno z nich) podle listu Opravneni (MODULY_OPRAVNENI);
 * `role: 'admin'` = jen admin (oprávnění samotná). Nový modul přidá své akce s vlastními klíči oprávnění.
 * Ve funkci, ne v konstantě – funkce z ostatních souborů nemusí být při načtení souboru ještě definované.
 */
function mapaAkci_() {
  return {
    'uzivatele.seznam': { fn: akceSeznamUzivatelu_ },
    'login': { fn: akceLogin_ },
    'login.info': { fn: akceLoginInfo_ },
    'pin.nastav': { fn: akcePinNastav_ },
    'ucet.pin': { prihlaseni: true, fn: akceUcetPin_ },
    'logout': { prihlaseni: true, fn: akceLogout_ },
    'ja': { prihlaseni: true, fn: akceJa_ },
    'data.zaklad': { prihlaseni: true, fn: akceDataZaklad_ },
    'kontroly.dnes': { prihlaseni: true, fn: akceKontrolyDnes_ },
    'diagnostika.odesli': { prihlaseni: true, fn: akceDiagnostikaOdesli_ },
    // Expirace – čtečka
    'lokace.nacti': { opravneni: 'kontrola', fn: akceLokaceNacti_ },
    'lokace.dokonci': { opravneni: 'kontrola', fn: akceLokaceDokonci_ },
    'foto.nahraj': { opravneni: 'kontrola', fn: akceFotoNahraj_ },
    'zaznam.stav': { opravneni: 'vydano', fn: akceZaznamStav_ },
    'ukoly.moje': { opravneni: 'moje_ukoly', fn: akceUkolyMoje_ },
    // Expirace – řízení (úkoly ke čtení vidí, kdo má přehledy nebo zadávání)
    'prehled.data': { opravneni: 'prehledy', fn: akcePrehledData_ },
    'zaznamy.seznam': { opravneni: 'zaznamy', fn: akceZaznamySeznam_ },
    'kontroly.log': { opravneni: 'zaznamy', fn: akceKontrolyLog_ },
    'ukoly.seznam': { opravneni: ['prehledy', 'ukoly_zadavani'], fn: akceUkolySeznam_ },
    'ukoly.zadej': { opravneni: 'ukoly_zadavani', fn: akceUkolyZadej_ },
    'ukoly.zrus': { opravneni: 'ukoly_zadavani', fn: akceUkolyZrus_ },
    // Správa (účty adminů spravuje jen admin – hlídá Sprava.gs)
    'sprava.uzivatele': { opravneni: 'sprava_uzivatelu', fn: akceSpravaUzivatele_ },
    'sprava.uzivatel.uloz': { opravneni: 'sprava_uzivatelu', fn: akceSpravaUzivatelUloz_ },
    'sprava.uzivatel.reset': { opravneni: 'sprava_uzivatelu', fn: akceSpravaUzivatelReset_ },
    'import.info': { opravneni: 'importy', fn: akceImportInfo_ },
    'import.polozky': { opravneni: 'importy', fn: akceImportPolozky_ },
    'import.lokace': { opravneni: 'importy', fn: akceImportLokace_ },
    'import.stav': { opravneni: 'importy', fn: akceImportStav_ },
    'sprava.polozky': { opravneni: 'importy', fn: akceSpravaPolozky_ },
    'sprava.polozka.uloz': { opravneni: 'importy', fn: akceSpravaPolozkaUloz_ },
    'sprava.nastaveni': { opravneni: 'nastaveni', fn: akceSpravaNastaveni_ },
    'sprava.nastaveni.uloz': { opravneni: 'nastaveni', fn: akceSpravaNastaveniUloz_ },
    // Oprávnění samotná nastavuje jen admin (admin má vždy vše).
    'opravneni.nacti': { role: 'admin', fn: akceOpravneniNacti_ },
    'opravneni.uloz': { role: 'admin', fn: akceOpravneniUloz_ }
  };
}

function doPost(e) {
  let pozadavek = {};
  let uzivatel = null;
  try {
    try {
      pozadavek = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (chybaJson) {
      throw chyba_('Neplatný požadavek.');
    }
    const akce = mapaAkci_()[pozadavek.action];
    if (!akce) throw chyba_('Neznámá akce: ' + pozadavek.action);
    if (akce.prihlaseni || akce.opravneni || akce.role) {
      uzivatel = overToken_(pozadavek.token);
      const smi = akce.role ? maRoli_(uzivatel, akce.role) : !akce.opravneni || maOpravneni_(uzivatel, akce.opravneni);
      if (!smi) throw chyba_('Na tuto akci nemáš oprávnění.', 'ROLE');
    }
    return odpoved_({ ok: true, data: akce.fn(pozadavek.data || {}, uzivatel) });
  } catch (err) {
    if (err && err.kod) return odpoved_({ ok: false, error: err.message, kod: err.kod });
    zalogujChybu_(pozadavek.action, err, uzivatel && uzivatel.jmeno);
    return odpoved_({ ok: false, error: 'Chyba na serveru: ' + ((err && err.message) || err), kod: 'SERVER' });
  }
}

/** Otevření adresy v prohlížeči – jen kontrola, že nasazení funguje. */
function doGet() {
  return ContentService.createTextOutput('Aplikace CS – API běží. Tuto adresu vlož do web/config.js.');
}

/** Výpis diagnostiky skenování z čtečky → řádek v listu Log_chyb (na čtečce nejde kopírovat do schránky). */
function akceDiagnostikaOdesli_(data, uzivatel) {
  const text = String(data.text || '').slice(0, 45000); // buňka pojme max. 50 000 znaků
  if (!text) throw chyba_('Výpis je prázdný.');
  sZamkem_(function () {
    pridejRadky_('Log_chyb', [{ cas: new Date(), akce: 'diagnostika skenování', uzivatel: uzivatel.jmeno, chyba: text }]);
  });
  return true;
}

function odpoved_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function overPodnik_(podnik) {
  if (!PODNIKY[podnik]) throw chyba_('Neznámý podnik: ' + podnik);
  return podnik;
}

/** Nastavení podniku jako objekt {klic: hodnota}; číselné hodnoty jako čísla, prázdné jako null. */
function nactiNastaveni_(podnik) {
  const vysledek = {};
  nactiList_('Nastaveni').radky.forEach(function (r) {
    if (text_(r.podnik) !== podnik || !text_(r.klic)) return;
    const h = r.hodnota;
    if (h === '' || h === null) vysledek[text_(r.klic)] = null;
    else if (typeof h === 'number') vysledek[text_(r.klic)] = h;
    else if (/^-?\d+([.,]\d+)?$/.test(text_(h))) vysledek[text_(r.klic)] = Number(text_(h).replace(',', '.'));
    else vysledek[text_(r.klic)] = text_(h);
  });
  return vysledek;
}

/**
 * Číselník, lokace, záznamy „Na lokaci“ a nastavení podniku – klient si je uloží do cache,
 * aby šlo lokaci zobrazit i bez signálu.
 */
function akceDataZaklad_(data) {
  const podnik = overPodnik_(data.podnik);

  const polozky = nactiList_('Polozky').radky
    .filter(function (r) { return text_(r.podnik) === podnik && jeAno_(r.aktivni, true); })
    .map(function (r) {
      return {
        ean: text_(r.ean),
        cislo_polozky: text_(r.cislo_polozky),
        nazev: text_(r.nazev),
        k_doplneni: jeAno_(r.k_doplneni)
      };
    });

  const lokace = nactiList_('Lokace').radky
    .filter(function (r) { return text_(r.podnik) === podnik && jeAno_(r.aktivni, true); })
    .map(function (r) {
      return {
        kod: text_(r.kod),
        hala: text_(r.hala),
        rada: text_(r.rada),
        sloupec: text_(r.sloupec),
        nosnik: text_(r.nosnik),
        zona: text_(r.zona),
        k_overeni: jeAno_(r.k_overeni)
      };
    });

  const zaznamy = nactiList_('Zaznamy').radky
    .filter(function (r) { return text_(r.podnik) === podnik && jeNaLokaci_(r); })
    .map(zaznamProKlienta_);

  const nastaveni = nactiNastaveni_(podnik);
  NASTAVENI_JEN_SERVER.forEach(function (k) { delete nastaveni[k]; });

  return {
    podnik: podnik,
    polozky: polozky,
    lokace: lokace,
    zaznamy: zaznamy,
    nastaveni: nastaveni,
    stazeno: new Date().toISOString()
  };
}
