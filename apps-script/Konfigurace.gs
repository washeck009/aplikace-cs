/**
 * Konfigurace – podniky, role, listy a jejich sloupce, výchozí nastavení.
 * Repo je veřejné: žádné PINy, e-maily, ID tabulek ani složek sem nepatří.
 */

// Kódy podniků (sloupec `podnik` v každém listu) a jejich názvy.
const PODNIKY = {
  DEK: 'Stavebniny DEK',
  STA: 'Stachema'
};

// Role a jejich úroveň. Co která role smí, určují oprávnění (MODULY_OPRAVNENI, list Opravneni) – úroveň se
// používá jen pro „přihlášen“ a pro to, že účty adminů spravuje jen admin.
const ROLE_UROVEN = {
  skladnik: 1,
  vedouci: 2,
  manazer: 3,
  admin: 4
};

/**
 * Oprávnění po modulech: [klíč, název, popis, výchozí role (kromě admina – ten má vždy vše)].
 * Server kontroluje u každé akce oprávnění (mapaAkci_ v Api.gs), ne pevnou roli; hodnoty se nastavují v listu
 * Opravneni / ve Správě → Oprávnění. **Nový modul jen přidá svou skupinu sem** a u svých akcí uvede klíč –
 * list Opravneni (setup, a do té doby výchozí hodnoty) i matice ve Správě se doplní samy.
 */
const MODULY_OPRAVNENI = [
  { modul: 'Expirace – čtečka', opravneni: [
    ['kontrola', 'Kontrola lokací', 'skenování lokací, potvrzení / změny / nové zboží, fotky',
      ['skladnik', 'vedouci', 'manazer']],
    ['vydano', 'Vydáno / Zlikvidováno', 'obrazovka Blíží se expirace – označit zboží jako vydané nebo zlikvidované',
      ['skladnik', 'vedouci', 'manazer']],
    ['moje_ukoly', 'Moje úkoly', 'úkoly pro mě a pro „kdokoliv“ na čtečce', ['skladnik', 'vedouci', 'manazer']]
  ] },
  { modul: 'Expirace – řízení', opravneni: [
    ['prehledy', 'Přehledy', 'přehled podniku (pokrytí, kontroly, pásma, FEFO) a úkoly s plněním ke čtení', ['vedouci', 'manazer']],
    ['zaznamy', 'Záznamy a export', 'tabulka záznamů, export do Excelu, log kontrol', ['vedouci', 'manazer']],
    ['ukoly_zadavani', 'Zadávání a rušení úkolů', 'nový úkol, zrušení úkolu', ['manazer']]
  ] },
  { modul: 'Správa', opravneni: [
    ['sprava_uzivatelu', 'Správa uživatelů', 'založit uživatele, role, aktivní, reset PINu (účty adminů jen admin)', ['manazer']],
    ['importy', 'Importy a číselník', 'import číselníku, lokací a stavu lokací; položky k doplnění', []],
    ['nastaveni', 'Nastavení podniků', 'pásma, cíle, plánovač, příjemci reportu', []]
  ] }
];

// Role ve sloupcích listu Opravneni (admin jen pro přehlednost – vždy TRUE, nemění se).
const ROLE_OPRAVNENI = ['skladnik', 'vedouci', 'manazer', 'admin'];
const CACHE_OPRAVNENI_S = 300; // změna přímo v listu se projeví nejpozději za 5 minut, ze Správy hned

// Kontrolují se jen lokace v halách a policové galerii: H nebo P a hned číslice (H1, H2, P0…; ne PAL, PRIJEM).
const LOKACE_KONTROLOVANA = /^[HP]\d/;
// Regálová lokace hala-řada-sloupec(-nosník), např. H2-P-37-1, H1-AB-12. H/P lokace jiného tvaru
// (H2-ZASOBNIK, P0-NEJAKE MISTO) se při importu založí jako neaktivní – admin je může zapnout.
const LOKACE_REGALOVA = /^[HP]\d+-[A-Z0-9]{1,3}-\d+(-[A-Z0-9]{1,3})?$/;

