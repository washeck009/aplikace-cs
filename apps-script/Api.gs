/**
 * @OnlyCurrentDoc
 * JSON API pro PWA: POST {action, token, data} → {ok, data} nebo {ok: false, error, kod}.
 * Klient posílá Content-Type text/plain (CORS bez preflightu), tělo je JSON.
 */

/**
 * Seznam akcí: role = minimální role (null = bez přihlášení).
 * Ve funkci, ne v konstantě – funkce z ostatních souborů nemusí být při načtení souboru ještě definované.
 */
function mapaAkci_() {
  return {
    'uzivatele.seznam': { role: null, fn: akceSeznamUzivatelu_ },
    'login': { role: null, fn: akceLogin_ },
    'logout': { role: 'skladnik', fn: akceLogout_ },
    'ja': { role: 'skladnik', fn: akceJa_ },
    'data.zaklad': { role: 'skladnik', fn: akceDataZaklad_ },
    'lokace.nacti': { role: 'skladnik', fn: akceLokaceNacti_ },
    'lokace.dokonci': { role: 'skladnik', fn: akceLokaceDokonci_ },
    'kontroly.dnes': { role: 'skladnik', fn: akceKontrolyDnes_ },
    'foto.nahraj': { role: 'skladnik', fn: akceFotoNahraj_ }
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
    if (akce.role) {
      uzivatel = overToken_(pozadavek.token);
      if (!maRoli_(uzivatel, akce.role)) throw chyba_('Na tuto akci nemáš oprávnění.', 'ROLE');
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
