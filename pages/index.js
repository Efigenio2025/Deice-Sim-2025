export default function Home() {
  return (
    <div className="wrap">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="btn ghost" as="a" href="/train">Open Trainer →</div>
      </div>

      <div className="card">
        <h1 style={{margin:'0 0 6px'}}>De-Ice Verbiage Trainer</h1>
        <p className="status" style={{margin:0}}>
          Practice Iceman-to-flight deck de-ice/anti-ice communications verbaige.
          
        </p>
      </div>

      <div className="card">
        <h2>Train</h2>
        <p> This is a simulator that automatically plays the flight deck verbaige and allows you to naturally practice as a two way conversation.
            Features for this simulator include; Live transcript, highlights, and scoring.</p>
        <a className="btn" href="/train">Start Training</a>
      </div>

      <div className="status">V2 • For training purposes only • Joshua Efigenio </div>
    </div>
  );
}
