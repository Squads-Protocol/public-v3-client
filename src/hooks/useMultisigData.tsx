import { useMemo } from 'react';
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { useRpcUrl, useProgramId } from '@/hooks/useSettings';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';
import { DEFAULT_MULTISIG_PROGRAM_ID, getAuthorityPDA } from '@sqds/sdk';
import BN from 'bn.js';

export const useMultisigData = () => {
  // Fetch settings from React Query hooks
  const { rpcUrl } = useRpcUrl();
  const { programId: storedProgramId } = useProgramId();
  const { multisigAddress } = useMultisigAddress();

  // Ensure we have a valid RPC URL (fallback to mainnet-beta)
  const effectiveRpcUrl = rpcUrl || clusterApiUrl('mainnet-beta');
  const connection = useMemo(() => new Connection(effectiveRpcUrl), [effectiveRpcUrl]);

  // Compute programId safely
  const programId = useMemo(
    () => (storedProgramId ? new PublicKey(storedProgramId) : DEFAULT_MULTISIG_PROGRAM_ID),
    [storedProgramId]
  );

  // Compute the multisig vault PDA
  const multisigVault = useMemo(() => {
    if (multisigAddress) {
      return getAuthorityPDA(new PublicKey(multisigAddress), new BN(1), programId)[0];
    }
    return null;
  }, [multisigAddress, programId]);

  return {
    rpcUrl: effectiveRpcUrl,
    connection,
    multisigAddress,
    programId,
    multisigVault,
  };
};
