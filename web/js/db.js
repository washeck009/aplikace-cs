// IndexedDB: cache dat podniku (číselník, lokace, záznamy, nastavení) a offline fronta odesílání.
const NAZEV_DB = 'aplikace-cs';
const VERZE_DB = 2;

function otevri() {
  return new Promise((hotovo, chyba) => {
    const pozadavek = indexedDB.open(NAZEV_DB, VERZE_DB);
    pozadavek.onupgradeneeded = () => {
      const db = pozadavek.result;
      if (!db.objectStoreNames.contains('zaklad')) db.createObjectStore('zaklad', { keyPath: 'podnik' });
      if (!db.objectStoreNames.contains('fronta')) db.createObjectStore('fronta', { keyPath: 'id', autoIncrement: true });
    };
    pozadavek.onsuccess = () => hotovo(pozadavek.result);
    pozadavek.onerror = () => chyba(pozadavek.error);
  });
}

/** Spustí akci nad úložištěm v jedné transakci; vrátí výsledek posledního požadavku. */
function transakce(store, rezim, akce) {
  return otevri().then((db) => new Promise((hotovo, chyba) => {
    const tx = db.transaction(store, rezim);
    const pozadavek = akce(tx.objectStore(store));
    tx.oncomplete = () => { db.close(); hotovo(pozadavek?.result); };
    tx.onerror = () => { db.close(); chyba(tx.error); };
    tx.onabort = () => { db.close(); chyba(tx.error); };
  }));
}

/* ---------- Data podniku ---------- */

/** Uložená data podniku {podnik, polozky, lokace, zaznamy, nastaveni, stazeno}, nebo null. */
export async function nactiZaklad(podnik) {
  try {
    return (await transakce('zaklad', 'readonly', (s) => s.get(podnik))) || null;
  } catch {
    return null;
  }
}

export async function ulozZaklad(zaklad) {
  try {
    await transakce('zaklad', 'readwrite', (s) => s.put(zaklad));
  } catch {
    // Bez IndexedDB aplikace funguje dál, jen bez offline cache.
  }
}

/* ---------- Fronta odesílání ---------- */

/** Všechny položky fronty v pořadí, jak vznikly. */
export async function frontaVse() {
  try {
    return (await transakce('fronta', 'readonly', (s) => s.getAll())) || [];
  } catch {
    return [];
  }
}

/** Přidá položky do fronty najednou (všechny, nebo žádnou). Při chybě vyhodí výjimku – data se nesmí ztratit potichu. */
export function frontaPridej(polozky) {
  return transakce('fronta', 'readwrite', (s) => {
    let posledni;
    polozky.forEach((p) => { posledni = s.add(p); });
    return posledni;
  });
}

export function frontaUloz(polozky) {
  return transakce('fronta', 'readwrite', (s) => {
    let posledni;
    polozky.forEach((p) => { posledni = s.put(p); });
    return posledni;
  });
}

export function frontaSmaz(id) {
  return transakce('fronta', 'readwrite', (s) => s.delete(id));
}
