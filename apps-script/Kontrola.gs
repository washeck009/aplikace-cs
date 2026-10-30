/**
 * Kontrola lokace (čtečka): načtení lokace, dokončení lokace jednou dávkou, dnešní počet kontrol.
 */

const DEN_MS = 24 * 60 * 60 * 1000;

/* ---------- Kódy, expirace, pomůcky ---------- */

/** Naskenovaný kód: bez mezer, velkými písmeny. */
function normalizujKod_(kod) {
  return text_(kod).toUpperCase().replace(/\s+/g, '');
}

/** EAN = jen číslice o délce 8, 12, 13 nebo 14; vše ostatní je kód lokace. */
function jeEan_(kod) {
  return /^\d+$/.test(kod) && [8, 12, 13, 14].indexOf(kod.length) >= 0;
}

function overKodLokace_(kod) {
  const k = normalizujKod_(kod);
  if (!k || jeEan_(k) || !/^[A-Z0-9][A-Z0-9.\/-]{0,29}$/.test(k)) throw chyba_('Neplatný kód lokace: ' + k);
  return k;
}

/**
 * Rozloží kód lokace podle pomlček (H2-P-37-1 → hala H2, řada P, sloupec 37, nosník 1).
 * Tolerantně – co nejde rozložit, zůstane prázdné. Zóna podle prvního písmene (H = hala, P = policová galerie).
 */
function rozlozKodLokace_(kod) {
  const casti = kod.split('-');
  const r = { hala: '', rada: '', sloupec: '', nosnik: '', zona: /^[HP]/.test(kod) ? kod.charAt(0) : '' };
  if (casti.length === 4) {
    r.hala = casti[0]; r.rada = casti[1]; r.sloupec = casti[2]; r.nosnik = casti[3];
  } else if (casti.length === 3) {
    r.rada = casti[0]; r.sloupec = casti[1]; r.nosnik = casti[2];
  }
  return r;
}

function najdiLokaci_(radky, podnik, kod) {
  return radky.filter(function (r) { return text_(r.podnik) === podnik && normalizujKod_(r.kod) === kod; })[0] || null;
}

/** MM/RR → {text: 'MM/RR', datum: poslední den měsíce}, nebo null. */
function parsujExpiraci_(text) {
  const m = /^(\d{1,2})\/(\d{2})$/.exec(text_(text));
  if (!m) return null;
  const mesic = Number(m[1]);
  if (mesic < 1 || mesic > 12) return null;
  return { text: ('0' + mesic).slice(-2) + '/' + m[2], datum: new Date(2000 + Number(m[2]), mesic, 0) };
}

/** Expirace záznamu jako MM/RR – ze sloupce expirace_text, jinak z data. */
function textExpirace_(zaznam) {
  const t = zaznam.expirace_text;
  if (typeof t === 'string' && /^\d{2}\/\d{2}$/.test(t.trim())) return t.trim();
  return zaznam.expirace instanceof Date
    ? Utilities.formatDate(zaznam.expirace, Session.getScriptTimeZone(), 'MM/yy') : '';
}

/** Záznamy bez stavu se berou jako „Na lokaci“. */
function jeNaLokaci_(zaznam) {
  const s = text_(zaznam.stav);
  return !s || s === STAV.NA_LOKACI;
}

function klicZaznamu_(lokace, ean, expiraceText) {
  return normalizujKod_(lokace) + '|' + text_(ean) + '|' + expiraceText;
}

/** Počet kusů: celé nezáporné číslo, jinak prázdné. */
function cisloKs_(hodnota) {
  if (hodnota === '' || hodnota === null || hodnota === undefined) return '';
  const n = Math.round(Number(String(hodnota).replace(',', '.')));
  return isFinite(n) && n >= 0 ? n : '';
}

function zacatekDne_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Čas kontroly z čtečky: ne v budoucnu a nejvýš ZPETNY_ZAPIS_DNI zpět, jinak čas přijetí. */
function casDavky_(iso, ted) {
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d > ted || ted - d > ZPETNY_ZAPIS_DNI * DEN_MS) return ted;
  return d;
}

