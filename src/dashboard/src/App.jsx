import { useState, useEffect, useMemo } from 'react';
import './App.css';
import MetricCards from './components/MetricCards.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import PlanCard from './components/PlanCard.jsx';
import ComparisonTable from './components/ComparisonTable.jsx';
import MarketInsights from './components/MarketInsights.jsx';
import AcquisitionCharts from './components/AcquisitionCharts.jsx';
import PriceHistoryChart from './components/PriceHistoryChart.jsx';
import DeckView from './components/DeckView.jsx';
import SummaryView from './components/SummaryView.jsx';
import DevicesView from './components/DevicesView.jsx';
import DeviceDeckView from './components/DeviceDeckView.jsx';
import ThemeSwitcher from './components/ThemeSwitcher.jsx';
import { exportPlansExcel } from './utils/exportExcel.js';

const DEFAULT_FILTERS = {
  network: [],
  contract: [],
  data: [],
  calls: [],
  offers: [],
  price: [],
};

const SORT_OPTIONS = [
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'data-desc', label: 'Data: High to Low' },
  { value: 'network-asc', label: 'Network: A–Z' },
  { value: 'contract-asc', label: 'Contract Length' },
];

const VIEWS = ['Summary', 'Cards', 'Table', 'Insights', 'Charts', 'Deck', 'Devices', 'Dev.Deck'];

const TIME_RANGES = [
  { value: 'week',    label: 'Wk',  days: 7  },
  { value: 'month',   label: 'Mo',  days: 30 },
  { value: 'quarter', label: 'Qtr', days: 90 },
  { value: 'all',     label: 'All', days: null },
];

