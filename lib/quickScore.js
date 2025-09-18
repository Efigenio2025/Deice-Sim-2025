// DEPRECATED: replaced by scoreWords from lib/scoring.js (NATO + fuzzy supported)
// Retained for debugging via the USE_RICH_SCORER flag.

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => normalize(value).split(" ").filter(Boolean);

const splitDisplayTokens = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);

export function quickScore(expected, heard) {
  const expectedSet = new Set(tokenize(expected));
  const heardSet = new Set(tokenize(heard));
  const totalExpected = expectedSet.size;
  const totalMatched = [...expectedSet].filter((token) => heardSet.has(token)).length;
  return totalExpected ? Math.round((totalMatched / totalExpected) * 100) : 0;
}

export function quickScoreDetail(expected, heard) {
  const expectedTokens = tokenize(expected);
  const heardTokens = tokenize(heard);
  const expectedSet = new Set(expectedTokens);
  const heardSet = new Set(heardTokens);

  const totalExpected = expectedSet.size;
  const totalMatched = [...expectedSet].filter((token) => heardSet.has(token)).length;
  const percent = totalExpected ? Math.round((totalMatched / totalExpected) * 100) : 0;

  const expectedDisplay = splitDisplayTokens(expected);
  const heardDisplay = splitDisplayTokens(heard);

  const expectedAnnotated = expectedDisplay.map((display, idx) => {
    const token = normalize(display);
    return {
      index: idx,
      word: token,
      display,
      status: heardSet.has(token) ? "match" : "miss",
      kind: heardSet.has(token) ? "exact" : "missing",
    };
  });

  const saidAnnotated = heardDisplay.map((display, idx) => {
    const token = normalize(display);
    return {
      index: idx,
      word: token,
      display,
      status: expectedSet.has(token) ? "match" : "extra",
      kind: expectedSet.has(token) ? "exact" : "extra",
    };
  });

  const matches = expectedAnnotated
    .filter((entry) => entry.status === "match")
    .map((entry) => {
      const saidIndex = heardTokens.indexOf(entry.word);
      return {
        expectedIndex: entry.index,
        expected: entry.word,
        expectedDisplay: entry.display,
        saidIndex,
        said: saidIndex >= 0 ? heardTokens[saidIndex] : entry.word,
        saidDisplay: saidIndex >= 0 ? heardDisplay[saidIndex] ?? entry.display : entry.display,
        kind: "exact",
        score: 1,
      };
    });

  const misses = expectedAnnotated
    .filter((entry) => entry.status !== "match")
    .map((entry) => ({
      expectedIndex: entry.index,
      expected: entry.word,
      expectedDisplay: entry.display,
    }));

  const extras = saidAnnotated
    .filter((entry) => entry.status === "extra")
    .map((entry) => ({
      saidIndex: entry.index,
      said: entry.word,
      saidDisplay: entry.display,
    }));

  return {
    percent,
    totalExpected,
    totalMatched,
    matches,
    misses,
    extras,
    expectedTokens: expectedAnnotated.map((entry) => ({ word: entry.word, display: entry.display })),
    saidTokens: saidAnnotated.map((entry) => ({ word: entry.word, display: entry.display })),
    expectedAnnotated,
    saidAnnotated,
  };
}

export default quickScore;
