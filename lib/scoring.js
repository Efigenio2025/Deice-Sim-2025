/**
 * Training scoring helpers used by the simulator UI.
 *
 * The flow is:
 *   1. prepareScenarioForGrading expands scenarios (NATO tail numbers, token metadata).
 *   2. scoreWords({ expected, transcript, options }) performs fuzzy/NATO-aware matching.
 *   3. diffWords(result) returns token level annotations for "Why you got this score".
 */

const DEFAULT_PREPARE_OPTIONS = {
  enableNATOExpansion: true,
};

const DEFAULT_SCORE_OPTIONS = {
  fuzzyThreshold: 0.82,
};

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[\u2010-\u2015-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (text) => norm(text).split(" ").filter(Boolean);

const digitsOnly = (word) => word.replace(/\D/g, "");
const hasDigits = (word) => /\d/.test(word);

const NUMBER_WORDS = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  won: "1",
  two: "2",
  three: "3",
  tree: "3",
  four: "4",
  fower: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  ate: "8",
  nine: "9",
  niner: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fouteen: "14",
  fiveteen: "15",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  fourty: "40",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
};

const CANONICAL_NUMBER_WORDS = new Set(["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]);

const numberValue = (word) => {
  if (!word) return null;
  if (/^\d+$/.test(word)) return word;
  return NUMBER_WORDS[word] || null;
};

const collapseRepeats = (s) => s.replace(/(.)\1+/g, "$1");
const stripVowels = (s) => s.replace(/[aeiou]/g, "");

const skeleton = (word) => {
  const cleaned = word.replace(/[^a-z0-9]/g, "");
  if (!cleaned) return "";
  const base = stripVowels(cleaned);
  return collapseRepeats(base);
};

const soundex = (word) => {
  const cleaned = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (!cleaned) return "";
  const codes = {
    B: "1",
    F: "1",
    P: "1",
    V: "1",
    C: "2",
    G: "2",
    J: "2",
    K: "2",
    Q: "2",
    S: "2",
    X: "2",
    Z: "2",
    D: "3",
    T: "3",
    L: "4",
    M: "5",
    N: "5",
    R: "6",
  };
  let prev = codes[cleaned[0]] || "";
  let out = cleaned[0];
  for (let i = 1; i < cleaned.length && out.length < 4; i++) {
    const ch = cleaned[i];
    const code = codes[ch] || "";
    if (code && code !== prev) out += code;
    prev = code || prev;
  }
  return (out + "000").slice(0, 4);
};

const distanceLimit = (a, b) => {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 3) return 1;
  if (maxLen <= 6) return 2;
  if (maxLen <= 10) return 3;
  return 4;
};

const isPrefixLikeMatch = (a, b) => {
  if (a === b) return false;
  if (hasDigits(a) || hasDigits(b)) return false;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 3) return false;
  const diff = Math.abs(a.length - b.length);
  if (diff > 3) return false;
  return a.startsWith(b) || b.startsWith(a);
};

const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const bc = b.charCodeAt(j - 1);
      const cost = ac === bc ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
};

const tokenMeta = (word, display) => {
  const numeric = numberValue(word);
  const digits = digitsOnly(word) || numeric || "";
  const numberSlots = digits ? digits.split("") : [];
  return {
    word,
    display: display ?? word,
    digits,
    hasDigits: hasDigits(word),
    numberValue: numeric,
    numberSlots,
    skeleton: skeleton(word),
    phonetic: soundex(word),
  };
};

const toTokenObject = (item, indexHint = 0) => {
  if (!item) return null;
  if (typeof item === "string") {
    const word = norm(item);
    if (!word) return null;
    return { ...tokenMeta(word, item), index: indexHint };
  }
  if (typeof item === "object") {
    const source = item.word ?? item.display ?? item.raw ?? "";
    const normalized = source ? norm(source) : "";
    if (!normalized) return null;
    const meta = tokenMeta(normalized, item.display ?? item.word ?? item.raw ?? normalized);
    return { ...item, ...meta, word: normalized, display: meta.display, index: indexHint };
  }
  return null;
};

const createTokenList = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((item, idx) => toTokenObject(item, idx))
      .filter(Boolean)
      .map((token, idx) => ({ ...token, index: idx }));
  }
  const text = String(input || "");
  const displayTokens = text.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokenize(text);
  return normalizedTokens.map((word, idx) => {
    const display = displayTokens[idx] ?? word;
    return { ...tokenMeta(word, display), index: idx };
  });
};

