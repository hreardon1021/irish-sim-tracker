import { readFileSync, appendFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function formatPlan(plan) {
  const price = plan.promoPrice
    ? `~~€${plan.priceEur}~~ €${plan.promoPrice}${plan.promoNote ? ` (${plan.promoNote})` : ''}`
    : `€${plan.priceEur}`;
  return `${plan.carrierDisplay} — ${plan.name} | ${price}/mo | ${plan.dataDisplay} data | ${plan.contractType}`;
}

function buildSlackMessage(report) {
  const { added, removed, changed, timestamp } = report;
  const date = new Date(timestamp).toLocaleDateString('en-IE', { dateStyle: 'full' });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📱 Irish SIM Plan Changes Detected', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `*${date}*` }],
    },
  ];

  if (added.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🆕 New Plans (${added.length})*\n` + added.map((p) => `• ${formatPlan(p)}`).join('\n'),
      },
    });
  }

  if (removed.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*❌ Removed Plans (${removed.length})*\n` + removed.map((p) => `• ${formatPlan(p)}`).join('\n'),
      },
    });
  }

  if (changed.length > 0) {
    blocks.push({ type: 'divider' });
    const changedLines = changed.map(({ plan, diffs }) => {
      const diffStr = Object.entries(diffs)
        .map(([field, { from, to }]) => `${field}: ${from} → ${to}`)
        .join(', ');
      return `• ${plan.carrierDisplay} — ${plan.name}: ${diffStr}`;
    });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*✏️ Changed Plans (${changed.length})*\n` + changedLines.join('\n'),
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: '_Always confirm current pricing directly with carrier before switching_',
      },
    ],
  });

  return { blocks };
}

function buildMarkdownSummary(report) {
  const { added, removed, changed, timestamp } = report;
  const date = new Date(timestamp).toLocaleDateString('en-IE', { dateStyle: 'full' });

  const lines = [
    `## 📱 Irish SIM Plan Changes — ${date}`,
    '',
    `| Change Type | Count |`,
    `|---|---|`,
    `| 🆕 Added | ${added.length} |`,
    `| ❌ Removed | ${removed.length} |`,
    `| ✏️ Changed | ${changed.length} |`,
    '',
  ];

  if (added.length > 0) {
    lines.push('### New Plans');
    added.forEach((p) => lines.push(`- ${formatPlan(p)}`));
    lines.push('');
  }

  if (removed.length > 0) {
    lines.push('### Removed Plans');
    removed.forEach((p) => lines.push(`- ${formatPlan(p)}`));
    lines.push('');
  }

  if (changed.length > 0) {
    lines.push('### Changed Plans');
    changed.forEach(({ plan, diffs }) => {
      const diffStr = Object.entries(diffs)
        .map(([field, { from, to }]) => `\`${field}\`: ${from} → ${to}`)
        .join(', ');
      lines.push(`- **${plan.carrierDisplay} — ${plan.name}**: ${diffStr}`);
    });
    lines.push('');
  }

  lines.push('> _Always confirm current pricing directly with carrier before switching_');

  return lines.join('\n');
}

async function postToSlack(webhookUrl, message) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}: ${await response.text()}`);
  }
}

async function main() {
  const changesPath = join(DATA_DIR, 'latest-changes.json');

  if (!existsSync(changesPath)) {
    console.log('No changes file found — nothing to notify');
    process.exit(0);
  }

  const report = JSON.parse(readFileSync(changesPath, 'utf8'));

  if (!report.hasChanges && !process.env.FORCE_NOTIFY) {
    console.log('No changes to notify about');
    process.exit(0);
  }

  const markdownSummary = buildMarkdownSummary(report);

  // Write GitHub Step Summary
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary + '\n');
    console.log('Wrote GitHub Step Summary');
  } else {
    console.log('--- GitHub Step Summary ---');
    console.log(markdownSummary);
  }

  // Post to Slack
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const slackMessage = buildSlackMessage(report);
    await postToSlack(webhookUrl, slackMessage);
    console.log('Posted to Slack');
  } else {
    console.log('SLACK_WEBHOOK_URL not set — skipping Slack notification');
  }
}

main().catch((err) => {
  console.error('Notifier error:', err);
  process.exit(1);
});
