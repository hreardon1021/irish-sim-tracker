import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

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

const BRAND_ICONS = {
  Apple:   '🍎',
  Samsung: '📱',
  Google:  '🔍',
};

// Carriers that bill the SIM plan as a SEPARATE monthly charge on top of the device payment.
// All other carriers quote an all-in monthly price (device + SIM combined).
const SKY_SIM_PROMO_ENDS = new Date('2026-06-04'); // promo €12.99 valid through June 3rd
const SIM_MONTHLY = {
  virginmedia: 15,                                          // €15/mo Customer Unlimited
  skymobile:   new Date() < SKY_SIM_PROMO_ENDS ? 12.99 : 15, // €12.99 promo → €15 from Jun 4
};

// Returns the effective COMBINED monthly price (device + SIM) used for sorting & comparison.
const effD = (d) => (d.promoPrice ?? d.monthlyPrice) + (SIM_MONTHLY[d.carrier] || 0);

// ── Multi-select dropdown (Device filter) ─────────────────────
function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasSelection = selected.size > 0;
  const btnLabel = hasSelection
    ? selected.size === 1 ? [...selected][0] : `${selected.size} devices`
    : 'All devices';

  const toggle = (name) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(next);
  };

  return (
    <div className="multidd-wrap" ref={wrapRef}>
      <button
        className={`multidd-btn${hasSelection ? ' multidd-btn-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="multidd-btn-label">{label}</span>
        <span className="multidd-btn-value">{btnLabel}</span>
        <span className="multidd-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="multidd-panel">
          {/* All option */}
          <label className={`multidd-option${!hasSelection ? ' multidd-option-checked' : ''}`}>
            <input type="checkbox" checked={!hasSelection} readOnly
              onChange={() => onChange(new Set())} />
            All devices
          </label>
          <div className="multidd-divider" />
          {options.map((opt) => (
            <label key={opt} className={`multidd-option${selected.has(opt) ? ' multidd-option-checked' : ''}`}>
              <input type="checkbox" checked={selected.has(opt)} readOnly
                onChange={() => toggle(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single device card ────────────────────────────────────────
function DeviceCard({ device, vmTotal }) {
  const color      = CARRIER_COLORS[device.carrier] || '#888';
  const isVM       = device.carrier === 'virginmedia';
  const simFee     = SIM_MONTHLY[device.carrier] || 0;  // separate SIM charge for this carrier
  const effPrice   = effD(device);                       // combined monthly (device + SIM)
  const isSkySplit = device.carrier === 'skymobile' && device.skyPhase2Monthly != null;

  // 24-month total always uses the real combined monthly cost
  const total24 = isSkySplit
    ? (device.monthlyPrice + simFee) * 12 + (device.skyPhase2Monthly + simFee) * 12 + (device.upfront || 0)
    : effPrice * device.contractMonths + (device.upfront || 0);

  // Positive = this deal costs more than VM; negative = cheaper than VM
  const vmDiff = (!isVM && vmTotal != null) ? total24 - vmTotal : null;

  return (
    <div className={`plan-card device-card${isVM ? ' device-card-vm' : ''}`}>
      {/* Carrier colour accent */}
      <div className="carrier-accent" style={{ background: color }} />

      {/* Header */}
      <div className="plan-card-header">
        <span className="carrier-chip" style={{ background: color, color: device.carrier === 'tescomobile' ? '#333' : '#fff' }}>
          {device.carrierDisplay}
        </span>
        {device.is5G && <span className="badge blue">5G</span>}
        {device.roaming !== 'No roaming' && <span className="badge green">EU roaming</span>}
      </div>

      {/* Device name */}
      <div className="device-name-row">
        <span className="device-brand-icon">{BRAND_ICONS[device.brand] || '📱'}</span>
        <div>
          <div className="device-name">{device.device}</div>
          <div className="device-storage">{device.storage} · {device.contractMonths}-month contract</div>
        </div>
      </div>

      {/* Price — Sky shows explicit 24-month split; everyone else shows single rate */}
      {isSkySplit ? (
        <div className="sky-split-pricing">
          <div className="sky-split-heading">24-month pricing breakdown</div>
          <div className="sky-split-row">
            <span className="sky-split-period">Months 1–12</span>
            <span className="sky-split-price">€{(device.monthlyPrice + simFee).toFixed(2)}<span className="sky-split-unit">/mo</span></span>
          </div>
          <div className="sky-split-row sky-split-row-phase2">
            <span className="sky-split-period">Months 13–24</span>
            <span className="sky-split-price">€{(device.skyPhase2Monthly + simFee).toFixed(2)}<span className="sky-split-unit">/mo</span></span>
          </div>
        </div>
      ) : (
        <div className="plan-price-row">
          <span className="plan-price" style={isVM ? { color: '#cc0000' } : undefined}>
            €{effPrice.toFixed(2)}
          </span>
          <span className="plan-price-period">/mo</span>
          {device.hasPromo && (
            <span className="plan-promo-price">€{(device.monthlyPrice + simFee).toFixed(2)}</span>
          )}
        </div>
      )}
      {device.hasPromo && device.promoNote && (
        <div className="plan-promo-note">{device.promoNote}</div>
      )}
      {simFee > 0 && (
        <div className="device-sim-breakdown">
          €{(effPrice - simFee).toFixed(0)} device + €{simFee} SIM plan/mo
        </div>
      )}

      {/* Upfront */}
      <div className={`device-upfront${!device.upfront ? ' device-upfront-free' : ''}`}>
        {device.upfront > 0 ? `+ €${device.upfront} upfront` : '✓ Free upfront'}
      </div>

      {/* Info specs */}
      <div className="device-info-specs">
        <div className="device-spec-row">
          <span className="device-spec-label">SIM Plan</span>
          <span className="device-spec-value">{device.planName || device.planData}</span>
        </div>
        <div className="device-spec-row">
          <span className="device-spec-label">Availability</span>
          <span className={device.inStock !== false ? 'device-stock-in' : 'device-stock-out'}>
            {device.inStock !== false ? '✓ In Stock' : '✗ Out of Stock'}
          </span>
        </div>
        <div className="device-spec-row">
          <span className="device-spec-label">SIM + Device / mo</span>
          <span className="device-spec-value">€{effPrice.toFixed(2)}</span>
        </div>
        <div className="device-spec-row">
          <span className="device-spec-label">vs Virgin Media</span>
          {isVM ? (
            <span className="device-vs-vm-baseline">VM Baseline</span>
          ) : vmDiff === null ? (
            <span className="device-vs-vm-baseline">No VM deal</span>
          ) : vmDiff < -0.49 ? (
            <span className="device-vs-vm-less">€{Math.abs(vmDiff).toFixed(0)} cheaper (24mo)</span>
          ) : vmDiff > 0.49 ? (
            <span className="device-vs-vm-more">€{vmDiff.toFixed(0)} more (24mo)</span>
          ) : (
            <span className="device-vs-vm-same">Same as VM</span>
          )}
        </div>
      </div>

      {/* Extras */}
      {device.extras && (
        <div className="device-extras">{device.extras}</div>
      )}

      {/* Link */}
      <a
        href={device.url}
        target="_blank"
        rel="noopener noreferrer"
        className="plan-card-link"
      >View deal ↗</a>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────
export default function DevicesView({ devices }) {
  const [filterBrand,   setFilterBrand]   = useState('All');
  const [filterDevices, setFilterDevices] = useState(new Set());
  const [filterCarrier, setFilterCarrier] = useState('All');
  const [filterStorage, setFilterStorage] = useState('All');
  const [sort, setSort] = useState('price-asc');

  const toggleDevice = useCallback((name) => {
    setFilterDevices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  // Unique option lists
  const brands   = useMemo(() => [...new Set(devices.map((d) => d.brand))],   [devices]);
  const devNames = useMemo(() => {
    const base = filterBrand === 'All' ? devices : devices.filter((d) => d.brand === filterBrand);
    return [...new Set(base.map((d) => d.device))];
  }, [devices, filterBrand]);
  const carriers = useMemo(() => [...new Set(devices.map((d) => d.carrierDisplay))], [devices]);
  const storages = useMemo(() => [...new Set(devices.map((d) => d.storage))],  [devices]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let r = [...devices];
    if (filterBrand        !== 'All') r = r.filter((d) => d.brand          === filterBrand);
    if (filterDevices.size > 0)       r = r.filter((d) => filterDevices.has(d.device));
    if (filterCarrier      !== 'All') r = r.filter((d) => d.carrierDisplay === filterCarrier);
    if (filterStorage      !== 'All') r = r.filter((d) => d.storage        === filterStorage);

    r.sort((a, b) => {
      switch (sort) {
        case 'price-asc':   return effD(a) - effD(b);
        case 'price-desc':  return effD(b) - effD(a);
        case 'carrier-asc': return a.carrierDisplay.localeCompare(b.carrierDisplay);
        case 'device-asc':  return a.device.localeCompare(b.device);
        default: return 0;
      }
    });
    return r;
  }, [devices, filterBrand, filterDevices, filterCarrier, filterStorage, sort]);

  // Best price per device model for badge
  const bestByDevice = useMemo(() => {
    const map = {};
    devices.forEach((d) => {
      const key = `${d.device}|${d.storage}`;
      if (map[key] == null || effD(d) < map[key]) map[key] = effD(d);
    });
    return map;
  }, [devices]);

  // 24-month total for Virgin Media (combined: device + SIM), keyed by device|storage
  const vmTotalMap = useMemo(() => {
    const map = {};
    devices
      .filter((d) => d.carrier === 'virginmedia')
      .forEach((d) => {
        const key = `${d.device}|${d.storage}`;
        // effD already includes the VM SIM fee so this is the true 24-month cost
        const total = effD(d) * d.contractMonths + (d.upfront || 0);
        if (map[key] == null || total < map[key]) map[key] = total;
      });
    return map;
  }, [devices]);

  const hasFilters = filterBrand !== 'All' || filterDevices.size > 0
    || filterCarrier !== 'All' || filterStorage !== 'All';

  const clearAll = () => {
    setFilterBrand('All');
    setFilterDevices(new Set());
    setFilterCarrier('All');
    setFilterStorage('All');
  };

  if (!devices.length) {
    return (
      <div className="chart-empty">
        No device data found. Update <code>data/devices.json</code> with current carrier prices.
      </div>
    );
  }

  return (
    <div className="devices-view">

      {/* ── Filter dropdown bar ──────────────────────── */}
      <div className="filter-dropdown-bar">

        {/* Brand */}
        <div className="filter-dd-group">
          <span className="filter-dd-label">Brand</span>
          <select
            className={`filter-select${filterBrand !== 'All' ? ' filter-select-active' : ''}`}
            value={filterBrand}
            onChange={(e) => { setFilterBrand(e.target.value); setFilterDevices(new Set()); }}
          >
            <option value="All">All brands</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Device — multi-select */}
        <div className="filter-dd-group">
          <span className="filter-dd-label">Device</span>
          <MultiSelectDropdown
            label=""
            options={devNames}
            selected={filterDevices}
            onChange={setFilterDevices}
          />
        </div>

        {/* Carrier */}
        <div className="filter-dd-group">
          <span className="filter-dd-label">Carrier</span>
          <select
            className={`filter-select${filterCarrier !== 'All' ? ' filter-select-active' : ''}`}
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
          >
            <option value="All">All carriers</option>
            {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Storage */}
        <div className="filter-dd-group">
          <span className="filter-dd-label">Storage</span>
          <select
            className={`filter-select${filterStorage !== 'All' ? ' filter-select-active' : ''}`}
            value={filterStorage}
            onChange={(e) => setFilterStorage(e.target.value)}
          >
            <option value="All">All storage</option>
            {storages.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button className="filter-dd-clear" onClick={clearAll}>✕ Clear</button>
        )}
      </div>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="result-count">
            {filtered.length} device deal{filtered.length !== 1 ? 's' : ''}
            {hasFilters ? ` (filtered from ${devices.length})` : ''}
          </span>
        </div>
        <div className="toolbar-right">
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="carrier-asc">Carrier: A–Z</option>
            <option value="device-asc">Device: A–Z</option>
          </select>
        </div>
      </div>

      {/* ── Cards grid ──────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="empty-state">No devices match your filters.</div>
      ) : (
        <div className="plan-grid">
          {filtered.map((d, i) => (
            <DeviceCard
              key={`${d.carrier}-${d.device}-${d.storage}-${i}`}
              device={d}
              bestPrice={bestByDevice[`${d.device}|${d.storage}`]}
              vmTotal={vmTotalMap[`${d.device}|${d.storage}`]}
            />
          ))}
        </div>
      )}

    </div>
  );
}
