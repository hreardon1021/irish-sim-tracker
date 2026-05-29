import * as XLSX from 'xlsx';

/** Auto-size column widths based on content */
function autoWidth(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const widths = [];
  data.forEach((row) => {
    row.forEach((cell, i) => {
      const len = cell ? String(cell).length + 2 : 10;
      widths[i] = Math.max(widths[i] || 0, len);
    });
  });
  ws['!cols'] = widths.map((w) => ({ wch: Math.min(w, 55) }));
}

/**
 * Export plans (and optionally price history) to a dated .xlsx file.
 * @param {Array}  plans   - The plan objects to export (filtered or full)
 * @param {Array}  history - The full history array from history.json
 * @param {string} label   - Sheet name for the plans sheet (default 'Plans')
 */
export function exportPlansExcel(plans, history = [], label = 'Plans') {
  const wb = XLSX.utils.book_new();

  /* ── Sheet 1: Plans ──────────────────────────────────────── */
  const planRows = plans.map((p) => ({
    'Network':               p.carrierDisplay,
    'Plan Name':             p.name,
    'Acquisition Price (€)': p.promoPrice ?? p.priceEur,
    'Full Price (€)':        p.priceEur,
    'Promo Note':            p.promoNote || '',
    'Data':                  p.dataDisplay,
    'Minutes':               p.minutes,
    'SMS / Texts':           p.sms,
    '5G':                    p.is5G ? 'Yes' : 'No',
    'Unlimited Data':        p.isUnlimited ? 'Yes' : 'No',
    'Contract':              p.contractType,
    'EU Roaming':            p.roaming !== 'No roaming' ? 'Yes' : 'No',
    'Active Promo':          p.hasPromo ? 'Yes' : 'No',
    'URL':                   p.url,
  }));

  const wsPlans = XLSX.utils.json_to_sheet(planRows);
  autoWidth(wsPlans);
  XLSX.utils.book_append_sheet(wb, wsPlans, label);

  /* ── Sheet 2: Price History ──────────────────────────────── */
  const enriched = history.filter((h) => h.carrierPrices);
  if (enriched.length > 0) {
    const histRows = [...enriched].reverse().map((h) => ({
      'Date':              new Date(h.timestamp).toLocaleDateString('en-IE', { dateStyle: 'medium' }),
      'Plan Count':        h.planCount,
      'Vodafone (€)':      h.carrierPrices.vodafone      ?? '',
      'Three (€)':         h.carrierPrices.three          ?? '',
      'GoMo (€)':          h.carrierPrices.gomo           ?? '',
      'Clear Mobile (€)':  h.carrierPrices.clearmobile    ?? '',
      'Sky Mobile (€)':    h.carrierPrices.skymobile      ?? '',
      'Tesco Mobile (€)':  h.carrierPrices.tescomobile    ?? '',
      'Virgin Media (€)':  h.carrierPrices.virginmedia    ?? '',
    }));
    const wsHist = XLSX.utils.json_to_sheet(histRows);
    autoWidth(wsHist);
    XLSX.utils.book_append_sheet(wb, wsHist, 'Price History');
  }

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `irish-sim-tracker-${ts}.xlsx`);
}
