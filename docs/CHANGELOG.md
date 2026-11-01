# Changelog

## 0.4.2 – 2026-11-01 – Oprávnění nastavitelná v aplikaci

### Přidáno
- List **`Opravneni`** (řádek = klíč oprávnění, sloupce skladnik / vedouci / manazer / admin, TRUE/FALSE) a registr
  `MODULY_OPRAVNENI` v `Konfigurace.gs`: kontrola lokací, vydáno / zlikvidováno, moje úkoly, přehledy, záznamy a export,
  zadávání / rušení úkolů, správa uživatelů, importy a číselník, nastavení. Výchozí hodnoty = dosavadní pravidla.
- **Správa → Oprávnění** (jen admin): matice se zaškrtávátky po modulech; admin má vždy vše (sloupec needitovatelný).
  Uložení se zapíše do nového listu **`Log_spravy`** (kdo, kdy, co) a v matici je seznam posledních změn.
- Nový modul jen přidá svou skupinu klíčů do `MODULY_OPRAVNENI` – list (setup) i matice se doplní samy; chybějící
  řádek nebo buňka = výchozí hodnota z registru.

### Změněno
- **Server kontroluje u každé akce oprávnění, ne pevnou roli** (`mapaAkci_()` v Api.gs: `opravneni` / `prihlaseni` /
  `role: 'admin'` jen pro oprávnění samotná). Přihlášení a `ja` vracejí seznam oprávnění; klient podle něj
  (`web/js/opravneni.js`, `ma()`) skrývá dlaždice v rozcestníku a Expiraci, položky menu řízení, záložky Správy
  a tlačítka (Na lokaci, Vydáno / Zlikvidováno, Začít úkol, zadávání úkolů).
- Úkoly v řízení vidí, kdo má *Přehledy* nebo *Zadávání úkolů*; účty adminů dál spravuje jen admin.
- Matice se drží 5 minut v cache – změna ve Správě platí hned, ruční změna přímo v listu nejpozději za 5 minut.

## 0.4.1 – 2026-11-01 – Vlastní PIN uživatele

### Změněno
- **Uživatel se zakládá jen se jménem a rolí, bez PINu** – ve Správě i v menu tabulky (*Přidat uživatele*); první admin
  ze setupu také. Žádné generované PINy ani aktivační kódy.
- **Přihlášení:** uživatel bez PINu po výběru jména uvidí *Nastav si PIN* (nový PIN 2×) → uloží se hash se solí →
  přihlášen (`login.info`, `pin.nastav`). Přihlášení účtu bez PINu vrátí `BEZ_PINU` a aplikace přepne na nastavení.
- **Reset PINu** (Správa – admin a manažer; menu tabulky *Resetovat PIN / odemknout uživatele*) PIN smaže, odemkne účet
  a zruší všechna přihlášení; nový PIN si uživatel nastaví sám. Dřívější „Nový PIN“ (vygenerovaný) je pryč.
- **Správa uživatelů i pro manažera** – jen účty pod adminem (admina nezaloží, nezmění, neresetuje; roli admin nepřidělí).
  Nastavení, položky k doplnění a importy dál jen admin.

### Přidáno
- **Můj účet** (rozcestník i řízení) → *Změnit PIN*: současný PIN + nový 2× (`ucet.pin`). Špatný současný PIN se počítá
  do zámku účtu; po změně se ostatní zařízení odhlásí a toto dostane nové přihlášení.
- **Zákaz triviálních PINů** (server `overNovyPin_` i klient `web/js/pin.js`): stejné číslice, vzestupné / sestupné řady.
- Správa: sloupec **PIN nastaven ano / ne**.

## 0.4.0 – 2026-11-01 – Etapa 4: Řízení – přehled, záznamy, správa, importy

### Přidáno
- **Přehled** (`prehled.data`, cache 5 min, velký sklad komprimovaně): KPI (pokrytí 30 / 90 dní, kontroly týden vs. cíl,
  červené, expirované, zboží bez kontroly, naskladněno po kontrole, plnění úkolů, k doplnění), mapa pokrytí
  (hala · řada, ≤30 / 31–60 / 61–90 / >90 / nikdy), kontroly po lidech za 8 týdnů, pásma + trend, FEFO.
