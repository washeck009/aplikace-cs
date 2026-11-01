/**
 * Importy z ERP (jen admin): číselník, lokace, stav na lokacích. Soubor (xlsx/csv) čte prohlížeč, sloupce mapuje
 * podle názvů v hlavičce, řádky sečte a pošle sem. Každý import má dva kroky: náhled (potvrdit = false – nic se
 * nezapíše) a potvrzení (potvrdit = true – zapíše a vrátí stejný souhrn). Podnik volí admin.
 */

const MAX_CHYB_V_NAHLEDU = 50;
const PREFIX_IMPORTU = 'import_stav_'; // Script Properties: souhrn posledního importu stavu podniku

/** Souhrn pro stránku importů: velikost číselníku a lokací, poslední import stavu, hlídaná čísla položek. */
function akceImportInfo_(data) {
  const podnik = overPodnik_(data.podnik);
  const hlidana = hlidanaCisla_(podnik, nactiList_('Zaznamy').radky);
  const lokace = nactiList_('Lokace').radky.filter(function (r) { return text_(r.podnik) === podnik; });
  const polozky = nactiList_('Polozky').radky.filter(function (r) { return text_(r.podnik) === podnik; });
  return {
    podnik: podnik,
    polozek: polozky.filter(function (r) { return jeAno_(r.aktivni, true); }).length,
    k_doplneni: polozky.filter(function (r) { return jeAno_(r.aktivni, true) && jeAno_(r.k_doplneni); }).length,
    lokaci: lokace.length,
    lokaci_aktivnich: lokace.filter(function (r) { return jeAno_(r.aktivni, true) && jeKontrolovanaLokace_(r.kod); }).length,
    posledni_stav: posledniImportInfo_(podnik),
    // Prohlížeč podle nich vybere ze stavu jen hlídané zboží (desítky tisíc řádků se tak nemusí posílat).
    hlidana_cisla: Object.keys(hlidana)
  };
}

/** Čísla položek (klíče), které se hlídají: aktivní položky číselníku podniku + položky záznamů „Na lokaci“. */
function hlidanaCisla_(podnik, zaznamy) {
  const cisla = {};
  nactiList_('Polozky').radky.forEach(function (r) {
    if (text_(r.podnik) === podnik && jeAno_(r.aktivni, true) && text_(r.cislo_polozky)) cisla[klicCisla_(r.cislo_polozky)] = true;
  });
  zaznamy.forEach(function (r) {
    if (text_(r.podnik) === podnik && jeNaLokaci_(r) && text_(r.cislo_polozky)) cisla[klicCisla_(r.cislo_polozky)] = true;
  });
  return cisla;
}

function posledniImportInfo_(podnik) {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(PREFIX_IMPORTU + podnik) || 'null');
  } catch (e) {
    return null;
  }
}

/** Náhled se počítá bez zámku, zápis pod zámkem; obojí stejnou funkcí. */
function provedImport_(potvrdit, fn) {
  if (!potvrdit) return fn(false);
  return sZamkem_(function () {
    const vysledek = fn(true);
    vysledek.provedeno = true;
    vymazCachePrehledu_();
    return vysledek;
  });
}

/* ---------- Číselník ---------- */

/**
 * {podnik, radky: [[ean, cislo_polozky, nazev, cislo_radku_v_souboru]], deaktivovat, potvrdit}.
 * Nový EAN se přidá, u existujícího se změní číslo / název, položka „k doplnění“ se doplní. deaktivovat = položky
 * podniku, které v souboru nejsou, se označí jako neaktivní (kromě nevyřešených „k doplnění“).
 */
