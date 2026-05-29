import { useMemo } from 'react';

const CARRIER_COLORS = {
  vodafone:    '#e60000',
  three:       '#6b2fa0',
  gomo:        '#00a651',
  clearmobile: '#00899d',
  skymobile:   '#0072c6',
  tescomobile: '#f5a623',
  virginmedia: '#cc0000',
  eir:         '#4a1942',
};

const CARRIER_DISPLAY = {
  vodafone:    'Vodafone',
  three:       'Three',
  gomo:        'GoMo',
  clearmobile: 'Clear Mobile',
  skymobile:   'Sky Mobile',
  tescomobile: 'Tesco Mobile',
  virginmedia: 'Virgin Media',
  eir:         'eir',
};

export default function PriceHistoryChart({ history }) {
  const enriched = useMemo(
    () => [...history].reverse().filter((h) => h.carrierPrices),
    [history]
  );

  if (enriched.length === 0) {
    return (
      <div className="history-placeholder">
        <div className="history-placeholder-icon">📈</div>
        <p className="history-placeholder-title">Building price history…</p>
        <p className="history-placeholder-body">
          Each scraper run records the cheapest acquisition price per carrier.
          Run the scraper daily and trends will appear here within a few days.
        </p>
        <code className="history-placeholder-cmd">npm start</code>
      </div>
    );
  }

  const W = 580, H = 280;
  const PAD = { top: 16, right: 20, bottom: 44, left: 50 };
  const pW = W - PAD.left - PAD.right;
  const pH = H - PAD.top - PAD.bottom;

  const allPrices = enriched.flatMap((h) => Object.values(h.carrierPrices));
  const minP = Math.floor(Math.min(...allPrices) / 5) * 5;
  const maxP = Math.ceil(Math.max(...allPrices) / 5) * 5;

  const xOf = (i) =>
    PAD.left + (enriched.length > 1 ? (i / (enriched.length - 1)) * pW : pW / 2);
  const yOf = (p) => PAD.top + pH - ((p - minP) / Math.max(maxP - minP, 1)) * pH;

  const yGrid = [];
  for (let p = minP; p <= maxP; p += 5) yGrid.push(p);

  const labelIdxs = new Set([0, enriched.length - 1]);
  if (enriched.length > 3) {
    const step = Math.max(1, Math.floor(enriched.length / 4));
    for (let j = step; j < enriched.length - 1; j += step) labelIdxs.add(j);
  }

  const activeCarriers = Object.keys(CARRIER_COLORS).filter((c) =>
    enriched.some((h) => h.carrierPrices?.[c] != null)
  );

  // When there's only one data point all carriers stack at the same x.
  // Spread carriers that share the same price bucket horizontally so every
  // dot is visible. Price axis (y) stays accurate; only x shifts.
  const xDodge = useMemo(() => {
    if (enriched.length !== 1) return {};
    const STEP = 11; // px between carriers in same price bucket
    const buckets = {};
    activeCarriers.forEach((c) => {
      const price = enriched[0]?.carrierPrices?.[c];
      if (price == null) return;
      const bucket = Math.round(price); // bucket by nearest €1
      if (!buckets[bucket]) buckets[bucket] = [];
      buckets[bucket].push(c);
    });
    const offsets = {};
    Object.values(buckets).forEach((group) => {
      const n = group.length;
      group.forEach((c, j) => {
        offsets[c] = (j - (n - 1) / 2) * STEP;
      });
    });
    return offsets;
  }, [enriched, activeCarriers]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {yGrid.map((p) => (
          <g key={p}>
            <line x1={PAD.left} y1={yOf(p)} x2={PAD.left + pW} y2={yOf(p)}
              stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left - 8} y={yOf(p) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
              €{p}
            </text>
          </g>
        ))}

        {[...labelIdxs].map((i) => (
          <text key={i} x={xOf(i)} y={H - 8}
            textAnchor="middle" fontSize="10" fill="var(--text-muted)">
            {new Date(enriched[i].timestamp).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}
          </text>
        ))}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + pH}
          stroke="var(--border)" strokeWidth="1.5" />
        <line x1={PAD.left} y1={PAD.top + pH} x2={PAD.left + pW} y2={PAD.top + pH}
          stroke="var(--border)" strokeWidth="1.5" />

        {activeCarriers.map((carrier) => {
          const color = CARRIER_COLORS[carrier];
          const isVM  = carrier === 'virginmedia';
          const points = enriched
            .map((h, i) =>
              h.carrierPrices?.[carrier] != null
                ? `${xOf(i)},${yOf(h.carrierPrices[carrier])}`
                : null
            )
            .filter(Boolean);

          if (points.length === 0) return null;

          return (
            <g key={carrier}>
              {points.length > 1 && (
                <polyline points={points.join(' ')} fill="none"
                  stroke={color} strokeWidth={isVM ? 3 : 1.5} opacity={isVM ? 1 : 0.65} />
              )}
              {enriched.map((h, i) => {
                const p = h.carrierPrices?.[carrier];
                if (p == null) return null;
                return (
                  <circle key={i} cx={xOf(i) + (xDodge[carrier] ?? 0)} cy={yOf(p)}
                    r={isVM ? 4.5 : 3} fill={color} opacity={isVM ? 1 : 0.75}>
                    <title>
                      {CARRIER_DISPLAY[carrier]}: €{p}/mo
                      {'\n'}{new Date(h.timestamp).toLocaleDateString('en-IE', { dateStyle: 'medium' })}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        {activeCarriers.map((carrier) => {
          const color = CARRIER_COLORS[carrier];
          const isVM  = carrier === 'virginmedia';
          return (
            <div key={carrier} className={`legend-item${isVM ? ' legend-vm' : ''}`}>
              <svg width="22" height="10" viewBox="0 0 22 10">
                <line x1="0" y1="5" x2="22" y2="5"
                  stroke={color} strokeWidth={isVM ? 3 : 1.5} opacity={isVM ? 1 : 0.65} />
                <circle cx="11" cy="5" r={isVM ? 4 : 2.5} fill={color} />
              </svg>
              <span>{CARRIER_DISPLAY[carrier]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