- **Záznamy** (`zaznamy.seznam`): hledání, filtr pásma a stavu, řazení, export .xlsx s aktuálním filtrem (kódy jako text),
  **log kontrol** za období (`kontroly.log`, max. 366 dní).
- **Správa** (admin): uživatelé – přidat (PIN se vygeneruje a ukáže jednou), role, aktivní, nový PIN / odemknutí
  (admin si nemůže sebrat roli, musí zůstat aspoň jeden aktivní admin); nastavení po podnicích s kontrolou hodnot;
  položky k doplnění – doplnit název nebo spárovat podle čísla položky (opraví i záznamy).
- **Importy** (admin, xlsx / csv UTF-8 i windows-1250, sloupce podle názvů v hlavičce, podnik volí admin, vždy náhled →
  potvrzení): číselník, lokace, stav na lokacích. Stav se v prohlížeči sečte za lokaci a položku (DATUM = nejnovější
  naskladnění) a na server jde jen lokace H/P a hlídané zboží (30 000 řádků ≈ 300 kB). Uzavření zmizelého zboží
  (`import uzavřel`), záznamy změněné po čase exportu se neuzavřou; varování při podezřele malém importu.
- **Plánovač d) Naskladněno po poslední kontrole** (`planovac_naskladneno_zapnuto`, `planovac_naskladneno_dni` = 14);
  pořadí pravidel b → d → a → c.
- SheetJS 0.20.3 z `cdn.sheetjs.com` s kontrolním součtem (načte se jen v řízení).
- Ukázkové soubory se smyšlenými daty: `docs/testovaci-data/`.

### Změněno
- **Oprávnění:** vedoucí v řízení jen čte (přehled, záznamy, úkoly s plněním); zadávat / rušit úkoly smí manažer a admin
  (`ROLE_UROVEN`: skladník 1, vedoucí 2, manažer 3, admin 4); Správa a Importy jen admin. Ověřuje server.
- Kontrolují se jen lokace **H nebo P s číslicí** (H1, P0…; ne PAL, PRIJEM): jen ty jsou v plánovači a v pokrytí.
  Import lokací: regálové (`H2-P-37-1`, `H1-AB-12`) aktivní, H/P jiného tvaru neaktivní, ostatní se přeskočí / vypnou.
- Rozklad třídílného kódu `H1-AB-12` → hala H1, řada AB, sloupec 12 (dřív řada H1).
- EAN a čísla položek se porovnávají **bez úvodních nul** (Excel je u čísel zahazuje): sken `0…` najde EAN uložený
  s 12 číslicemi a záznam převezme EAN z číselníku.
- „Poslední kontrola lokace“ (plánovač, pokrytí) nepočítá `import uzavřel` ani Vydáno / Zlikvidováno z Blíží se expirace.
- Dlaždice *Expirace – řízení* vede na Přehled; postranní menu Přehled / Úkoly / Záznamy / Správa / Importy podle role.

### Datový model
- `Import_stav_lokaci`: nové sloupce `naskladneno` (DATUM z ERP) a `mj`; ukládá se jen hlídané zboží a každý import
  nahradí předchozí import podniku. Souhrn posledního importu ve Script Properties (`import_stav_<podnik>`).
- `Nastaveni`: `planovac_naskladneno_zapnuto`, `planovac_naskladneno_dni` (doplní setup).

## 0.3.1 – 2026-10-30 – Opravy po testu etap 2–3

### Opraveno
- **Ruční psaní do skenovacího pole**: pole odeslalo kód po pauze 250 ms, takže při psaní vzalo jen první písmeno.
  Pauzou se teď ukončí jen rychlý vstup (skener – celý kód najednou přes IME, nebo znaky do ~50 ms po sobě).
  Pomalé psaní čeká na **Enter** nebo nové tlačítko **OK** vedle pole (při ručním psaní zezelená, ukazatel hlásí
  „Píšeš ručně – potvrď Enterem nebo OK“). Pravidla skenování v `CLAUDE.md` doplněna.
- Menu **Přidat uživatele**: role jde napsat s háčky a velkými písmeny (*skladník*, *Vedoucí*, *MANAŽER*, *správce*)
  nebo číslem 1–4 (dialog je nabízí). Při chybě (role, PIN, prázdné jméno) se dialog zeptá znovu a česky řekne,
  co napsat. PIN smí obsahovat mezeru („04 27“).
