import 'dotenv/config';
import {
  notifyMarketDeployed,
  notifyMarketResolved,
  notifyLiquidityWithdrawn,
  notifyResolutionSuggestion,
} from '../src/lib/discord';

const MARKET_ID = '00000000-0000-0000-0000-000000000000';
const CHAIN_ID = 8453; // mainnet so testnet filter doesn't skip

async function main() {
  console.log('Sending test notifications to Discord...\n');

  await notifyMarketDeployed({
    marketId: MARKET_ID,
    title: '¿Milei vetará la ley de financiamiento universitario?',
    onchainId: '42',
    chainId: CHAIN_ID,
  });
  console.log('✓ Market deployed');

  await notifyMarketResolved({
    marketId: MARKET_ID,
    title: '¿El dólar blue superará los $1500 antes del 1 de mayo?',
    outcome: 'Sí',
    chainId: CHAIN_ID,
    onchainId: '42',
    confirmedBy: 'admin',
  });
  console.log('✓ Market resolved');

  await notifyLiquidityWithdrawn({
    marketId: MARKET_ID,
    title: '¿River ganará la Libertadores 2026?',
    txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
    amount: '150000000', // 150 USDC
    chainId: CHAIN_ID,
    onchainId: '42',
  });
  console.log('✓ Liquidity withdrawn');

  await notifyResolutionSuggestion({
    marketId: MARKET_ID,
    title: '¿La inflación de marzo será menor al 3%?',
    suggestedOutcome: 'No',
    confidence: 'high',
    evidence: 'El INDEC publicó el IPC de marzo 2026 con una variación mensual del 3.7%, superando el umbral establecido en el criterio de resolución.',
    chainId: CHAIN_ID,
    onchainId: '42',
  });
  console.log('✓ Resolution suggestion');

  await notifyResolutionSuggestion({
    marketId: MARKET_ID,
    title: '¿Caputo renunciará antes de junio?',
    suggestedOutcome: 'Sí',
    confidence: 'medium',
    evidence: 'Múltiples fuentes confirman que el ministro presentó su renuncia esta mañana. Infobae, La Nación y Clarín reportan la noticia.',
    isEmergency: true,
    emergencyReason: 'El mercado cierra en menos de 24hs y el evento ya ocurrió.',
    chainId: CHAIN_ID,
    onchainId: '42',
  });
  console.log('✓ Resolution suggestion (emergency)');

  console.log('\nDone! Check your Discord channel.');
}

main().catch(console.error);