/** Záznam pro čtečku (jen to, co potřebuje). */
function zaznamProKlienta_(r) {
  return {
    id: text_(r.id),
    lokace: text_(r.lokace),
    ean: text_(r.ean),
    cislo_polozky: text_(r.cislo_polozky),
    expirace: textExpirace_(r),
    pocet_ks: r.pocet_ks === '' || r.pocet_ks === null ? null : Number(r.pocet_ks),
    overil: text_(r.overil),
    overeno: r.overeno instanceof Date ? r.overeno.toISOString() : null,
    poznamka: text_(r.poznamka),
    foto_url: text_(r.foto_url),
    k_doplneni: jeAno_(r.k_doplneni)
  };
}

/**
 * Řádky listu Kontroly s časem od `od` (včetně). Čte od konce po blocích – log se nikdy nemaže a roste.
 * Řádky přibývají podle času přijetí a čas kontroly je nejvýš ZPETNY_ZAPIS_DNI starší,
 * proto se čtení zastaví u řádku staršího než `od` minus tato rezerva.
 */
function kontrolyOd_(od) {
  const list = list_('Kontroly');
  const hlavicka = hlavickaListu_(list);
  const iCas = hlavicka.indexOf('cas');
  const hranice = od.getTime() - ZPETNY_ZAPIS_DNI * DEN_MS;
  const vysledek = [];
  let konec = list.getLastRow();
  while (konec >= 2) {
    const zacatek = Math.max(2, konec - 499);
    const hodnoty = list.getRange(zacatek, 1, konec - zacatek + 1, hlavicka.length).getValues();
    for (let i = hodnoty.length - 1; i >= 0; i--) {
      const cas = hodnoty[i][iCas];
      if (!(cas instanceof Date)) continue;
      if (cas.getTime() < hranice) return vysledek;
      if (cas >= od) {
        const o = {};
        hlavicka.forEach(function (h, j) { if (h) o[h] = hodnoty[i][j]; });
        vysledek.push(o);
      }
    }
    konec = zacatek - 1;
  }
  return vysledek;
}

/** Kolik lokací má uživatel v podniku započteno v den `den` (podle již zapsaných kontrol). */
function pocetZapoctenych_(kontroly, podnik, jmeno, den) {
  const konec = new Date(den.getTime() + DEN_MS);
  return kontroly.filter(function (k) {
    return jeAno_(k.zapocteno) && text_(k.podnik) === podnik
      && text_(k.uzivatel).toLowerCase() === jmeno.toLowerCase() && k.cas >= den && k.cas < konec;
  }).length;
}

/* ---------- Akce API ---------- */

/** Evidované záznamy „Na lokaci“ na jedné lokaci. */
function akceLokaceNacti_(data) {
  const podnik = overPodnik_(data.podnik);
  const kod = overKodLokace_(data.kod);
  const lokace = najdiLokaci_(nactiList_('Lokace').radky, podnik, kod);
  const zaznamy = nactiList_('Zaznamy').radky
    .filter(function (r) { return text_(r.podnik) === podnik && normalizujKod_(r.lokace) === kod && jeNaLokaci_(r); })
    .map(zaznamProKlienta_);
  return {
    kod: lokace ? text_(lokace.kod) : kod,
    existuje: !!lokace,
    k_overeni: lokace ? jeAno_(lokace.k_overeni) : true,
    zaznamy: zaznamy,
    nacteno: new Date().toISOString()
  };
}

/** Počet dnes započtených lokací přihlášeného uživatele v podniku (dlaždice Domů). */
function akceKontrolyDnes_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  const dnes = zacatekDne_(new Date());
  return { zapocteno: pocetZapoctenych_(kontrolyOd_(dnes), podnik, uzivatel.jmeno, dnes) };
}