- Menu **Změnit PIN / odemknout**: jméno najde i bez háčků a s jinými velkými písmeny, při nejednoznačné shodě
  nebo neznámém jménu srozumitelná hláška a nový dotaz.
- Role zapsaná do listu `Uzivatele` ručně s háčky (např. „Vedoucí“) se při přihlášení bere správně.
- **Poznámka** zadaná uživatelem (úprava záznamu i nové zboží) se zapisuje i do `Kontroly.poznamka`, spojená
  s automatickým textem: „expirace 03/27 → 03/28; pozn.: …“; smazaná poznámka jako „poznámka smazána“.

### Změněno
- Dlaždice *Expirace – PC* se jmenuje **Expirace – řízení** (Úkoly, přehledy, správa). Skladník ji nevidí,
  server mu akce `ukoly.seznam` / `ukoly.zadej` / `ukoly.zrus` odmítne (ověřeno testem).
- **Barva podle podniku** v modulu Expirace: hlavička (čtečka), horní pruh řízení, horní lišta systému
  (`theme-color`) a vybraný podnik v přepínači – Stavebniny DEK červená, Stachema modrá. V hlavičce je vždy název
  podniku. Barvy pásem expirace se nemění. Barvy jsou v `web/js/podniky.js`.

## 0.3.0 – 2026-10-30 – Etapa 3: Úkoly, Blíží se expirace, plánovač

### Přidáno
- Čtečka – **Moje úkoly**: úkoly pro mě + „kdokoliv“ ve zvoleném podniku, lokace podle trasy (hala → řada → sloupec →
  nosník, čísla přirozeně), hotové přeškrtnuté, průběh x z y, *Začít / pokračovat* → kontrola s nabídkou zbývajících
  lokací (čipy i sken). Bez signálu poslední stažené úkoly + lokace z neodeslaných dávek jako hotové.
- Čtečka – **Blíží se expirace**: řazení podle zbývajících dní, filtry Červené + expirované / Žluté / Vše,
  *Na lokaci* (otevře kontrolu lokace), *Vydáno* / *Zlikvidováno* s potvrzením přes offline frontu.
- Domů: aktivní dlaždice Moje úkoly (počet otevřených) a Blíží se expirace (počet červených + expirovaných).
- **PC část**: rám s postranním menu podle makety (Přehled, Záznamy, Správa zatím „připravujeme“), obrazovka **Úkoly**
  – nový úkol (komu, lokace jednotlivě / čárkou / rozsah „od až do“ v rámci řady, zboží, termín, poznámka), přehled
  s průběhem, zrušení, pravidla plánovače a stav spouštěče. Dlaždice *Expirace – PC* v rozcestníku pro vedoucí+.
- Backend: `ukoly.moje`, `ukoly.seznam`, `ukoly.zadej`, `ukoly.zrus`, `zaznam.stav`; `lokace.dokonci` odškrtne lokaci
  ve všech otevřených úkolech podniku zadaných před kontrolou (úkol s poslední lokací = splněný, `splnil`, `splneno`),
  `Kontroly.id_ukolu` = odškrtnuté úkoly; `kontroly.dnes` vrací i počet otevřených úkolů.
- **Plánovač** `planovac()` (kap. 7): pravidla b) červené pásmo neověřené, a) lokace bez kontroly, c) zboží z importu
  bez záznamů; na pravidlo a podnik nejvýš jeden otevřený úkol pro „kdokoliv“ (doplňuje se do max. počtu lokací),
  nejnaléhavější lokace, podle trasy, bez duplicit s otevřenými úkoly. Spouštěč denně 5:30 – menu v tabulce
  *Plánovač – zapnout denní spouštění*, ruční běh *Plánovač – spustit teď*.

### Změněno v datovém modelu
- List `Ukoly`: nový sloupec `hotove_lokace` (lokace zkontrolované po zadání). Doplní ho setup, nebo aplikace sama.
- U zrušeného úkolu jsou ve `splneno` / `splnil` čas a jméno toho, kdo ho zrušil.

