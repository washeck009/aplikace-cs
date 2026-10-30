// Záznamy „Na lokaci“ na straně klienta: promítnutí dávky z kontroly lokace (cache, neodeslaná fronta) a nová ID.

/** Náhodné hexadecimální ID (12 znaků jako na serveru, pro dávky delší). */
export function noveId(delka = 12) {
  const bajty = new Uint8Array(Math.ceil(delka / 2));
  crypto.getRandomValues(bajty);
  return Array.from(bajty, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, delka);
}

const ODCHAZI = ['Vydáno', 'Zlikvidováno'];

function vyplnene(radek, klice) {
  const o = {};
  klice.forEach((k) => {
    if (radek[k] !== undefined && radek[k] !== null && radek[k] !== '') o[k] = radek[k];
  });
  return o;
}

/**
 * Promítne dávku {lokace, cas, radky} do seznamu záznamů „Na lokaci“ (stejně jako server)
 * a vrátí nový seznam. Záznamy, které z lokace odešly, v něm už nejsou.
 */
export function aplikujDavku(zaznamy, davka, autor) {
  const kod = davka.lokace.toUpperCase();
  const podleId = new Map(zaznamy.map((z) => [z.id, z]));
  const overeni = { overil: autor, overeno: davka.cas };

  for (const r of davka.radky) {
    if (r.akce === 'nový') {
      const stejny = [...podleId.values()].find((z) =>
        z.lokace.toUpperCase() === kod && z.ean === r.ean && z.expirace === r.expirace);
      if (stejny) {
        podleId.set(stejny.id, { ...stejny, ...vyplnene(r, ['pocet_ks', 'poznamka', 'foto_url']), ...overeni });
      } else {
        podleId.set(r.id, {
          id: r.id, lokace: davka.lokace, ean: r.ean, cislo_polozky: r.cislo_polozky || '',
          expirace: r.expirace, pocet_ks: r.pocet_ks ?? null, poznamka: r.poznamka || '',
          foto_url: r.foto_url || '', k_doplneni: !!r.k_doplneni, ...overeni
        });
      }
      continue;
    }
    const z = podleId.get(r.id);
    if (!z) continue;
    if (r.akce === 'potvrzeno') {
      podleId.set(r.id, { ...z, ...overeni });
    } else if (r.akce === 'není na lokaci' || (r.akce === 'změna' && ODCHAZI.includes(r.stav))) {
      podleId.delete(r.id);
    } else if (r.akce === 'změna') {
      const zmeny = vyplnene(r, ['expirace', 'foto_url']);
      if ('pocet_ks' in r) zmeny.pocet_ks = r.pocet_ks;
      if ('poznamka' in r) zmeny.poznamka = r.poznamka;
      podleId.set(r.id, { ...z, ...zmeny, ...overeni });
    }
  }
  return [...podleId.values()];
}
