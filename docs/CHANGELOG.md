# Changelog

## 0.2.0 – 2026-10-30 – Etapa 2: Kontrola lokace

### Přidáno
- Čtečka – obrazovka **Kontrola lokace**: skenovací pole s trvalým fokusem a Enterem (skener Urovo), bez vyskakující
  klávesnice (⌨ pro ruční zadání), skenování kamerou (`BarcodeDetector`, záloha `@zxing/library` 0.21.3 z CDN
  s kontrolním součtem). EAN = jen číslice 8/12/13/14 znaků, jinak lokace.
- Seznam záznamů „Na lokaci“ s pásmem, zbývajícími dny, ks, posledním ověřením a poznámkou; ✓ Je tu / ✗ Není tu /
  ✎ Upravit (expirace, ks, poznámka, stav Vydáno/Zlikvidováno, fotka).
- Přidání zboží (EAN → číselník → MM/RR → ks → poznámka → fotka), neznámý EAN s ručním číslem položky a `k_doplneni`,
  zákaz duplicity klíče podnik + lokace + EAN + expirace.
- *Lokace hotová* s dialogem „Neoznačené řádky“ / *Vše ostatní je tu*, *Bez expiračního zboží* s potvrzením.
- Backend: `lokace.nacti`, `lokace.dokonci` (jedna dávka = změny lokace + zápis do `Kontroly`, `zapocteno` max. 1× denně
  na uživatele a lokaci, idempotence podle ID dávky), `kontroly.dnes`, `foto.nahraj` (base64 → Google Disk).
- Offline fronta v IndexedDB: fotky a dávky se odesílají na pozadí, opakují se s rostoucí prodlevou, čekají na
  přihlášení autora; ikona ⇡ s počtem neodeslaných v hlavičce a seznam fronty.
- Fotky zmenšené v prohlížeči (max. 1600 px, JPEG 0,8), složka na Disku se založí sama, sdílení „kdokoli s odkazem“.
- Domů: aktivní dlaždice Kontrola lokace, počet dnes započtených lokací (+ čekající na odeslání).
- Menu v tabulce *Povolit fotky (Google Disk)*.

### Poznámky
- `data.zaklad` nově posílá i záznamy „Na lokaci“ – lokace jde zobrazit i bez signálu.
- Existující záznam se stejným klíčem ve stavu „Není na lokaci“ / Vydáno / Zlikvidováno se při přidání vrátí na lokaci
  (nevznikne druhý řádek se stejným klíčem).
- Neznámá lokace se zakládá až při dokončení (ne při pouhém naskenování). Zóna = první písmeno kódu (H/P).
- `zapocteno = TRUE` má jen první řádek dávky v `Kontroly` – počet TRUE = počet započtených kontrol.
- Úkoly se při dokončení lokace zatím neodškrtávají – přijde v etapě 3.

## 0.1.1 – 2026-10-30

### Změněno
- `web/config.js`: doplněná URL webové aplikace Apps Scriptu.
- Nasazení na Pages: novější verze actions běžící na Node.js 24 (`checkout@v7`, `configure-pages@v6`,
  `upload-pages-artifact@v5`, `deploy-pages@v5`).

## 0.1.0 – 2026-10-29 – Etapa 1: základ

### Přidáno
- Struktura repa: `web/` (PWA), `apps-script/` (backend), nasazení `web/` na GitHub Pages přes GitHub Actions.
- Backend (Apps Script navázaný na tabulku):
  - `setup()` z menu *Aplikace CS* v tabulce – založí listy se sloupci ze specifikace, doplní výchozí nastavení
    (DEK 90/180, Stachema 180/360, plánovač 60/30/20) a prvního administrátora (jméno a PIN přes dialog).
  - Menu *Přidat uživatele* a *Změnit PIN / odemknout uživatele* (do doby, než bude Správa v aplikaci).
  - JSON API `doPost` s akcemi `uzivatele.seznam`, `login`, `logout`, `ja`, `data.zaklad`; kontrola tokenu a role.
  - PIN jako SHA-256 se solí; token platný do konce dne (ve Script Properties jen jeho hash);
    5 chybných PINů = zámek na 10 minut.
  - Čtení a zápis listů podle názvů sloupců, zápisy pod `LockService`, textový formát pro kódy (úvodní nuly),
    log neočekávaných chyb do listu `Log_chyb`.
- Frontend (PWA): přihlášení (výběr jména + PIN klávesnice, funguje i fyzická klávesnice čtečky, pamatuje posledního
  uživatele), rozcestník modulů, Expirace – Domů s přepínačem podniku (pamatuje si volbu) a třemi dlaždicemi
  (zatím bez funkce), stažení číselníku/lokací/nastavení do IndexedDB, odhlášení, manifest, ikony, service worker.
- README s návodem na nasazení krok za krokem.

### Poznámky
- List `Log_chyb` není ve specifikaci – přidán kvůli požadavku na log chyb z etapy 1.
- Do čtečky se z nastavení neposílají `report_prijemci` a `slozka_fotky_id`.
