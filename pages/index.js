export default function Home() {
  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <a className="btn ghost" href="/desktop_train">Desktop Version →</a>
        <a className="btn ghost" href="/mobile_train">Mobile Version →</a>
      </div>

      <div className="card">
        <h1 style={{ margin: '0 0 6px' }}>De-Ice Trainer</h1>
        <p className="status" style={{ margin: 0 }}>
          Practice agent-to-flight deck de-ice/anti-ice communications by voice.
          Optimized for iOS Safari (mic) and Chrome.
        </p>
      </div>

      <div className="card">
        <h2>Train</h2>
        <p>Captain lines play; you speak Iceman. Live transcript, highlights, and scoring.</p>
        <a className="btn" href="/desktop_train">Start Training</a>
      </div>

      <div className="status">V2 • For training purposes only • OMA Station • 2025</div>
    </div>
  );
}
