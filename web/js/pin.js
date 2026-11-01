// Pravidla pro PIN, který si uživatel volí sám (nastavení při prvním přihlášení, změna v Můj účet).
// Stejná kontrola je na serveru (Auth.gs, overNovyPin_) – tady jen kvůli okamžité odezvě.

/** Triviální PIN: všechny číslice stejné (1111) nebo vzestupná / sestupná řada (0123, 1234, 4321, 9876). */
export function jeTrivialniPin(pin) {
  const c = String(pin).split('').map(Number);
  const rada = (krok) => c.every((x, i) => i === 0 || x - c[i - 1] === krok);
  return rada(0) || rada(1) || rada(-1);
}

/** Text chyby nového PINu, nebo '' když je v pořádku. */
export function chybaNovehoPinu(pin) {
  if (!/^\d{4}$/.test(pin)) return 'PIN musí mít přesně 4 číslice.';
  if (jeTrivialniPin(pin)) return 'Tenhle PIN se dá snadno uhodnout (stejné číslice nebo řada jako 1234 / 4321). Zvol jiný.';
  return '';
}
