export default function ComparisonTable({ plans, bestValuePrice }) {
  if (plans.length === 0) {
    return <div className="empty-state">No plans match your filters.</div>;
  }

  return (
    <div className="comparison-wrapper">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Carrier</th>
            <th>Plan</th>
            <th>Price</th>
            <th>Data</th>
            <th>Calls / SMS</th>
            <th>5G</th>
            <th>Contract</th>
            <th>Roaming</th>
            <th>Offers</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan, i) => {
            const effective = plan.promoPrice ?? plan.priceEur;
            const isBest = effective === bestValuePrice;

            return (
              <tr key={`${plan.carrier}-${plan.name}-${i}`} className={isBest ? 'best-value-row' : ''}>
                <td>
                  <span className={`table-carrier-chip ${plan.carrier}`}>
                    {plan.carrierDisplay}
                  </span>
                </td>
                <td>
                  <a href={plan.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                    {plan.name}
                  </a>
                </td>
                <td>
                  {plan.promoPrice != null ? (
                    <span>
                      <span className="table-strike">€{plan.priceEur}</span>
                      {' '}
                      <span className="table-promo-price">€{plan.promoPrice}</span>
                    </span>
                  ) : (
                    <span className="table-price">€{plan.priceEur}</span>
                  )}
                  {plan.promoNote && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{plan.promoNote}</div>
                  )}
                </td>
                <td>{plan.dataDisplay}</td>
                <td>
                  {plan.minutes}
                  {plan.sms !== plan.minutes && ` / ${plan.sms}`}
                </td>
                <td>{plan.is5G ? '✓' : ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{plan.contractType}</td>
                <td style={{ fontSize: '0.8rem' }}>{plan.roaming !== 'No roaming' ? plan.roaming : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {plan.freeMonth && <span className="badge green">Free month</span>}
                    {plan.forLife && <span className="badge green">For life</span>}
                    {plan.hasPromo && !plan.freeMonth && !plan.forLife && (
                      <span className="badge amber">Promo</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
