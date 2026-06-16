import { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { exportPlansExcel } from '../utils/exportExcel.js';
import html2canvas from 'html2canvas';

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

const CARRIER_DISPLAY = {
  vodafone:    'Vodafone',
  three:       'Three',
  gomo:        'GoMo',
  clearmobile: 'Clear Mobile',
  skymobile:   'Sky Mobile',
  tescomobile: 'Tesco Mobile',
  virginmedia: 'Virgin Media',
  eir:         'eir',
};

// Preferred row order (matching typical deck presentation)
const CARRIER_ORDER = ['three', 'vodafone', 'tescomobile', 'gomo', 'clearmobile', 'skymobile', 'eir'];

const eff = (p) => p.promoPrice ?? p.priceEur;

// ── Savings maths ─────────────────────────────────────────────
function getPromoMonths(plan) {
  if (!plan.promoNote) return 0;
  const m = plan.promoNote.match(/(\d+)\s*months?/i);
  return m ? parseInt(m[1]) : 0;
}

/**
 * Year 1 savings = what the customer pays in months 1–12 versus VM baseline.
 * If competitor has a timed promo we account for the promo period then standard price.
 */
function calcYear1(plan, vmPrice) {
  if (!plan.hasPromo) return (plan.priceEur - vmPrice) * 12;
  const pm = Math.min(getPromoMonths(plan) || 6, 12);
  const rm = 12 - pm;
  return (plan.promoPrice - vmPrice) * pm + (plan.priceEur - vmPrice) * rm;
}

/**
 * Year 2 cumulative = Year 1 savings + months 13–24 at competitor's standard price.
 */
function calcYear2(plan, vmPrice) {
  return calcYear1(plan, vmPrice) + (plan.priceEur - vmPrice) * 12;
}

function formatCostStr(plan) {
  if (!plan.hasPromo) return `€${plan.priceEur}/mo`;
  const pm = getPromoMonths(plan);
  if (pm > 0) return `€${plan.promoPrice}×${pm}m, €${plan.priceEur} after`;
  return `€${plan.promoPrice}/mo → €${plan.priceEur}`;
}

// ── Savings cell ──────────────────────────────────────────────
function SavingsCell({ value, plain }) {
  const rounded = Math.round(value);
  const isZero  = Math.abs(rounded) < 1;
  const isPos   = rounded > 0;
  const cls     = isZero ? 'savings-zero' : isPos ? 'savings-pos' : 'savings-neg';
  const label   = isZero ? '€0'
    : isPos ? `€${rounded}`
    : `−€${Math.abs(rounded)}`;
  if (plain) return label;
  return <td className={`deck-td deck-td-savings ${cls}`}>{label}</td>;
}

// ── Plain-text + HTML builders for clipboard ─────────────────
function buildClipboard(carriers, groups, vmPrice, vmLabel) {
  const cols = ['Provider', 'Plan', 'Included', 'Cost',
    `Savings vs VM ${vmLabel} (Yr 1)`,
    `Savings vs VM ${vmLabel} (Yr 2 Cumul.)`,
  ];

  // Tab-separated plain text
  const tsv = [cols.join('\t'),
    ...carriers.flatMap((c) =>
      groups[c].map((p) => [
        CARRIER_DISPLAY[c], p.name,
        `${p.dataDisplay} · ${p.minutes} mins · ${p.sms} texts`,
        formatCostStr(p),
        SavingsCell({ value: calcYear1(p, vmPrice), plain: true }),
        SavingsCell({ value: calcYear2(p, vmPrice), plain: true }),
      ].join('\t'))
    ),
  ].join('\n');

  // Rich HTML (pastes with colour into Word / PPT)
  const thStyle = 'background:#cc0000;color:#fff;padding:6px 10px;font-size:12px;text-align:left;white-space:nowrap;';
  const tdStyle = 'padding:5px 10px;font-size:12px;border-bottom:1px solid #e0e0e0;vertical-align:middle;';
  const posCls  = 'color:#16a34a;font-weight:700;';
  const negCls  = 'color:#dc2626;font-weight:700;';

  const rows = carriers.flatMap((c) => {
    const color = CARRIER_COLORS[c] || '#888';
    return groups[c].map((p, i) => {
      const y1 = Math.round(calcYear1(p, vmPrice));
      const y2 = Math.round(calcYear2(p, vmPrice));
      const fmtAmt = (v) => Math.abs(v) < 1 ? '€0' : v > 0 ? `€${v}` : `−€${Math.abs(v)}`;
      const carrierCell = i === 0
        ? `<td rowspan="${groups[c].length}" style="${tdStyle}border-left:4px solid ${color};font-weight:700;">${CARRIER_DISPLAY[c]}</td>`
        : '';
      return `<tr>
        ${carrierCell}
        <td style="${tdStyle}">${p.name}<br/><small style="color:#888">${p.contractType}</small></td>
        <td style="${tdStyle}">${p.dataDisplay} · ${p.minutes} · ${p.sms}</td>
        <td style="${tdStyle}">${formatCostStr(p)}</td>
        <td style="${tdStyle}${y1 >= 0 ? posCls : negCls}">${fmtAmt(y1)}</td>
        <td style="${tdStyle}${y2 >= 0 ? posCls : negCls}">${fmtAmt(y2)}</td>
      </tr>`;
    });
  }).join('');

  const html = `<table style="border-collapse:collapse;font-family:sans-serif;width:100%">
    <thead><tr>
      ${cols.map((h) => `<th style="${thStyle}">${h}</th>`).join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  return { tsv, html };
}

// ── Main component ────────────────────────────────────────────
export default function DeckView({ plans }) {
  const vmPlans = useMemo(
    () => plans.filter((p) => p.carrier === 'virginmedia').sort((a, b) => eff(a) - eff(b)),
    [plans]
  );

  const [vmIdx, setVmIdx]     = useState(0);
  const [copied, setCopied]   = useState(false);
  const [imaging, setImaging] = useState(false);
  const tableRef = useRef(null);

  const vmPlan  = vmPlans[vmIdx] ?? null;
  const vmPrice = vmPlan ? eff(vmPlan) : 15;
  const vmLabel = vmPlan ? `${vmPlan.name} (€${vmPrice}/mo)` : `€${vmPrice}/mo`;

  // Group competitors by carrier
  const groups = useMemo(() => {
    const g = {};
    plans
      .filter((p) => p.carrier !== 'virginmedia')
      .forEach((p) => { (g[p.carrier] = g[p.carrier] || []).push(p); });
    Object.values(g).forEach((arr) => arr.sort((a, b) => eff(a) - eff(b)));
    return g;
  }, [plans]);

  const carriers = [
    ...CARRIER_ORDER.filter((c) => groups[c]),
    ...Object.keys(groups).filter((c) => !CARRIER_ORDER.includes(c)),
  ];

  // ── Copy to clipboard ──────────────────────────────────────
  const handleCopy = () => {
    const { tsv, html } = buildClipboard(carriers, groups, vmPrice, vmLabel);

    const writeToClipboard = async () => {
      try {
        // Try rich HTML first (Word / PPT preserves colours)
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([tsv],  { type: 'text/plain' }),
          }),
        ]);
      } catch {
        // Fallback: plain text only
        await navigator.clipboard.writeText(tsv);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    };

    writeToClipboard().catch(() => {});
  };

  // ── Excel export ───────────────────────────────────────────
  const handleExcel = () => {
    // Build deck rows manually so column labels match the slide
    const rows = carriers.flatMap((c) =>
      groups[c].map((p) => ({
        'Provider':                       CARRIER_DISPLAY[c],
        'Plan':                           p.name,
        'Contract':                       p.contractType,
        'Data':                           p.dataDisplay,
        'Minutes':                        p.minutes,
        'SMS':                            p.sms,
        '5G':                             p.is5G ? 'Yes' : 'No',
        'Cost Structure':                 formatCostStr(p),
        'Acquisition Price (€)':          eff(p),
        'Standard Price (€)':             p.priceEur,
        [`Savings vs VM ${vmPlan?.name || 'plan'} Year 1 (€)`]:          Math.round(calcYear1(p, vmPrice)),
        [`Savings vs VM ${vmPlan?.name || 'plan'} Year 2 Cumulative (€)`]: Math.round(calcYear2(p, vmPrice)),
      }))
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // Auto-width columns
    const sheetData = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const widths = [];
    sheetData.forEach((r) => r.forEach((c, i) => {
      const l = c ? String(c).length + 2 : 10;
      widths[i] = Math.max(widths[i] || 0, l);
    }));
    ws['!cols'] = widths.map((w) => ({ wch: Math.min(w, 50) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Deck Comparison');
    XLSX.writeFile(wb, `vm-sim-deck-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Image export ───────────────────────────────────────────
  const handleImage = async () => {
    if (!tableRef.current) return;
    setImaging(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `vm-sim-deck-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setImaging(false);
    }
  };

  if (!plans.length) return null;

  return (
    <div className="deck-view">

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="deck-toolbar">
        <div className="deck-baseline">
          <span className="deck-baseline-label">VM baseline:</span>
          {vmPlans.length > 1 ? (
            <select
              className="sort-select"
              value={vmIdx}
              onChange={(e) => setVmIdx(Number(e.target.value))}
            >
              {vmPlans.map((p, i) => (
                <option key={i} value={i}>
                  {p.name} — €{eff(p)}/mo
                </option>
              ))}
            </select>
          ) : (
            <span className="deck-baseline-val">{vmLabel}</span>
          )}
        </div>
        <div className="deck-actions">
          <button className="export-btn deck-copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied!' : '📋 Copy for deck'}
          </button>
          <button className="export-btn" onClick={handleExcel}>
            ↓ Excel
          </button>
          <button className="export-btn" onClick={handleImage} disabled={imaging}>
            {imaging ? '...' : '↓ Image'}
          </button>
        </div>
      </div>

      {/* ── Main comparison table ─────────────────────── */}
      <div className="deck-table-wrap" ref={tableRef}>
        <table className="deck-table">
          <thead>
            <tr className="deck-thead-tr">
              <th className="deck-th">Provider</th>
              <th className="deck-th">Plan</th>
              <th className="deck-th deck-th-specs">Included</th>
              <th className="deck-th">Cost</th>
              <th className="deck-th deck-th-savings">
                Savings vs VM
                <span className="deck-th-sub">
                  {vmPlan?.name || 'plan'} · Year 1
                </span>
              </th>
              <th className="deck-th deck-th-savings">
                Savings vs VM
                <span className="deck-th-sub">
                  {vmPlan?.name || 'plan'} · Year 2 Cumulative
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {carriers.map((carrier) => {
              const color  = CARRIER_COLORS[carrier] || '#888';
              const cPlans = groups[carrier];

              return cPlans.map((plan, idx) => {
                const y1 = calcYear1(plan, vmPrice);
                const y2 = calcYear2(plan, vmPrice);

                return (
                  <tr
                    key={`${carrier}-${plan.name}`}
                    className={`deck-row${idx === 0 ? ' deck-row-first' : ' deck-row-cont'}`}
                  >
                    {idx === 0 && (
                      <td
                        className="deck-td deck-td-carrier"
                        rowSpan={cPlans.length}
                        style={{ borderLeft: `4px solid ${color}` }}
                      >
                        <span className="deck-carrier-dot" style={{ background: color }} />
                        <span className="deck-carrier-name">{CARRIER_DISPLAY[carrier]}</span>
                      </td>
                    )}

                    <td className="deck-td deck-td-plan">
                      <span className="deck-plan-name">{plan.name}</span>
                      <span className="deck-plan-contract">{plan.contractType}</span>
                    </td>

                    <td className="deck-td deck-td-specs">
                      <span className="deck-spec-item">{plan.dataDisplay} data</span>
                      <span className="deck-spec-sep">·</span>
                      <span className="deck-spec-item">{plan.minutes} mins</span>
                      <span className="deck-spec-sep">·</span>
                      <span className="deck-spec-item">{plan.sms} texts</span>
                      {plan.is5G && <span className="deck-5g-badge">5G</span>}
                      {plan.roaming !== 'No roaming' && (
                        <span className="deck-roam-badge">EU roaming</span>
                      )}
                    </td>

                    <td className="deck-td deck-td-cost">
                      {formatCostStr(plan)}
                    </td>

                    <SavingsCell value={y1} />
                    <SavingsCell value={y2} />
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* ── VM reference plans ───────────────────────── */}
      {vmPlans.length > 0 && (
        <div className="deck-vm-ref">
          <div className="deck-vm-ref-label">
            <span className="deck-vm-ref-dot" />
            Virgin Media SIM-Only Plans — click to change baseline
          </div>
          <div className="deck-vm-ref-row">
            {vmPlans.map((p, i) => (
              <div
                key={i}
                className={`deck-vm-card${i === vmIdx ? ' deck-vm-card-active' : ''}`}
                onClick={() => setVmIdx(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setVmIdx(i)}
              >
                <div className="deck-vm-card-name">{p.name}</div>
                <div className="deck-vm-card-price">€{eff(p)}<span>/mo</span></div>
                {p.hasPromo && (
                  <div className="deck-vm-card-after">→ €{p.priceEur} after promo</div>
                )}
                <div className="deck-vm-card-spec">{p.dataDisplay} · {p.contractType}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footnote ────────────────────────────────── */}
      <p className="deck-footnote">
        Savings = (competitor price − VM {vmPlan?.name || 'plan'} €{vmPrice}/mo) × months paid.
        Year 1 uses competitor's acquisition/intro price; Year 2 cumulative adds months 13–24 at competitor's standard price.
        Data sourced via automated scraping — confirm current pricing before using in presentations.
        <span className="deck-footnote-date"> Last scraped: {new Date().toLocaleDateString('en-IE', { dateStyle: 'medium' })}.</span>
      </p>
    </div>
  );
}