const findMatch = (expectedToken, saidTokens, used, options) => {
  const meta = expectedToken;
  const threshold = options?.fuzzyThreshold ?? DEFAULT_SCORE_OPTIONS.fuzzyThreshold;
  const available = [];
  for (let i = 0; i < saidTokens.length; i++) {
    if (!used.has(i)) available.push({ index: i, token: saidTokens[i] });
  }
  if (!available.length) return null;

  for (const entry of available) {
    if (entry.token.word === meta.word) {
      return { index: entry.index, kind: "exact", score: 1, consumed: true };
    }
  }

  const metaNumberString = meta.numberValue || meta.digits || "";
  const metaSingleDigit = metaNumberString.length === 1 ? metaNumberString : "";
  const metaMultiDigits = metaNumberString.length > 1 ? metaNumberString : "";

  if (metaMultiDigits) {
    for (const entry of available) {
      const token = entry.token;
      const tokenNumeric = token.numberValue || token.digits || "";
      if (tokenNumeric && tokenNumeric === metaMultiDigits) {
        const kind = token.hasDigits ? "digits" : "number";
        return { index: entry.index, kind, score: 1, consumed: true };
      }
    }
  }

  if (metaSingleDigit) {
    for (const entry of available) {
      const token = entry.token;
      const slots = token.numberSlots || [];
      if (!slots.length) continue;
      const usage = token._numberSlotUsage || new Set();
      let matchedSlot = -1;
      for (let i = 0; i < slots.length; i++) {
        if (usage.has(i)) continue;
        if (slots[i] === metaSingleDigit) {
          matchedSlot = i;
          break;
        }
      }
      if (matchedSlot !== -1) {
        usage.add(matchedSlot);
        token._numberSlotUsage = usage;
        const consumed = usage.size >= slots.length;
        return { index: entry.index, kind: slots.length > 1 ? "number-chunk" : "number", score: 1, consumed };
      }
    }
  }

  for (const entry of available) {
    if (isPrefixLikeMatch(meta.word, entry.token.word)) {
      return { index: entry.index, kind: "prefix", score: 1, consumed: true };
    }
  }

  if (meta.phonetic) {
    for (const entry of available) {
      const token = entry.token;
      if (!token.phonetic) continue;
      if (token.phonetic !== meta.phonetic) continue;
      if (Math.abs(token.word.length - meta.word.length) <= 3) {
        return { index: entry.index, kind: "phonetic", score: 1, consumed: true };
      }
    }
  }

  if (meta.skeleton) {
    for (const entry of available) {
      if (entry.token.skeleton && entry.token.skeleton === meta.skeleton) {
        return { index: entry.index, kind: "skeleton", score: 1, consumed: true };
      }
    }
  }

  let best = null;
  let bestRatio = 0;
  for (const entry of available) {
    const token = entry.token;
    const dist = levenshtein(meta.word, token.word);
    if (dist === 0) {
      return { index: entry.index, kind: "exact", score: 1, consumed: true };
    }
    const maxLen = Math.max(meta.word.length, token.word.length, 1);
    const ratio = 1 - dist / maxLen;
    const limit = distanceLimit(meta.word, token.word);
    if (dist <= limit && ratio >= threshold && ratio > bestRatio) {
      best = entry;
      bestRatio = ratio;
    }
  }
  if (best) {
    return { index: best.index, kind: "fuzzy", score: Number(bestRatio.toFixed(2)), consumed: true };
  }

  return null;
};

