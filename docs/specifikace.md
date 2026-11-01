# Specifikace – Aplikace CS, modul Kontrola expirací

Verze 1.0 (2026-10-29). Vzhled a tok obrazovek: `docs/maketa.html` (odsouhlaseno vlastníkem).

## 1. Cíl
- Nahradit aplikaci v AppSheet bez placených nástrojů (Google Apps Script, Google tabulka, GitHub Pages).
- Skladníci rychle zkontrolují expirace zboží na lokacích; vedoucí a vlastník mají přehled, co kde expiruje,
  které lokace a kdo kontroloval, a mohou zadávat úkoly.
- Počet kontrol po pracovnících a týdnech slouží jako podklad pro hodnocení vedoucích.

## 2. Podniky a pásma
Dva podniky, stejné funkce, oddělená data (sloupec `podnik` v každém listu): kódy `DEK` (Stavebniny DEK), `STA` (Stachema).

| Podnik | Červená (Expiruje brzy) | Žlutá (Pozor) |
|---|---|---|
| Stachema | ≤ 180 dní | ≤ 360 dní |
| Stavebniny DEK | ≤ 90 dní | ≤ 180 dní |

- Expirace se zadává jako **MM/RR**, ukládá se jako **poslední den měsíce** (datum). `Zbývá dní` = expirace − dnes.
- Pásma: `< 0` Expirováno (tmavě červená), `≤ červená` Expiruje brzy, `≤ žlutá` Pozor, jinak OK.
- Hranice jsou v listu `Nastaveni` a jdou měnit bez zásahu do kódu.

## 3. Role a přihlášení
- Přihlášení: výběr jména ze seznamu aktivních uživatelů + **4místný PIN**. Token platí do konce dne.
- Role:
  - **skladník** – kontrola lokací, moje úkoly, blíží se expirace, označení Vydáno/Zlikvidováno.
  - **vedoucí** – vše co skladník + PC část (řízení) **jen ke čtení**: přehled, záznamy (export), úkoly včetně plnění
    („kolik je uděláno“); úkoly nezadává ani neruší.
  - **manažer** – vše co vedoucí + zadávání a rušení úkolů.
  - **admin** – vše + Správa (uživatelé, PINy, nastavení, položky k doplnění) a Importy (číselník, lokace, stav lokací).
  - Oprávnění se ověřují na serveru (úrovně: skladník 1, vedoucí 2, manažer 3, admin 4); klient jen skrývá ovládání.
  *(Upřesněno vlastníkem 2026-11-01, etapa 4.)*
- Data obou podniků vidí všichni přihlášení (žádné omezení po podnicích).

## 4. Datový model (Google tabulka)
Každý list má v 1. řádku hlavičku. ID = krátký náhodný řetězec (např. `Utilities.getUuid()` zkrácený).
Datumy jako datum/čas tabulky, časové pásmo Europe/Prague.

**Uzivatele**: id, jmeno, role (skladnik/vedouci/manazer/admin), pin_hash, pin_salt, aktivni (TRUE/FALSE),
chybne_pokusy, zamceno_do.

**Polozky** (číselník): podnik, ean, cislo_polozky, nazev, aktivni, zdroj (import/rucni), k_doplneni (TRUE/FALSE).
Jedna položka může mít víc EAN (víc řádků). Číslo položky vždy jako **text** (úvodní nuly).
EAN a čísla položek se **porovnávají bez úvodních nul** (Excel z čísla nulu zahodí: EAN 13 → 12 číslic) – sken `0…`
najde položku uloženou bez nuly a záznam převezme EAN z číselníku. Čísla položek mohou být i textová (např. `BZ…`).

**Lokace**: podnik, kod, hala, rada, sloupec, nosnik, zona (P = policová galerie / H = hala), aktivni, k_overeni.
Kód lokace se rozkládá podle pomlček (např. `H2-P-37-1` → hala H2, řada P, sloupec 37, nosník 1; třídílný
`H1-AB-12` → hala H1, řada AB, sloupec 12). Formát se může mezi podniky lišit – rozklad musí být tolerantní (co nejde
rozložit, zůstane prázdné). Rozklad se dělá vždy z kódu, ne ze sloupců importu (Excel u čísel zahazuje úvodní nuly,
např. sloupec `07` → 7). Neznámá naskenovaná lokace se založí s příznakem `k_overeni`.
**Kontrolují se jen lokace v halách a policové galerii: kód začíná `H` nebo `P` a hned za tím je číslice** (H1, H2, P0…;
ne PAL, PRIJEM, BAL, RAMP). Jen ty jsou v plánovači a v pokrytí. Regálové lokace (hala-řada-sloupec(-nosník)) jsou
aktivní, lokace H/P jiného tvaru (`H2-ZASOBNIK`, zóny se slovem) se při importu založí jako neaktivní – admin je může
zapnout. Ostatní prefixy se při importu přeskočí, existující se vypnou. *(Upřesněno vlastníkem 2026-11-01.)*

