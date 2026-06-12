const TIMELINE = [
  {
    period: 'Now',
    label: 'Live Activity',
    accent: '#cc0000',
    tracks: [
      {
        title: 'Mobile Acquisition',
        items: ['Existing SIM-only portfolio', 'Broadband convergence offers', 'Device promotions', 'Digital & retail activity'],
      },
      {
        title: 'Retention / CVM',
        items: ['Base plan migrations', 'Upgrade journeys', 'Loyalty propositions', 'Save activity'],
      },
    ],
    note: 'Maintain acquisition volumes · Protect ARPU · Drive broadband–mobile convergence',
  },
  {
    period: 'Aug',
    label: 'FMC Launch',
    accent: '#8b1a8b',
    tracks: [
      {
        title: 'FMC Proposition',
        items: ['Enhanced broadband & mobile bundling', 'Convergence messaging refresh', 'Acquisition support', 'Upgrade support'],
      },
    ],
    note: 'Focused on broadband-attached mobile growth',
  },
  {
    period: 'Sep – Oct',
    label: 'CVM Programme',
    accent: '#1a56a0',
    tracks: [
      {
        title: 'Existing Customer Activity',
        items: ['Targeted upgrade journeys', 'Upsell to higher-value plans', 'Data-led segmentation', 'Churn risk mitigation'],
      },
    ],
    note: 'Reduce churn risk · Increase contract renewals',
  },
  {
    period: 'Nov – Dec',
    label: 'Seasonal Trading',
    accent: '#1a7a4a',
    tracks: [
      {
        title: 'Tactical Campaigns',
        items: ['Back-to-school (late Oct)', 'Black Friday activity', 'Christmas acquisition push', 'Value-led positioning'],
      },
    ],
    note: 'Proposition-led offers · Avoid reactive discounting',
  },
];

const PRIORITIES = [
  {
    theme: 'Growth',
    color: '#cc0000',
    points: ['Increase FMC penetration', 'Improve mobile attach rates', 'Drive higher-value plans'],
  },
  {
    theme: 'Retention',
    color: '#1a56a0',
    points: ['Reduce churn risk', 'Increase contract renewals', 'Expand loyalty benefits'],
  },
  {
    theme: 'Value',
    color: '#1a7a4a',
    points: ['Protect price position', 'Minimise unnecessary discounting', 'Proposition-led differentiation'],
  },
];

export default function OfferRoadmap() {
  return (
    <div className="roadmap-wrap">

      {/* Slide header */}
      <div className="roadmap-header">
        <div>
          <h2 className="roadmap-title">VM Offer Roadmap</h2>
          <p className="roadmap-subtitle">
            Current live activity and planned trading priorities — <strong>not reactive discounting</strong>
          </p>
        </div>
        <div className="roadmap-context">
          Market stable · Vodafone remains price leader · Limited competitor tactical activity
        </div>
      </div>

      {/* Timeline columns */}
      <div className="roadmap-timeline">
        {TIMELINE.map((col) => (
          <div key={col.period} className="roadmap-col" style={{ '--col-accent': col.accent }}>
            <div className="roadmap-col-header">
              <span className="roadmap-period">{col.period}</span>
              <span className="roadmap-col-label">{col.label}</span>
            </div>
            <div className="roadmap-col-body">
              {col.tracks.map((track) => (
                <div key={track.title} className="roadmap-track">
                  <p className="roadmap-track-title">{track.title}</p>
                  <ul className="roadmap-track-list">
                    {track.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="roadmap-col-note">{col.note}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Strategic priorities strip */}
      <div className="roadmap-priorities">
        <p className="roadmap-priorities-label">Strategic Priorities</p>
        <div className="roadmap-priorities-grid">
          {PRIORITIES.map((p) => (
            <div key={p.theme} className="roadmap-priority-card" style={{ borderTopColor: p.color }}>
              <p className="roadmap-priority-theme" style={{ color: p.color }}>{p.theme}</p>
              <ul>
                {p.points.map((pt) => <li key={pt}>{pt}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="roadmap-footnote">
        For internal use only · VM Ireland Weekly Trading Deck · {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}
