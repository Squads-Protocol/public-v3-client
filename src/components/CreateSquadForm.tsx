import { Button } from './ui/button';
import { Input } from './ui/input';
import { createMultisig } from '@/lib/createSquad';
import { Keypair, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { CheckSquare, Copy, ExternalLink, PlusCircleIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { isPublickey } from '@/lib/isPublickey';
import { ValidationRules, useSquadForm } from '@/lib/hooks/useSquadForm';
import { Link } from 'react-router-dom';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';

export default function CreateSquadForm({}: {}) {
  const wallet = useWallet();

  const { connection, programId } = useMultisigData();
  const { setMultisigAddress } = useMultisigAddress();
  const validationRules = getValidationRules();

  const { formState, handleChange, handleAddMember, onSubmit } = useSquadForm<{
    signature: string;
    multisig: string;
  }>(
    {
      threshold: 1,
      createKey: '',
      members: {
        count: 0,
        memberKeys: [],
      },
    },
    validationRules
  );

  async function submitHandler() {
    if (!wallet.connected || !wallet) throw new Error('Please connect your wallet.');
    try {
      const createKey = Keypair.generate();

      const { transaction, multisig } = await createMultisig(
        wallet,
        connection,
        wallet.publicKey!,
        formState.values.members.memberKeys,
        formState.values.threshold,
        createKey.publicKey,
        programId
      );

      const signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: true,
      });
      console.log('Transaction signature', signature);
      toast.loading('Confirming...', {
        id: 'create',
      });

      let sent = false;
      const maxAttempts = 10;
      const delayMs = 1000;
      for (let attempt = 0; attempt <= maxAttempts && !sent; attempt++) {
        const status = await connection.getSignatureStatus(signature);
        if (status?.value?.confirmationStatus === 'confirmed') {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          sent = true;
        } else {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      setMultisigAddress.mutate(multisig.toBase58());

      return { signature, multisig: multisig.toBase58() };
    } catch (error: any) {
      console.error(error);
      return error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  return (
    <>
      <div className="grid grid-cols-8 gap-4 mb-6">
        <div className="col-span-6 flex-col space-y-2">
          <label htmlFor="members" className="font-medium">
            Members <span className="text-red-600">*</span>
          </label>
          {formState.values.members.memberKeys.map((member: string, i: number) => (
            <div key={i} className="grid grid-cols-4 items-center gap-2">
              <div className="relative col-span-3">
                <Input
                  defaultValue={member ? member : ''}
                  placeholder={`Member key ${i + 1}`}
                  onChange={(e) => {
                    handleChange('members', {
                      count: formState.values.members.count,
                      memberKeys: formState.values.members.memberKeys.map(
                        (member: string, index: number) => {
                          if (index === i) {
                            let newKey = null;
                            try {
                              if (e.target.value && PublicKey.isOnCurve(e.target.value)) {
                                newKey = e.target.value;
                              }
                            } catch (error) {
                              console.error('Invalid public key input:', error);
                            }
                            return newKey;
                          }
                          return member;
                        }
                      ),
                    });
                  }}
                />
                {i > 0 && (
                  <XIcon
                    onClick={() => {
                      handleChange('members', {
                        count: formState.values.members.count,
                        memberKeys: formState.values.members.memberKeys.filter(
                          (_: string, index: number) => index !== i
                        ),
                      });
                    }}
                    className="absolute inset-y-3 right-2 w-4 h-4 text-zinc-400 hover:text-zinc-600"
                  />
                )}
              </div>
            </div>
          ))}
          <button
            onClick={(e) => handleAddMember(e)}
            className="mt-2 flex gap-1 items-center text-zinc-400 hover:text-zinc-600"
          >
            <PlusCircleIcon className="w-4" />
            <p className="text-sm">Add Address</p>
          </button>
          {formState.errors.members && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.members}</div>
          )}
        </div>
        <div className="col-span-4 flex-col space-y-2">
          <label htmlFor="threshold" className="font-medium">
            Threshold <span className="text-red-600">*</span>
          </label>
          <Input
            type="number"
            placeholder="Approval threshold for execution"
            defaultValue={formState.values.threshold}
            onChange={(e) => handleChange('threshold', parseInt(e.target.value))}
            className=""
          />
          {formState.errors.threshold && (
            <div className="mt-1.5 text-red-500 text-xs">{formState.errors.threshold}</div>
          )}
        </div>
      </div>
      <Button
        onClick={() =>
          toast.promise(onSubmit(submitHandler), {
            id: 'create',
            duration: 10000,
            loading: 'Building Transaction...',
            success: (res) => (
              <div className="w-full flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <div className="flex flex-col space-y-0.5">
                    <p className="font-semibold">
                      Squad Created:{' '}
                      <span className="font-normal">
                        {res.multisig.slice(0, 4) + '...' + res.multisig.slice(-4)}
                      </span>
                    </p>
                    <p className="font-light">Your new Squad has been set as active.</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Copy
                    onClick={() => {
                      navigator.clipboard.writeText(res.multisig);
                      toast.success('Copied address!');
                    }}
                    className="w-4 h-4 hover:text-stone-500"
                  />
                  <Link
                    to={`https://explorer.solana.com/address/${res.multisig}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 hover:text-stone-500" />
                  </Link>
                </div>
              </div>
            ),
            error: (e) => `Failed to create squad: ${e}`,
          })
        }
      >
        Create Squad
      </Button>
    </>
  );
}

function getValidationRules(): ValidationRules {
  return {
    threshold: async (value: number) => {
      if (value < 1) return 'Threshold must be greater than 0';
      return null;
    },
    members: async (value: { count: number; memberKeys: string[] }) => {
      if (value.count < 1) return 'At least one member is required';

      const valid = await Promise.all(
        value.memberKeys.map(async (member) => {
          if (!member) return 'Invalid Member Key';
          const valid = isPublickey(member);
          if (!valid) return 'Invalid Member Key';
          return null;
        })
      );

      if (valid.includes('Invalid Member Key')) {
        let index = valid.findIndex((v) => v === 'Invalid Member Key');
        return `Member ${index + 1} is invalid`;
      }

      return null;
    },
  };
}
