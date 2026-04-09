import { isTestnet, getBasescanUrl, getPredmarksUrl } from './chains';

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
  timestamp?: string;
  footer?: { text: string };
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

let warned = false;

async function sendDiscordWebhook(payload: DiscordWebhookPayload): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    if (!warned) {
      console.warn('[discord] DISCORD_WEBHOOK_URL not configured, skipping');
      warned = true;
    }
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[discord] Webhook failed (${res.status}):`, body.slice(0, 200));
    }
  } catch (err) {
    console.error('[discord] Failed to send notification:', err);
  }
}

function backofficeUrl(marketId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://backoffice.predmarks.com';
  return `${base}/dashboard/markets/${marketId}`;
}

function predmarksMarketUrl(chainId: number, onchainId: string): string {
  return `${getPredmarksUrl(chainId)}/mercados/${onchainId}`;
}

function linksField(marketId: string, chainId: number, onchainId?: string | null): { name: string; value: string } {
  const bo = `[Backoffice](${backofficeUrl(marketId)})`;
  const pm = onchainId ? ` · [Predmarks](${predmarksMarketUrl(chainId, onchainId)})` : '';
  return { name: 'Links', value: `${bo}${pm}` };
}

// --- Public notification functions ---

export async function notifyMarketDeployed(data: {
  marketId: string;
  title: string;
  onchainId: string;
  chainId: number;
}): Promise<void> {
  if (isTestnet(data.chainId)) return;

  await sendDiscordWebhook({
    embeds: [{
      title: '🟢 Mercado live',
      description: data.title,
      color: 0x00D26A,
      url: backofficeUrl(data.marketId),
      fields: [
        { name: 'Onchain ID', value: data.onchainId, inline: true },
        linksField(data.marketId, data.chainId, data.onchainId),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'predmarks backoffice' },
    }],
  });
}

export async function notifyMarketResolved(data: {
  marketId: string;
  title: string;
  outcome: string;
  chainId: number;
  onchainId?: string | null;
  confirmedBy?: string;
}): Promise<void> {
  if (isTestnet(data.chainId)) return;

  await sendDiscordWebhook({
    embeds: [{
      title: '🔵 Mercado resuelto',
      description: data.title,
      color: 0x5865F2,
      url: backofficeUrl(data.marketId),
      fields: [
        { name: 'Resultado', value: data.outcome, inline: true },
        ...(data.confirmedBy
          ? [{ name: 'Confirmado por', value: data.confirmedBy, inline: true }]
          : []),
        linksField(data.marketId, data.chainId, data.onchainId),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'predmarks backoffice' },
    }],
  });
}

export async function notifyLiquidityWithdrawn(data: {
  marketId: string;
  title: string;
  txHash?: string;
  amount?: string;
  chainId: number;
  onchainId?: string | null;
}): Promise<void> {
  if (isTestnet(data.chainId)) return;

  const basescanBase = getBasescanUrl(data.chainId);
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (data.amount) {
    const usdc = (Number(data.amount) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    fields.push({ name: 'Monto', value: `$${usdc} USDC`, inline: true });
  }
  if (data.txHash) {
    fields.push({ name: 'Tx', value: `[${data.txHash.slice(0, 14)}…](${basescanBase}/tx/${data.txHash})`, inline: true });
  }
  fields.push(linksField(data.marketId, data.chainId, data.onchainId));

  await sendDiscordWebhook({
    embeds: [{
      title: '🟡 Liquidez retirada',
      description: data.title,
      color: 0xFEE75C,
      url: backofficeUrl(data.marketId),
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'predmarks backoffice' },
    }],
  });
}

export async function notifyResolutionSuggestion(data: {
  marketId: string;
  title: string;
  suggestedOutcome: string;
  confidence: string;
  evidence: string;
  isEmergency?: boolean;
  emergencyReason?: string;
  chainId: number;
  onchainId?: string | null;
}): Promise<void> {
  if (isTestnet(data.chainId)) return;

  const confidenceEmoji = data.confidence === 'high' ? '🟢' : data.confidence === 'medium' ? '🟡' : '🔴';
  const isEmergency = data.isEmergency ?? false;

  await sendDiscordWebhook({
    embeds: [{
      title: isEmergency ? '🚨 EMERGENCIA: Resolución urgente' : '🟠 Sugerencia de resolución',
      description: data.title,
      color: isEmergency ? 0xED4245 : 0xF0B232,
      url: backofficeUrl(data.marketId),
      fields: [
        { name: 'Resultado sugerido', value: data.suggestedOutcome, inline: true },
        { name: 'Confianza', value: `${confidenceEmoji} ${data.confidence}`, inline: true },
        { name: 'Evidencia', value: data.evidence.slice(0, 300) + (data.evidence.length > 300 ? '…' : '') },
        ...(isEmergency && data.emergencyReason
          ? [{ name: 'Razón de emergencia', value: data.emergencyReason }]
          : []),
        linksField(data.marketId, data.chainId, data.onchainId),
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'predmarks backoffice' },
    }],
  });
}
