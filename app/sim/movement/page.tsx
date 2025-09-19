"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../../components/Badge";
import { Card } from "../../../components/Card";
import { normalize } from "../../../lib/phonetics";
import { scoreTokens } from "../../../lib/scoring";

type Speaker = "Captain" | "Coordinator";

type Cue = {
  id: string;
  speaker: Speaker;
  line: string;
  exemplar: string;
  required: string[];
};

type Scenario = {
  id: string;
  name: string;
  cues: Cue[];
};

type ResponseRecord = {
  cue: Cue;
  correct: boolean;
  misses: string[];
  said: string;
  latencyPenalty: number;
  tokensHit: number;
  tokensTotal: number;
  pct: number;
};

const SCENARIOS: Scenario[] = [
  {
    id: "rampIn",
    name: "Ramp In",
    cues: [
      {
        id: "ramp-1",
        speaker: "Coordinator",
        line: "Ramp to Piedmont 443, stand three is clear. Proceed inbound.",
        exemplar: "Piedmont 443 inbound stand three, clear of hazards, entering the pad now.",
        required: ["piedmont", "443", "stand", "three", "inbound", "clear"]
      },
      {
        id: "ramp-2",
        speaker: "Captain",
        line: "Ramp, Piedmont 443 holding short of the pad.",
        exemplar: "Piedmont 443 holding short, brakes set, awaiting your signal.",
        required: ["holding", "short", "brakes", "set"]
      },
      {
        id: "ramp-3",
        speaker: "Coordinator",
        line: "Crew ready for spray, confirm Type I only.",
        exemplar: "Confirm Type I only, spray team ready, Piedmont 443 stable.",
        required: ["type", "i", "ready", "confirm"]
      },
      {
        id: "ramp-4",
        speaker: "Captain",
        line: "Ready to enter, request clearance.",
        exemplar: "Piedmont 443 entering pad, clearance received, proceeding in.",
        required: ["entering", "pad", "clearance", "received"]
      }
    ]
  },
  {
    id: "pushback",
    name: "Pushback",
    cues: [
      {
        id: "push-1",
        speaker: "Coordinator",
        line: "Crew, confirm brakes released for push.",
        exemplar: "Brakes released, chocks clear, ready to push tail first.",
        required: ["brakes", "released", "chocks", "clear", "push"]
      },
      {
        id: "push-2",
        speaker: "Captain",
        line: "Pushback approved, watch tail swing.",
        exemplar: "Pushback approved, monitoring tail swing, ready to roll.",
        required: ["pushback", "approved", "tail", "swing"]
      },
      {
        id: "push-3",
        speaker: "Coordinator",
        line: "Stop stop stop — tail swing tight.",
        exemplar: "STOP pushback, tail swing tight, holding position.",
        required: ["stop", "tail", "swing", "holding"]
      },
      {
        id: "push-4",
        speaker: "Captain",
        line: "We copy stop, holding position.",
        exemplar: "Holding position, brakes set, awaiting new clearance.",
        required: ["holding", "position", "brakes", "set"]
      }
    ]
  },
  {
    id: "taxi",
    name: "Taxi Handoff",
    cues: [
      {
        id: "taxi-1",
        speaker: "Coordinator",
        line: "Taxi clearance ready, hold short alpha.",
        exemplar: "Holding short alpha, brakes set, ready for taxi clearance.",
        required: ["holding", "short", "alpha"]
      },
      {
        id: "taxi-2",
        speaker: "Captain",
        line: "Request handoff to ground when clear.",
        exemplar: "Requesting handoff to ground once clear, standing by.",
        required: ["handoff", "ground", "clear", "standing"]
      },
      {
        id: "taxi-3",
        speaker: "Coordinator",
        line: "Clear to taxi via alpha to spot two.",
        exemplar: "Cleared taxi via alpha to spot two, monitoring ice.",
        required: ["cleared", "taxi", "alpha", "spot", "two"]
      },
      {
        id: "taxi-4",
        speaker: "Captain",
        line: "Taxiing alpha to spot two, thanks for the spray.",
        exemplar: "Taxiing alpha to spot two, thanks for the spray, switching to ground.",
        required: ["taxiing", "alpha", "spot", "two", "ground"]
      }
    ]
  }
];