## 0.2.3 – 2026-10-30 – Skenování podle ověřených pravidel pro Urovo DT66

Sken na Urovo chodí přes IME (commitText), ne jako stisky kláves (ověřeno v jiné aplikaci na stejných čtečkách).

### Změněno
- Skenovací pole už nikdy nemá `inputmode="none"`. Výchozí režim **C** (fokus přes krátké `readOnly`, klávesnice
  nevyskočí), záloha **B** (obyčejné pole); režim A z přepínače v diagnostice zmizel (uložené „A“ se bere jako C).
- `focus()` se volá synchronně v obsluze klepnutí: přechod na Kontrolu lokace (dlaždice pole ukáže a zaměří ještě
  před přechodem), ✓ / ✗, zavření dialogu, Zrušit ve formuláři, klepnutí kamkoliv. Odstraněno „blur → 50 ms → focus“;
  časovač už jen kontroluje stav pro ukazatel zelená/šedá.
- Jediná cesta příjmu skenu: zaměřené pole + událost `input`. Odstraněn globální buffer kláves.
- Konec skenu: Enter (když už text v poli je), nebo pauza **250 ms** od posledního `input`.
- Kamera: vypne se po skenu, po Zrušit i při odchodu z aplikace.

## 0.2.2 – 2026-10-30 – Ladění skenování přes IME

Diagnostika z čtečky ukázala, že skener vkládá celý kód přes IME (`keydown key="Unidentified"`, pak Enter),
ale text do pole s `inputmode="none"` nedorazí.

### Změněno
- Enter v skenovacím poli nečte hodnotu naslepo: když je pole prázdné (nebo IME ještě skládá), počká až 150 ms
  na `input` / `compositionend` a teprve pak sken zpracuje. Enter už nevolá `preventDefault`.

### Přidáno
- Diagnostika: přepínač **režimu pole** – A `inputmode="none"` (výchozí), B obyčejné textové pole,
  C fokus přes krátké `readOnly` (potlačí klávesnici, pole zůstane běžné). Volba se pamatuje v zařízení.
- Diagnostika loguje i `beforeinput`, `input`, `compositionstart/update/end` (s `data`, `inputType` a hodnotou pole)
  a hodnotu pole v okamžiku Enteru a 100 ms po něm; drží posledních 30 událostí.
- Tlačítko **Odeslat výpis** – uloží výpis do listu `Log_chyb` (akce `diagnostika skenování`) přes nové API
  `diagnostika.odesli`. Vyžaduje aktualizovaný `Api.gs` a novou verzi nasazení Apps Scriptu.

## 0.2.1 – 2026-10-30 – Oprava skenování na čtečce Urovo

### Opraveno
- Na čtečce fungoval jen první sken, další se ztrácely, dokud uživatel neodešel z aplikace a nevrátil se.
  Skener (IME) zůstával navázaný na skenovací pole, které obrazovka po skenu nahradila novým.
  - Skenovací pole je teď **jedno trvalé** v `index.html` mimo překreslovanou část (dole na obrazovce);
    obrazovky ho jen zobrazují/skrývají a mění popisek. `inputmode` se nemění.
  - Po každém skenu, návratu do aplikace a zavření dialogu se fokus „odpojí a znovu připojí“ (blur → 50 ms → focus).
  - Pojistka: rychle po sobě jdoucí znaky mimo pole se skládají do bufferu (konec Enterem nebo pauzou 100 ms);
    konec skenu se pozná i z `beforeinput`/`input` a pauzy; `Unidentified`/229 vrátí fokus do pole.
  - Skeny během načítání, dialogu nebo překreslení čekají ve frontě a zpracují se po vykreslení.
  - Sken na obrazovce bez skenování (např. Domů) ukáže upozornění místo tichého zahození.

### Přidáno
- Ukazatel připravenosti nad skenovacím polem (zelený pruh = připraveno, šedý = klepni sem).
- Ruční zadání kódu v samostatném dialogu (⌨).
- Diagnostický režim: 5× klepnout na číslo verze v rozcestníku – panel s posledními 20 událostmi klávesnice
  (typ, key, code, keyCode, cíl, čas, odstup) a stavem fokusu; *Kopírovat* zkopíruje výpis.

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
