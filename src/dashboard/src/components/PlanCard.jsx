// Carriers confirmed to support eSIM in Ireland
const ESIM_CARRIERS = new Set([
  'vodafone',
  'three',
  'eir',
  'gomo',
  'skymobile',
]);

// Extras already covered by dedicated badges/specs — don't show twice
const SKIP_EXTRAS = new Set(['5G', 'EU Roaming', 'EU roaming']);

export default function PlanCard({ plan, isBestValue }) {
  const effectivePrice = plan.promoPrice ?? plan.priceEur;
  const hasEsim = ESIM_CARRIERS.has(plan.carrier);
  const filteredExtras = plan.extras?.filter((e) => !SKIP_EXTRAS.has(e)) ?? [];

  return (
    <div className={`plan-card${isBestValue ? ' best-value' : ''}`}>
      <div className={`carrier-accent ${plan.carrier}`} />

      {isBestValue && <span className="best-value-badge">Best Value</span>}

      <div className="plan-card-header">
        <span className={`carrier-chip ${plan.carrier}`}>{plan.carrierDisplay}</span>
        <span className="plan-name">{plan.name}</span>
      </div>

      <div>
        <div className="plan-price-row">
          {plan.promoPrice != null && (
            <span className="plan-promo-price">€{plan.priceEur}</span>
          )}
          <span className="plan-price">€{effectivePrice}</span>
          <span className="plan-price-period">/mo</span>
        </div>
        {plan.promoNote && (
          <div className="plan-promo-note">{plan.promoNote}</div>
        )}
      </div>

      <div className="plan-specs">
        <div className="plan-spec">
          <span className="spec-label">Data</span>
          <span className="spec-value">{plan.dataDisplay}</span>
        </div>
        <div className="plan-spec">
          <span className="spec-label">Calls</span>
          <span className="spec-value">{plan.minutes}</span>
        </div>
        <div className="plan-spec">
          <span className="spec-label">SMS</span>
          <span className="spec-value">{plan.sms}</span>
        </div>
        <div className="plan-spec">
          <span className="spec-label">Contract</span>
          <span className="spec-value">{plan.contractType}</span>
        </div>
      </div>

      {plan.roaming && plan.roaming !== 'No roaming' && (
        <div className="plan-spec">
          <span className="spec-label">Roaming</span>
          <span className="spec-value" style={{ fontSize: '0.8rem' }}>{plan.roaming}</span>
        </div>
      )}

      {plan.bundleRequired && (
        <div className="plan-bundle-note">
          🔗 {plan.bundleRequired}
        </div>
      )}

      <div className="plan-badges">
        {plan.bundleRequired && <span className="badge bundle">Bundle</span>}
        {plan.is5G && <span className="badge purple">5G</span>}
        {hasEsim && <span className="badge blue">eSIM</span>}
        {plan.freeMonth && <span className="badge green">Free month</span>}
        {plan.forLife && <span className="badge green">For life</span>}
        {plan.hasPromo && !plan.freeMonth && !plan.forLife && (
          <span className="badge amber">Promo</span>
        )}
        {filteredExtras.slice(0, 2).map((extra) => (
          <span key={extra} className="badge blue">{extra}</span>
        ))}
      </div>

      <a
        href={plan.url}
        target="_blank"
        rel="noopener noreferrer"
        className="plan-card-link"
      >
        View plan →
      </a>
    </div>
  );
}