export default function MovementSimulatorPage() {
  const [scenarioId, setScenarioId] = useState<string>(SCENARIOS[0].id);
  const [cueIndex, setCueIndex] = useState(0);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"coach" | "assessment">("coach");
  const [cueStartedAt, setCueStartedAt] = useState<number>(() => Date.now());

  const scenario = useMemo(() => SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0], [scenarioId]);
  const cues = scenario.cues;
  const currentCue = cues[cueIndex];
  const isComplete = cueIndex >= cues.length;
  const totalLatency = responses.reduce((sum, record) => sum + record.latencyPenalty, 0);
  const correctCount = responses.filter((record) => record.correct).length;
  const tokensHit = responses.reduce((sum, record) => sum + record.tokensHit, 0);
  const tokensTotal = responses.reduce((sum, record) => sum + record.tokensTotal, 0);
  const tokenAccuracy = tokensTotal > 0 ? (tokensHit / tokensTotal) * 100 : 0;
  const cuesComplete = responses.length;
  const progressPct = cues.length > 0 ? Math.min((cuesComplete / cues.length) * 100, 100) : 0;

  useEffect(() => {
    setCueStartedAt(Date.now());
    setInput("");
  }, [cueIndex, scenarioId]);

  const resetScenario = (nextScenario?: string) => {
    if (nextScenario) {
      setScenarioId(nextScenario);
    }
    setCueIndex(0);
    setResponses([]);
    setInput("");
    setCueStartedAt(Date.now());
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentCue) return;
    const result = scoreTokens(currentCue.required, input);
    const elapsed = Date.now() - cueStartedAt;
    const latencyPenalty = elapsed > 6000 ? 1 : 0;
    const record: ResponseRecord = {
      cue: currentCue,
      correct: result.pct >= 0.8,
      misses: result.misses,
      said: input,
      latencyPenalty,
      tokensHit: result.hit,
      tokensTotal: result.total,
      pct: result.pct
    };
    setResponses((prev) => [...prev, record]);
    setInput("");
    if (cueIndex + 1 >= cues.length) {
      setCueIndex(cues.length);
    } else {
      setCueIndex(cueIndex + 1);
    }
  };

  const highlightExemplar = (text: string, required: string[]) => {
    return text.split(/(\s+)/).map((segment, index) => {
      const normalized = normalize(segment);
      if (required.includes(normalized)) {
        return (
          <span key={`${segment}-${index}`} className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-amber-200">
            {segment}
          </span>
        );
      }
      return <span key={`${segment}-${index}`}>{segment}</span>;
    });
  };

  const completedCues = isComplete ? cues : cues.slice(0, responses.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 pb-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
        <header className="space-y-2 text-center sm:text-left">
          <Badge tone="sky" className="mx-auto sm:mx-0">
            Simulator Module
          </Badge>
          <h1 className="text-3xl font-semibold text-slate-100">Aircraft Movement Verbiage Simulator</h1>
          <p className="text-sm text-slate-300">
            Practice confident read-backs for ramp, pushback, and taxi handoffs. Emphasis on safety-critical tokens and
            pacing under pressure.
          </p>
        </header>

        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
              Scenario
              <select
                value={scenarioId}
                onChange={(event) => resetScenario(event.target.value)}
                className="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {SCENARIOS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2" role="group" aria-label="Training mode">
              {[
                { id: "coach", label: "Coach Mode" },
                { id: "assessment", label: "Assessment" }
              ].map((option) => {
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMode(option.id as typeof mode)}
                    aria-pressed={active}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
                        : "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-sky-500/60 hover:text-slate-100"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>Latency penalties: {totalLatency}s</Badge>
              <button
                type="button"
                onClick={() => resetScenario()}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500/60 hover:text-slate-100"
              >
                Reset scenario
              </button>
            </div>
          </div>
        </Card>

        <Card title="Session metrics" subtitle="Monitor accuracy and pacing in real time">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Token accuracy</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{tokenAccuracy.toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Cues completed</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">
                {cuesComplete}/{cues.length}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Correct read-backs</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{correctCount}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Latency penalties</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{totalLatency}s</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>Scenario progress</span>
              <Badge>{mode === "coach" ? "Coach" : "Assessment"}</Badge>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-slate-800/80 bg-slate-950/80" role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full bg-sky-500"
                style={{ width: `${progressPct}%` }}
                aria-hidden
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge>{currentCue?.speaker ?? "Complete"}</Badge>
                <span className="text-sm text-slate-300">Cue {Math.min(cueIndex + 1, cues.length)} of {cues.length}</span>
              </div>
              <Badge tone={correctCount === responses.length && responses.length > 0 ? "sky" : "default"}>
                Score: {correctCount}/{Math.max(responses.length, 1)}
              </Badge>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-5 text-base text-slate-200">
              {currentCue ? currentCue.line : "Scenario complete. Review your results below."}
            </div>
            {!isComplete && (
              <form onSubmit={handleSubmit} className="space-y-3">
                <label htmlFor="readback" className="text-sm font-semibold text-slate-200">
                  Your read-back
                </label>
                <textarea
                  id="readback"
                  name="readback"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 shadow-inner focus-visible:ring-2 focus-visible:ring-sky-500"
                  placeholder="Repeat the required tokens and clearance details"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Submit response
                </button>
              </form>
            )}
            {mode === "coach" && responses.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Exemplar</p>
                <p className="text-sm text-slate-100">
                  {highlightExemplar(responses[responses.length - 1].cue.exemplar, responses[responses.length - 1].cue.required)}
                </p>
              </div>
            )}
          </div>
        </Card>

        <section id="scenarios">
          <Card className="space-y-4" subtitle="Review each cue result" title="Progress log">
            {responses.length === 0 ? (
              <p className="text-sm text-slate-400">Responses will appear here once you start reading back.</p>
            ) : (
              <ul className="space-y-4">
                {responses.map((record) => {
                  const cueNumber = cues.findIndex((cue) => cue.id === record.cue.id) + 1;
                  return (
                    <li key={record.cue.id} className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge>{record.cue.speaker}</Badge>
                          <span className="text-sm text-slate-300">Cue {cueNumber}</span>
                        </div>
                        <Badge tone={record.correct ? "sky" : "critical"}>
                          {record.correct ? "On script" : "Recheck"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{record.cue.line}</p>
                      <p className="mt-2 text-sm text-slate-200">
                        {highlightExemplar(record.cue.exemplar, record.cue.required)}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        You said: <span className="text-slate-200">{record.said || "—"}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        <Badge>Penalty: {record.latencyPenalty}s</Badge>
                        <Badge>Tokens: {record.tokensHit}/{record.tokensTotal}</Badge>
                        {record.misses.length > 0 && <Badge tone="critical">Missed: {record.misses.join(", ")}</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {mode === "assessment" && isComplete && (
          <Card title="Assessment summary" subtitle="Reveal exemplar phrasing for final review">
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Final score {correctCount}/{responses.length} with {totalLatency}s latency penalties and
                {" "}
                {tokenAccuracy.toFixed(0)}% token accuracy.
              </p>
              <ul className="space-y-3 text-sm text-slate-200">
                {completedCues.map((cue) => (
                  <li key={cue.id}>
                    <p className="font-semibold text-slate-100">
                      {cue.speaker}: {cue.line}
                    </p>
                    <p className="mt-1 text-slate-300">
                      {highlightExemplar(cue.exemplar, cue.required)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
