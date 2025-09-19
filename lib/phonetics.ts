const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBERS = "0123456789".split("");

export const PHONETIC_MAP: Record<string, string> = {
  A: "Alpha",
  B: "Bravo",
  C: "Charlie",
  D: "Delta",
  E: "Echo",
  F: "Foxtrot",
  G: "Golf",
  H: "Hotel",
  I: "India",
  J: "Juliett",
  K: "Kilo",
  L: "Lima",
  M: "Mike",
  N: "November",
  O: "Oscar",
  P: "Papa",
  Q: "Quebec",
  R: "Romeo",
  S: "Sierra",
  T: "Tango",
  U: "Uniform",
  V: "Victor",
  W: "Whiskey",
  X: "X-ray",
  Y: "Yankee",
  Z: "Zulu",
  0: "Zero",
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine"
};

const randomOf = (set: string[]) => set[Math.floor(Math.random() * set.length)];

const randomCallsign = () => {
  const prefix = randomOf(LETTERS);
  const middleLength = 2 + Math.floor(Math.random() * 2);
  const suffixLength = 2 + Math.floor(Math.random() * 2);
  let middle = "";
  for (let i = 0; i < middleLength; i++) {
    middle += randomOf(NUMBERS);
  }
  let suffix = "";
  for (let i = 0; i < suffixLength; i++) {
    suffix += Math.random() > 0.5 ? randomOf(LETTERS) : randomOf(NUMBERS);
  }
  return `${prefix}${middle}${suffix}`;
};

export function RANDOM_ITEMS(mode: "letters" | "numbers" | "mixed" | "callsigns", count: number): string[] {
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    if (mode === "letters") {
      items.push(randomOf(LETTERS));
    } else if (mode === "numbers") {
      items.push(randomOf(NUMBERS));
    } else if (mode === "mixed") {
      items.push(Math.random() > 0.5 ? randomOf(LETTERS) : randomOf(NUMBERS));
    } else {
      items.push(randomCallsign());
    }
  }
  return items;
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toPhonetic(item: string): string {
  return item
    .toUpperCase()
    .split("")
    .map((char) => PHONETIC_MAP[char] ?? char)
    .join(" ");
}
