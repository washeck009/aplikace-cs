# CLAUDE.md – Aplikace CS

Tento soubor čti na začátku každé práce v repu. Podrobné zadání je v `docs/specifikace.md`,
vzhled a ovládání v klikací maketě `docs/maketa.html` (otevři v prohlížeči). Práce probíhá po etapách
podle `docs/prompty/etapa-N.md`.

## O co jde
Webová aplikace (PWA) pro centrální sklad. Hlavní aplikace = rozcestník modulů; první a zatím jediný modul
je **Kontrola expirací** (doby trvanlivosti barev a dalšího zboží) pro dva podniky: **Stavebniny DEK** a **Stachema**.
Oba podniky mají stejný proces i vzhled, liší se jen daty (číselník, lokace, záznamy, nastavení pásem).
Nahrazuje starou aplikaci v AppSheet.

Uživatelé: skladníci na čtečkách **Urovo DT40 / DT50S / DT66** (Android, Chrome), vedoucí a manažeři (PC i mobil),
administrátor (vlastník projektu). Skladníci **nemají žádné firemní ani Google účty**.

## Architektura (závazná)
- `web/` – frontend: **statická PWA** bez build kroku (čisté HTML + CSS + JavaScript, ES moduly).
  Nasazení na **GitHub Pages** přes GitHub Actions (publikuje se jen složka `web/`).
- `apps-script/` – backend: **Google Apps Script** navázaný na Google tabulku (container-bound, `SpreadsheetApp.getActive()`),
  nasazený jako webová aplikace „Spustit jako: já“, „Přístup: kdokoliv“. Slouží jako JSON API (`doPost`).
- **Databáze = Google tabulka** (listy viz specifikace). Fotky = Google Disk (složka nastavená v listu Nastaveni).
- Časové spouštěče Apps Scriptu: plánovač kontrol (denně ráno), týdenní report (pondělí).
- `docs/` – specifikace, maketa, prompty. Na Pages se **nepublikuje**.

## Pravidla
- **Repo je veřejné.** Nikdy do něj nedávej hesla, PINy, tokeny, e-mailové adresy, skutečná data ze skladu,
  jména zaměstnanců ani ID tabulky/složek. Konfigurace s citlivými hodnotami patří do listu `Nastaveni`
  nebo do Script Properties. URL webové aplikace Apps Scriptu ve `web/config.js` je v pořádku (bez PINu je k ničemu).
- **UI celé česky**, srozumitelně pro skladníky. Velká tlačítka (ovládání v rukavicích), vysoký kontrast, mobil na prvním místě.
- **Skenování:** hardwarový skener Urovo funguje jako klávesnice (kód + Enter) → aktivní vstupní pole musí mít vždy fokus
  a reagovat na Enter. Kamera je záloha (`BarcodeDetector`, pokud chybí, knihovna z CDN s pevnou verzí).
- Komunikace frontend → Apps Script: `fetch` POST s `Content-Type: text/plain` (kvůli CORS bez preflightu), tělo JSON
  `{action, token, data}`, odpověď JSON `{ok, data | error}`.
- **Bezpečnost:** PIN se ukládá jen jako hash se solí (SHA-256, `Utilities.computeDigest`). Po přihlášení dostane klient
  náhodný token s platností do konce dne (CacheService / PropertiesService). Každá akce ověřuje token a roli na serveru.
  Po 5 chybných PINech zámek účtu na 10 minut.
- Zápisy do tabulky pod `LockService`. Log `Kontroly` se **nikdy nemaže**, záznamy se jen mění/uzavírají se stopou kdo/kdy.
- Výpadek signálu: záznamy se ukládají do fronty v IndexedDB a odesílají se na pozadí; fronta musí být vidět.
- Kód piš jednoduše a čitelně, s krátkými komentáři česky. Žádné frameworky bez důvodu; knihovny jen z CDN s pevnou verzí.
- Při každé změně ve `web/` zvyš `VERZE` v `web/sw.js` i `web/js/verze.js` (jinak čtečky drží starou cache)
  a nové soubory přidej do seznamu `SOUBORY` v `web/sw.js`.
- Po každé etapě: aktualizuj `README.md` (jak nasadit / co je hotové) a `docs/CHANGELOG.md`, commitni s popisným
  českým commitem. Push jen se souhlasem vlastníka.
- Když něco ve specifikaci chybí nebo si odporuje, **zeptej se**, nevymýšlej.

## Nasazení (vlastník dělá ručně, pokud není nastavený clasp)
1. Google tabulka → Rozšíření → Apps Script → vložit soubory z `apps-script/` → spustit `setup()` (založí listy).
2. Nasadit jako webovou aplikaci → URL vložit do `web/config.js`.
3. Push do `main` → GitHub Actions nasadí `web/` na GitHub Pages.