// Zámek účtu po chybných PINech.
const ZAMEK_POKUSU = 5;
const ZAMEK_MINUT = 10;

// Klíč tokenu ve Script Properties = prefix + SHA-256 tokenu (samotný token se neukládá).
const PREFIX_TOKENU = 'token_';

// Zpracované dávky z čtečky (idempotence): Script Properties `davka_<id>`, drží se 30 dní.
const PREFIX_DAVKY = 'davka_';
const DAVKY_DRZET_DNI = 30;

// Dávka z offline fronty smí nést čas kontroly nejvýš 2 dny zpět, starší dostane čas přijetí.
const ZPETNY_ZAPIS_DNI = 2;

// Stavy záznamů (list Zaznamy).
const STAV = {
  NA_LOKACI: 'Na lokaci',
  NENI: 'Není na lokaci',
  VYDANO: 'Vydáno',
  ZLIKVIDOVANO: 'Zlikvidováno'
};

// Úkoly (list Ukoly).
const STAV_UKOLU = { OTEVRENY: 'otevřený', SPLNENY: 'splněný', ZRUSENY: 'zrušený' };
const TYP_UKOLU = { RUCNI: 'ruční', PLANOVAC: 'plánovač' };
const KDOKOLIV = 'kdokoliv';
const MAX_LOKACI_RUCNI_UKOL = 300;

// Pravidla plánovače (kap. 7). Úkol plánovače se k pravidlu přiřazuje podle začátku popisu.
const PRAVIDLA_PLANOVACE = {
  a: 'Lokace nekontrolované déle než',
  b: 'Červené pásmo – ověřit, že zboží je na lokaci',
  c: 'Zboží na skladě bez kontroly',
  d: 'Naskladněno po poslední kontrole'
};

// Pořadí pravidel plánovače – nejnaléhavější první (jeho lokace mají přednost).
const PORADI_PRAVIDEL = ['b', 'd', 'a', 'c'];

// Kontroly, které nejsou dokončenou kontrolou lokace (nepočítají se do pokrytí ani „poslední kontroly“).
const AKCE_IMPORT_UZAVREL = 'import uzavřel';
const POZNAMKA_BLIZI_SE = 'Blíží se expirace';

// Listy a jejich sloupce. Pořadí slouží jen pro založení – kód vždy čte podle názvů.
const LISTY = {
  Uzivatele: ['id', 'jmeno', 'role', 'pin_hash', 'pin_salt', 'aktivni', 'chybne_pokusy', 'zamceno_do'],
  Polozky: ['podnik', 'ean', 'cislo_polozky', 'nazev', 'aktivni', 'zdroj', 'k_doplneni'],
  Lokace: ['podnik', 'kod', 'hala', 'rada', 'sloupec', 'nosnik', 'zona', 'aktivni', 'k_overeni'],
  Zaznamy: ['id', 'podnik', 'lokace', 'ean', 'cislo_polozky', 'expirace', 'expirace_text', 'pocet_ks', 'stav',
    'zalozil', 'zalozeno', 'overil', 'overeno', 'zmenil', 'zmeneno', 'poznamka', 'foto_url', 'k_doplneni'],
  Kontroly: ['id', 'cas', 'uzivatel', 'podnik', 'lokace', 'id_zaznamu', 'akce', 'pocet_ks', 'poznamka', 'id_ukolu', 'zapocteno'],
  // hotove_lokace: lokace úkolu, které už někdo po zadání zkontroloval (přidáno v etapě 3).
  // U zrušeného úkolu je ve splneno/splnil kdy a kdo ho zrušil.
  Ukoly: ['id', 'podnik', 'typ', 'komu', 'lokace', 'polozka', 'termin', 'popis', 'stav', 'zadal', 'zadano', 'splneno', 'splnil',
    'hotove_lokace'],
  Nastaveni: ['podnik', 'klic', 'hodnota', 'popis'],
  // Matice oprávnění: řádek = klíč oprávnění, sloupce rolí TRUE/FALSE (admin vždy TRUE). Doplní setup podle MODULY_OPRAVNENI.
  Opravneni: ['klic', 'modul', 'nazev', 'skladnik', 'vedouci', 'manazer', 'admin'],
  // Log změn ve správě (oprávnění): kdo, kdy, co.
  Log_spravy: ['cas', 'uzivatel', 'akce', 'detail'],
  // naskladneno = DATUM z ERP (poslední naskladnění položky do lokace), mj = základní měrná jednotka (etapa 4).
  // Jen hlídané zboží (z číselníku podniku); každý import stavu nahradí předchozí import podniku.
  Import_stav_lokaci: ['podnik', 'lokace', 'cislo_polozky', 'mnozstvi', 'datum_importu', 'naskladneno', 'mj'],
  Log_chyb: ['cas', 'akce', 'uzivatel', 'chyba']
};

