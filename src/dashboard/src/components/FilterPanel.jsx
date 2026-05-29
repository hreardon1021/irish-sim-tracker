import { useState, useMemo } from 'react';

const NETWORK_OPTIONS = [
  { value: 'vodafone',    label: 'Vodafone' },
  { value: 'three',       label: 'Three' },
  { value: 'gomo',        label: 'GoMo' },
  { value: 'clearmobile', label: 'Clear Mobile' },
  { value: 'skymobile',   label: 'Sky Mobile' },
  { value: 'tescomobile', label: 'Tesco Mobile' },
  { value: 'virginmedia', label: 'Virgin Media' },
  { value: 'eir',         label: 'eir' },
];

const CONTRACT_OPTIONS = [
  { value: '30-day rolling', label: '30-day' },
  { value: '12-month',       label: '12-month' },
  { value: '24-month',       label: '24-month' },
];

const DATA_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited' },
  { value: 'capped',    label: 'Capped' },
];

const CALLS_OPTIONS = [
  { value: 'unlimited', label: 'Unlimited calls' },
];

const OFFER_OPTIONS = [
  { value: 'hasPromo',  label: 'Promo price' },
  { value: 'freeMonth', label: 'Free month' },
  { value: 'forLife',   label: 'For life' },
  { value: 'euRoaming', label: 'EU roaming' },
];

const PRICE_OPTIONS = [
  { value: 'under13', label: 'Under €13' },
  { value: 'under15', label: 'Under €15' },
  { value: 'under20', label: 'Under €20' },
  { value: '5gOnly',  label: '5G only' },
];

const GROUPS = [
  { key: 'network',  label: 'Network',  options: NETWORK_OPTIONS },
  { key: 'contract', label: 'Contract', options: CONTRACT_OPTIONS },
  { key: 'data',     label: 'Data',     options: DATA_OPTIONS },
  { key: 'calls',    label: 'Calls',    options: CALLS_OPTIONS },
  { key: 'offers',   label: 'Offers',   options: OFFER_OPTIONS },
  { key: 'price',    label: 'Price',    options: PRICE_OPTIONS },
];

function ChipGroup({ options, active, onToggle, group }) {
  return (
    <div className="filter-chips">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`chip${active.includes(opt.value) ? ' active' : ''}`}
          data-carrier={group === 'network' ? opt.value : undefined}
          onClick={() => onToggle(group, opt.value)}
          aria-pressed={active.includes(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function FilterPanel({ filters, onToggle, onClear, activeCount }) {
  const [open, setOpen] = useState(false);

  // Build flat list of active filter labels for the summary pills
  const activeLabels = useMemo(() => {
    const labels = [];
    GROUPS.forEach(({ key, options }) => {
      filters[key].forEach((val) => {
        const opt = options.find((o) => o.value === val);
        if (opt) labels.push({ key, value: val, label: opt.label });
      });
    });
    return labels;
  }, [filters]);

  return (
    <div className={`filter-panel${open ? ' filter-panel-open' : ''}`}>

      {/* ── Always-visible summary bar ─────────────────────── */}
      <div
        className="filter-summary"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Toggle filters"
      >
        <div className="filter-summary-left">
          <span className="filter-title">
            Filters
            {activeCount > 0 && (
              <span className="filter-badge">{activeCount}</span>
            )}
          </span>

          {/* Active pills visible when collapsed */}
          {!open && activeLabels.length > 0 && (
            <div className="filter-active-pills">
              {activeLabels.map(({ key, value, label }) => (
                <span
                  key={`${key}-${value}`}
                  className="filter-active-pill"
                  data-carrier={key === 'network' ? value : undefined}
                >
                  {label}
                  <button
                    className="filter-pill-remove"
                    onClick={(e) => { e.stopPropagation(); onToggle(key, value); }}
                    aria-label={`Remove ${label} filter`}
                  >×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="filter-summary-right">
          {activeCount > 0 && (
            <button
              className="clear-btn"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            >Clear all</button>
          )}
          <svg
            className={`filter-chevron-icon${open ? ' open' : ''}`}
            width="14" height="14" viewBox="0 0 14 14"
            fill="none" aria-hidden="true"
          >
            <path d="M2 4.5L7 9.5L12 4.5"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* ── Expanded filter groups ─────────────────────────── */}
      {open && (
        <div className="filter-groups">
          {GROUPS.map(({ key, label, options }) => (
            <div key={key} className="filter-group">
              <span className="filter-group-label">{label}</span>
              <ChipGroup
                options={options}
                active={filters[key]}
                onToggle={onToggle}
                group={key}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
