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

const tokenMeta = (word) => ({
  word,
  digits: digitsOnly(word),
  hasDigits: hasDigits(word),
  skeleton: skeleton(word),
  phonetic: soundex(word),
});

const findMatch = (expectedWord, saidTokens, used) => {
  const meta = tokenMeta(expectedWord);
  const available = [];
  for (let i = 0; i < saidTokens.length; i++) {
    if (!used.has(i)) available.push({ index: i, ...saidTokens[i] });
  }
  if (!available.length) return null;

  let candidate = available.find((c) => c.word === meta.word);
  if (candidate) return { index: candidate.index, kind: "exact" };

  if (meta.hasDigits && meta.digits) {
    candidate = available.find((c) => c.digits && c.digits === meta.digits);
    if (candidate) return { index: candidate.index, kind: "digits" };
  }

  candidate = available.find((c) => isPrefixLikeMatch(meta.word, c.word));
  if (candidate) return { index: candidate.index, kind: "prefix" };

  if (meta.phonetic) {
    candidate = available.find(
      (c) => c.phonetic && c.phonetic === meta.phonetic && Math.abs(c.word.length - meta.word.length) <= 3
    );
    if (candidate) return { index: candidate.index, kind: "phonetic" };
  }

  if (meta.skeleton) {
    candidate = available.find((c) => c.skeleton && c.skeleton === meta.skeleton);
    if (candidate) return { index: candidate.index, kind: "skeleton" };
  }

  let best = null;
  let bestDist = Infinity;
  for (const c of available) {
    const dist = levenshtein(meta.word, c.word);
    if (dist === 0) return { index: c.index, kind: "exact" };
    const limit = distanceLimit(meta.word, c.word);
    if (dist <= limit && dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  if (best) return { index: best.index, kind: "fuzzy" };

  return null;
};

const buildMatchReport = (expected, said) => {
  const expectedTokens = tokenize(expected).map(tokenMeta);
  const saidTokens = tokenize(said).map(tokenMeta);
  const used = new Set();
  const expTokens = expectedTokens.map((meta) => ({ w: meta.word, cls: "miss" }));
  let hitCount = 0;

  expectedTokens.forEach((meta, idx) => {
    const match = findMatch(meta.word, saidTokens, used);
    if (match) {
      used.add(match.index);
      expTokens[idx].cls = "ok";
      hitCount += 1;
    }
  });

  const extraTokens = saidTokens
    .map((meta, idx) => ({ meta, idx }))
    .filter((entry) => !used.has(entry.idx))
    .map((entry) => ({ w: entry.meta.word, cls: "extra" }));

  return { expTokens, extraTokens, hitCount, expCount: expectedTokens.length };
};

export function scoreWords(expected, said) {
  const report = buildMatchReport(expected, said);
  if (!report.expCount) return 0;
  return Math.round((report.hitCount / report.expCount) * 100);
}

export function diffWords(expectedDisplay, heard) {
  return buildMatchReport(expectedDisplay, heard);
}

// NATO: grade Iceman tail phonetically but display tail
const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};
const toNatoTail = t => t.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');

export function prepareScenarioForGrading(scn){
  (scn.steps||[]).forEach(st=>{
    const base = String(st.text || st.phraseId || '');
    st._displayLine = base; // show tail as written
    st._expectedForGrade = (st.role === 'Iceman')
      ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
      : base;
  });
}