export default function App() {
  const [plans, setPlans] = useState([]);
  const [history, setHistory] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState('price-asc');
  const [view, setView] = useState('Summary');
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('sim-tracker-theme') || 'default'
  );
  const [timeRange, setTimeRange] = useState('all');

  // Apply theme to <html> and persist
  useEffect(() => {
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('sim-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;

    fetch(`${base}data/plans.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });

    fetch(`${base}data/history.json`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data);
        if (data.length > 0) setLastUpdated(data[0].timestamp);
      })
      .catch(() => {});

    fetch(`${base}data/devices.json`)
      .then((r) => r.json())
      .then((data) => setDevices(data))
      .catch(() => {});
  }, []);

  // Filter history to the selected time window (used by all chart components)
  const filteredHistory = useMemo(() => {
    const range = TIME_RANGES.find((r) => r.value === timeRange);
    if (!range || !range.days) return history;
    const cutoff = new Date(Date.now() - range.days * 864e5);
    return history.filter((h) => new Date(h.timestamp) >= cutoff);
  }, [history, timeRange]);

  const filtered = useMemo(() => {
    let result = [...plans];

    if (filters.network.length > 0) {
      result = result.filter((p) => filters.network.includes(p.carrier));
    }
    if (filters.contract.length > 0) {
      result = result.filter((p) => filters.contract.includes(p.contractType));
    }
    if (filters.data.length > 0) {
      result = result.filter((p) => {
        if (filters.data.includes('unlimited') && p.isUnlimited) return true;
        if (filters.data.includes('capped') && !p.isUnlimited) return true;
        return false;
      });
    }
    if (filters.calls.length > 0) {
      result = result.filter((p) => {
        if (filters.calls.includes('unlimited') && p.unlimitedCalls) return true;
        return false;
      });
    }
    if (filters.offers.length > 0) {
      result = result.filter((p) =>
        filters.offers.some((offer) => {
          if (offer === 'hasPromo') return p.hasPromo;
          if (offer === 'freeMonth') return p.freeMonth;
          if (offer === 'forLife') return p.forLife;
          if (offer === 'euRoaming') return p.roaming && p.roaming !== 'No roaming';
          return false;
        })
      );
    }
    if (filters.price.length > 0) {
      result = result.filter((p) => {
        const effective = p.promoPrice ?? p.priceEur;
        return filters.price.some((filter) => {
          if (filter === 'under13') return effective < 13;
          if (filter === 'under15') return effective < 15;
          if (filter === 'under20') return effective < 20;
          if (filter === '5gOnly') return p.is5G;
          return false;
        });
      });
    }

    result.sort((a, b) => {
      const aEff = a.promoPrice ?? a.priceEur;
      const bEff = b.promoPrice ?? b.priceEur;
      const aData = a.dataGB === 9999 ? Infinity : a.dataGB;
      const bData = b.dataGB === 9999 ? Infinity : b.dataGB;
      const contractOrder = { '30-day rolling': 0, '12-month': 1, '24-month': 2 };

      switch (sort) {
        case 'price-asc': return aEff - bEff;
        case 'data-desc': return bData - aData;
        case 'network-asc': return a.carrierDisplay.localeCompare(b.carrierDisplay);
        case 'contract-asc': return (contractOrder[a.contractType] ?? 0) - (contractOrder[b.contractType] ?? 0);
        default: return 0;
      }
    });

    return result;
  }, [plans, filters, sort]);

  // Best value = lowest effective price among all plans
  const bestValuePrice = useMemo(() => {
    if (plans.length === 0) return null;
    return Math.min(...plans.map((p) => p.promoPrice ?? p.priceEur));
  }, [plans]);

  const metrics = useMemo(() => ({
    total: plans.length,
    lowestPrice: bestValuePrice,
    unlimitedCount: plans.filter((p) => p.isUnlimited).length,
    activeOffers: plans.filter((p) => p.hasPromo).length,
  }), [plans, bestValuePrice]);

  const toggleFilter = (group, value) => {
    setFilters((prev) => {
      const current = prev[group];
      return {
        ...prev,
        [group]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const activeFilterCount = Object.values(filters).flat().length;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading plans…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <h2>Could not load plans</h2>
        <p>{error}</p>
        <p className="error-hint">Run <code>npm start</code> to populate data, then refresh.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div>
            <h1>📱 Irish SIM Tracker</h1>
            <p className="header-subtitle">SIM-only bill pay plans across 7 Irish networks</p>
          </div>
          <div className="header-right">
            {lastUpdated && (
              <p className="last-updated">
                Updated {new Date(lastUpdated).toLocaleDateString('en-IE', { dateStyle: 'medium' })}
              </p>
            )}
            <ThemeSwitcher theme={theme} setTheme={setThemeState} />
          </div>
        </div>
      </header>

      <main className="app-main">
        <MetricCards metrics={metrics} />

        <FilterPanel
          filters={filters}
          onToggle={toggleFilter}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />

        <div className="toolbar">
          <div className="toolbar-left">
            <p className="result-count">
              {view === 'Devices'
                ? `${devices.length} device deal${devices.length !== 1 ? 's' : ''}`
                : view === 'Dev.Deck'
                ? `${devices.length} device entries · ${[...new Set(devices.map(d => d.device))].length} models`
                : view === 'Deck'
                ? `${plans.length} plans · ${plans.filter(p => p.carrier !== 'virginmedia').length} competitors`
                : `${filtered.length} plan${filtered.length !== 1 ? 's' : ''}${activeFilterCount > 0 ? ` (filtered from ${plans.length})` : ''}`
              }
            </p>
            <div className="time-range-tabs" title="Filter price history charts by time window">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  className={`time-tab${timeRange === r.value ? ' active' : ''}`}
                  onClick={() => setTimeRange(r.value)}
                  title={`History: last ${r.label}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="toolbar-right">
            <div className="view-tabs">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  className={`view-tab${view === v ? ' active' : ''}`}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <select
              className="sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort plans"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              className="export-btn"
              onClick={() => exportPlansExcel(
                view === 'Charts' ? plans : filtered,
                history,
                view === 'Charts' ? 'All Plans' : `${view} (${filtered.length})`
              )}
              title="Download current data as Excel"
            >
              ↓ Excel
            </button>
          </div>
        </div>

        {view === 'Cards' && (
          <>
            {/* Price history line chart — grows as scraper runs daily */}
            <section className="chart-section cards-history-section">
              <div className="chart-section-hdr">
                <h2 className="chart-section-title">📈 Entry Price History — All Carriers</h2>
                <p className="chart-section-sub">
                  Cheapest acquisition price per carrier over time · VM shown bold · hover for detail
                </p>
              </div>
              <PriceHistoryChart history={filteredHistory} />
            </section>

            {/* Plan cards grid */}
            <div className="plan-grid">
              {filtered.length === 0 ? (
                <div className="empty-state">No plans match your filters.</div>
              ) : (
                filtered.map((plan, i) => (
                  <PlanCard
                    key={`${plan.carrier}-${plan.name}-${i}`}
                    plan={plan}
                    isBestValue={(plan.promoPrice ?? plan.priceEur) === bestValuePrice}
                  />
                ))
              )}
            </div>
          </>
        )}

        {view === 'Table' && (
          <ComparisonTable plans={filtered} bestValuePrice={bestValuePrice} />
        )}

        {view === 'Insights' && (
          <MarketInsights plans={plans} filtered={filtered} />
        )}

        {view === 'Summary' && (
          <SummaryView plans={plans} />
        )}

        {view === 'Charts' && (
          <AcquisitionCharts plans={plans} history={filteredHistory} />
        )}

        {view === 'Deck' && (
          <DeckView plans={plans} />
        )}

        {view === 'Devices' && (
          <DevicesView devices={devices} />
        )}

        {view === 'Dev.Deck' && (
          <DeviceDeckView devices={devices} />
        )}
      </main>

      <footer className="app-footer">
        <p>Always confirm current pricing directly with carrier before switching.</p>
        <p className="footer-small">Data sourced via automated scraping — may not reflect real-time availability.</p>
      </footer>
    </div>
  );
}
