import { useMemo } from 'react';

// ── Shared constants ──────────────────────────────────────────
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

const eff = (p) => p.promoPrice ?? p.priceEur;

const isESIM = (p) => /esim|e-sim/i.test(p.name);

const ESIM_CARRIERS = new Set(['vodafone', 'three', 'eir', 'gomo', 'skymobile']);

// ── Insight bullet helper ─────────────────────────────────────
function Insight({ icon, children }) {
  return (
    <div className="sum-insight">
      <span className="sum-insight-icon">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────
export default function SummaryView({ plans }) {

  // ── All non-eSIM plans, sorted by acquisition price ──
  const qualified = useMemo(() =>
    plans
      .filter((p) => !isESIM(p))
      .sort((a, b) => eff(a) - eff(b)),
    [plans]
  );

  const esimCount = plans.filter(isESIM).length;

  // ── Aggregate stats ───────────────────────────────────────────
  const stats = useMemo(() => {
    if (!qualified.length) return null;

    const effPrices   = qualified.map(eff);
    const cheapest    = Math.min(...effPrices);
    const priciest    = Math.max(...effPrices);
    const avg         = effPrices.reduce((s, v) => s + v, 0) / effPrices.length;

    const vmIdx       = qualified.findIndex((p) => p.carrier === 'virginmedia');
    const vmPlan      = vmIdx >= 0 ? qualified[vmIdx] : null;
    const vmRank      = vmIdx >= 0 ? vmIdx + 1 : null;
    const vmPrice     = vmPlan ? eff(vmPlan) : null;
    const vsAvg       = vmPrice != null ? vmPrice - avg : null;

    const uniqueCarriers = [...new Set(qualified.map((p) => p.carrier))];
    const withPromo      = qualified.filter((p) => p.hasPromo).length;
    const with5G         = qualified.filter((p) => p.is5G).length;
    const withRoaming    = qualified.filter((p) => p.roaming !== 'No roaming').length;
    const forLifeCount   = qualified.filter((p) => p.forLife).length;

    // cheapest non-VM plan (to show VM gap)
    const cheapestComp = qualified.filter((p) => p.carrier !== 'virginmedia');
    const cheapestCompPrice = cheapestComp.length
      ? Math.min(...cheapestComp.map(eff))
      : null;

    return {
      total: qualified.length,
      carrierCount: uniqueCarriers.length,
      cheapest,
      priciest,
      avg,
      vmRank,
      vmPlan,
      vmPrice,
      vsAvg,
      withPromo,
      with5G,
      withRoaming,
      forLifeCount,
      cheapestCompPrice,
    };
  }, [qualified]);

  // ── Edge cases ────────────────────────────────────────────────
  if (!plans.length) return null;
  if (!qualified.length) {
    return (
      <div className="chart-empty">
        No fully unlimited plans found. Run the scraper to refresh data.
      </div>
    );
  }

  const bestPrice = eff(qualified[0]);

  return (
    <div className="summary-view">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="sum-page-header">
        <div>
          <h2 className="sum-page-title">📊 All Plans — Market Summary</h2>
          <p className="sum-page-sub">
            Physical SIM only (eSIM excluded) ·{' '}
            <strong>{stats.total}</strong> plans across{' '}
            <strong>{stats.carrierCount}</strong> carriers
          </p>
        </div>
      </div>

      {/* ── Key metric cards ─────────────────────────────── */}
      <div className="sum-stat-grid">

        <div className="sum-stat-card">
          <div className="sum-stat-label">Cheapest Unlimited</div>
          <div className="sum-stat-big">€{stats.cheapest}<span className="sum-stat-unit">/mo</span></div>
          <div className="sum-stat-sub">lowest acquisition price in market</div>
        </div>

        <div className={`sum-stat-card ${
          stats.vmRank === 1 ? 'sum-card-green'
          : stats.vmRank <= 2 ? 'sum-card-amber'
          : 'sum-card-red'
        }`}>
          <div className="sum-stat-label">VM Market Rank</div>
          <div className="sum-stat-big">
            #{stats.vmRank}
            <span className="sum-stat-unit"> of {stats.total}</span>
          </div>
          <div className="sum-stat-sub">
            {stats.vmPlan
              ? `€${stats.vmPrice}/mo · ${stats.vmPlan.contractType}`
              : 'No VM unlimited plan found'}
          </div>
        </div>

        <div className={`sum-stat-card ${
          stats.vsAvg != null && stats.vsAvg < -0.01 ? 'sum-card-green'
          : stats.vsAvg != null && stats.vsAvg > 0.01 ? 'sum-card-red'
          : ''
        }`}>
          <div className="sum-stat-label">VM vs Market Avg</div>
          <div className="sum-stat-big sum-stat-vs">
            {stats.vsAvg == null ? '—'
              : Math.abs(stats.vsAvg) < 0.01 ? 'At avg'
              : stats.vsAvg < 0
                ? `€${Math.abs(stats.vsAvg).toFixed(2)} cheaper`
                : `€${stats.vsAvg.toFixed(2)} pricier`
            }
          </div>
          <div className="sum-stat-sub">
            market avg €{stats.avg.toFixed(2)}/mo
          </div>
        </div>

        <div className="sum-stat-card">
          <div className="sum-stat-label">Market Features</div>
          <div className="sum-stat-big">{stats.with5G}<span className="sum-stat-unit"> 5G plans</span></div>
          <div className="sum-stat-sub">
            {stats.withRoaming} with EU roaming ·{' '}
            {stats.withPromo} active promos ·{' '}
            {stats.forLifeCount} price-for-life
          </div>
        </div>

      </div>

      {/* ── Main comparison table ─────────────────────── */}
      <div className="sum-table-section">
        <div className="sum-table-hdr">
          <h3 className="sum-table-title">All Plans — Ranked by Acquisition Price</h3>
          <p className="sum-table-sub">
            Sorted by what a new customer pays today · hover rows for detail
          </p>
        </div>
        <div className="sum-table-wrap">
          <table className="sum-table">
            <thead>
              <tr>
                <th className="sum-th sum-th-rank">#</th>
                <th className="sum-th">Network</th>
                <th className="sum-th">Plan</th>
                <th className="sum-th">Data</th>
                <th className="sum-th sum-th-price">Acq. Price</th>
                <th className="sum-th sum-th-price">Standard Price</th>
                <th className="sum-th">Contract</th>
                <th className="sum-th">Features</th>
                <th className="sum-th">URL</th>
              </tr>
            </thead>
            <tbody>
              {qualified.map((plan, idx) => {
                const effP   = eff(plan);
                const isVM   = plan.carrier === 'virginmedia';
                const isBest = effP === bestPrice;
                const color  = CARRIER_COLORS[plan.carrier] || '#888';

                return (
                  <tr
                    key={`${plan.carrier}-${plan.name}`}
                    className={`sum-row${isVM ? ' sum-row-vm' : ''}${isBest ? ' sum-row-best' : ''}`}
                  >
                    {/* Rank */}
                    <td className="sum-td sum-td-rank">
                      {isBest
                        ? <span className="sum-trophy" title="Cheapest unlimited">🏆</span>
                        : <span className="sum-rank-num">#{idx + 1}</span>}
                    </td>

                    {/* Carrier */}
                    <td className="sum-td sum-td-carrier" style={{ borderLeft: `3px solid ${color}` }}>
                      <span className="sum-carrier-dot" style={{ background: color }} />
                      <span className="sum-carrier-name">{plan.carrierDisplay}</span>
                    </td>

                    {/* Plan name */}
                    <td className="sum-td sum-td-name">
                      <span className="sum-plan-name">{plan.name}</span>
                      {isVM && <span className="sum-vm-pill">VM</span>}
                    </td>

                    {/* Data */}
                    <td className="sum-td sum-td-data">
                      <span className={plan.isUnlimited ? 'sum-data-unlimited' : 'sum-data-capped'}>
                        {plan.dataDisplay}
                      </span>
                    </td>

                    {/* Acquisition price */}
                    <td className="sum-td sum-td-price">
                      <span
                        className="sum-acq-price"
                        style={isBest ? { color: '#16a34a' } : isVM ? { color: '#cc0000' } : undefined}
                      >
                        €{effP}
                        <span className="sum-mo">/mo</span>
                      </span>
                      {plan.hasPromo && plan.promoNote && (
                        <span className="sum-promo-note">{plan.promoNote}</span>
                      )}
                    </td>

                    {/* Standard price */}
                    <td className="sum-td sum-td-standard">
                      {plan.hasPromo
                        ? <><span className="sum-standard-price">€{plan.priceEur}/mo</span><span className="sum-after-label"> after promo</span></>
                        : plan.forLife
                          ? <span className="sum-forlife">Price for life</span>
                          : <span className="sum-muted">€{plan.priceEur}/mo</span>
                      }
                    </td>

                    {/* Contract */}
                    <td className="sum-td">
                      <span className="sum-contract">{plan.contractType}</span>
                    </td>

                    {/* Feature badges */}
                    <td className="sum-td sum-td-features">
                      {plan.is5G && <span className="deck-5g-badge">5G</span>}
                      {ESIM_CARRIERS.has(plan.carrier) && <span className="deck-esim-badge">eSIM</span>}
                      {plan.roaming !== 'No roaming' && (
                        <span className="deck-roam-badge">EU roaming</span>
                      )}
                      {plan.forLife && <span className="sum-badge-life">For life</span>}
                    </td>

                    {/* Link */}
                    <td className="sum-td sum-td-link">
                      <a
                        href={plan.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sum-link"
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick insights ───────────────────────────────── */}
      <div className="sum-insights-section">
        <h3 className="sum-insights-title">💡 Key Insights</h3>
        <div className="sum-insights-grid">
          {stats.vmRank === 1 && (
            <Insight icon="🥇">
              VM is the <strong>cheapest unlimited plan</strong> in the market at €{stats.vmPrice}/mo
            </Insight>
          )}
          {stats.vmRank > 1 && stats.cheapestCompPrice != null && (
            <Insight icon="📍">
              VM unlimited (€{stats.vmPrice}/mo) is <strong>€{(stats.vmPrice - stats.cheapestCompPrice).toFixed(2)} more</strong> than
              the cheapest competitor (€{stats.cheapestCompPrice}/mo)
            </Insight>
          )}
          {stats.vsAvg != null && stats.vsAvg < -0.01 && (
            <Insight icon="✅">
              VM is <strong>€{Math.abs(stats.vsAvg).toFixed(2)} below the market average</strong> of €{stats.avg.toFixed(2)}/mo
            </Insight>
          )}
          {stats.vsAvg != null && stats.vsAvg > 0.01 && (
            <Insight icon="⚠️">
              VM is <strong>€{stats.vsAvg.toFixed(2)} above the market average</strong> of €{stats.avg.toFixed(2)}/mo
            </Insight>
          )}
          <Insight icon="📶">
            <strong>{stats.with5G} of {stats.total}</strong> unlimited plans include 5G connectivity
          </Insight>
          <Insight icon="🌍">
            <strong>{stats.withRoaming} of {stats.total}</strong> unlimited plans include EU roaming
            {stats.vmPlan?.roaming === 'No roaming' && ' — VM does not include EU roaming on this plan'}
          </Insight>
          <Insight icon="🏷️">
            <strong>{stats.withPromo} plans</strong> currently have introductory/promotional pricing
          </Insight>
          {stats.forLifeCount > 0 && (
            <Insight icon="🔒">
              <strong>{stats.forLifeCount} plan{stats.forLifeCount > 1 ? 's' : ''}</strong> offer price-for-life guarantee
              {stats.vmPlan?.forLife && ' — including VM'}
            </Insight>
          )}
          <Insight icon="💰">
            Unlimited price range: <strong>€{stats.cheapest} – €{stats.priciest}/mo</strong>
            {' '}(acquisition prices)
          </Insight>
        </div>
      </div>

      {/* ── Excluded plans note ──────────────────────────── */}
      {esimCount > 0 && (
        <div className="sum-excluded-note">
          <strong>Not shown:</strong>{' '}
          {esimCount} eSIM plan{esimCount > 1 ? 's' : ''} excluded — available on the SIM / Table tabs.
        </div>
      )}

    </div>
  );
}
