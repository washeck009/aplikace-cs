/**
 * Správa (jen admin): uživatelé (přidat, role, aktivní, reset PINu – nový PIN se vrátí jen jednou),
 * nastavení po podnicích, položky k doplnění (doplnit název / spárovat s číslem položky).
 */

// Nastavení, která musí být celé nezáporné číslo (prázdné = výchozí / bez cíle).
const NASTAVENI_CISLA = ['hranice_cervena', 'hranice_zluta', 'cil_kontrol_tyden', 'planovac_dni_bez_kontroly',
  'planovac_cervene_overit_dni', 'planovac_max_lokaci_ukol', 'planovac_naskladneno_dni'];
const NASTAVENI_ANO_NE = ['planovac_naskladneno_zapnuto'];
// PINy, které by uhodl každý – nový PIN je nikdy nedostane.
const SLABE_PINY = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '9876'];

/* ---------- Uživatelé ---------- */

function uzivatelProKlienta_(u) {
  return {
    id: text_(u.id),
    jmeno: text_(u.jmeno),
    role: roleUzivatele_(u),
    aktivni: jeAno_(u.aktivni, true),
    zamceno_do: u.zamceno_do instanceof Date && u.zamceno_do > new Date() ? u.zamceno_do.toISOString() : null
  };
}

function akceSpravaUzivatele_(data, uzivatel) {
  return {
    uzivatele: nactiList_('Uzivatele').radky.filter(function (u) { return text_(u.jmeno); }).map(uzivatelProKlienta_)
      .sort(function (a, b) { return a.jmeno.localeCompare(b.jmeno, 'cs'); }),
    ja: uzivatel.id
  };
}

/** Náhodný 4místný PIN (ne slabý). */
function novyPin_() {
  for (;;) {
    const cisla = Utilities.getUuid().replace(/\D/g, '');
    const pin = (cisla + '0000').slice(0, 4);
    if (SLABE_PINY.indexOf(pin) < 0) return pin;
  }
}

/** Po úpravě musí zůstat aspoň jeden aktivní admin. */
function overAdmina_(radky) {
  const admini = radky.filter(function (u) { return roleUzivatele_(u) === 'admin' && jeAno_(u.aktivni, true); });
  if (!admini.length) throw chyba_('Musí zůstat aspoň jeden aktivní admin.');
}

/**
 * {id?, jmeno, role, aktivni}. Bez id = nový uživatel (vrátí jednorázově vygenerovaný PIN),
 * s id = změna role a aktivity. Jméno se nemění (podle něj se vede historie kontrol a úkolů).
 */
function akceSpravaUzivatelUloz_(data, uzivatel) {
  const role = normalizujRoli_(data.role);
  if (!role) throw chyba_('Neznámá role. Vyber skladník, vedoucí, manažer nebo admin.');
  if (!text_(data.id)) {
    const pin = novyPin_();
    try {
      pridejUzivatele_(data.jmeno, role, pin);
    } catch (e) {
      throw chyba_(e.message);
    }
    return { jmeno: text_(data.jmeno).replace(/\s+/g, ' '), pin: pin };
  }
  return sZamkem_(function () {
    const tabulka = nactiList_('Uzivatele');
    const u = tabulka.radky.filter(function (r) { return text_(r.id) === text_(data.id); })[0];
    if (!u) throw chyba_('Uživatel neexistuje.');
    const aktivni = data.aktivni !== false;
    if (text_(u.id) === uzivatel.id && (role !== 'admin' || !aktivni)) {
      throw chyba_('Sám sobě nemůžeš odebrat roli admin ani vypnout účet.');
    }
    u.role = role;
    u.aktivni = aktivni;
    overAdmina_(tabulka.radky);
    upravRadek_('Uzivatele', u._radek, { role: role, aktivni: aktivni });
    if (!aktivni) zrusTokenyUzivatele_(text_(u.id));
    return uzivatelProKlienta_(u);
  });
}