function akceImportPolozky_(data) {
  const podnik = overPodnik_(data.podnik);
  const radky = Array.isArray(data.radky) ? data.radky : [];
  if (!radky.length) throw chyba_('Soubor neobsahuje žádné řádky.');
  return provedImport_(!!data.potvrdit, function (zapsat) {
    const tabulka = nactiList_('Polozky');
    const podleEan = {};
    tabulka.radky.forEach(function (r) { if (text_(r.podnik) === podnik) podleEan[klicEan_(r.ean)] = r; });

    const chyby = [];
    const ean12 = [];
    const videne = {};
    const nove = [];
    const zmenene = [];
    const vyreseneEan = {}; // klíč EAN → nové číslo položky (položky k doplnění a změněná čísla – pro záznamy)
    let doplnene = 0;
    let bezeZmeny = 0;
    let duplicit = 0;

    radky.forEach(function (radek) {
      const ean = text_(radek[0]).replace(/\s+/g, '');
      const cislo = text_(radek[1]);
      const nazev = text_(radek[2]).slice(0, 200);
      const cisloRadku = radek[3] || '';
      if (!jeEan_(ean)) {
        chyby.push({ radek: cisloRadku, chyba: ean ? 'Neplatný EAN „' + ean + '“ (musí mít 8, 12, 13 nebo 14 číslic).' : 'Chybí EAN.' });
        return;
      }
      if (!cislo) {
        chyby.push({ radek: cisloRadku, chyba: 'Chybí číslo položky (EAN ' + ean + ').' });
        return;
      }
      const k = klicEan_(ean);
      if (videne[k]) {
        if (klicCisla_(videne[k].cislo) !== klicCisla_(cislo)) {
          chyby.push({ radek: cisloRadku, chyba: 'EAN ' + ean + ' je v souboru víckrát s jiným číslem položky (viz řádek ' + videne[k].radek + ').' });
        } else {
          duplicit++;
        }
        return;
      }
      videne[k] = { cislo: cislo, radek: cisloRadku };
      if (ean.length === 12) ean12.push(ean);

      const r = podleEan[k];
      if (!r) {
        nove.push({ podnik: podnik, ean: ean, cislo_polozky: cislo, nazev: nazev, aktivni: true, zdroj: 'import', k_doplneni: false });
        return;
      }
      let zmena = false;
      if (klicCisla_(r.cislo_polozky) !== klicCisla_(cislo)) {
        r.cislo_polozky = cislo;
        vyreseneEan[k] = cislo;
        zmena = true;
      }
      if (nazev && text_(r.nazev) !== nazev) {
        r.nazev = nazev;
        zmena = true;
      }
      if (!jeAno_(r.aktivni, true)) {
        r.aktivni = true;
        zmena = true;
      }
      if (jeAno_(r.k_doplneni)) {
        r.k_doplneni = false;
        r.zdroj = 'import';
        vyreseneEan[k] = text_(r.cislo_polozky);
        doplnene++;
        zmena = true;
      }
      if (zmena) zmenene.push(r);
      else bezeZmeny++;
    });

    const deaktivuje = data.deaktivovat ? tabulka.radky.filter(function (r) {
      return text_(r.podnik) === podnik && jeAno_(r.aktivni, true) && !jeAno_(r.k_doplneni) && !videne[klicEan_(r.ean)];
    }) : [];

    // Záznamy se zbožím, jehož položka se doplnila nebo změnila číslo – převezmou číslo a přestanou být „k doplnění“.
    const zaznamy = nactiList_('Zaznamy');
    const upraveneZaznamy = zaznamy.radky.filter(function (z) {
      return text_(z.podnik) === podnik && klicEan_(z.ean) in vyreseneEan;
    });

    if (zapsat) {
      deaktivuje.forEach(function (r) { r.aktivni = false; });
      zapisRadkyHromadne_(tabulka, zmenene.concat(deaktivuje));
      pridejRadky_('Polozky', nove);
      upraveneZaznamy.forEach(function (z) {
        z.cislo_polozky = vyreseneEan[klicEan_(z.ean)];
        z.k_doplneni = false;
      });
      zapisRadkyHromadne_(zaznamy, upraveneZaznamy);
    }

    return {
      typ: 'polozky',
      radku: radky.length,
      nove: nove.length,
      zmenene: zmenene.length - doplnene,
      doplnene: doplnene,
      beze_zmeny: bezeZmeny,
      duplicit: duplicit,
      deaktivuje: deaktivuje.length,
      zaznamu_upravi: upraveneZaznamy.length,
      chyb: chyby.length,
      chyby: chyby.slice(0, MAX_CHYB_V_NAHLEDU),
      ean12: ean12.length,
      ean12_ukazka: ean12.slice(0, 10),
      ukazka_novych: nove.slice(0, 10).map(function (p) { return [p.ean, p.cislo_polozky, p.nazev]; })
    };
  });
}

