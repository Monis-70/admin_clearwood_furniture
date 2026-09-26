/**
 * A strong temporary password generated in the browser (Web Crypto). It is shown once to the admin
 * who sets it and is never stored by the admin app.
 */
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '-_.!@#';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function pick(alphabet: string, random: number): string {
  return alphabet[random % alphabet.length]!;
}

export function generateTemporaryPassword(length = 16): string {
  const random = new Uint32Array(length * 2);
  crypto.getRandomValues(random);
  const chars = [
    pick(LOWER, random[0]!),
    pick(UPPER, random[1]!),
    pick(DIGITS, random[2]!),
    pick(SYMBOLS, random[3]!),
  ];
  for (let i = 4; i < length; i += 1) chars.push(pick(ALL, random[i]!));
  // Fisher-Yates with fresh randomness so the fixed classes are not always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = random[length + i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
