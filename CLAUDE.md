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
  Vzorové exporty z ERP vlastník drží mimo repo – do repa z nich nic nekopíruj (ani čísla položek, EAN, kódy lokací
  či názvy). Testovací soubory jen se **smyšlenými** hodnotami a jen v `docs/testovaci-data/` (jediná výjimka
  z `*.xlsx` / `*.csv` v `.gitignore`).
- **UI celé česky**, srozumitelně pro skladníky. Velká tlačítka (ovládání v rukavicích), vysoký kontrast, mobil na prvním místě.
- **Skenování:** řídí se závaznými pravidly v sekci *Skenování na čtečkách Urovo* níže.
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

## Data a oprávnění (závazné – rozhodnutí vlastníka z etapy 4, 2026-11-01)
1. **Role v řízení:** vedoucí jen čte (přehled, záznamy, úkoly s plněním); zadávat a rušit úkoly smí manažer a admin;
   Správa a Importy jen admin. Každou novou akci API zařaď do `mapaAkci_()` s minimální rolí – **oprávnění vždy
   ověřuje server** (`ROLE_UROVEN`: skladník 1, vedoucí 2, manažer 3, admin 4), klient jen skrývá ovládání.
2. **Kontrolují se jen lokace H nebo P s číslicí** (`LOKACE_KONTROLOVANA` = `/^[HP]\d/` – H1, P0…; ne PAL, PRIJEM,
   BAL, RAMP). Jen ty patří do plánovače a pokrytí (`mapaHlidanychLokaci_`). Klient importů má stejný regulár –
   při změně uprav obě místa.
3. **Podnik se ze souboru neurčuje** – Stachema a Stavebniny DEK mají oddělené exporty, podnik volí admin při importu.
4. **DATUM v exportu stavu = poslední naskladnění do lokace** (`Import_stav_lokaci.naskladneno`); používá se ve FEFO
   a v pravidle plánovače d). Import stavu ukládá jen hlídané zboží a vždy nahradí předchozí import podniku.
5. **Excel zahazuje úvodní nuly:** EAN a čísla položek porovnávej přes `klicEan_` / `klicCisla_` (server)
   a `klicEan` / `polozkaPodleEan` (klient), ne přes `===`. Kódy čti z buněk jako text (`hodnotaNaText`),
   rozklad lokace dělej z kódu, ne ze sloupců SLOUPEC / NOSNÍK. V tabulce drž kódy jako text (`TEXTOVE_SLOUPCE`).
6. **Velké objemy:** import musí zvládnout desítky tisíc řádků (DEK ~30 000) – čti a sčítej v prohlížeči, na server
   posílej jen výsledek; zapisuj hromadně (`zapisRadkyHromadne_`, `nahradRadkyPodniku_`), ne po řádcích.
   Cache Apps Scriptu pojme max. 100 kB na klíč (větší hodnoty komprimuj).
7. Import má vždy **náhled** (nic nezapíše) a teprve pak potvrzení; uzavření zboží importem (`import uzavřel`)
   nesmí zavřít záznam založený / ověřený / změněný po „stavu ke dni“.

## Skenování na čtečkách Urovo (závazné – ověřeno na Urovo DT66, verze 0.2.3)
Hardwarový skener posílá kód **přes IME (commitText)**, ne jako stisky kláves. Každé z pravidel níže vzniklo z chyby,
kdy se skeny ztrácely (fungoval jen první sken). Při jakékoliv úpravě skenování nebo obrazovek se skenováním je
**neporušuj**; když se zdá, že je porušit potřeba, nejdřív se zeptej vlastníka.

1. **Nikdy `inputmode="none"`** na skenovacím poli – zavírá cestu, kterou sken chodí. Klávesnice se potlačuje
   readonly trikem (režim C: před `focus()` krátce `readOnly = true`, po ~50 ms zpět), záloha je obyčejné pole (režim B).
2. **Pole je viditelné a zaměřené** – ne mimo obrazovku, ne `display:none`, ne průhledné/0 px, dokud se na obrazovce
   skenuje. Je **jedno trvalé** (`#sken` v `web/index.html`, obsluha `web/js/skener.js`); obrazovky ho nikdy
   nepřekreslují ani nenahrazují, jen volají `zobrazSkener` / `skryjSkener` / `pripravSkener`.
3. **`focus()` jen synchronně v obsluze klepnutí** (přechod na skenovací obrazovku, ✓/✗, zavření dialogu, klepnutí
   kamkoliv). Fokus ze `setTimeout` / po `await` Android ignoruje – časovač smí jen kontrolovat stav (ukazatel
   zelená/šedá), ne fokus opravovat. Žádné „blur → časovač → focus“.
4. **Jen jedna cesta zachytávání:** zaměřené pole + událost `input`. Žádný globální `keydown` buffer ani jiný
   souběžný posluchač, který by skládal kód – dvě cesty si kradou text.
5. **Konec skenu = Enter, nebo pauza 250 ms od posledního `input`** (některé kusy Enter neposílají; IME může text
   doručit až po Enteru). Během skládání IME (`compositionstart`–`compositionend`) se nečeká na pauzu.
   Pauzou se ukončí jen **rychlý vstup** (celý text najednou přes IME, nebo znaky do ~50 ms po sobě); pomalé
   ruční psaní do pole ukončí jen Enter nebo tlačítko OK (od verze 0.3.1).
6. **Kamera jen za tlačítkem 📷** a po skenu, Zrušit i odchodu z aplikace se vždy vypne (zastavit všechny stopy streamu – `track.stop()`).

Ladění na čtečce: diagnostika je v aplikaci skrytá; zapne se 5× klepnutím na číslo verze v rozcestníku (události
klávesnice/IME, stav fokusu, přepínač režimu C/B, *Odeslat výpis* do listu `Log_chyb`). Ve výchozím stavu je vypnutá
a tak ji nech.

## Nasazení (vlastník dělá ručně, pokud není nastavený clasp)
1. Google tabulka → Rozšíření → Apps Script → vložit soubory z `apps-script/` → spustit `setup()` (založí listy).
2. Nasadit jako webovou aplikaci → URL vložit do `web/config.js`.
3. Push do `main` → GitHub Actions nasadí `web/` na GitHub Pages.