**Zaznamy** (aktuální stav; 1 řádek = jedno zboží s jednou expirací na jedné lokaci):
id, podnik, lokace, ean, cislo_polozky, expirace (datum), expirace_text (MM/RR), pocet_ks (volitelné), stav
(`Na lokaci` / `Není na lokaci` / `Vydáno` / `Zlikvidováno`), zalozil, zalozeno, overil, overeno, zmenil, zmeneno,
poznamka, foto_url, k_doplneni.
**Klíč: podnik + lokace + ean + expirace.** Stejné zboží se dvěma expiracemi na jedné lokaci = dva záznamy.
Duplicitní založení stejného klíče se nepovolí (aplikace nabídne ✓ u existujícího).

**Kontroly** (log, nikdy se nemaže): id, cas, uzivatel, podnik, lokace, id_zaznamu, akce
(`nový` / `potvrzeno` / `změna` / `není na lokaci` / `bez expiračního zboží` / `vydáno` / `zlikvidováno` / `import uzavřel`),
pocet_ks, poznamka, id_ukolu, zapocteno (TRUE když tato akce byla první dokončená kontrola lokace toho uživatele v daném dni).
„Poslední kontrola lokace“ (plánovač, pokrytí) se počítá jen z dokončených kontrol – ne z `import uzavřel` ani
z Vydáno / Zlikvidováno z obrazovky Blíží se expirace.

**Ukoly**: id, podnik, typ (`ruční` / `plánovač`), komu (jméno nebo `kdokoliv`), lokace (seznam kódů oddělený čárkou),
polozka (volitelně EAN nebo číslo položky), termin, popis, stav (`otevřený` / `splněný` / `zrušený`), zadal, zadano,
splneno, splnil. Úkol je splněný, když jsou zkontrolované všechny jeho lokace (kýmkoliv po zadání).

**Nastaveni** (klíč–hodnota, řádek = podnik + klíč): hranice_cervena, hranice_zluta, cil_kontrol_tyden (prázdné = bez cíle),
report_prijemci (e-maily), planovac_dni_bez_kontroly (výchozí 60), planovac_cervene_overit_dni (30),
planovac_max_lokaci_ukol (20), planovac_naskladneno_zapnuto (TRUE), planovac_naskladneno_dni (14), slozka_fotky_id.

**Import_stav_lokaci**: podnik, lokace, cislo_polozky, mnozstvi, datum_importu, naskladneno, mj. Nahrává se 1× týdně
(export z ERP). Ukládá se **jen hlídané zboží** (položky z číselníku podniku a položky záznamů na lokacích) na lokacích
H/P, sečtené za lokaci + položku; každý import **nahradí** předchozí import podniku (list neroste).
`naskladneno` = sloupec **DATUM** exportu = **poslední naskladnění položky do lokace** (při víc řádcích nejnovější).

**Exporty z ERP** (podnik se ze souboru neurčuje – Stachema a Stavebniny DEK se exportují zvlášť, podnik volí admin
při importu; sloupce se hledají podle názvů v hlavičce bez ohledu na velikost písmen a diakritiku):
- *Stav na lokacích:* DATUM, BALKOD (nepoužívá se), UMISTENI → lokace, ID_POLOZKY → cislo_polozky (vždy text),
  POL_NAZEV (doplní prázdný název v číselníku), MNOZ_ZAKL_MJ → mnozstvi (součet), ZAKL_MJ → mj.
- *Číselník:* EAN, Číslo položky, Název položky.
- *Lokace:* LOKACE (HALA, ŘADA, SLOUPEC, NOSNÍK se nepoužívají – rozklad z kódu).
Import musí zvládnout desítky tisíc řádků (DEK ~30 000): soubor se čte a sčítá v prohlížeči, na server jde jen
výsledek. *(Upřesněno vlastníkem 2026-11-01.)*

