import { useState, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

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

// VM always first, then in this order
const CARRIER_ORDER = ['virginmedia', 'three', 'vodafone', 'tescomobile', 'skymobile', 'eir', 'gomo', 'clearmobile'];

// Effective monthly price: afterDiscount → promoPrice → monthlyPrice
const effD = (d) => d.afterDiscount ?? d.promoPrice ?? d.monthlyPrice;

// VM savings = total competitor cost − total VM cost over contract
// Positive → competitor is more expensive → VM customers save (green)
// Negative → competitor is cheaper → VM is more expensive (red)
function calcVMSavings(device, vmRef) {
  if (!vmRef) return null;
  const compEff  = effD(device);
  const compTotal = compEff * device.contractMonths + device.upfront;
  const vmTotal   = vmRef.monthly * vmRef.months + vmRef.upfront;
  return compTotal - vmTotal;
}

// ── Savings cell ─────────────────────────────────────────────
function SavingsCell({ value }) {
  if (value === null) {
    return (
      <td className="deck-td deck-td-savings sum-muted" style={{ textAlign: 'center', opacity: 0.5 }}>
        —
      </td>
    );
  }
  const rounded = Math.round(value);
  const isZero  = Math.abs(rounded) < 1;
  const isPos   = rounded > 0;
  const cls     = isZero ? 'savings-zero' : isPos ? 'savings-pos' : 'savings-neg';
  const label   = isZero ? '€0' : isPos ? `€${rounded}` : `−€${Math.abs(rounded)}`;
  return <td className={`deck-td deck-td-savings ${cls}`}>{label}</td>;
}

// ── Root ─────────────────────────────────────────────────────
export default function DeviceDeckView({ devices }) {
  const [filterBrand,   setFilterBrand]   = useState('All');
  // Multi-select: empty Set = show all
  const [filterDevices, setFilterDevices] = useState(new Set());
  const [copied, setCopied]   = useState(false);
  const [imaging, setImaging] = useState(false);
  const deckRef = useRef(null);

  const brands   = useMemo(() => ['All', ...new Set(devices.map((d) => d.brand))], [devices]);
  const devNames = useMemo(() => {
    const src = filterBrand === 'All' ? devices : devices.filter((d) => d.brand === filterBrand);
    return [...new Set(src.map((d) => d.device))];
  }, [devices, filterBrand]);

  // Toggle a device name in/out of the selection set
  const toggleDevice = useCallback((name) => {
    setFilterDevices((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  // Filtered set
  const filtered = useMemo(() =>
    devices
      .filter((d) => filterBrand       === 'All' || d.brand  === filterBrand)
      .filter((d) => filterDevices.size === 0     || filterDevices.has(d.device)),
    [devices, filterBrand, filterDevices]
  );

  // VM reference: best (cheapest effective) VM price per device|storage
  const vmRefMap = useMemo(() => {
    const map = {};
    filtered.filter((d) => d.carrier === 'virginmedia').forEach((d) => {
      const key = `${d.device}|${d.storage}`;
      const eff = effD(d);
      if (!map[key] || eff < map[key].monthly) {
        map[key] = { monthly: eff, months: d.contractMonths, upfront: d.upfront };
      }
    });
    return map;
  }, [filtered]);

  // Group by carrier in display order
  const carrierGroups = useMemo(() => {
    const g = {};
    filtered.forEach((d) => { (g[d.carrier] = g[d.carrier] || []).push(d); });
    return Object.keys(g)
      .sort((a, b) => {
        const ai = CARRIER_ORDER.indexOf(a);
        const bi = CARRIER_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map((c) => ({ carrier: c, devs: g[c] }));
  }, [filtered]);

  // Title: "Mobile Devices — VM from €XX/mo"
  const vmMinPrice = useMemo(() => {
    const vmDevs = filtered.filter((d) => d.carrier === 'virginmedia');
    return vmDevs.length ? Math.min(...vmDevs.map(effD)) : null;
  }, [filtered]);

  // ── Excel export ─────────────────────────────────────────
  const handleExcel = () => {
    const rows = [];
    carrierGroups.forEach(({ carrier, devs }) => {
      devs.forEach((d) => {
        const isVM = carrier === 'virginmedia';
        const vmRef = vmRefMap[`${d.device}|${d.storage}`];
        const savings = isVM || !vmRef ? '' : Math.round(calcVMSavings(d, vmRef));
        rows.push({
          'Carrier':               d.carrierDisplay,
          'Device':                d.device,
          'Storage':               d.storage,
          'Plan Included':         d.planName || '',
          'Upfront (€)':           d.upfront,
          'Monthly (€)':           d.monthlyPrice.toFixed(2),
          'After Discount (€)':    d.afterDiscount != null ? d.afterDiscount.toFixed(2) : d.monthlyPrice.toFixed(2),
          'Contract (months)':     d.contractMonths,
          '5G':                    d.is5G ? 'Yes' : 'No',
          'EU Roaming':            d.roaming !== 'No roaming' ? 'Yes' : 'No',
          'VM Customers Savings (€)': savings,
          'Extras':                d.extras || '',
        });
      });
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const widths = [];
    data.forEach((r) => r.forEach((c, i) => {
      const l = c ? String(c).length + 2 : 10;
      widths[i] = Math.max(widths[i] || 0, l);
    }));
    ws['!cols'] = widths.map((w) => ({ wch: Math.min(w, 55) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Device Deck');
    XLSX.writeFile(wb, `vm-device-deck-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Copy TSV ─────────────────────────────────────────────
  const handleCopy = () => {
    const cols = ['Carrier', 'Device', 'Storage', 'Plan', 'Upfront (€)', 'Monthly (€)',
      'After Discount (€)', 'Contract', 'VM Customers (€)', 'Extras'];
    const rows = carrierGroups.flatMap(({ carrier, devs }) =>
      devs.map((d) => {
        const isVM  = carrier === 'virginmedia';
        const vmRef = vmRefMap[`${d.device}|${d.storage}`];
        const savings = isVM || !vmRef ? 'Baseline'
          : `€${Math.round(calcVMSavings(d, vmRef))}`;
        return [
          d.carrierDisplay, d.device, d.storage,
          d.planName || '', d.upfront,
          d.monthlyPrice.toFixed(2),
          (d.afterDiscount ?? d.monthlyPrice).toFixed(2),
          `${d.contractMonths}m`, savings, d.extras || '',
        ].join('\t');
      })
    );
    navigator.clipboard.writeText([cols.join('\t'), ...rows].join('\n'))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
      .catch(() => {});
  };

  const handleImage = async () => {
    if (!deckRef.current) return;
    setImaging(true);
    try {
      const canvas = await html2canvas(deckRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `vm-device-deck-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setImaging(false);
    }
  };

  if (!devices.length) {
    return (
      <div className="chart-empty">
        No device data. Update <code>data/devices.json</code> with current pricing.
      </div>
    );
  }

  return (
    <div className="deck-view" ref={deckRef}>

      {/* Toolbar */}
      <div className="deck-toolbar">
        <div className="deck-baseline">

          {/* Brand — single select */}
          <span className="deck-baseline-label">Brand:</span>
          <div className="filter-chips" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {brands.map((b) => (
              <button key={b}
                className={`chip${filterBrand === b ? ' active' : ''}`}
                onClick={() => { setFilterBrand(b); setFilterDevices(new Set()); }}>
                {b}
              </button>
            ))}
          </div>

          {/* Device — multi-select */}
          <span className="deck-baseline-label" style={{ marginLeft: '0.75rem' }}>Device:</span>
          <div className="filter-chips" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {/* "All" chip — active when nothing selected */}
            <button
              className={`chip${filterDevices.size === 0 ? ' active' : ''}`}
              onClick={() => setFilterDevices(new Set())}>
              All
            </button>
            {devNames.map((d) => (
              <button key={d}
                className={`chip${filterDevices.has(d) ? ' active' : ''}`}
                onClick={() => toggleDevice(d)}>
                {d}
              </button>
            ))}
          </div>

          {/* Multi-select count hint */}
          {filterDevices.size > 1 && (
            <span className="multiselect-hint" style={{ marginLeft: '0.5rem' }}>
              {filterDevices.size} selected
            </span>
          )}
        </div>

        <div className="deck-actions">
          <button className="export-btn deck-copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy for deck'}
          </button>
          <button className="export-btn" onClick={handleExcel}>↓ Excel</button>
          <button className="export-btn" onClick={handleImage} disabled={imaging}>
            {imaging ? '...' : '↓ Image'}
          </button>
        </div>
      </div>

      {/* Slide-style title */}
      <div className="devdeck-slide-title-row">
        <h2 className="devdeck-slide-title">
          Mobile Devices
          {vmMinPrice != null && (
            <span className="devdeck-slide-subtitle"> — VM from €{vmMinPrice.toFixed(0)}/mo</span>
          )}
        </h2>
      </div>

      {/* Main carrier-grouped table */}
      {carrierGroups.length === 0 ? (
        <div className="chart-empty">No devices match the selected filters.</div>
      ) : (
        <div className="sum-table-wrap">
          <table className="deck-table devdeck-carrier-table">
            <thead>
              <tr className="deck-thead-tr">
                <th className="deck-th">Device</th>
                <th className="deck-th">Plan Included</th>
                <th className="deck-th devdeck-th-right">Upfront</th>
                <th className="deck-th devdeck-th-right">Monthly</th>
                <th className="deck-th devdeck-th-right">After Discount</th>
                <th className="deck-th devdeck-th-center">Contract</th>
                <th className="deck-th deck-th-savings">VM Customers</th>
                <th className="deck-th">Extras</th>
              </tr>
            </thead>
            <tbody>
              {carrierGroups.map(({ carrier, devs }) => {
                const isVM    = carrier === 'virginmedia';
                const color   = CARRIER_COLORS[carrier] || '#888';
                const display = devs[0]?.carrierDisplay || carrier;

                return [
                  /* ── Carrier section header ── */
                  <tr key={`hdr-${carrier}`} className="devdeck-carrier-hdr-row">
                    <td colSpan={8} className="devdeck-carrier-hdr-cell"
                        style={{ borderLeft: `5px solid ${color}` }}>
                      <span className="deck-carrier-dot" style={{ background: color }} />
                      <span className="devdeck-carrier-hdr-name">{display}</span>
                      {isVM && <span className="sum-vm-pill">VM Baseline</span>}
                    </td>
                  </tr>,

                  /* ── Device rows ── */
                  ...devs.map((d) => {
                    const key        = `${d.device}|${d.storage}`;
                    const vmRef      = isVM ? null : vmRefMap[key];
                    const savings    = isVM ? null : calcVMSavings(d, vmRef);
                    const hasDisc    = d.afterDiscount != null && d.afterDiscount !== d.monthlyPrice;
                    const dispDisc   = d.afterDiscount ?? d.monthlyPrice;

                    return (
                      <tr key={`${carrier}-${d.device}-${d.storage}`}
                          className={`deck-row${isVM ? ' sum-row-vm' : ''}`}>

                        {/* Device */}
                        <td className="deck-td">
                          <div className="devdeck-row-device">{d.device}</div>
                          <div className="devdeck-row-storage">{d.storage}</div>
                        </td>

                        {/* Plan included */}
                        <td className="deck-td">
                          <span className="devdeck-plan-label">
                            {d.planName || `${d.planData} data · ${d.planMinutes} mins`}
                          </span>
                          {d.is5G && <span className="deck-5g-badge">5G</span>}
                          {d.roaming !== 'No roaming' && <span className="deck-roam-badge">EU</span>}
                        </td>

                        {/* Upfront */}
                        <td className="deck-td devdeck-td-right">
                          {d.upfront > 0
                            ? <strong>€{d.upfront}</strong>
                            : <span className="sum-muted">€0</span>}
                        </td>

                        {/* Monthly */}
                        <td className="deck-td devdeck-td-right">
                          <span className={isVM ? 'devdeck-vm-price' : ''}>
                            €{d.monthlyPrice.toFixed(2)}
                          </span>
                          {d.hasPromo && d.promoNote && (
                            <div className="sum-promo-note">{d.promoNote}</div>
                          )}
                        </td>

                        {/* After discount */}
                        <td className="deck-td devdeck-td-right">
                          {hasDisc
                            ? <strong className="devdeck-disc-price">€{dispDisc.toFixed(2)}</strong>
                            : <span className="sum-muted">€{dispDisc.toFixed(2)}</span>
                          }
                        </td>

                        {/* Contract */}
                        <td className="deck-td devdeck-td-center">
                          <span className="sum-contract">{d.contractMonths}m</span>
                        </td>

                        {/* VM Customers savings */}
                        {isVM
                          ? <td className="deck-td deck-td-savings sum-muted"
                                style={{ textAlign: 'center', opacity: 0.5 }}>—</td>
                          : <SavingsCell value={savings} />
                        }

                        {/* Extras */}
                        <td className="deck-td devdeck-extras-cell">
                          {d.extras
                            ? <span className="devdeck-extras-text">{d.extras}</span>
                            : <span className="sum-muted">—</span>}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footnote */}
      <p className="deck-footnote">
        VM Customers = (competitor After Discount × contract months + upfront) − (VM monthly × contract months + upfront).
        Positive (green) = competitor costs more, VM customers save. Negative (red) = competitor is cheaper.
        All prices are {devices[0]?.lastUpdated ?? 'current'} — verify with carriers before presentations.
      </p>
    </div>
  );
}