/* ---------- Lokace ---------- */

/**
 * {podnik, kody: [[kod, cislo_radku]], potvrdit}. Kontrolují se jen lokace H/P (LOKACE_KONTROLOVANA): regálové
 * (LOKACE_REGALOVA) se založí aktivní, ostatní H/P neaktivní; jiné (BAL, RAMP, PRIJEM…) se přeskočí a pokud už
 * v listu jsou, vypnou se. Existující lokaci se doplní rozklad a zruší „k ověření“; aktivní/neaktivní se nemění.
 */
function akceImportLokace_(data) {
  const podnik = overPodnik_(data.podnik);
  const kody = Array.isArray(data.kody) ? data.kody : [];
  if (!kody.length) throw chyba_('Soubor neobsahuje žádné lokace.');
  return provedImport_(!!data.potvrdit, function (zapsat) {
    const tabulka = nactiList_('Lokace');
    const mapa = {};
    tabulka.radky.forEach(function (r) { if (text_(r.podnik) === podnik) mapa[normalizujKod_(r.kod)] = r; });

    const videne = {};
    const chyby = [];
    const preskoceno = {};
    const nove = [];
    const zmenene = [];
    let neaktivnichNovych = 0;
    let bezeZmeny = 0;

    kody.forEach(function (radek) {
      const kod = normalizujKod_(radek[0]);
      if (!kod || videne[kod]) return;
      videne[kod] = true;
      if (jeEan_(kod) || !/^[A-Z0-9][A-Z0-9.\/-]{0,29}$/.test(kod)) {
        chyby.push({ radek: radek[1] || '', chyba: 'Neplatný kód lokace „' + kod + '“.' });
        return;
      }
      if (!jeKontrolovanaLokace_(kod)) {
        const prefix = kod.split('-')[0];
        preskoceno[prefix] = (preskoceno[prefix] || 0) + 1;
        return;
      }
      const ex = mapa[kod];
      if (!ex) {
        const aktivni = LOKACE_REGALOVA.test(kod);
        if (!aktivni) neaktivnichNovych++;
        nove.push(Object.assign({ podnik: podnik, kod: kod, aktivni: aktivni, k_overeni: false }, rozlozKodLokace_(kod)));
        return;
      }
      if (doplnLokaci_(ex)) zmenene.push(ex);
      else bezeZmeny++;
    });

    const vypne = tabulka.radky.filter(function (r) {
      return text_(r.podnik) === podnik && jeAno_(r.aktivni, true) && !jeKontrolovanaLokace_(r.kod);
    });
    const chybiVImportu = Object.keys(mapa).filter(function (k) { return jeKontrolovanaLokace_(k) && !videne[k]; }).length;

    if (zapsat) {
      vypne.forEach(function (r) { r.aktivni = false; });
      zapisRadkyHromadne_(tabulka, zmenene.concat(vypne));
      pridejRadky_('Lokace', nove);
    }
    return {
      typ: 'lokace',
      radku: kody.length,
      nove: nove.length,
      nove_neaktivni: neaktivnichNovych,
      zmenene: zmenene.length,
      beze_zmeny: bezeZmeny,
      preskoceno: Object.keys(preskoceno).reduce(function (s, k) { return s + preskoceno[k]; }, 0),
      preskoceno_prefixy: preskoceno,
      vypne: vypne.length,
      nejsou_v_importu: chybiVImportu,
      chyb: chyby.length,
      chyby: chyby.slice(0, MAX_CHYB_V_NAHLEDU),
      ukazka_novych: nove.slice(0, 10).map(function (l) { return [l.kod, l.aktivni]; })
    };
  });
}