/** {id} → nový PIN (zobrazí se jen teď), odemčení účtu a odhlášení ze všech zařízení. */
function akceSpravaUzivatelPin_(data) {
  return sZamkem_(function () {
    const u = nactiList_('Uzivatele').radky.filter(function (r) { return text_(r.id) === text_(data.id); })[0];
    if (!u) throw chyba_('Uživatel neexistuje.');
    const pin = novyPin_();
    const sul = novaSul_();
    upravRadek_('Uzivatele', u._radek, { pin_hash: hashPinu_(pin, sul), pin_salt: sul, chybne_pokusy: 0, zamceno_do: '' });
    zrusTokenyUzivatele_(text_(u.id));
    return { jmeno: text_(u.jmeno), pin: pin };
  });
}

/* ---------- Nastavení ---------- */

function akceSpravaNastaveni_(data) {
  const podnik = overPodnik_(data.podnik);
  const radky = nactiList_('Nastaveni').radky.filter(function (r) { return text_(r.podnik) === podnik && text_(r.klic); });
  const podleKlice = {};
  radky.forEach(function (r) { podleKlice[text_(r.klic)] = r; });
  const vychozi = VYCHOZI_NASTAVENI.map(function (v) {
    const r = podleKlice[v[0]];
    return { klic: v[0], popis: r && text_(r.popis) ? text_(r.popis) : v[1], hodnota: r ? hodnotaNastaveni_(r.hodnota) : '' };
  });
  const ostatni = radky.filter(function (r) {
    return !VYCHOZI_NASTAVENI.some(function (v) { return v[0] === text_(r.klic); });
  }).map(function (r) { return { klic: text_(r.klic), popis: text_(r.popis), hodnota: hodnotaNastaveni_(r.hodnota) }; });
  return { podnik: podnik, nastaveni: vychozi.concat(ostatni) };
}

function hodnotaNastaveni_(h) {
  if (h === true || h === false) return h ? 'TRUE' : 'FALSE';
  return text_(h);
}

/** {podnik, hodnoty: {klic: hodnota}} – kontrola čísel a ano/ne, chybějící řádek se založí. */
function akceSpravaNastaveniUloz_(data) {
  const podnik = overPodnik_(data.podnik);
  const hodnoty = data.hodnoty || {};
  const zmeny = {};
  Object.keys(hodnoty).forEach(function (klic) {
    let h = text_(hodnoty[klic]);
    if (NASTAVENI_CISLA.indexOf(klic) >= 0) {
      if (h !== '' && !/^\d+$/.test(h)) throw chyba_('„' + klic + '“ musí být celé nezáporné číslo.');
      zmeny[klic] = h === '' ? '' : Number(h);
    } else if (NASTAVENI_ANO_NE.indexOf(klic) >= 0) {
      zmeny[klic] = jeAno_(h);
    } else if (klic === 'report_prijemci') {
      const spatne = h.split(/[,;\s]+/).filter(String).filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
      if (spatne.length) throw chyba_('Neplatný e-mail: ' + spatne.join(', '));
      zmeny[klic] = h.split(/[,;\s]+/).filter(String).join(', ');
    } else {
      zmeny[klic] = h.slice(0, 500);
    }
  });
  const n = Object.assign({}, nactiNastaveni_(podnik), zmeny);
  if (Number(n.hranice_cervena) > Number(n.hranice_zluta)) throw chyba_('Červené pásmo musí být kratší nebo stejné jako žluté.');
  sZamkem_(function () {
    const radky = nactiList_('Nastaveni').radky.filter(function (r) { return text_(r.podnik) === podnik; });
    const nove = [];
    Object.keys(zmeny).forEach(function (klic) {
      const r = radky.filter(function (x) { return text_(x.klic) === klic; })[0];
      if (r) {
        upravRadek_('Nastaveni', r._radek, { hodnota: zmeny[klic] });
      } else {
        const v = VYCHOZI_NASTAVENI.filter(function (x) { return x[0] === klic; })[0];
        nove.push({ podnik: podnik, klic: klic, hodnota: zmeny[klic], popis: v ? v[1] : '' });
      }
    });
    pridejRadky_('Nastaveni', nove);
  });
  vymazCachePrehledu_();
  return akceSpravaNastaveni_({ podnik: podnik });
}