## 5. Čtečka – obrazovky a pravidla
1. **Přihlášení** – seznam jmen, PIN klávesnice. Zapamatovat posledního uživatele na zařízení.
2. **Domů** – přepínač podniku (pamatuje si poslední), dlaždice *Kontrola lokace*, *Moje úkoly (počet)*,
   *Blíží se expirace (počet červených + expirovaných)*, počet dnes započtených lokací.
3. **Kontrola lokace**
   - Sken lokace (pole s fokusem, Enter). Rozlišení lokace vs. EAN: EAN = jen číslice (8/12/13/14 znaků), jinak lokace.
   - Zobrazí záznamy se stavem `Na lokaci` na této lokaci: název, expirace, pásmo + zbývá dní, ks, kdy a kdo naposledy ověřil, poznámka.
   - U každého: **✓ Je tu** (ověřeno), **✗ Není tu** (stav `Není na lokaci`), **✎ Upravit** (oprava expirace/ks/poznámky,
     fotka, případně stav Vydáno/Zlikvidováno).
   - **Přidání zboží**: sken EAN → najde položku v číselníku podniku → expirace MM/RR (číselná klávesnice, automatické lomítko,
     validace měsíce 1–12) → ks (nepovinné) → poznámka (nepovinné) → fotka (nepovinné) → uložit; nový záznam je rovnou ✓.
   - **Neznámý EAN**: skladník zadá číslo položky ručně; do číselníku se přidá řádek s `k_doplneni = TRUE`, záznam také.
   - **Lokace hotová**: povolit až po rozhodnutí u všech řádků; jinak dialog „Neoznačené řádky: N“ s volbou
     *Zpět* / *Vše ostatní je tu*.
   - **Bez expiračního zboží**: lokace je zkontrolovaná a nic na ní není; pokud tam jsou evidované záznamy, vyžádat potvrzení
     a označit je `Není na lokaci`.
   - Po dokončení zápis do `Kontroly` + aktualizace `Zaznamy` a úkolů; toast se souhrnem.
4. **Moje úkoly** – úkoly pro mě a pro „kdokoliv“ ve zvoleném podniku; lokace seřazené podle trasy (hala → řada → sloupec → nosník),
   hotové přeškrtnuté, průběh x z y; tlačítko *Začít/pokračovat* otevře kontrolu s nabídkou zbývajících lokací.
5. **Blíží se expirace** – záznamy `Na lokaci` seřazené podle zbývajících dní; filtr *Červené + expirované* / *Žluté* / *Vše*;
   akce *Na lokaci* (otevře kontrolu lokace), *Vydáno*, *Zlikvidováno* (smí kdokoliv, zapíše se do logu).

**Počítání kontrol:** 1 kontrola = 1 dokončená lokace (Lokace hotová / Bez expiračního zboží). Tatáž lokace se jednomu
uživateli započítá **max. 1× za den** (`zapocteno`). Týden = pondělí–neděle (ISO).

**Offline:** akce se ukládají do fronty (IndexedDB), odesílají se na pozadí, ikona s počtem neodeslaných. Číselník a lokace
se po přihlášení nacachují, aby šlo skenovat i při slabém signálu.

**Fotky:** zmenšit v prohlížeči na max. 1600 px, JPEG ~0,8; nahrát na Google Disk do složky z nastavení; URL do záznamu.

## 6. PC část (vedoucí, manažer, admin) – responzivní, funguje i na mobilu
1. **Přehled** (za vybraný podnik):
   - KPI: pokrytí lokací za 30 a 90 dní (% aktivních lokací s dokončenou kontrolou), kontroly tento týden (+ cíl, je-li),
     počet záznamů v červeném pásmu, expirované a stále na lokaci, zboží na skladě bez kontroly (z importu), položky k doplnění,
     lokace naskladněné po poslední kontrole, plnění otevřených úkolů (hotové lokace / všechny).
   - **Mapa pokrytí**: řádky = hala+řada, buňky = lokace (sloupce), barva podle dní od poslední kontroly
     (≤30 zelená, 31–60 světle zelená, 61–90 žlutá, >90 červená, nikdy šedá), tooltip s detailem.
   - **Kontroly po lidech a týdnech** (posledních 8 týdnů), součet proti cíli.
   - **Zboží podle pásem** + trend (počet červených po týdnech).
   - **FEFO upozornění**: stejná položka (číslo položky) se záznamy na více lokacích nebo s více expiracemi → pořadí, odkud vychystávat
     (nejdřív nejbližší expirace, při stejné expiraci dřív naskladněné podle DATUM z importu).
   - Týdenní report: kdy odchází, komu, *Náhled* / *Odeslat teď*.
