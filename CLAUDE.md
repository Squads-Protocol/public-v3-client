# public-v3-client

Open-source UI for the **Squads V3 Multisig Program** on Solana. Designed to be verifiable and self-hostable — users can build from source, generate a SHA-256 hash, and verify it against a remote URL or IPFS CID. The sibling repo `public-v4-client` (one level up) targets the V4 program.

---

## Tech Stack

| Layer | Library / Version |
|---|---|
| Framework | React 19, TypeScript 5 |
| Routing | React Router DOM 7 (HashRouter) |
| State / data fetching | TanStack React Query 5 |
| Blockchain | `@solana/web3.js` 1.95, `@sqds/sdk` 2.0.4 |
| Wallet | `@solana/wallet-adapter-react` + `-react-ui` |
| Token | `@solana/spl-token` 0.3.11 |
| Styling | Tailwind CSS 3.3, Radix UI primitives, Sonner toasts |
| Bundler | Webpack 5 (separate dev/prod configs) |
| Release | semantic-release + conventional commits + Husky |

No Next.js — this is a purely static SPA bundled by Webpack.

---

## Project Structure

```
src/
  index.tsx              # React DOM entry point
  App.tsx                # Providers (QueryClient, Wallet, HashRouter) + route tree
  routes/                # Page-level components (one file = one route)
    _index.tsx           # / — Overview (vault balance, tokens)
    create.tsx           # /create — Create a new multisig
    config.tsx           # /config — Members & threshold management
    transactions.tsx     # /transactions — Pending proposals, paginated
    programs.tsx         # /programs — Program manager (upgrade authority)
    settings.tsx         # /settings — RPC URL + Program ID
  components/            # Feature components + UI primitives
    ui/                  # Radix UI wrappers (button, card, dialog, input, …)
  hooks/                 # App-level custom hooks
    useMultisigData.tsx  # Computes connection, programId, multisigAddress, vault PDA
    useServices.tsx      # useMultisig, useBalance, useGetTokens, useTransactions
    useSettings.tsx      # useRpcUrl, useProgramId — localStorage + React Query
    useMultisigAddress.tsx  # Active multisig address — localStorage
    useProgram.tsx       # Fetch program authority / programData
  lib/
    createSquad.ts       # Build multisig creation transaction
    createSquadTransactionInstructions.ts  # Build proposal instructions
    transactionConfirmation.ts             # Poll for signature confirmation
    isPublickey.ts / isProgram.ts          # Validation helpers
    utils.ts             # cn() (classname merge), range()
    hooks/
      useAccess.tsx      # Is the connected wallet a multisig member?
      useSquadForm.ts    # Form state + async validation for create squad form
    transaction/
      decodeAndDeserialize.ts     # Decode base58 transactions
      simulateEncodedTransaction.ts
      importTransaction.ts
      getAccountsForSimulation.ts
  styles/globals.css     # Tailwind base + CSS variable theme tokens
public/
  index.html             # HTML template for Webpack HtmlWebpackPlugin
scripts/
  generate-hash.sh       # SHA-256 hash of dist/ (deterministic order)
  verify-remote.sh       # Compare remote deployment hash
  verify-ipfs.sh         # Compare IPFS deployment hash
webpack.common.js / webpack.dev.js / webpack.prod.js
Dockerfile               # Multi-stage: Node 20 build → Nginx Alpine serve
```

---

## Path Aliases (tsconfig + Webpack)

```
~/       → src/
@/components/  → src/components/
@/hooks/       → src/hooks/
@/lib/         → src/lib/
```

---

## Development

```bash
yarn install --frozen-lockfile
yarn dev        # webpack-dev-server with HMR
yarn build      # production bundle → dist/
./scripts/generate-hash.sh   # compute build hash for verification
```

No `.env` files — all runtime config is stored in **localStorage**:

| Key | Default | Description |
|---|---|---|
| `x-rpc-url` | `https://api.mainnet-beta.solana.com` | RPC endpoint |
| `x-program-id` | `DEFAULT_MULTISIG_PROGRAM_ID` from SDK | Squads V3 program ID |
| `x-multisig` | — | Active multisig PDA |

Settings are changed via the `/settings` route at runtime.

> **Known quirk**: `Wallet.tsx` passes `WalletAdapterNetwork.Devnet` to the wallet adapter even though the default RPC points to mainnet-beta. The actual RPC URL from localStorage takes precedence for on-chain calls — this only affects wallet-adapter's cluster hint.

---

## Squads V3 SDK Integration

The core on-chain layer is `@sqds/sdk` v2.0.4. Instantiation pattern:

```typescript
const squads = Squads.endpoint(rpcUrl, wallet, { multisigProgramId });
```

**SDK methods used across the codebase:**

- `getMultisig(pda)` / `getTransaction(pda)` — fetch accounts
- `buildCreateMultisig()` — create multisig
- `buildCreateTransaction()` / `buildAddInstruction()` / `buildActivateTransaction()` — proposal lifecycle
- `buildApproveTransaction()` / `buildRejectTransaction()` / `buildExecuteTransaction()` — voting + execution
- `buildAddMember()` / `buildRemoveMember()` / `buildChangeThreshold()` — config changes
- `getAuthorityPDA()` — derive vault address
- `getMsPDA()` / `getTxPDA()` / `getIxPDA()` — PDA derivation helpers

**Transaction flow pattern (used consistently):**
1. Build instruction(s) via SDK `build*()` methods
2. Wrap in `Transaction` / `VersionedTransaction`, set `feePayer` + `recentBlockhash`
3. `wallet.signTransaction()` → `connection.sendRawTransaction()`
4. Poll confirmation with `waitForConfirmation()` (signature status polling with timeout)
5. Toast success/failure via Sonner
6. `queryClient.invalidateQueries()` to refresh UI

**Large transaction handling:** `ExecuteButton` checks if serialized size > 1050 bytes and splits into multiple sequential transactions, each with priority fee + compute unit instructions.

---

## Data Fetching Conventions

- All server state via `useSuspenseQuery` (React Query) — components suspend while loading
- Query keys: `['multisig', address]`, `['balance', vault]`, `['transactions', multisigAddress]`, etc.
- Mutations invalidate relevant query keys on success
- No global store (no Redux/Zustand) — React Query + localStorage is sufficient

---

## Routing

Uses `HashRouter` (not `BrowserRouter`) so the static build works without server-side routing. All routes are `#/path` style.

---

## Styling Conventions

- Tailwind utility classes; theme tokens via CSS variables (`--background`, `--primary`, etc.) defined in `globals.css`
- `cn()` from `lib/utils.ts` merges classnames (clsx + tailwind-merge)
- Radix UI primitives wrapped in `src/components/ui/` with Tailwind styling
- Responsive: sidebar layout on `md+`, bottom nav bar on mobile
- Dark mode via `.dark` class on `<html>` (not yet fully wired)

---

## Build & Release

- **Versioning**: semantic-release reads conventional commits and bumps `package.json` + generates `CHANGELOG.md`
- **Commits**: must follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) — enforced by commitlint + Husky pre-commit hook
- **Deterministic builds**: `SOURCE_DATE_EPOCH` is set in the Dockerfile so builds are reproducible
- **No test suite**: `yarn test` exits 1 with a placeholder message — there are currently no automated tests

---

## Deployment

**Docker (recommended for self-hosting):**
```bash
docker build -t squads-public-v3-client .
docker run -d -p 8080:80 squads-public-v3-client
docker exec <id> cat /var/build-metadata/hash.txt
```

**Static hosting**: serve the `dist/` directory from any CDN or static host. Because it uses HashRouter, no server rewrite rules are needed.
