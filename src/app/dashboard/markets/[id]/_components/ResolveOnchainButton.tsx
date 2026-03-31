'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useChainId, useWalletClient, usePublicClient } from 'wagmi';
import { PRECOG_MARKET_ABI, REPORTER_ABI, REPORTER_ADDRESSES } from '@/lib/contracts';
import { getBasescanUrl } from '@/lib/chains';

interface Props {
  marketId: string;
  onchainId: number;
  outcome: string;
  outcomes: string[];
  marketAddress: `0x${string}`;
  reportOnly?: boolean;
}

type Step =
  | 'idle'
  | 'preview-resolve'
  | 'resolving' | 'confirming-resolve'
  | 'preview-report'
  | 'reporting' | 'confirming-report'
  | 'refreshing' | 'done' | 'error';

function TxLink({ hash, chainId }: { hash: string; chainId: number }) {
  return (
    <a href={`${getBasescanUrl(chainId)}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline font-mono">
      {hash.slice(0, 10)}...
    </a>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-mono">{value}</span>
    </div>
  );
}

export function ResolveOnchainButton({ marketId, onchainId, outcome, outcomes, marketAddress, reportOnly }: Props) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (!isConnected) return null;

  const outcomeIndex = outcomes.indexOf(outcome) + 1;
  if (outcomeIndex <= 0) return null;

  const reporterAddress = REPORTER_ADDRESSES[chainId];
  const basescanBase = getBasescanUrl(chainId);

  const logTx = (action: string, detail: Record<string, unknown>) =>
    fetch(`/api/markets/${marketId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, detail }),
    });

  async function handleResolve() {
    if (!walletClient || !publicClient) return;
    setError(null);
    setTxHash(null);

    try {
      setStep('resolving');
      const resolveTx = await walletClient.writeContract({
        address: marketAddress,
        abi: PRECOG_MARKET_ABI,
        functionName: 'reportResult',
        args: [BigInt(onchainId), BigInt(outcomeIndex)],
      });
      setTxHash(resolveTx);
      setStep('confirming-resolve');
      await publicClient.waitForTransactionReceipt({ hash: resolveTx });
      await logTx('market_resolved_onchain', {
        txHash: resolveTx,
        outcome,
        outcomeIndex,
        marketAddress,
        reporterPending: !!reporterAddress,
      });

      // If reporter configured, show preview for TX2
      if (reporterAddress) {
        setTxHash(null);
        setStep('preview-report');
        return; // Wait for user to confirm TX2
      }

      // No reporter — go straight to refresh
      setStep('refreshing');
      setTxHash(null);
      await new Promise((r) => setTimeout(r, 2000));
      await fetch(`/api/markets/${marketId}/refresh?full=true`, { method: 'POST' });
      router.refresh();
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }

  async function handleReport() {
    if (!walletClient || !publicClient || !reporterAddress) return;
    setError(null);
    setTxHash(null);

    try {
      setStep('reporting');
      const reportTx = await walletClient.writeContract({
        address: reporterAddress,
        abi: REPORTER_ABI,
        functionName: 'reportResult',
        args: [marketAddress, BigInt(onchainId), BigInt(outcomeIndex)],
      });
      setTxHash(reportTx);
      setStep('confirming-report');
      await publicClient.waitForTransactionReceipt({ hash: reportTx });
      await logTx('market_reported_onchain', {
        txHash: reportTx,
        reporterAddress,
      });

      setStep('refreshing');
      setTxHash(null);
      await new Promise((r) => setTimeout(r, 2000));
      await fetch(`/api/markets/${marketId}/refresh?full=true`, { method: 'POST' });
      router.refresh();
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStep('error');
    }
  }

  const busy = ['resolving', 'confirming-resolve', 'reporting', 'confirming-report', 'refreshing'].includes(step);

  // Preview: TX1 resolve
  if (step === 'preview-resolve') {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3 text-sm">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">TX 1: Resolver mercado</p>
        <div className="space-y-1">
          <Param label="Contrato" value={`${marketAddress.slice(0, 6)}...${marketAddress.slice(-4)}`} />
          <Param label="Funcion" value="reportResult" />
          <Param label="Market ID" value={String(onchainId)} />
          <Param label="Outcome" value={`${outcomeIndex} (${outcome})`} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResolve} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 cursor-pointer">Confirmar y firmar</button>
          <button onClick={() => setStep('idle')} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">Cancelar</button>
        </div>
      </div>
    );
  }

  // Preview: TX2 reporter
  if (step === 'preview-report' && reporterAddress) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3 text-sm">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">TX 2: Reportar resultado</p>
        <div className="space-y-1">
          <Param label="Contrato" value={`${reporterAddress.slice(0, 6)}...${reporterAddress.slice(-4)}`} />
          <Param label="Funcion" value="reportResult" />
          <Param label="Market" value={`${marketAddress.slice(0, 6)}...${marketAddress.slice(-4)}`} />
          <Param label="Market ID" value={String(onchainId)} />
          <Param label="Outcome" value={`${outcomeIndex} (${outcome})`} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReport} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 cursor-pointer">Confirmar y firmar</button>
          <button onClick={() => { setStep('refreshing'); fetch(`/api/markets/${marketId}/refresh?full=true`, { method: 'POST' }).then(() => { router.refresh(); setStep('done'); }); }} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">Omitir</button>
        </div>
      </div>
    );
  }

  // Status display during tx processing
  const label = step === 'resolving' ? 'Firmando...'
    : step === 'confirming-resolve' ? 'Confirmando resolución...'
    : step === 'reporting' ? 'Firmando reporte...'
    : step === 'confirming-report' ? 'Confirmando reporte...'
    : step === 'refreshing' ? 'Actualizando...'
    : step === 'done' ? 'Resuelto onchain'
    : step === 'error' ? 'Reintentar'
    : 'Resolve onchain';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => step === 'idle' || step === 'error' ? setStep(reportOnly ? 'preview-report' : 'preview-resolve') : undefined}
        disabled={busy || step === 'done'}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 cursor-pointer"
      >
        {label}
      </button>
      {txHash && <TxLink hash={txHash} chainId={chainId} />}
      {step === 'done' && <span className="text-xs text-green-600">OK</span>}
      {error && <span className="text-xs text-red-500 max-w-xs truncate" title={error}>Error: {error.slice(0, 60)}</span>}
    </div>
  );
}