const runScore = ({ expected, transcript, options }) => {
  const opts = { ...DEFAULT_SCORE_OPTIONS, ...(options || {}) };
  const expectedTokens = createTokenList(expected).map((token, idx) => ({ ...token, index: idx }));
  const saidTokens = createTokenList(transcript).map((token, idx) => ({ ...token, index: idx }));
  const used = new Set();
  const matches = [];
  const misses = [];

  expectedTokens.forEach((token) => {
    const match = findMatch(token, saidTokens, used, opts);
    if (match) {
      if (match.consumed !== false) {
        used.add(match.index);
      }
      const saidToken = saidTokens[match.index] || {};
      matches.push({
        expectedIndex: token.index,
        expected: token.word,
        expectedDisplay: token.display,
        saidIndex: match.index,
        said: saidToken.word ?? "",
        saidDisplay: saidToken.display ?? saidToken.word ?? "",
        kind: match.kind,
        score: match.score ?? 1,
      });
    } else {
      misses.push({
        expectedIndex: token.index,
        expected: token.word,
        expectedDisplay: token.display,
      });
    }
  });

  const totalExpected = expectedTokens.length;
  const totalMatched = matches.length;
  const percent = totalExpected ? Math.round((totalMatched / totalExpected) * 100) : 0;

  const matchByExpectedIndex = new Map();
  const matchBySaidIndex = new Map();
  matches.forEach((m) => {
    matchByExpectedIndex.set(m.expectedIndex, m);
    if (m.saidIndex !== undefined && m.saidIndex !== null) {
      matchBySaidIndex.set(m.saidIndex, m);
    }
  });

  const extras = [];
  saidTokens.forEach((token) => {
    if (!matchBySaidIndex.has(token.index)) {
      extras.push({
        saidIndex: token.index,
        said: token.word,
        saidDisplay: token.display,
      });
    }
  });

  const expectedAnnotated = expectedTokens.map((token) => {
    const match = matchByExpectedIndex.get(token.index);
    return {
      index: token.index,
      word: token.word,
      display: token.display,
      status: match ? "match" : "miss",
      kind: match?.kind ?? "missing",
      saidIndex: match?.saidIndex,
    };
  });

  const saidAnnotated = saidTokens.map((token) => {
    const match = matchBySaidIndex.get(token.index);
    return {
      index: token.index,
      word: token.word,
      display: token.display,
      status: match ? "match" : "extra",
      kind: match?.kind ?? "extra",
      expectedIndex: match?.expectedIndex,
    };
  });

  return {
    totalExpected,
    totalMatched,
    percent,
    matches,
    misses,
    extras,
    expectedTokens,
    saidTokens,
    expectedAnnotated,
    saidAnnotated,
    optionsUsed: opts,
    transcript: String(transcript || ""),
  };
};

export function scoreWords(input, transcriptMaybe) {
  if (input && typeof input === "object" && !Array.isArray(input) && Object.prototype.hasOwnProperty.call(input, "expected")) {
    return runScore(input);
  }
  const result = runScore({ expected: input, transcript: transcriptMaybe });
  return result.percent;
}

export function diffWords(arg, transcriptMaybe, optionsMaybe) {
  let result;
  if (arg && typeof arg === "object" && !Array.isArray(arg)) {
    if (arg.expectedAnnotated && arg.saidAnnotated) {
      result = arg;
    } else if (Object.prototype.hasOwnProperty.call(arg, "expected")) {
      result = runScore(arg);
    }
  }
  if (!result) {
    result = runScore({ expected: arg, transcript: transcriptMaybe, options: optionsMaybe });
  }
  return {
    expected: result.expectedAnnotated || [],
    transcript: result.saidAnnotated || [],
    matches: result.matches || [],
    extras: result.extras || [],
    percent: result.percent ?? 0,
  };
}

// NATO: grade Iceman tail phonetically but display tail
const NATO = {
  A: "Alpha",
  B: "Bravo",
  C: "Charlie",
  D: "Delta",
  E: "Echo",
  F: "Foxtrot",
  G: "Golf",
  H: "Hotel",
  I: "India",
  J: "Juliet",
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
  9: "Nine",
};

const TAIL_REGEX = /\bN[0-9A-Z]{3,}\b/gi;

const toNatoTail = (tail) => tail.toUpperCase().split("").map((ch) => NATO[ch] || ch).join(" ");

export function prepareScenarioForGrading(scenario, options = {}) {
  if (!scenario) return null;
  const opts = { ...DEFAULT_PREPARE_OPTIONS, ...options };
  const steps = (scenario.steps || []).map((step) => {
    const baseText = String(step?.text || step?.phraseId || "");
    const gradeSource =
      opts.enableNATOExpansion && step?.role === "Iceman"
        ? baseText.replace(TAIL_REGEX, (match) => toNatoTail(match))
        : baseText;
    const tokens = createTokenList(gradeSource);
    return {
      ...step,
      _displayLine: baseText,
      _expectedGradeText: gradeSource,
      _expectedForGrade: tokens,
    };
  });
  return {
    ...scenario,
    steps,
    _expectedForGrade: steps.map((s) => s._expectedForGrade),
  };
}

export default scoreWords;
