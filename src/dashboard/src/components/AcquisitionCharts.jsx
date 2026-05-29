import { useState, useMemo } from 'react';
import PriceHistoryChart from './PriceHistoryChart.jsx';

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

const eff = (plan) => plan.promoPrice ?? plan.priceEur;

const DEFAULT_CHART_FILTERS = {
  data:      'all',   // 'all' | 'unlimited' | 'capped'
  contract:  'all',   // 'all' | '30-day rolling' | '12-month' | '24-month'
  carriers:  [],      // [] = all carriers
  fiveG:     false,
  promoOnly: false,
  euRoaming: false,
};

// ─────────────────────────────────────────────────────────────
// Filter bar (lives at the top of the Charts view)
// ─────────────────────────────────────────────────────────────
function ChartFilterBar({ filters, onChange, plans, filteredCount }) {
  const allCarriers = useMemo(
    () => [...new Set(plans.map((p) => p.carrier))].sort(),
    [plans]
  );

  const set = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  const toggleCarrier = (carrier) =>
    onChange((prev) => ({
      ...prev,
      carriers: prev.carriers.includes(carrier)
        ? prev.carriers.filter((c) => c !== carrier)
        : [...prev.carriers, carrier],
    }));

  const toggleBool = (key) => onChange((prev) => ({ ...prev, [key]: !prev[key] }));

  const isDefault =
    filters.data === 'all' &&
    filters.contract === 'all' &&
    filters.carriers.length === 0 &&
    !filters.fiveG &&
    !filters.promoOnly &&
    !filters.euRoaming;

  return (
    <div className="cf-bar">
      <div className="cf-rows">

        {/* Data allowance */}
        <div className="cf-row">
          <span className="cf-label">Data</span>
          <div className="cf-chips">
            {[
              { value: 'all',       label: 'All' },
              { value: 'unlimited', label: 'Unlimited' },
              { value: 'capped',    label: 'Capped (GB)' },
            ].map(({ value, label }) => (
              <button
                key={value}
                className={`cf-chip${filters.data === value ? ' cf-chip-on' : ''}`}
                onClick={() => set('data', filters.data === value ? 'all' : value)}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Contract length */}
        <div className="cf-row">
          <span className="cf-label">Contract</span>
          <div className="cf-chips">
            {[
              { value: 'all',            label: 'All' },
              { value: '30-day rolling', label: '30-day rolling' },
              { value: '12-month',       label: '12-month' },
              { value: '24-month',       label: '24-month' },
            ].map(({ value, label }) => (
              <button
                key={value}
                className={`cf-chip${filters.contract === value ? ' cf-chip-on' : ''}`}
                onClick={() => set('contract', filters.contract === value ? 'all' : value)}
              >{label}</button>
            ))}
          </div>
        </div>

        {/* Carriers */}
        <div className="cf-row">
          <span className="cf-label">Carrier</span>
          <div className="cf-chips">
            {allCarriers.map((carrier) => {
              const on    = filters.carriers.includes(carrier);
              const color = CARRIER_COLORS[carrier];
              const light = carrier === 'tescomobile';
              return (
                <button
                  key={carrier}
                  className={`cf-chip${on ? ' cf-chip-on' : ''}`}
                  style={on ? { background: color, borderColor: color, color: light ? '#333' : '#fff' } : {}}
                  onClick={() => toggleCarrier(carrier)}
                >
                  {CARRIER_DISPLAY[carrier]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle chips */}
        <div className="cf-row">
          <span className="cf-label">More</span>
          <div className="cf-chips">
            <button
              className={`cf-chip${filters.fiveG ? ' cf-chip-on' : ''}`}
              onClick={() => toggleBool('fiveG')}
            >5G only</button>
            <button
              className={`cf-chip${filters.promoOnly ? ' cf-chip-on' : ''}`}
              onClick={() => toggleBool('promoOnly')}
            >Promos only</button>
            <button
              className={`cf-chip${filters.euRoaming ? ' cf-chip-on' : ''}`}
              onClick={() => toggleBool('euRoaming')}
            >EU roaming</button>
          </div>
        </div>

      </div>

      <div className="cf-footer">
        <span className="cf-count">
          Showing <strong>{filteredCount}</strong> of <strong>{plans.length}</strong> plans
        </span>
        {!isDefault && (
          <button
            className="cf-clear"
            onClick={() => onChange(DEFAULT_CHART_FILTERS)}
          >Clear filters</button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. VM Rank Summary  (always uses full plans — true market position)
// ─────────────────────────────────────────────────────────────
function VMRankSummary({ plans }) {
  const stats = useMemo(() => {
    const vmPlans = plans.filter((p) => p.carrier === 'virginmedia');
    if (!vmPlans.length) return null;

    const vmEntry = Math.min(...vmPlans.map(eff));

    const sortedAll = [...plans].sort((a, b) => eff(a) - eff(b));
    const overallRank = sortedAll.findIndex((p) => p.carrier === 'virginmedia') + 1;

    const unlimited = plans.filter((p) => p.isUnlimited);
    const sortedUn  = [...unlimited].sort((a, b) => eff(a) - eff(b));
    const unlimitedRank = sortedUn.findIndex((p) => p.carrier === 'virginmedia') + 1;

    const competitors = plans.filter((p) => p.carrier !== 'virginmedia');
    const marketAvg   = competitors.length
      ? competitors.reduce((s, p) => s + eff(p), 0) / competitors.length
      : 0;
    const vsAvg = vmEntry - marketAvg;

    const carrierBest = {};
    plans.forEach((p) => {
      const e = eff(p);
      if (carrierBest[p.carrier] == null || e < carrierBest[p.carrier]) carrierBest[p.carrier] = e;
    });
    const competitorEntries = Object.entries(carrierBest).filter(([c]) => c !== 'virginmedia');
    const cheaperCarriers   = competitorEntries.filter(([, p]) => p < vmEntry).length;
    const pricierCarriers   = competitorEntries.filter(([, p]) => p >= vmEntry).length;

    return { vmEntry, overallRank, unlimited, unlimitedRank, vsAvg, cheaperCarriers, pricierCarriers };
  }, [plans]);

  if (!stats) return <p className="chart-empty">No Virgin Media plans found in dataset.</p>;

  const { vmEntry, overallRank, unlimited, unlimitedRank, vsAvg, cheaperCarriers, pricierCarriers } = stats;

  return (
    <div className="vm-rank-grid">
      <div className="vm-rank-card vm-highlight-card">
        <div className="vm-rank-label">Overall Plan Rank</div>
        <div className="vm-rank-num">#{overallRank}</div>
        <div className="vm-rank-sub">of {plans.length} plans by entry price</div>
      </div>

      <div className="vm-rank-card vm-highlight-card">
        <div className="vm-rank-label">Unlimited Rank</div>
        <div className="vm-rank-num">{unlimitedRank > 0 ? `#${unlimitedRank}` : '—'}</div>
        <div className="vm-rank-sub">of {unlimited.length} unlimited plans</div>
      </div>

      <div className="vm-rank-card">
        <div className="vm-rank-label">VM Entry Price</div>
        <div className="vm-rank-num">€{vmEntry}<span className="vm-rank-mo">/mo</span></div>
        <div className="vm-rank-sub">new customer acquisition price</div>
      </div>

      <div className={`vm-rank-card ${vsAvg < -0.01 ? 'rank-card-better' : vsAvg > 0.01 ? 'rank-card-worse' : ''}`}>
        <div className="vm-rank-label">vs Competitor Avg</div>
        <div className="vm-rank-num vm-rank-vs">
          {Math.abs(vsAvg) < 0.01
            ? 'At average'
            : vsAvg < 0
            ? `€${Math.abs(vsAvg).toFixed(2)} cheaper`
            : `€${vsAvg.toFixed(2)} pricier`}
        </div>
        <div className="vm-rank-sub">
          {cheaperCarriers} carrier{cheaperCarriers !== 1 ? 's' : ''} undercut VM · {pricierCarriers} more expensive
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Acquisition Bar Chart  (uses filteredPlans)
// ─────────────────────────────────────────────────────────────
function AcquisitionBarChart({ plans }) {
  const sorted   = useMemo(() => [...plans].sort((a, b) => eff(a) - eff(b)), [plans]);
  const maxPrice = useMemo(() => Math.max(...plans.map((p) => p.priceEur), 1), [plans]);

  if (plans.length === 0) {
    return <p className="chart-empty">No plans match the current filters.</p>;
  }

  return (
    <div className="acq-chart">
      <div className="acq-legend">
        <div className="acq-legend-item">
          <div className="acq-legend-swatch" style={{ background: '#6b6b80' }} />
          <span>Acquisition / intro price</span>
        </div>
        <div className="acq-legend-item">
          <div className="acq-legend-swatch acq-legend-ghost" />
          <span>Full price after promo ends</span>
        </div>
        <div className="acq-legend-item">
          <div className="acq-legend-vm-border" />
          <span>Virgin Media</span>
        </div>
      </div>

      <div className="acq-rows">
        {sorted.map((plan, i) => {
          const effP     = eff(plan);
          const hasPromo = plan.priceEur > effP;
          const color    = CARRIER_COLORS[plan.carrier] || '#888';
          const isVM     = plan.carrier === 'virginmedia';
          const effPct   = (effP / maxPrice) * 100;
          const fullPct  = hasPromo ? (plan.priceEur / maxPrice) * 100 : effPct;

          return (
            <div key={i} className={`acq-row${isVM ? ' acq-row-vm' : ''}`}>
              <div className="acq-label">
                <span className="acq-carrier-dot" style={{ background: color }} />
                <div className="acq-label-text">
                  <div className="acq-carrier-name">{plan.carrierDisplay}</div>
                  <div className="acq-plan-name">{plan.name}</div>
                </div>
              </div>

              <div className="acq-bar-col">
                <div className="acq-bar-track">
                  {hasPromo && (
                    <div className="acq-bar-ghost" style={{ width: `${fullPct}%`, background: color + '28' }} />
                  )}
                  <div className="acq-bar-fill" style={{ width: `${effPct}%`, background: color }} />
                </div>
                <div className="acq-bar-meta">
                  <span className="acq-eff-price" style={{ color }}>€{effP}/mo</span>
                  {hasPromo && (
                    <span className="acq-full-price">→ €{plan.priceEur} after promo</span>
                  )}
                  <span className="acq-tag">{plan.dataDisplay}</span>
                  <span className="acq-tag">{plan.contractType}</span>
                  {plan.roaming !== 'No roaming' && (
                    <span className="acq-tag acq-tag-green">EU roaming</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Price vs Data Scatter  (uses filteredPlans)
// ─────────────────────────────────────────────────────────────
const DATA_TIERS = [
  { max: 0,    xRatio: 0.04, label: null },
  { max: 5,    xRatio: 0.10, label: '5GB' },
  { max: 10,   xRatio: 0.22, label: '10GB' },
  { max: 23,   xRatio: 0.38, label: '23GB' },
  { max: 80,   xRatio: 0.57, label: '80GB' },
  { max: 95,   xRatio: 0.70, label: '95GB' },
  { max: 9999, xRatio: 0.90, label: 'Unlimited' },
];

function getDataXRatio(gb) {
  for (const tier of DATA_TIERS) {
    if (gb <= tier.max) return tier.xRatio;
  }
  return 0.90;
}

function PriceScatterPlot({ plans }) {
  const W = 580, H = 300;
  const PAD = { top: 16, right: 20, bottom: 40, left: 50 };
  const pW = W - PAD.left - PAD.right;
  const pH = H - PAD.top - PAD.bottom;

  const minP = useMemo(
    () => (plans.length ? Math.floor(Math.min(...plans.map(eff)) / 5) * 5 : 0),
    [plans]
  );
  const maxP = useMemo(
    () => (plans.length ? Math.ceil(Math.max(...plans.map((p) => p.priceEur)) / 5) * 5 : 40),
    [plans]
  );

  const yOf = (p) => PAD.top + pH - ((p - minP) / Math.max(maxP - minP, 1)) * pH;

  const jitter = useMemo(() => {
    const tierMap = {};
    plans.forEach((plan, i) => {
      const key = String(plan.dataGB);
      if (!tierMap[key]) tierMap[key] = [];
      tierMap[key].push(i);
    });
    const result = {};
    Object.values(tierMap).forEach((group) => {
      const n = group.length;
      group.forEach((idx, j) => {
        result[idx] = n === 1 ? 0 : (j - (n - 1) / 2) * 12;
      });
    });
    return result;
  }, [plans]);

  const yGrid = useMemo(() => {
    const lines = [];
    for (let p = minP; p <= maxP; p += 5) lines.push(p);
    return lines;
  }, [minP, maxP]);

  if (plans.length === 0) {
    return <p className="chart-empty">No plans match the current filters.</p>;
  }

  const xTiers = DATA_TIERS.filter((t) => t.label);

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

        {xTiers.map(({ label, xRatio }) => (
          <g key={label}>
            <line x1={PAD.left + xRatio * pW} y1={PAD.top + pH}
              x2={PAD.left + xRatio * pW} y2={PAD.top + pH + 5}
              stroke="var(--border)" strokeWidth="1" />
            <text x={PAD.left + xRatio * pW} y={H - 6}
              textAnchor="middle" fontSize="10" fill="var(--text-muted)">{label}</text>
          </g>
        ))}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + pH}
          stroke="var(--border)" strokeWidth="1.5" />
        <line x1={PAD.left} y1={PAD.top + pH} x2={PAD.left + pW} y2={PAD.top + pH}
          stroke="var(--border)" strokeWidth="1.5" />

        <text transform={`rotate(-90)`} x={-(PAD.top + pH / 2)} y={14}
          textAnchor="middle" fontSize="10" fill="var(--text-muted)">€/mo</text>

        {plans.map((plan, i) => {
          if (!plan.hasPromo) return null;
          const color = CARRIER_COLORS[plan.carrier] || '#888';
          const x = PAD.left + getDataXRatio(plan.dataGB) * pW + (jitter[i] || 0);
          return (
            <line key={`drop-${i}`}
              x1={x} y1={yOf(plan.priceEur)} x2={x} y2={yOf(eff(plan)) + 10}
              stroke={color} strokeWidth="1.5" strokeDasharray="3 2" opacity="0.35" />
          );
        })}

        {plans.filter((p) => p.hasPromo).map((plan) => {
          const idx = plans.indexOf(plan);
          const color = CARRIER_COLORS[plan.carrier] || '#888';
          const x = PAD.left + getDataXRatio(plan.dataGB) * pW + (jitter[idx] || 0);
          return (
            <circle key={`ghost-${idx}`} cx={x} cy={yOf(plan.priceEur)} r={4}
              fill="none" stroke={color} strokeWidth="1.5"
              strokeDasharray="3 2" opacity="0.4" />
          );
        })}

        {plans.map((plan, i) => {
          const isVM  = plan.carrier === 'virginmedia';
          const color = CARRIER_COLORS[plan.carrier] || '#888';
          const x = PAD.left + getDataXRatio(plan.dataGB) * pW + (jitter[i] || 0);
          const y = yOf(eff(plan));
          const r = isVM ? 9 : 7;

          return (
            <g key={i} className="scatter-point">
              {isVM && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke={color} strokeWidth="2" />
              )}
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity="0.88">
                <title>
                  {plan.carrierDisplay} — {plan.name}{'\n'}
                  Entry: €{eff(plan)}/mo{plan.hasPromo ? ` (→ €${plan.priceEur} after promo)` : ''}{'\n'}
                  Data: {plan.dataDisplay} · {plan.contractType}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        {Object.entries(CARRIER_COLORS).map(([carrier, color]) => {
          if (!plans.some((p) => p.carrier === carrier)) return null;
          const isVM = carrier === 'virginmedia';
          return (
            <div key={carrier} className={`legend-item${isVM ? ' legend-vm' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                {isVM && <circle cx="6" cy="6" r="5.5" fill="none" stroke={color} strokeWidth="1.5" />}
                <circle cx="6" cy="6" r={isVM ? 3.5 : 5} fill={color} />
              </svg>
              <span>{CARRIER_DISPLAY[carrier]}</span>
            </div>
          );
        })}
        <div className="legend-item">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="5" fill="none" stroke="#888"
              strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5" />
          </svg>
          <span className="legend-muted">Full price after promo</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────
export default function AcquisitionCharts({ plans, history }) {
  const [chartFilters, setChartFilters] = useState(DEFAULT_CHART_FILTERS);

  // Apply filters to produce the subset used by bar chart + scatter
  const filteredPlans = useMemo(() => {
    let r = [...plans];
    if (chartFilters.data === 'unlimited') r = r.filter((p) => p.isUnlimited);
    if (chartFilters.data === 'capped')    r = r.filter((p) => !p.isUnlimited);
    if (chartFilters.contract !== 'all')   r = r.filter((p) => p.contractType === chartFilters.contract);
    if (chartFilters.carriers.length > 0)  r = r.filter((p) => chartFilters.carriers.includes(p.carrier));
    if (chartFilters.fiveG)                r = r.filter((p) => p.is5G);
    if (chartFilters.promoOnly)            r = r.filter((p) => p.hasPromo);
    if (chartFilters.euRoaming)            r = r.filter((p) => p.roaming !== 'No roaming');
    return r;
  }, [plans, chartFilters]);

  if (!plans.length) return null;

  return (
    <div className="charts-view">

      {/* Filter bar */}
      <ChartFilterBar
        filters={chartFilters}
        onChange={setChartFilters}
        plans={plans}
        filteredCount={filteredPlans.length}
      />

      {/* 1 — VM Market Position (always full dataset — true market ranking) */}
      <section className="chart-section">
        <div className="chart-section-hdr">
          <h2 className="chart-section-title">🎯 Virgin Media Market Position</h2>
          <p className="chart-section-sub">
            Full-market ranking — always shows VM's true position across all plans regardless of filters
          </p>
        </div>
        <VMRankSummary plans={plans} />
      </section>

      {/* 2 — Acquisition Bar Chart (filtered) */}
      <section className="chart-section">
        <div className="chart-section-hdr">
          <h2 className="chart-section-title">💰 Acquisition Price Comparison</h2>
          <p className="chart-section-sub">
            What a new customer pays today — intro price shown solid, full price after promo as ghost
            {filteredPlans.length < plans.length && (
              <span className="chart-filter-note"> · {filteredPlans.length} of {plans.length} plans</span>
            )}
          </p>
        </div>
        <AcquisitionBarChart plans={filteredPlans} />
      </section>

      {/* 3 & 4 — Scatter + History */}
      <div className="charts-two-col">
        <section className="chart-section">
          <div className="chart-section-hdr">
            <h2 className="chart-section-title">📍 Price vs Data — Market Map</h2>
            <p className="chart-section-sub">
              Value positioning · VM ringed · dashed = full price after promo · hover for details
            </p>
          </div>
          <PriceScatterPlot plans={filteredPlans} />
        </section>

        <section className="chart-section">
          <div className="chart-section-hdr">
            <h2 className="chart-section-title">📈 Price History</h2>
            <p className="chart-section-sub">
              Cheapest acquisition price per carrier over time — full market, grows with each daily scrape
            </p>
          </div>
          <PriceHistoryChart history={history} />
        </section>
      </div>

    </div>
  );
}
