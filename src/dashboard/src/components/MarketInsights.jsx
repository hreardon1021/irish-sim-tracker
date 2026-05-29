import { useMemo } from 'react';

export default function MarketInsights({ plans }) {
  const insights = useMemo(() => {
    if (plans.length === 0) return null;

    // Plans per carrier
    const byCarrier = {};
    plans.forEach((p) => {
      byCarrier[p.carrierDisplay] = (byCarrier[p.carrierDisplay] || 0) + 1;
    });
    const carrierCounts = Object.entries(byCarrier).sort((a, b) => b[1] - a[1]);

    // Price distribution
    const prices = plans.map((p) => p.promoPrice ?? p.priceEur).sort((a, b) => a - b);
    const avgPrice = (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2);
    const medianPrice = prices[Math.floor(prices.length / 2)];
    const minPrice = prices[0];
    const maxPrice = prices[prices.length - 1];

    // Contract type breakdown
    const byContract = {};
    plans.forEach((p) => {
      byContract[p.contractType] = (byContract[p.contractType] || 0) + 1;
    });

    // 5G availability
    const fiveGCount = plans.filter((p) => p.is5G).length;
    const unlimitedCount = plans.filter((p) => p.isUnlimited).length;
    const promoCount = plans.filter((p) => p.hasPromo).length;
    const euRoamingCount = plans.filter((p) => p.roaming && p.roaming !== 'No roaming').length;

    // Cheapest per carrier
    const cheapestByCarrier = {};
    plans.forEach((p) => {
      const eff = p.promoPrice ?? p.priceEur;
      if (!cheapestByCarrier[p.carrierDisplay] || eff < cheapestByCarrier[p.carrierDisplay].price) {
        cheapestByCarrier[p.carrierDisplay] = { price: eff, plan: p.name };
      }
    });
    const cheapestList = Object.entries(cheapestByCarrier)
      .map(([carrier, { price, plan }]) => ({ carrier, price, plan }))
      .sort((a, b) => a.price - b.price);

    return { carrierCounts, avgPrice, medianPrice, minPrice, maxPrice, byContract, fiveGCount, unlimitedCount, promoCount, euRoamingCount, cheapestList };
  }, [plans]);

  if (!insights) {
    return <div className="empty-state">No data available.</div>;
  }

  const { carrierCounts, avgPrice, medianPrice, minPrice, maxPrice, byContract, fiveGCount, unlimitedCount, promoCount, euRoamingCount, cheapestList } = insights;
  const maxCount = Math.max(...carrierCounts.map(([, c]) => c));

  return (
    <div className="insights-grid">
      {/* Price stats */}
      <div className="insight-card">
        <p className="insight-title">Price Stats</p>
        <ul className="insight-list">
          <li><span className="label">Lowest effective</span><span className="value">€{minPrice}</span></li>
          <li><span className="label">Highest</span><span className="value">€{maxPrice}</span></li>
          <li><span className="label">Average</span><span className="value">€{avgPrice}</span></li>
          <li><span className="label">Median</span><span className="value">€{medianPrice}</span></li>
        </ul>
      </div>

      {/* Plans per carrier */}
      <div className="insight-card">
        <p className="insight-title">Plans per Carrier</p>
        <ul className="insight-list">
          {carrierCounts.map(([carrier, count]) => (
            <li key={carrier}>
              <span className="label">{carrier}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} /></div>
              <span className="value">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Market coverage */}
      <div className="insight-card">
        <p className="insight-title">Market Coverage</p>
        <ul className="insight-list">
          <li><span className="label">Unlimited data plans</span><span className="value">{unlimitedCount} / {plans.length}</span></li>
          <li><span className="label">5G plans</span><span className="value">{fiveGCount} / {plans.length}</span></li>
          <li><span className="label">With EU roaming</span><span className="value">{euRoamingCount} / {plans.length}</span></li>
          <li><span className="label">Active promotions</span><span className="value">{promoCount} / {plans.length}</span></li>
        </ul>
      </div>

      {/* Contract breakdown */}
      <div className="insight-card">
        <p className="insight-title">Contract Types</p>
        <ul className="insight-list">
          {Object.entries(byContract).map(([type, count]) => (
            <li key={type}>
              <span className="label">{type}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / plans.length) * 100}%` }} /></div>
              <span className="value">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Cheapest per carrier */}
      <div className="insight-card" style={{ gridColumn: '1 / -1' }}>
        <p className="insight-title">Entry Price by Carrier</p>
        <ul className="insight-list">
          {cheapestList.map(({ carrier, price, plan }) => (
            <li key={carrier}>
              <span className="label"><strong>{carrier}</strong> — {plan}</span>
              <span className="value">€{price}/mo</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
