# Etapa 4 – PC část: přehled, záznamy, správa, importy

Podle specifikace (kap. 6 a 7 – import):

1. **Přehled**: KPI, mapa pokrytí, kontroly po lidech a týdnech (8 týdnů) proti cíli, zboží podle pásem + trend, FEFO upozornění.
   Výpočty dělej na serveru jednou akcí (`prehled.data`), ať je stránka rychlá; zvaž krátkodobou cache.
2. **Záznamy**: tabulka s hledáním, filtry, řazením; **export .xlsx** (SheetJS z CDN s pevnou verzí) s aktuálním filtrem;
   export logu kontrol za zvolené období.
3. **Správa** (jen admin): uživatelé (přidat, role, aktivní, reset PINu – nový PIN zobrazit jednou), nastavení po podnicích,
   položky k doplnění.
4. **Importy** (admin, xlsx/csv nahrané v prohlížeči, zpracování na serveru): číselník (EAN, číslo položky, název), lokace,
   **stav na lokacích** → uzavření zmizelého zboží (`import uzavřel`), výpočet „zboží bez kontroly“, FEFO.
   Před importem náhled (počet řádků, nové/změněné/chyby) a potvrzení. Mapování sloupců podle názvů v hlavičce –
   ukaž mi, jaké sloupce očekáváš, pošlu ti vzorový export.

**Hotovo, když:** vedoucí na PC vidí přehled za oba podniky, stáhne Excel záznamů; admin naimportuje číselník a stav lokací
a záznamy zboží, které z lokace zmizelo, se uzavřou.
