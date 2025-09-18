import { prepareScenarioForGrading, scoreWords } from "../lib/scoring.js";

const logResult = (label, result) => {
  console.log(`\n${label}`);
  console.log({
    percent: result.percent,
    totalMatched: result.totalMatched,
    totalExpected: result.totalExpected,
    firstMatches: (result.matches || []).slice(0, 5),
  });
};

const tailScenario = {
  id: "demo-tail",
  steps: [{ role: "Iceman", text: "Tail N443DF ready for taxi" }],
};

const preparedTail = prepareScenarioForGrading(tailScenario);
const tailStep = preparedTail?.steps?.[0];
const tailResult = scoreWords({
  expected: tailStep?._expectedForGrade,
  transcript: "November Four Four Three Delta Foxtrot ready for taxi",
});
logResult("Tail number NATO expansion", tailResult);

const mergedDigitsResult = scoreWords({
  expected: ["four", "four", "three"],
  transcript: "four forty three",
});
logResult('Merged digits vs "forty" transcript', mergedDigitsResult);

const icemanResult = scoreWords({
  expected: ["iceman"],
  transcript: "ice man",
});
logResult("Iceman vs Ice Man", icemanResult);

const threeResult = scoreWords({
  expected: ["three"],
  transcript: "tree",
});
logResult('"Three" vs "Tree"', threeResult);

const numericWordResult = scoreWords({
  expected: ["type", "1"],
  transcript: "type one",
});
logResult('"Type 1" vs "Type one"', numericWordResult);

console.log("\nScoring demo complete.");