/* ---------- Položky k doplnění ---------- */

/** {podnik} → položky „k doplnění“ (neznámé EAN ze čtečky) s počtem záznamů a návrhem názvu podle čísla položky. */
function akceSpravaPolozky_(data) {
  const podnik = overPodnik_(data.podnik);
  const polozky = nactiList_('Polozky').radky.filter(function (r) { return text_(r.podnik) === podnik; });
  const znamaCisla = {};
  polozky.forEach(function (r) {
    if (!jeAno_(r.k_doplneni) && text_(r.nazev)) znamaCisla[klicCisla_(r.cislo_polozky)] = text_(r.nazev);
  });
  const zaznamu = {};
  nactiList_('Zaznamy').radky.forEach(function (z) {
    if (text_(z.podnik) === podnik && jeNaLokaci_(z)) zaznamu[klicEan_(z.ean)] = (zaznamu[klicEan_(z.ean)] || 0) + 1;
  });
  return {
    podnik: podnik,
    polozky: polozky.filter(function (r) { return jeAno_(r.aktivni, true) && jeAno_(r.k_doplneni); }).map(function (r) {
      return {
        ean: text_(r.ean), cislo_polozky: text_(r.cislo_polozky), nazev: text_(r.nazev),
        zaznamu: zaznamu[klicEan_(r.ean)] || 0, navrh_nazvu: znamaCisla[klicCisla_(r.cislo_polozky)] || ''
      };
    })
  };
}

/**
 * {podnik, ean, cislo_polozky, nazev} – doplní / opraví položku k doplnění. Bez názvu se převezme název známé položky
 * se stejným číslem (spárování). S názvem přestane být „k doplnění“; záznamy s tímto EAN převezmou číslo položky.
 */
function akceSpravaPolozkaUloz_(data) {
  const podnik = overPodnik_(data.podnik);
  const cislo = text_(data.cislo_polozky);
  if (!cislo) throw chyba_('Vyplň číslo položky.');
  return sZamkem_(function () {
    const polozky = nactiList_('Polozky');
    const r = polozky.radky.filter(function (x) { return text_(x.podnik) === podnik && klicEan_(x.ean) === klicEan_(data.ean); })[0];
    if (!r) throw chyba_('Položka s EAN ' + text_(data.ean) + ' neexistuje.');
    let nazev = text_(data.nazev).slice(0, 200);
    if (!nazev) {
      const znama = polozky.radky.filter(function (x) {
        return text_(x.podnik) === podnik && x !== r && !jeAno_(x.k_doplneni) && text_(x.nazev) && klicCisla_(x.cislo_polozky) === klicCisla_(cislo);
      })[0];
      nazev = znama ? text_(znama.nazev) : '';
    }
    r.cislo_polozky = cislo;
    r.nazev = nazev;
    r.k_doplneni = !nazev;
    upravRadek_('Polozky', r._radek, { cislo_polozky: cislo, nazev: nazev, k_doplneni: !nazev });
    const zaznamy = nactiList_('Zaznamy');
    const upravit = zaznamy.radky.filter(function (z) { return text_(z.podnik) === podnik && klicEan_(z.ean) === klicEan_(r.ean); });
    upravit.forEach(function (z) {
      z.cislo_polozky = cislo;
      z.k_doplneni = !nazev;
    });
    zapisRadkyHromadne_(zaznamy, upravit);
    return { ean: text_(r.ean), cislo_polozky: cislo, nazev: nazev, k_doplneni: !nazev, zaznamu: upravit.length };
  });
}
