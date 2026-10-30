// Podniky v pořadí přepínače (první = výchozí) a názvy rolí pro zobrazení.
// barva = firemní barva podniku pro hlavičku a horní pruh v modulu Expirace (barvy pásem expirace jsou jinde
// a s podnikem se nemění). barvaText = barva písma na ní.
export const PODNIKY = [
  { kod: 'DEK', nazev: 'Stavebniny DEK', barva: '#d6001c', barvaText: '#fff' },
  { kod: 'STA', nazev: 'Stachema', barva: '#005ca9', barvaText: '#fff' }
];

/** Podnik podle kódu (neznámý kód = null). */
export const podnikPodleKodu = (kod) => PODNIKY.find((p) => p.kod === kod) || null;

export const NAZVY_ROLI = {
  skladnik: 'skladník',
  vedouci: 'vedoucí',
  manazer: 'manažer',
  admin: 'admin'
};
