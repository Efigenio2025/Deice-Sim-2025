import { FrostCard } from '../components/frost/FrostCard';

const resources = [
  {
    title: 'Quickstart Script',
    description: 'One-page frost-styled transcript cheat sheet covering standard clearances and de-ice phrasing.',
    href: '#',
  },
  {
    title: 'Pad Checklist',
    description: 'Interactive checklist for Type I operations with frost glow emphasis on safety callouts.',
    href: '#',
  },
  {
    title: 'Captain Cue Library',
    description: 'Downloadable MP3 set for offline practice with frost-calibrated levels.',
    href: '#',
  },
];

export default function ResourcesPage() {
  return (
    <div className="space-y-8 pb-20">
      <header className="space-y-3">
        <p className="frost-pill muted w-fit">Resource Vault</p>
        <h1 className="font-display text-3xl font-semibold text-slate-100">Frost Training Resources</h1>
        <p className="max-w-2xl text-sm text-slate-300/80">
          Download training aids styled with the Frost Dashboard palette. Cards glow with cyan rings on hover or focus, providing
          consistent cues across the app.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {resources.map((resource) => (
          <FrostCard key={resource.title} padding="lg">
            <h2 className="font-display text-xl font-semibold text-slate-100">{resource.title}</h2>
            <p className="text-sm text-slate-300/80">{resource.description}</p>
            <a href={resource.href} className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Download →
            </a>
          </FrostCard>
        ))}
      </div>

      <FrostCard padding="lg" interactive={false}>
        <h2 className="font-display text-2xl font-semibold text-slate-100">Design Tokens</h2>
        <p className="text-sm text-slate-300/80">
          Global Tailwind plugin includes <code className="text-cyan-200">bg-frost-radial</code>, <code className="text-cyan-200">bg-frost-panel</code>, and
          <code className="text-cyan-200">frost-divider</code> utilities. Apply them directly to replicate the Frost Dashboard look.
        </p>
      </FrostCard>
    </div>
  );
}