// Sloupce, které musí zůstat textem (úvodní nuly, MM/RR, kódy lokací) – jinak z nich tabulka udělá číslo či datum.
const TEXTOVE_SLOUPCE = {
  Uzivatele: ['id', 'jmeno', 'pin_hash', 'pin_salt'],
  Polozky: ['ean', 'cislo_polozky'],
  Lokace: ['kod', 'hala', 'rada', 'sloupec', 'nosnik'],
  Zaznamy: ['id', 'lokace', 'ean', 'cislo_polozky', 'expirace_text'],
  Kontroly: ['id', 'lokace', 'id_zaznamu', 'id_ukolu'],
  Ukoly: ['id', 'lokace', 'polozka', 'hotove_lokace'],
  Import_stav_lokaci: ['lokace', 'cislo_polozky']
};

// Sloupce s datem a časem (jen formát zobrazení v tabulce).
const DATUMOVE_SLOUPCE = {
  Uzivatele: ['zamceno_do'],
  Zaznamy: ['zalozeno', 'overeno', 'zmeneno'],
  Kontroly: ['cas'],
  Ukoly: ['zadano', 'splneno'],
  Import_stav_lokaci: ['datum_importu', 'naskladneno'],
  Log_spravy: ['cas'],
  Log_chyb: ['cas']
};
const DATUMOVE_SLOUPCE_BEZ_CASU = {
  Zaznamy: ['expirace'],
  Ukoly: ['termin']
};

// Výchozí nastavení: [klíč, popis, hodnota DEK, hodnota STA]. Setup doplní jen chybějící řádky.
const VYCHOZI_NASTAVENI = [
  ['hranice_cervena', 'Červené pásmo (Expiruje brzy): max. dní do expirace', 90, 180],
  ['hranice_zluta', 'Žluté pásmo (Pozor): max. dní do expirace', 180, 360],
  ['cil_kontrol_tyden', 'Týdenní cíl kontrol (lokací); prázdné = bez cíle', '', ''],
  ['report_prijemci', 'Příjemci týdenního reportu (e-maily oddělené čárkou)', '', ''],
  ['planovac_dni_bez_kontroly', 'Plánovač: lokace bez kontroly déle než (dní)', 60, 60],
  ['planovac_cervene_overit_dni', 'Plánovač: červené pásmo ověřit alespoň 1× za (dní)', 30, 30],
  ['planovac_max_lokaci_ukol', 'Plánovač: max. lokací v jednom úkolu', 20, 20],
  ['planovac_naskladneno_zapnuto', 'Plánovač: pravidlo d) Naskladněno po poslední kontrole (TRUE/FALSE)', true, true],
  ['planovac_naskladneno_dni', 'Plánovač d): jen naskladnění za posledních N dní', 14, 14],
  ['slozka_fotky_id', 'ID složky na Google Disku pro fotky', '', '']
];

// Nastavení, která se do čtečky neposílají (e-maily, ID složek).
const NASTAVENI_JEN_SERVER = ['report_prijemci', 'slozka_fotky_id'];
