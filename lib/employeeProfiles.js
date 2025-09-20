export const EMPLOYEE_PROFILES = {
  "50731": {
    name: "Jordan Rivera",
    role: "De-Ice Coordinator",
    location: "OMA Ramp Ops Loft",
    shift: "0530 – 1430",
    summary:
      "Lead the morning push, monitor holdover drift, and coordinate with Ramp 3 on Type IV deployment windows.",
    focusAreas: [
      {
        title: "Aircraft Queue",
        detail: "Delta 418 scheduled for pad at 0615. Monitor Type IV saturation and adjust queue if holdover < 6 min.",
        status: "On schedule",
      },
      {
        title: "Weather Cells",
        detail: "Lake-effect bands expected after 0900. Prep alternate clearance route for south pad team.",
        status: "Alert",
      },
      {
        title: "Crew Comms",
        detail: "Ensure Ramp 3 and Cockpit confirm holdover call-backs before brake release.",
        status: "Follow-up",
      },
    ],
    quickLinks: [
      { label: "Launch Desktop Trainer", href: "/desktop_train" },
      { label: "Launch Mobile Trainer", href: "/mobile_train" },
      { label: "De-Ice Playbook", href: "https://intranet.example.com/deice-playbook" },
    ],
    upcomingTraining: {
      module: "Advanced Fluid Blending",
      due: "Mar 14, 2025",
      notes: "Complete before next recurrent audit",
    },
    checklists: [
      "Verify Type IV inventory with Ramp 3 at 0600",
      "Confirm comms check with Captain Hayes for Delta 418",
      "Log holdover variance in the Polar Ops dashboard",
    ],
    metrics: [
      { label: "Holdover Calls", value: "5", trend: "+1 vs avg" },
      { label: "Crew Sync", value: "92%", trend: "Stable" },
      { label: "Pads Ready", value: "3", trend: "All green" },
    ],
  },
  "73104": {
    name: "Morgan Patel",
    role: "Ramp Crew Lead",
    location: "OMA South Pad",
    shift: "1500 – 2330",
    summary:
      "Stage the evening crews, spot-check boots for glycol residue, and shadow new hires on pad sequencing.",
    focusAreas: [
      {
        title: "Equipment Prep",
        detail: "Truck 7A needs boom calibration before 1700 roll-out.",
        status: "Action required",
      },
      {
        title: "Crew Check-ins",
        detail: "Two new hires shadowing. Pair with veteran techs for first sortie.",
        status: "In progress",
      },
      {
        title: "Safety Sweep",
        detail: "Run slip hazard sweep between sorties and confirm cones at pad exits.",
        status: "Scheduled",
      },
    ],
    quickLinks: [
      { label: "Ramp Safety Form", href: "https://intranet.example.com/ramp-safety" },
      { label: "Launch Mobile Trainer", href: "/mobile_train" },
      { label: "Crew Scheduling", href: "https://intranet.example.com/crew-schedule" },
    ],
    upcomingTraining: {
      module: "Night Operations Refresher",
      due: "Apr 02, 2025",
      notes: "Complete after next shadow shift",
    },
    checklists: [
      "Inspect boom hydraulics prior to first sortie",
      "Confirm PPE compliance for all crew before staging",
      "Update shift log with calibration status",
    ],
    metrics: [
      { label: "Shadow Sessions", value: "3", trend: "+2 this week" },
      { label: "Safety Flags", value: "0", trend: "Keep clear" },
      { label: "Equipment Ready", value: "5/6", trend: "Truck 7A pending" },
    ],
  },
  "84219": {
    name: "Avery Chen",
    role: "Ops Supervisor",
    location: "Central Ops Deck",
    shift: "0700 – 1600",
    summary:
      "Oversee cross-station coordination, audit transcripts, and prep executive briefing packets.",
    focusAreas: [
      {
        title: "Station Sync",
        detail: "Share OMA fluid burn report with MSP and DEN leads by 1000.",
        status: "In progress",
      },
      {
        title: "Audit Review",
        detail: "Listen to random sampling of Type I briefings for cadence compliance.",
        status: "Queued",
      },
      {
        title: "Exec Brief",
        detail: "Compile de-ice readiness slides for VP Ops by 1500.",
        status: "Drafting",
      },
    ],
    quickLinks: [
      { label: "Operations Dashboard", href: "https://intranet.example.com/ops-dashboard" },
      { label: "Live Transcript Review", href: "https://intranet.example.com/transcripts" },
      { label: "Launch Desktop Trainer", href: "/desktop_train" },
    ],
    upcomingTraining: {
      module: "Leadership Sync",
      due: "Mar 28, 2025",
      notes: "Focus on cross-station escalation scenarios",
    },
    checklists: [
      "Review fluid burn analytics before leadership sync",
      "Approve MSP staffing adjustment request",
      "Update exec dashboard with latest holdover KPIs",
    ],
    metrics: [
      { label: "Stations Green", value: "6/7", trend: "+1 overnight" },
      { label: "Audits Closed", value: "12", trend: "2 remaining" },
      { label: "Escalations", value: "1", trend: "Monitoring" },
    ],
  },
};

export const EMPLOYEE_IDS = Object.keys(EMPLOYEE_PROFILES);

export function getEmployeeProfile(employeeId) {
  return EMPLOYEE_PROFILES[employeeId] ?? null;
}

export function isAllowedEmployeeId(employeeId) {
  return Object.prototype.hasOwnProperty.call(EMPLOYEE_PROFILES, employeeId);
}

export function normalizeEmployeeId(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\D+/g, "").trim();
}
