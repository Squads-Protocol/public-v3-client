import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import SendTokens from './SendTokensButton';
import SendSol from './SendSolButton';
import { useBalance, useGetTokens } from '@/hooks/useServices';
import React from 'react';

type TokenListProps = {
  multisigPda: string;
};

export function TokenList({ multisigPda }: TokenListProps) {
  const { data: solBalance = 0 } = useBalance();
  const { data: tokens = null } = useGetTokens();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
        <CardDescription>The tokens you hold in your wallet</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <div>
            <div className="flex items-center">
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">SOL</p>
                <p className="text-sm text-muted-foreground">
                  Amount: {solBalance ? solBalance / LAMPORTS_PER_SOL : 0}
                </p>
              </div>
              <div className="ml-auto">
                <SendSol multisigPda={multisigPda} />
              </div>
            </div>
            {tokens && tokens.value.length > 0 ? <hr className="mt-2" /> : null}
          </div>
          {tokens &&
            tokens.value
              .filter(token => token.account.data.parsed.info.tokenAmount.uiAmount > 0)
              .map((token) => {
                const isToken2022 = token.account.owner.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
                return (
                  <div key={token.account.data.parsed.info.mint}>
                    <div className="flex items-center">
                      <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">
                          Mint: {token.account.data.parsed.info.mint}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({isToken2022 ? 'SPL-Token-2022' : 'SPL Token'})
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Amount: {token.account.data.parsed.info.tokenAmount.uiAmount}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <SendTokens
                          mint={token.account.data.parsed.info.mint}
                          tokenAccount={token.pubkey.toBase58()}
                          decimals={token.account.data.parsed.info.tokenAmount.decimals}
                          multisigPda={multisigPda}
                          isToken2022={isToken2022}
                        />
                      </div>
                    </div>
                    <hr className="mt-2" />
                  </div>
                );
              })}
        </div>
      </CardContent>
    </Card>
  );
}