/**
 * Dokončení lokace – jedna dávka ze čtečky:
 * {id_davky, podnik, lokace, typ: 'hotovo'|'bez_zbozi', cas, radky: [{akce, id, …}]}.
 * Akce řádků: 'potvrzeno', 'není na lokaci', 'změna' (expirace, pocet_ks, poznamka, stav, foto_url), 'nový'.
 * Stejná dávka poslaná znovu (výpadek signálu) vrátí původní výsledek a nic nezdvojí.
 */
function akceLokaceDokonci_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  const kod = overKodLokace_(data.lokace);
  const idDavky = text_(data.id_davky);
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(idDavky)) throw chyba_('Chybí ID dávky.');
  if (['hotovo', 'bez_zbozi'].indexOf(data.typ) < 0) throw chyba_('Neznámý typ dokončení lokace: ' + data.typ);
  const radky = Array.isArray(data.radky) ? data.radky : [];
  if (radky.length > 500) throw chyba_('Dávka je příliš velká.');

  return sZamkem_(function () {
    const vlastnosti = PropertiesService.getScriptProperties();
    const klicDavky = PREFIX_DAVKY + idDavky;
    const zpracovana = vlastnosti.getProperty(klicDavky);
    if (zpracovana) return JSON.parse(zpracovana).vysledek;

    const ted = new Date();
    const vysledek = zpracujDavku_(podnik, kod, data.typ, radky, casDavky_(data.cas, ted), uzivatel.jmeno, ted);

    // Nejdřív zapsat do tabulky, teprve potom označit dávku jako zpracovanou.
    SpreadsheetApp.flush();
    uklidDavky_(vlastnosti, ted);
    vlastnosti.setProperty(klicDavky, JSON.stringify({ cas: ted.getTime(), vysledek: vysledek }));
    return vysledek;
  });
}

