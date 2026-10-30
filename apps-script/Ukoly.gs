/**
 * Úkoly: Moje úkoly (čtečka), zadávání a rušení (PC), odškrtávání lokací po dokončení kontroly.
 * Lokace úkolu jsou v listu jako seznam kódů oddělený čárkou, hotové ve sloupci hotove_lokace.
 */

/* ---------- Trasa a seznamy lokací ---------- */

/** Přirozené porovnání částí kódu: čísla jako čísla (2 < 10), jinak text. */
function porovnejCast_(a, b) {
  a = text_(a).toUpperCase();
  b = text_(b).toUpperCase();
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Části trasy lokace (hala, řada, sloupec, nosník) – z listu Lokace, jinak rozkladem kódu. */
function castiTrasy_(kod, mapaLokaci) {
  const r = mapaLokaci[normalizujKod_(kod)] || rozlozKodLokace_(normalizujKod_(kod));
  return [r.hala, r.rada, r.sloupec, r.nosnik, normalizujKod_(kod)];
}

/** Porovnání podle trasy skladem: hala → řada → sloupec → nosník. */
function porovnejTrasu_(kodA, kodB, mapaLokaci) {
  const a = castiTrasy_(kodA, mapaLokaci);
  const b = castiTrasy_(kodB, mapaLokaci);
  for (let i = 0; i < a.length; i++) {
    const r = porovnejCast_(a[i], b[i]);
    if (r) return r;
  }
  return 0;
}

function seradPodleTrasy_(kody, mapaLokaci) {
  return kody.slice().sort(function (a, b) { return porovnejTrasu_(a, b, mapaLokaci); });
}

/** Mapa normalizovaný kód → řádek listu Lokace (jen podnik). */
function mapaLokaci_(podnik, jenAktivni) {
  const mapa = {};
  nactiList_('Lokace').radky.forEach(function (r) {
    if (text_(r.podnik) !== podnik) return;
    if (jenAktivni && !jeAno_(r.aktivni, true)) return;
    mapa[normalizujKod_(r.kod)] = r;
  });
  return mapa;
}

/** Seznam kódů z buňky („A, B, C“) – normalizované, bez prázdných a duplicit. */
function seznamKodu_(hodnota) {
  const videno = {};
  return text_(hodnota).split(/[,;\n]+/).map(normalizujKod_).filter(function (k) {
    if (!k || videno[k]) return false;
    videno[k] = true;
    return true;
  });
}

/**
 * Rozebere zadání lokací z PC: jednotlivé kódy oddělené čárkou / středníkem / řádkem a rozsahy „od až do“
 * (také „od – do“, „od - do“ s mezerami, „od..do“) v rámci jedné řady. Vrátí kódy seřazené podle trasy.
 */
function rozeberLokace_(text, podnik) {
  const mapa = mapaLokaci_(podnik, true);
  const vysledek = {};
  const nezname = [];
  const chyby = [];
  const pridej = function (kod) { vysledek[kod] = true; };

  String(text || '').split(/[,;\n]+/).map(function (c) { return c.trim(); }).filter(String).forEach(function (cast) {
    const rozsah = cast.split(/\s+(?:až|az|-|–|—)\s+|\s*(?:–|—|\.\.)\s*/i).filter(String);
    if (rozsah.length === 1) {
      const kod = normalizujKod_(rozsah[0]);
      if (mapa[kod]) pridej(kod);
      else nezname.push(kod);
      return;
    }
    if (rozsah.length !== 2) {
      chyby.push('Nesrozumitelný rozsah „' + cast + '“.');
      return;
    }
    const od = normalizujKod_(rozsah[0]);
    const doK = normalizujKod_(rozsah[1]);
    if (!mapa[od] || !mapa[doK]) {
      [od, doK].forEach(function (k) { if (!mapa[k]) nezname.push(k); });
      return;
    }
    const a = castiTrasy_(od, mapa);
    const b = castiTrasy_(doK, mapa);
    if (porovnejCast_(a[0], b[0]) || porovnejCast_(a[1], b[1])) {
      chyby.push('Rozsah „' + cast + '“ musí být v rámci jedné haly a řady.');
      return;
    }
    const [zacatek, konec] = porovnejTrasu_(od, doK, mapa) <= 0 ? [od, doK] : [doK, od];
    Object.keys(mapa).forEach(function (kod) {
      const c = castiTrasy_(kod, mapa);
      if (porovnejCast_(c[0], a[0]) || porovnejCast_(c[1], a[1])) return;
      if (porovnejTrasu_(kod, zacatek, mapa) >= 0 && porovnejTrasu_(kod, konec, mapa) <= 0) pridej(kod);
    });
  });

  if (nezname.length) chyby.push('Neznámé (nebo neaktivní) lokace: ' + nezname.join(', ') + '.');
  if (chyby.length) throw chyba_(chyby.join(' '));
  const kody = seradPodleTrasy_(Object.keys(vysledek), mapa).map(function (k) { return text_(mapa[k].kod); });
  if (!kody.length) throw chyba_('Zadej aspoň jednu lokaci.');
  if (kody.length > MAX_LOKACI_RUCNI_UKOL) throw chyba_('Příliš mnoho lokací (' + kody.length + '), max. ' + MAX_LOKACI_RUCNI_UKOL + '.');
  return kody;
}

/* ---------- Úkoly ---------- */

function datumTextem_(d) {
  return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function ukolProKlienta_(r, mapaLokaci) {
  const hotove = seznamKodu_(r.hotove_lokace);
  return {
    id: text_(r.id),
    podnik: text_(r.podnik),
    typ: text_(r.typ),
    komu: text_(r.komu),
    lokace: seradPodleTrasy_(seznamKodu_(r.lokace), mapaLokaci || {}),
    hotove: hotove,
    polozka: text_(r.polozka),
    termin: datumTextem_(r.termin),
    popis: text_(r.popis),
    stav: text_(r.stav),
    zadal: text_(r.zadal),
    zadano: r.zadano instanceof Date ? r.zadano.toISOString() : null,
    splneno: r.splneno instanceof Date ? r.splneno.toISOString() : null,
    splnil: text_(r.splnil)
  };
}

const jeOtevreny_ = function (r) { return text_(r.stav) === STAV_UKOLU.OTEVRENY; };

function proUzivatele_(r, jmeno) {
  const komu = text_(r.komu).toLowerCase();
  return komu === KDOKOLIV || komu === jmeno.toLowerCase();
}

/** Otevřené úkoly podniku pro uživatele a pro „kdokoliv“ (řádky listu). */
function mojeOtevreneUkoly_(podnik, jmeno) {
  return nactiList_('Ukoly').radky.filter(function (r) {
    return text_(r.podnik) === podnik && jeOtevreny_(r) && proUzivatele_(r, jmeno);
  });
}

/** Řazení úkolů: nejbližší termín první (bez termínu na konec), pak podle zadání. */
function porovnejUkoly_(a, b) {
  const ta = a.termin || '9999';
  const tb = b.termin || '9999';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return (a.zadano || '') < (b.zadano || '') ? -1 : 1;
}

/** Moje úkoly (čtečka): otevřené pro mě a pro „kdokoliv“ ve zvoleném podniku. */
function akceUkolyMoje_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  zajistiSloupce_('Ukoly');
  const mapa = mapaLokaci_(podnik, false);
  return {
    ukoly: mojeOtevreneUkoly_(podnik, uzivatel.jmeno)
      .map(function (r) { return ukolProKlienta_(r, mapa); })
      .sort(porovnejUkoly_),
    nacteno: new Date().toISOString()
  };
}

/** PC – přehled úkolů podniku (otevřené + uzavřené za 30 dní), uživatelé a pravidla plánovače. */
function akceUkolySeznam_(data) {
  const podnik = overPodnik_(data.podnik);
  zajistiSloupce_('Ukoly');
  const mapa = mapaLokaci_(podnik, false);
  const hranice = new Date(Date.now() - 30 * DEN_MS);
  const ukoly = nactiList_('Ukoly').radky
    .filter(function (r) {
      return text_(r.podnik) === podnik
        && (jeOtevreny_(r) || (r.splneno instanceof Date && r.splneno >= hranice));
    })
    .map(function (r) { return ukolProKlienta_(r, mapa); })
    .sort(function (a, b) {
      if ((a.stav === STAV_UKOLU.OTEVRENY) !== (b.stav === STAV_UKOLU.OTEVRENY)) return a.stav === STAV_UKOLU.OTEVRENY ? -1 : 1;
      return porovnejUkoly_(a, b);
    });
  const n = nactiNastaveni_(podnik);
  return {
    ukoly: ukoly,
    uzivatele: akceSeznamUzivatelu_(),
    planovac: {
      dni_bez_kontroly: n.planovac_dni_bez_kontroly,
      cervene_overit_dni: n.planovac_cervene_overit_dni,
      max_lokaci_ukol: n.planovac_max_lokaci_ukol,
      spoustec: planovacNainstalovan_()
    }
  };
}

/** PC – nový ruční úkol: {podnik, komu, lokace (text), polozka, termin (RRRR-MM-DD), popis}. */
function akceUkolyZadej_(data, uzivatel) {
  const podnik = overPodnik_(data.podnik);
  const komu = text_(data.komu) || KDOKOLIV;
  if (komu.toLowerCase() !== KDOKOLIV && !najdiUzivatele_(komu)) throw chyba_('Neznámý uživatel: ' + komu);
  const lokace = rozeberLokace_(data.lokace, podnik);
  let termin = '';
  if (text_(data.termin)) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text_(data.termin));
    if (!m) throw chyba_('Termín ve tvaru RRRR-MM-DD.');
    termin = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const popis = text_(data.popis).slice(0, 500)
    || 'Zkontroluj ' + lokace.length + (lokace.length === 1 ? ' lokaci' : lokace.length < 5 ? ' lokace' : ' lokací');
  const radek = {
    id: noveId_(), podnik: podnik, typ: TYP_UKOLU.RUCNI,
    komu: komu.toLowerCase() === KDOKOLIV ? KDOKOLIV : text_(najdiUzivatele_(komu).jmeno),
    lokace: lokace.join(', '), polozka: text_(data.polozka).slice(0, 50), termin: termin, popis: popis,
    stav: STAV_UKOLU.OTEVRENY, zadal: uzivatel.jmeno, zadano: new Date(), splneno: '', splnil: '', hotove_lokace: ''
  };
  sZamkem_(function () {
    zajistiSloupce_('Ukoly');
    pridejRadky_('Ukoly', [radek]);
  });
  return ukolProKlienta_(radek, mapaLokaci_(podnik, false));
}

