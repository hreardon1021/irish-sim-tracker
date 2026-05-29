import { useState, useCallback } from 'react';

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

const TYPE_ICON  = { price_drop: '↓', price_rise: '↑', new_plan: '+', removed: '×' };
const TYPE_LABEL = { price_drop: 'Price drop', price_rise: 'Price rise', new_plan: 'New plan', removed: 'Removed' };

const STORAGE_KEY = 'sim-tracker-dismissed-alerts';

function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
  catch { return new Set(); }
}

export default function AlertsBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(loadDismissed);
  const [collapsed, setCollapsed] = useState(false);

  const dismiss = useCallback((id) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  return (
    <div className="alerts-banner">
      {/* Header row */}
      <button className="alerts-banner-hdr" onClick={() => setCollapsed((c) => !c)}>
        <span className="alerts-banner-title">
          <span className="alerts-bell">🔔</span>
          Price Alerts
          <span className="alerts-count-pill">{visible.length}</span>
        </span>
        <span className="alerts-chevron">{collapsed ? '▾' : '▴'}</span>
      </button>

      {/* Alert rows */}
      {!collapsed && (
        <ul className="alerts-list">
          {visible.map((alert) => {
            const color = CARRIER_COLORS[alert.carrier] || '#888';
            const isDropped = alert.type === 'price_drop';
            const isRisen   = alert.type === 'price_rise';
            return (
              <li key={alert.id} className="alert-row">
                {/* Carrier dot */}
                <span className="alert-dot" style={{ background: color }} />

                {/* Body */}
                <div className="alert-body">
                  <span className="alert-carrier" style={{ color }}>{alert.carrierDisplay}</span>
                  <span className="alert-plan">{alert.planName}</span>

                  {/* Price change pill */}
                  {alert.oldPrice != null && alert.newPrice != null && (
                    <span className={`alert-price-change ${isDropped ? 'alert-drop' : isRisen ? 'alert-rise' : ''}`}>
                      {TYPE_ICON[alert.type]} €{alert.oldPrice} → €{alert.newPrice}/mo
                    </span>
                  )}
                  {alert.note && <span className="alert-note">{alert.note}</span>}
                </div>

                {/* Type badge */}
                <span className={`alert-type-badge alert-type-${alert.type}`}>
                  {TYPE_LABEL[alert.type] || alert.type}
                </span>

                {/* Dismiss */}
                <button className="alert-dismiss" onClick={() => dismiss(alert.id)} title="Dismiss">✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