function zpracujDavku_(podnik, kod, typ, radky, cas, jmeno, ted) {
  const lokace = najdiLokaci_(nactiList_('Lokace').radky, podnik, kod);
  const kodLokace = lokace ? text_(lokace.kod) : kod;

  const zaznamy = nactiList_('Zaznamy');
  const vsechnaId = {};
  const podleId = {};
  const podleKlice = {};
  zaznamy.radky.forEach(function (r) {
    vsechnaId[text_(r.id)] = true;
    if (text_(r.podnik) !== podnik) return;
    podleId[text_(r.id)] = r;
    const k = klicZaznamu_(r.lokace, r.ean, textExpirace_(r));
    if (!podleKlice[k] || jeNaLokaci_(r)) podleKlice[k] = r;
  });

  const polozkaPodleEan = {};
  const nazevPodleCisla = {};
  nactiList_('Polozky').radky.forEach(function (r) {
    if (text_(r.podnik) !== podnik) return;
    polozkaPodleEan[text_(r.ean)] = r;
    if (text_(r.nazev)) nazevPodleCisla[text_(r.cislo_polozky)] = text_(r.nazev);
  });

  const zmenene = [];
  const noveZaznamy = [];
  const novePolozky = [];
  const kontroly = [];
  const souhrn = { potvrzeno: 0, neni: 0, zmena: 0, novy: 0, vydano: 0, zlikvidovano: 0, preskoceno: 0 };

  const uloz = function (r) {
    if (r._radek && zmenene.indexOf(r) < 0) zmenene.push(r);
  };
  const zmenil = function (r) {
    r.zmenil = jmeno;
    r.zmeneno = cas;
  };
  const zaloguj = function (akce, r, poznamka) {
    kontroly.push({ akce: akce, id_zaznamu: r ? text_(r.id) : '', pocet_ks: r ? r.pocet_ks : '', poznamka: poznamka || '' });
  };

  const upravZaznam = function (r, radek) {
    const poznamky = [];
    if (radek.expirace !== undefined && radek.expirace !== null && radek.expirace !== '') {
      const exp = parsujExpiraci_(radek.expirace);
      const puvodni = textExpirace_(r);
      if (!exp) {
        poznamky.push('neplatná expirace ' + text_(radek.expirace) + ' – nezměněna');
      } else if (exp.text !== puvodni) {
        const novyKlic = klicZaznamu_(kod, r.ean, exp.text);
        const jiny = podleKlice[novyKlic];
        if (jiny && jiny !== r && jeNaLokaci_(jiny)) {
          poznamky.push('expirace ' + exp.text + ' už na lokaci je – nezměněna');
        } else {
          const staryKlic = klicZaznamu_(kod, r.ean, puvodni);
          if (podleKlice[staryKlic] === r) delete podleKlice[staryKlic];
          podleKlice[novyKlic] = r;
          r.expirace = exp.datum;
          r.expirace_text = exp.text;
          poznamky.push('expirace ' + puvodni + ' → ' + exp.text);
        }
      }
    }
    if (radek.pocet_ks !== undefined) r.pocet_ks = cisloKs_(radek.pocet_ks);
    if (radek.poznamka !== undefined) r.poznamka = text_(radek.poznamka).slice(0, 500);
    if (text_(radek.foto_url)) r.foto_url = text_(radek.foto_url);

    const stav = text_(radek.stav);
    let akce;
    if (stav === STAV.VYDANO || stav === STAV.ZLIKVIDOVANO) {
      r.stav = stav;
      akce = stav === STAV.VYDANO ? 'vydáno' : 'zlikvidováno';
      souhrn[stav === STAV.VYDANO ? 'vydano' : 'zlikvidovano']++;
    } else {
      r.stav = STAV.NA_LOKACI;
      r.overil = jmeno;
      r.overeno = cas;
      akce = 'změna';
      souhrn.zmena++;
    }
    zmenil(r);
    uloz(r);
    zaloguj(akce, r, poznamky.join('; '));
  };

  const pridejZaznam = function (radek) {
    const ean = text_(radek.ean);
    const exp = parsujExpiraci_(radek.expirace);
    if (!jeEan_(ean) || !exp) {
      souhrn.preskoceno++;
      return;
    }
    const ks = cisloKs_(radek.pocet_ks);
    const poznamka = text_(radek.poznamka).slice(0, 500);
    const foto = text_(radek.foto_url);

    // Klíč podnik + lokace + EAN + expirace je jedinečný – existující záznam se potvrdí, případně vrátí na lokaci.
    const existujici = podleKlice[klicZaznamu_(kod, ean, exp.text)];
    if (existujici) {
      const bylNaLokaci = jeNaLokaci_(existujici);
      if (!bylNaLokaci || ks !== '' || poznamka || foto) zmenil(existujici);
      existujici.stav = STAV.NA_LOKACI;
      existujici.overil = jmeno;
      existujici.overeno = cas;
      if (ks !== '') existujici.pocet_ks = ks;
      if (poznamka) existujici.poznamka = poznamka;
      if (foto) existujici.foto_url = foto;
      uloz(existujici);
      zaloguj(bylNaLokaci ? 'potvrzeno' : 'nový', existujici);
      souhrn[bylNaLokaci ? 'potvrzeno' : 'novy']++;
      return;
    }

    let polozka = polozkaPodleEan[ean];
    const cislo = polozka ? text_(polozka.cislo_polozky) : text_(radek.cislo_polozky);
    if (!cislo) {
      souhrn.preskoceno++;
      return;
    }
    if (!polozka) {
      // Neznámý EAN – do číselníku k doplnění (název převezme od stejného čísla položky, je-li).
      polozka = { podnik: podnik, ean: ean, cislo_polozky: cislo, nazev: nazevPodleCisla[cislo] || '',
        aktivni: true, zdroj: 'rucni', k_doplneni: true };
      novePolozky.push(polozka);
      polozkaPodleEan[ean] = polozka;
    }

    const id = /^[a-f0-9]{12}$/.test(text_(radek.id)) && !vsechnaId[text_(radek.id)] ? text_(radek.id) : noveId_();
    vsechnaId[id] = true;
    const r = {
      id: id, podnik: podnik, lokace: kodLokace, ean: ean, cislo_polozky: cislo,
      expirace: exp.datum, expirace_text: exp.text, pocet_ks: ks, stav: STAV.NA_LOKACI,
      zalozil: jmeno, zalozeno: cas, overil: jmeno, overeno: cas, zmenil: '', zmeneno: '',
      poznamka: poznamka, foto_url: foto, k_doplneni: jeAno_(polozka.k_doplneni)
    };
    noveZaznamy.push(r);
    podleId[id] = r;
    podleKlice[klicZaznamu_(kod, ean, exp.text)] = r;
    zaloguj('nový', r);
    souhrn.novy++;
  };

  radky.forEach(function (radek) {
    const akce = text_(radek && radek.akce);
    if (akce === 'nový') {
      pridejZaznam(radek);
      return;
    }
    const r = podleId[text_(radek && radek.id)];
    // Záznam z jiné lokace nebo mezitím smazaný řádek – přeskočit, zbytek dávky se zpracuje.
    if (!r || normalizujKod_(r.lokace) !== kod) {
      souhrn.preskoceno++;
      return;
    }
    if (akce === 'potvrzeno') {
      if (!jeNaLokaci_(r)) zmenil(r);
      r.stav = STAV.NA_LOKACI;
      r.overil = jmeno;
      r.overeno = cas;
      uloz(r);
      zaloguj('potvrzeno', r);
      souhrn.potvrzeno++;
    } else if (akce === 'není na lokaci') {
      r.stav = STAV.NENI;
      zmenil(r);
      uloz(r);
      zaloguj('není na lokaci', r);
      souhrn.neni++;
    } else if (akce === 'změna') {
      upravZaznam(r, radek);
    } else {
      souhrn.preskoceno++;
    }
  });

  if (typ === 'bez_zbozi' || !kontroly.length) {
    kontroly.unshift({ akce: 'bez expiračního zboží', id_zaznamu: '', pocet_ks: '', poznamka: '' });
  }

  // Započtení: první dokončená kontrola této lokace tímto uživatelem v daném dni.
  const den = zacatekDne_(cas);
  const dnes = zacatekDne_(ted);
  const posledni = kontrolyOd_(den < dnes ? den : dnes);
  const konecDne = new Date(den.getTime() + DEN_MS);
  const uzZapocteno = posledni.some(function (k) {
    return jeAno_(k.zapocteno) && text_(k.podnik) === podnik && normalizujKod_(k.lokace) === kod
      && text_(k.uzivatel).toLowerCase() === jmeno.toLowerCase() && k.cas >= den && k.cas < konecDne;
  });
  kontroly.forEach(function (k, i) {
    k.id = noveId_();
    k.cas = cas;
    k.uzivatel = jmeno;
    k.podnik = podnik;
    k.lokace = kodLokace;
    k.id_ukolu = '';
    k.zapocteno = i === 0 && !uzZapocteno;
  });

  if (!lokace) {
    pridejRadky_('Lokace', [Object.assign({ podnik: podnik, kod: kod, aktivni: true, k_overeni: true }, rozlozKodLokace_(kod))]);
  }
  pridejRadky_('Polozky', novePolozky);
  zapisRadky_(zaznamy, zmenene);
  pridejRadky_('Zaznamy', noveZaznamy);
  pridejRadky_('Kontroly', kontroly);

  const dnesPocet = pocetZapoctenych_(posledni, podnik, jmeno, dnes)
    + (!uzZapocteno && den.getTime() === dnes.getTime() ? 1 : 0);
  return { lokace: kodLokace, zapocteno: !uzZapocteno, dnes: dnesPocet, nova_lokace: !lokace, souhrn: souhrn };
}

/** Smaže záznamy o zpracovaných dávkách starší než DAVKY_DRZET_DNI. */
function uklidDavky_(vlastnosti, ted) {
  const vse = vlastnosti.getProperties();
  Object.keys(vse).forEach(function (k) {
    if (k.indexOf(PREFIX_DAVKY) !== 0) return;
    try {
      if (ted.getTime() - JSON.parse(vse[k]).cas > DAVKY_DRZET_DNI * DEN_MS) vlastnosti.deleteProperty(k);
    } catch (e) {
      vlastnosti.deleteProperty(k);
    }
  });
}
