import { PublicKey } from '@solana/web3.js';
import type { DecodedInstruction } from './decodeV3Transaction';

// Anchor instruction discriminators for the Squads V3 (squads_mpl) program.
// Computed once via sha256("global:<snake_case_name>").slice(0, 8).
// See node_modules/@sqds/sdk/lib/target/idl/squads_mpl.json for the source IDL.
const DISC = {
  addMember: [13, 116, 123, 130, 126, 198, 57, 34],
  removeMember: [171, 57, 231, 150, 167, 128, 18, 55],
  removeMemberAndChangeThreshold: [230, 97, 183, 248, 43, 190, 154, 29],
  addMemberAndChangeThreshold: [114, 213, 59, 47, 214, 157, 150, 170],
  changeThreshold: [146, 151, 213, 63, 121, 79, 9, 29],
  addAuthority: [229, 9, 106, 73, 91, 213, 109, 183],
} as const;

export type ConfigActionKind =
  | 'AddMember'
  | 'RemoveMember'
  | 'AddMemberAndChangeThreshold'
  | 'RemoveMemberAndChangeThreshold'
  | 'ChangeThreshold'
  | 'AddAuthority';

export interface ConfigAction {
  kind: ConfigActionKind;
  fields: Array<{ label: string; value: string; mono?: boolean }>;
}

function matches(data: Uint8Array, disc: readonly number[]): boolean {
  if (data.length < disc.length) return false;
  for (let i = 0; i < disc.length; i++) {
    if (data[i] !== disc[i]) return false;
  }
  return true;
}

function readPubkey(data: Uint8Array, offset: number): string {
  if (data.length < offset + 32) {
    throw new Error('Truncated instruction data: pubkey out of range');
  }
  return new PublicKey(data.slice(offset, offset + 32)).toBase58();
}

function readU16(data: Uint8Array, offset: number): number {
  if (data.length < offset + 2) {
    throw new Error('Truncated instruction data: u16 out of range');
  }
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Try to recognize a multisig-program config instruction (add member, remove
 * member, change threshold, etc.) by matching its 8-byte Anchor discriminator
 * and decoding its arguments. Returns null for any instruction that targets a
 * different program or whose discriminator does not match a known config IX.
 */
export function recognizeConfigAction(
  ix: DecodedInstruction,
  multisigProgramId: PublicKey
): ConfigAction | null {
  if (ix.programId !== multisigProgramId.toBase58()) return null;

  const data = ix.data;

  try {
    if (matches(data, DISC.addMember)) {
      return {
        kind: 'AddMember',
        fields: [{ label: 'New Member', value: readPubkey(data, 8), mono: true }],
      };
    }
    if (matches(data, DISC.removeMember)) {
      return {
        kind: 'RemoveMember',
        fields: [{ label: 'Old Member', value: readPubkey(data, 8), mono: true }],
      };
    }
    if (matches(data, DISC.addMemberAndChangeThreshold)) {
      return {
        kind: 'AddMemberAndChangeThreshold',
        fields: [
          { label: 'New Member', value: readPubkey(data, 8), mono: true },
          { label: 'New Threshold', value: String(readU16(data, 8 + 32)) },
        ],
      };
    }
    if (matches(data, DISC.removeMemberAndChangeThreshold)) {
      return {
        kind: 'RemoveMemberAndChangeThreshold',
        fields: [
          { label: 'Old Member', value: readPubkey(data, 8), mono: true },
          { label: 'New Threshold', value: String(readU16(data, 8 + 32)) },
        ],
      };
    }
    if (matches(data, DISC.changeThreshold)) {
      return {
        kind: 'ChangeThreshold',
        fields: [{ label: 'New Threshold', value: String(readU16(data, 8)) }],
      };
    }
    if (matches(data, DISC.addAuthority)) {
      return { kind: 'AddAuthority', fields: [] };
    }
  } catch {
    // Decoding failed (truncated data) — fall back to the raw instruction view.
    return null;
  }

  return null;
}

export function formatConfigActionKind(kind: ConfigActionKind): string {
  return kind.replace(/([A-Z])/g, ' $1').trim();
}