/** PC – zrušení otevřeného úkolu (kdo a kdy se zapíše do splnil / splneno). */
function akceUkolyZrus_(data, uzivatel) {
  return sZamkem_(function () {
    const r = nactiList_('Ukoly').radky.filter(function (x) { return text_(x.id) === text_(data.id); })[0];
    if (!r) throw chyba_('Úkol neexistuje.');
    if (!jeOtevreny_(r)) throw chyba_('Úkol už není otevřený (' + text_(r.stav) + ').');
    upravRadek_('Ukoly', r._radek, { stav: STAV_UKOLU.ZRUSENY, splneno: new Date(), splnil: uzivatel.jmeno });
    return true;
  });
}

/**
 * Po dokončení kontroly lokace (volá se pod zámkem z lokace.dokonci): odškrtne lokaci ve všech otevřených úkolech
 * podniku zadaných před kontrolou; úkol s hotovými všemi lokacemi je splněný.
 * Vrátí {ids: odškrtnuté úkoly, splnene: popisy právě splněných}.
 */
function odskrtniLokaciVUkolech_(podnik, kod, jmeno, cas) {
  zajistiSloupce_('Ukoly');
  const tabulka = nactiList_('Ukoly');
  const ids = [];
  const splnene = [];
  const zmenene = [];
  tabulka.radky.forEach(function (r) {
    if (text_(r.podnik) !== podnik || !jeOtevreny_(r)) return;
    if (r.zadano instanceof Date && r.zadano > cas) return; // kontrola z doby před zadáním se nepočítá
    const lokace = seznamKodu_(r.lokace);
    if (lokace.indexOf(kod) < 0) return;
    const hotove = seznamKodu_(r.hotove_lokace);
    if (hotove.indexOf(kod) < 0) hotove.push(kod);
    ids.push(text_(r.id));
    r.hotove_lokace = hotove.join(', ');
    if (lokace.every(function (k) { return hotove.indexOf(k) >= 0; })) {
      r.stav = STAV_UKOLU.SPLNENY;
      r.splneno = cas;
      r.splnil = jmeno;
      splnene.push(text_(r.popis));
    }
    zmenene.push(r);
  });
  zapisRadky_(tabulka, zmenene);
  return { ids: ids, splnene: splnene };
}
