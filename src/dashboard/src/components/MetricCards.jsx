export default function MetricCards({ metrics }) {
  const { total, lowestPrice, unlimitedCount, activeOffers } = metrics;

  const cards = [
    { label: 'Total Plans', value: total, sub: 'across 7 carriers' },
    {
      label: 'Lowest Price',
      value: lowestPrice != null ? `€${lowestPrice}` : '—',
      sub: 'effective monthly',
    },
    { label: 'Unlimited Data', value: unlimitedCount, sub: `of ${total} plans` },
    { label: 'Active Offers', value: activeOffers, sub: 'promotional pricing' },
  ];

  return (
    <div className="metric-cards">
      {cards.map((card) => (
        <div key={card.label} className="metric-card">
          <p className="metric-label">{card.label}</p>
          <p className="metric-value">{card.value}</p>
          <p className="metric-sub">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