/** Existující lokace z importu: zrušit „k ověření“, doplnit chybějící rozklad. Vrátí true, když se něco změnilo. */
function doplnLokaci_(r) {
  let zmena = false;
  if (jeAno_(r.k_overeni)) {
    r.k_overeni = false;
    zmena = true;
  }
  const rozklad = rozlozKodLokace_(normalizujKod_(r.kod));
  ['hala', 'rada', 'sloupec', 'nosnik', 'zona'].forEach(function (s) {
    if (!text_(r[s]) && rozklad[s]) {
      r[s] = rozklad[s];
      zmena = true;
    }
  });
  return zmena;
}

/* ---------- Stav na lokacích ---------- */

/**
 * {podnik, k_datu (ISO – stav ke dni, obvykle čas exportu), statistika {radku, preskoceno, chybne},
 *  lokace: [kódy H/P z exportu], radky: [[lokace, cislo_polozky, mnozstvi, naskladneno ISO, mj, nazev]], potvrdit}.
 * Prohlížeč posílá jen lokace H/P a jen hlídané zboží (sečtené za lokaci a položku); server to ověří znovu.
 * Zápis: nahradí import podniku v Import_stav_lokaci, uzavře zmizelé zboží (Není na lokaci, akce „import uzavřel“),
 * založí chybějící lokace, doplní prázdné názvy v číselníku.
 */
