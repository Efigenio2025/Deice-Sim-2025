export function FrostFooter() {
  return (
    <footer className="safe-px safe-pb mt-16 border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs uppercase tracking-[0.25em] text-slate-400/80 md:flex-row md:items-center md:justify-between">
        <p className="text-slate-400">© {new Date().getFullYear()} De-Ice Trainer • Frost Dashboard Edition</p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>V2 Training Suite</span>
          <span>OMA Station</span>
          <span>For training use only</span>
        </div>
      </div>
    </footer>
  );
}

export default FrostFooter;
