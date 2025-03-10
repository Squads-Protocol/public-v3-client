import AddMemberInput from '@/components/AddMemberInput';
import ChangeThresholdInput from '@/components/ChangeThresholdInput';
import ChangeUpgradeAuthorityInput from '@/components/ChangeUpgradeAuthorityInput';
import RemoveMemberButton from '@/components/RemoveMemberButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clusterApiUrl } from '@solana/web3.js';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig } from '@/hooks/useServices';
import { DEFAULT_MULTISIG_PROGRAM_ID } from '@sqds/sdk';

const ConfigurationPage = () => {
  const { rpcUrl, multisigAddress, programId } = useMultisigData();
  const { data: multisigConfig } = useMultisig();
  return (
    <div className="">
      <h1 className="text-3xl font-bold mb-4">Multisig Configuration</h1>
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>List of members in the multisig.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {multisigConfig &&
              multisigConfig.keys.map((member) => (
                <div key={member.toBase58()}>
                  <div className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        Public Key: {member.toBase58()}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <RemoveMemberButton
                        rpcUrl={rpcUrl || clusterApiUrl('mainnet-beta')}
                        memberKey={member.toBase58()}
                        multisigPda={multisigAddress!}
                        programId={
                          programId ? programId.toBase58() : DEFAULT_MULTISIG_PROGRAM_ID.toBase58()
                        }
                      />
                    </div>
                  </div>
                  <hr className="mt-2" />
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex pb-4">
        <Card className="mt-4 w-1/2 mr-2">
          <CardHeader>
            <CardTitle>Add Member</CardTitle>
            <CardDescription>Add a member to the Multisig</CardDescription>
          </CardHeader>
          <CardContent>
            <AddMemberInput
              multisigPda={multisigAddress!}
              rpcUrl={rpcUrl || clusterApiUrl('mainnet-beta')}
              programId={programId ? programId.toBase58() : DEFAULT_MULTISIG_PROGRAM_ID.toBase58()}
            />
          </CardContent>
        </Card>
        <Card className="mt-4 w-1/2">
          <CardHeader>
            <CardTitle>Change Threshold</CardTitle>
            <CardDescription>
              Change the threshold required to execute a multisig transaction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangeThresholdInput
              multisigPda={multisigAddress!}
              rpcUrl={rpcUrl || clusterApiUrl('mainnet-beta')}
              programId={programId ? programId.toBase58() : DEFAULT_MULTISIG_PROGRAM_ID.toBase58()}
            />
          </CardContent>
        </Card>
      </div>
      {multisigConfig && (
        <div className="pb-4">
          <Card className="w-1/2">
            <CardHeader>
              <CardTitle>Change program Upgrade authority</CardTitle>
              <CardDescription>
                Change the upgrade authority of one of your programs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangeUpgradeAuthorityInput
                multisigPda={multisigAddress!}
                rpcUrl={rpcUrl || clusterApiUrl('mainnet-beta')}
                globalProgramId={
                  programId ? programId.toBase58() : DEFAULT_MULTISIG_PROGRAM_ID.toBase58()
                }
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPage;
