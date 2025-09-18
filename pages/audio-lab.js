import { FrostCard } from '../components/frost/FrostCard';

const calibrationSteps = [
  {
    title: 'Unlock Audio',
    description: 'Tap the Frost Unlock button to enable microphone capture. Safari on iOS requires user interaction.',
    action: 'Unlock Audio',
  },
  {
    title: 'Test Captain Cue',
    description: 'Play a sample captain line and adjust headset volume until the frost meter pulses amber.',
    action: 'Play Sample',
  },
  {
    title: 'Noise Floor Check',
    description: 'Stay silent for 5 seconds while the frost meter captures ambient decibels.',
    action: 'Start Meter',
  },
];

export default function AudioLabPage() {
  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-3">
        <p className="frost-pill muted w-fit">Audio Lab</p>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Frost Audio Diagnostics</h1>
        <p className="max-w-2xl text-sm text-slate-300/80">
          Preview captain cues, tune microphone gain, and trigger the frost-wipe sheen when testing interactive controls. These
          utilities match the Frost Dashboard palette across desktop and mobile.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <FrostCard padding="lg" interactive={false}>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mic Status</p>
          <p className="text-4xl font-semibold text-slate-100">Ready</p>
          <p className="text-xs text-slate-300/80">Device recognized • Safari iOS 17.4</p>
        </FrostCard>
        <FrostCard padding="lg" interactive={false}>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ambient</p>
          <p className="text-4xl font-semibold text-slate-100">36 dB</p>
          <p className="text-xs text-slate-300/80">Quiet ramp • Frost-meter baseline</p>
        </FrostCard>
        <FrostCard padding="lg" interactive={false}>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Captain Preview</p>
          <p className="text-4xl font-semibold text-slate-100">Type I Mix</p>
          <p className="text-xs text-slate-300/80">Frost audio stage loaded</p>
        </FrostCard>
      </div>

      <FrostCard padding="lg" interactive={false}>
        <h2 className="font-display text-2xl font-semibold text-slate-100">Calibration Checklist</h2>
        <p className="text-sm text-slate-300/80">Tap a card to trigger frost tilt effects on desktop.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {calibrationSteps.map((step) => (
            <FrostCard key={step.title} padding="lg">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">{step.title}</p>
              <p className="text-sm text-slate-300/80">{step.description}</p>
              <button className="mt-4 frost-btn text-xs">{step.action}</button>
            </FrostCard>
          ))}
        </div>
      </FrostCard>
    </div>
  );
}
