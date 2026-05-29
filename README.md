# Irish SIM-Only Bill Pay Competitor Tracker

Tracks SIM-only bill pay plans from 7 Irish mobile networks daily and displays them in an interactive dashboard.

## Networks Tracked

| Carrier | URL | Network |
|---|---|---|
| Vodafone | https://www.vodafone.ie/sim-only | Vodafone |
| Three | https://www.three.ie/deals/sim-only.html | Three |
| GoMo | https://shop.gomo.ie/mobile-sim-only | Three |
| Clear Mobile | https://www.clearmobile.ie/ | Three |
| Sky Mobile | https://www.sky.com/ie/shop/mobile/plans/ | Vodafone |
| Tesco Mobile | https://www.tescomobile.ie/sim-only-plans | Three |
| Virgin Media Mobile | https://www.virginmedia.ie/mobile/sim-only/ | Three |

## How It Works

The scraper uses **Claude claude-opus-4-7 with the `web_search_20250305` built-in tool**. Claude visits each carrier's SIM-only page via Anthropic's server-side web search, bypassing bot-protection and JavaScript rendering, then returns structured JSON plan data.

## Setup

### Prerequisites
- Node.js 20+
- An Anthropic API key

### Install

```bash
# Clone and install
git clone <your-repo>
cd irish-sim-tracker
npm install
npm install --prefix src/dashboard
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook URL for change notifications |

Create a `.env` file or set these in your shell / GitHub Actions secrets.

## Usage

### Run the scraper (populates `data/plans.json`)
```bash
npm start
```

**Exit codes:**
- `0` — completed, no changes from previous run
- `1` — fatal error (no data written)
- `2` — completed, changes detected

### Send notifications (reads `data/latest-changes.json`)
```bash
npm run notify
```

### Run scraper + notify
```bash
npm run check
```

### Dashboard (development)
```bash
npm run dev
```
Starts Vite dev server at http://localhost:5173. Serves `data/` files via middleware — no copying needed.

### Dashboard (production build)
```bash
npm run build
```
Outputs to `dist/`. The `data/` directory must be served alongside the build (e.g., copy `data/` into `dist/data/` on deploy, or configure your web server to serve both).

## GitHub Actions

The workflow at `.github/workflows/daily-check.yml` runs daily at 08:00 Irish time.

### Required Secrets

Set these in your GitHub repository → Settings → Secrets and variables → Actions:

| Secret | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `SLACK_WEBHOOK_URL` | Slack webhook URL (optional) |

### Manual trigger

Go to Actions → Daily SIM Plan Check → Run workflow. You can check **Force notify** to send a Slack notification even if no changes were detected.

## Cost Estimate

Each daily run makes ~7 API calls (one per carrier) using claude-opus-4-7 with web search. Approximate cost: **€0.05–0.15 per daily run** depending on page complexity and response length. Monthly cost: ~€1.50–4.50.

## Data Files

| File | Description |
|---|---|
| `data/plans.json` | Current plan data (all carriers) |
| `data/latest-changes.json` | Change report from the most recent run |
| `data/history.json` | Last 90 run summaries |

## Dashboard Features

- **Plan Cards** — colour-coded by carrier, best-value badge on lowest effective price
- **Comparison Table** — strikethrough promo prices, sortable columns
- **Market Insights** — price stats, plans per carrier, contract type breakdown, entry price by carrier
- **Filters** — Network, Contract type, Data (unlimited/capped), Calls, Offers (promo/free month/for life/EU roaming), Price range
- **Sort** — Price low–high, Data high–low, Network A–Z, Contract length
- Light/dark mode via `prefers-color-scheme`

## Disclaimer

Always confirm current pricing directly with the carrier before switching. This tool is for informational purposes only.
