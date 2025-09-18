import path from "path";
import { promises as fs } from "fs";

const LOG_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(LOG_DIR, "stats.jsonl");
const EMPLOYEE_ID_REGEX = /^\d{4,10}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const { employeeId, scenarioId, scenarioLabel, recordedAt, summary, steps } = body;

    if (typeof employeeId !== "string" || !EMPLOYEE_ID_REGEX.test(employeeId)) {
      res.status(400).json({ error: "Invalid employeeId" });
      return;
    }

    const safeSummary = summary && typeof summary === "object" ? summary : {};
    const safeSteps = Array.isArray(steps) ? steps : [];

    const entry = {
      employeeId,
      scenarioId: typeof scenarioId === "string" ? scenarioId : safeSummary.scenarioId || "",
      scenarioLabel: typeof scenarioLabel === "string" ? scenarioLabel : safeSummary.scenarioLabel || "",
      recordedAt: typeof recordedAt === "string" ? recordedAt : new Date().toISOString(),
      summary: safeSummary,
      steps: safeSteps,
    };

    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to save stats", err);
    res.status(500).json({ error: "Failed to save stats" });
  }
}
