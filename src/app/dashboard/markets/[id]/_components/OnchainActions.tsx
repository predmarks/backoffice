'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { zeroAddress } from 'viem';
import { PRECOG_MASTER_ABI, MASTER_ADDRESSES } from '@/lib/contracts';

interface Props {
  marketId: string;
  onchainId: number;
  title: string;
  description: string;
  category: string;
  outcomes: string[];
  endTimestamp: number;
}

export function OnchainActions({ marketId, onchainId, title, description, category, outcomes, endTimestamp }: Props) {
  const router = useRouter();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const masterAddress = MASTER_ADDRESSES[chainId];

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // After tx confirms, refresh market data from contract
  useEffect(() => {
    if (!isSuccess) return;
    fetch(`/api/markets/${marketId}/refresh?full=true`, { method: 'POST' })
      .then(() => router.refresh())
      .catch(() => {});
  }, [isSuccess, marketId, router]);

  if (!isConnected || !masterAddress) return null;

  function handleUpdate() {
    writeContract({
      address: masterAddress,
      abi: PRECOG_MASTER_ABI,
      functionName: 'updateMarket',
      args: [
        BigInt(onchainId),
        title,
        description,
        category,
        outcomes.map((o) => o.replace(/,/g, '.')),
        BigInt(0), // startTimestamp: 0 = don't change
        BigInt(endTimestamp),
        zeroAddress, // creator: zero = don't change
        zeroAddress, // oracle: zero = don't change
      ],
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleUpdate}
        disabled={isPending || isConfirming}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 cursor-pointer"
      >
        {isPending ? 'Firmando...' : isConfirming ? 'Confirmando...' : 'Actualizar onchain'}
      </button>
      {isSuccess && <span className="text-xs text-green-600">Confirmado</span>}
      {error && <span className="text-xs text-red-500" title={error.message}>Error</span>}
    </div>
  );
}