function akceImportStav_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  const radky = Array.isArray(data.radky) ? data.radky : [];
  const kodyLokaci = Array.isArray(data.lokace) ? data.lokace : [];
  if (!kodyLokaci.length) throw chyba_('V souboru nejsou žádné lokace H nebo P – je to export stavu lokací?');
  const kDatu = new Date(data.k_datu);
  if (isNaN(kDatu.getTime())) throw chyba_('Zadej, ke kterému dni a času je stav (čas exportu).');
  if (kDatu.getTime() > Date.now() + DEN_MS) throw chyba_('Stav ke dni nesmí být v budoucnu.');
  const stat = data.statistika || {};

  return provedImport_(!!data.potvrdit, function (zapsat) {
    zajistiSloupce_('Import_stav_lokaci');
    const ted = new Date();
    const zaznamy = nactiList_('Zaznamy');
    const hlidana = hlidanaCisla_(podnik, zaznamy.radky);

    // Hlídané zboží sečtené za lokaci a položku (prohlížeč už sčítal, tady jen pro jistotu).
    const stav = {};
    radky.forEach(function (r) {
      const lokace = normalizujKod_(r[0]);
      const k = klicCisla_(r[1]);
      if (!jeKontrolovanaLokace_(lokace) || !k || !hlidana[k]) return;
      const klic = lokace + '|' + k;
      const naskladneno = r[3] ? new Date(r[3]) : null;
      const s = stav[klic] || (stav[klic] = { lokace: lokace, cislo: text_(r[1]), mnozstvi: 0, naskladneno: null, mj: text_(r[4]), nazev: text_(r[5]) });
      s.mnozstvi += Number(r[2]) || 0;
      if (naskladneno && !isNaN(naskladneno.getTime()) && (!s.naskladneno || naskladneno > s.naskladneno)) s.naskladneno = naskladneno;
    });
    const klicePolozek = Object.keys(stav);

    // Zboží, které z lokace zmizelo: „Na lokaci“ na lokaci H/P, jeho položka na lokaci podle importu není
    // a od stavu ke dni se záznamem nikdo nepracoval (založený / ověřený / změněný později = nechat).
    const uzavrit = zaznamy.radky.filter(function (z) {
      if (text_(z.podnik) !== podnik || !jeNaLokaci_(z) || !jeKontrolovanaLokace_(z.lokace)) return false;
      if (stav[normalizujKod_(z.lokace) + '|' + klicCisla_(z.cislo_polozky)]) return false;
      return !['zalozeno', 'overeno', 'zmeneno'].some(function (s) { return z[s] instanceof Date && z[s] > kDatu; });
    });

    // Lokace z exportu, které v listu ještě nejsou (DEK zatím nemá seznam lokací) + zrušení „k ověření“.
    const lokaceTab = nactiList_('Lokace');
    const mapa = {};
    lokaceTab.radky.forEach(function (r) { if (text_(r.podnik) === podnik) mapa[normalizujKod_(r.kod)] = r; });
    const vImportu = {};
    kodyLokaci.concat(klicePolozek.map(function (k) { return stav[k].lokace; })).forEach(function (kod) {
      const k = normalizujKod_(kod);
      if (k && jeKontrolovanaLokace_(k) && /^[A-Z0-9][A-Z0-9.\/-]{0,29}$/.test(k)) vImportu[k] = true;
    });
    const noveLokace = [];
    const zmeneneLokace = [];
    Object.keys(vImportu).forEach(function (k) {
      if (!mapa[k]) {
        noveLokace.push(Object.assign({ podnik: podnik, kod: k, aktivni: LOKACE_REGALOVA.test(k), k_overeni: false }, rozlozKodLokace_(k)));
      } else if (doplnLokaci_(mapa[k])) {
        zmeneneLokace.push(mapa[k]);
      }
    });

    // Prázdné názvy v číselníku doplnit z POL_NAZEV.
    const polozky = nactiList_('Polozky');
    const nazevPodleCisla = {};
    klicePolozek.forEach(function (k) { if (stav[k].nazev) nazevPodleCisla[k.split('|')[1]] = stav[k].nazev; });
    const doplnitNazev = polozky.radky.filter(function (r) {
      return text_(r.podnik) === podnik && !text_(r.nazev) && nazevPodleCisla[klicCisla_(r.cislo_polozky)];
    });

    // Zboží bez kontroly: hlídané zboží na aktivní lokaci, kde není záznam „Na lokaci“ se stejnou položkou.
    const sZaznamem = {};
    const uzavrene = {};
    uzavrit.forEach(function (z) { uzavrene[z._radek] = true; });
    zaznamy.radky.forEach(function (z) {
      if (text_(z.podnik) === podnik && jeNaLokaci_(z) && !uzavrene[z._radek]) {
        sZaznamem[normalizujKod_(z.lokace) + '|' + klicCisla_(z.cislo_polozky)] = true;
      }
    });
    const bezKontroly = klicePolozek.filter(function (k) { return !sZaznamem[k]; });

    const minule = posledniImportInfo_(podnik);
    const varovani = [];
    if (minule && minule.hlidanych >= 50 && klicePolozek.length < minule.hlidanych * 0.5) {
      varovani.push('Hlídaného zboží je výrazně méně než při minulém importu (' + klicePolozek.length + ' proti '
        + minule.hlidanych + '). Je to celý export skladu a správný podnik?');
    }
    const naLokaci = zaznamy.radky.filter(function (z) { return text_(z.podnik) === podnik && jeNaLokaci_(z); }).length;
    if (naLokaci >= 20 && uzavrit.length > naLokaci * 0.3) {
      varovani.push('Uzavřelo by se ' + uzavrit.length + ' z ' + naLokaci + ' záznamů na lokacích – zkontroluj podnik a soubor.');
    }
    if (minule && minule.k_datu && new Date(minule.k_datu) > kDatu) {
      varovani.push('Minulý import byl ke dni ' + datumCasTextem_(new Date(minule.k_datu)) + ' – tento soubor je starší.');
    }

    if (zapsat) {
      nahradRadkyPodniku_('Import_stav_lokaci', podnik, klicePolozek.map(function (k) {
        const s = stav[k];
        return { podnik: podnik, lokace: s.lokace, cislo_polozky: s.cislo, mnozstvi: Math.round(s.mnozstvi * 1000) / 1000,
          datum_importu: ted, naskladneno: s.naskladneno || '', mj: s.mj };
      }));
      uzavrit.forEach(function (z) {
        z.stav = STAV.NENI;
        z.zmenil = uzivatel.jmeno;
        z.zmeneno = ted;
      });
      zapisRadkyHromadne_(zaznamy, uzavrit);
      pridejRadky_('Kontroly', uzavrit.map(function (z) {
        return { id: noveId_(), cas: ted, uzivatel: uzivatel.jmeno, podnik: podnik, lokace: text_(z.lokace), id_zaznamu: text_(z.id),
          akce: AKCE_IMPORT_UZAVREL, pocet_ks: z.pocet_ks, poznamka: 'import stavu lokací k ' + datumCasTextem_(kDatu),
          id_ukolu: '', zapocteno: false };
      }));
      zapisRadkyHromadne_(lokaceTab, zmeneneLokace);
      pridejRadky_('Lokace', noveLokace);
      doplnitNazev.forEach(function (r) { r.nazev = nazevPodleCisla[klicCisla_(r.cislo_polozky)]; });
      zapisRadkyHromadne_(polozky, doplnitNazev);
      PropertiesService.getScriptProperties().setProperty(PREFIX_IMPORTU + podnik, JSON.stringify({
        cas: ted.toISOString(), k_datu: kDatu.toISOString(), kdo: uzivatel.jmeno, radku: Number(stat.radku) || radky.length,
        lokaci: Object.keys(vImportu).length, hlidanych: klicePolozek.length, uzavreno: uzavrit.length
      }));
    }

    const nazevZaznamu = nazvyPolozek_(podnik, polozky.radky);
    return {
      typ: 'stav',
      radku: Number(stat.radku) || radky.length,
      preskoceno: Number(stat.preskoceno) || 0,
      chybne: Number(stat.chybne) || 0,
      lokaci: Object.keys(vImportu).length,
      hlidanych: klicePolozek.length,
      uzavre: uzavrit.length,
      uzavre_ukazka: uzavrit.slice(0, 30).map(function (z) {
        return { lokace: text_(z.lokace), cislo: text_(z.cislo_polozky), nazev: nazevZaznamu(z), expirace: textExpirace_(z) };
      }),
      nove_lokace: noveLokace.length,
      nove_lokace_neaktivni: noveLokace.filter(function (l) { return !l.aktivni; }).length,
      doplni_nazvu: doplnitNazev.length,
      bez_kontroly: bezKontroly.length,
      bez_kontroly_lokaci: Object.keys(bezKontroly.reduce(function (m, k) { m[k.split('|')[0]] = true; return m; }, {})).length,
      k_datu: kDatu.toISOString(),
      minule: minule,
      varovani: varovani
    };
  });
}

/** Funkce záznam → název zboží (podle EAN z číselníku, jinak podle čísla položky). */
function nazvyPolozek_(podnik, radkyPolozek) {
  const podleEan = {};
  const podleCisla = {};
  radkyPolozek.forEach(function (r) {
    if (text_(r.podnik) !== podnik || !text_(r.nazev)) return;
    podleEan[klicEan_(r.ean)] = text_(r.nazev);
    podleCisla[klicCisla_(r.cislo_polozky)] = text_(r.nazev);
  });
  return function (z) {
    return podleEan[klicEan_(z.ean)] || podleCisla[klicCisla_(z.cislo_polozky)] || '';
  };
}

/** 30.10.2026 19:46 (časové pásmo skriptu). */
function datumCasTextem_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd.M.yyyy H:mm');
}