2. **Úkoly**: nový úkol (komu, lokace – jednotlivé, oddělené čárkou nebo rozsah „od–do“ v rámci řady, volitelně položka,
   termín, poznámka), přehled úkolů s průběhem, zrušení úkolu, pravidla plánovače (zobrazení).
   Zadávat a rušit smí manažer a admin; vedoucí úkoly a jejich plnění jen vidí.
3. **Záznamy**: tabulka s hledáním (lokace, EAN, číslo, název), filtry (podnik, pásmo, stav), řazení,
   **export do Excelu (.xlsx)** s aktuálním filtrem; export logu kontrol za období.
4. **Správa (jen admin)**: uživatelé (přidat, role, aktivní, reset PINu – nový PIN se zobrazí jednou), nastavení po podnicích,
   import číselníku (xlsx/csv: EAN, číslo položky, název), import lokací, import stavu lokací, položky k doplnění (doplnit název / spárovat).
   Každý import: zvolit podnik → nahrát soubor → **náhled** (počty nových / změněných / přeskočených / chybných řádků,
   co se uzavře, varování) → *Importovat*. U stavu lokací admin potvrdí „stav ke dni“ (čas exportu).

## 7. Automatika (časové spouštěče Apps Scriptu)
- **Plánovač (denně 5:30)** pro každý podnik vytvoří/aktualizuje úkoly typu `plánovač` pro „kdokoliv“:
  a) aktivní lokace bez kontroly déle než `planovac_dni_bez_kontroly`;
  b) lokace se záznamem v červeném pásmu neověřeným déle než `planovac_cervene_overit_dni`;
  c) lokace, kde podle importu leží zboží z číselníku, ale nejsou na ní žádné záznamy (zboží bez kontroly);
  d) **naskladněno po poslední kontrole**: lokace s hlídaným zbožím, kde `naskladneno` (DATUM z importu) je pozdější než
  poslední dokončená kontrola lokace – zachytí nové šarže. Jen naskladnění za posledních `planovac_naskladneno_dni`
  (výchozí 14); vypíná se `planovac_naskladneno_zapnuto`. *(Upřesněno vlastníkem 2026-11-01.)*
  Pořadí pravidel b → d → a → c (lokace naléhavějšího pravidla mají přednost). Jen aktivní lokace H/P.
  Maximálně `planovac_max_lokaci_ukol` lokací na úkol, seřazeno podle trasy; nevytvářet duplicity s otevřenými úkoly.
- **Zpracování importu stavu lokací** (po nahrání): záznam `Na lokaci` na lokaci H/P, jehož číslo položky na lokaci
  podle importu není → stav `Není na lokaci`, akce `import uzavřel`; **neuzavírat** záznamy založené, ověřené nebo
  změněné po čase exportu („stav ke dni“). Chybějící lokace H/P z exportu se založí. Spočítat „zboží bez kontroly“;
  přepočítat FEFO.
- **Týdenní report (pondělí 7:00)** pro každý podnik e-mail příjemcům z nastavení: souhrn + příloha xlsx se záznamy
  v červeném pásmu a expirovanými (lokace, číslo, název, EAN, expirace, zbývá dní, ks, naposledy ověřeno).

## 8. Převod dat z AppSheet
Jednorázový import z původní Google tabulky (list Záznamy: EAN, Lokace, Expirace MM/RR, Stav položky, Změnil, Datum změny,
Poznámka, Počet kusů; list Číselník; list lokace). Záznamy bez stavu = `Na lokaci`, Vydáno/Zlikvidováno převzít.
Duplicitní klíče sloučit (nejnovější datum). Log kontrol převzít jako historii (akce `potvrzeno`, `zapocteno` dopočítat).

## 9. Nefunkční požadavky
- Rychlost: sken → zobrazení lokace do 2 s při běžném signálu; zápis neblokuje další sken.
- Odolnost: nic se neztratí při výpadku signálu (fronta).
- Stopa: každá změna nese kdo a kdy.
- Čtečky Urovo: Chrome, obrazovka ~5–6", ovládání palcem. PWA instalovatelná na plochu (manifest, ikony, service worker).

## 10. Výhled (není součástí verze 1)
- Další moduly v rozcestníku (návrhy později).
- Hlubší napojení na ERP.
