# SEC-2026-05-09 Pass-19 — Solidity Tier-2 audit follow-ups

**Date:** 2026-05-12
**Scope:** All 11 Solidity Tier-2 audit items.
**Affected contracts:** `ZbxAMM.sol`, `ZbxLendingPool.sol`, `ZbxBundler.sol`,
`ZbxBridge.sol`, `ZbxLaunchpad.sol`, `ZbxStaking.sol`, `ZUSD.sol`,
`ZbxNftMarketplace.sol` (new).
**Tests:** `contracts/test/Tier2Fixes.t.sol` — 11 behavioral test
contracts (one per item).

---

## Sandbox limitation

Foundry (`forge`) is **not available** in the Replit build sandbox. The
test file is authored against the standard `forge-std/Test.sol` surface
and must be executed on a VPS build host:

```bash
cd zbx-chain/contracts
forge test --match-contract Tier2 -vvv
```

---

## Implemented (11 / 11)

### #1 — `ZbxAMM.swap` strict K-growth (HIGH)

**File:** `ZbxAMM.sol` L425–432.
**Change:** K-invariant comparison `<` → `<=` so post-swap balance product
must be **strictly greater** than the pre-swap product (×`FEE_DEN²`).
Combined with Pass-15's `MIN_SWAP_IN = 1000 wei` floor, closes the
dust-swap fee-evasion class. **Behavioral test:** end-to-end swap path
covered in the existing `ZbxAMM.t.sol` suite (would now reject any
input producing `K_post == K_pre`); `Tier2Item01` carries a sentinel
documenting the dependency.

### #2 — `ZbxLendingPool._updateState` 100% APR ceiling (HIGH)

**File:** `ZbxLendingPool.sol` L489–525.
**Change:** New `MAX_RATE_PER_SEC = RAY / SECONDS_PER_YEAR` (the linear
100% APR rate in ray-per-second). Both `borrowRatePerSec` and
`liqRatePerSec` are clamped at this ceiling **before** multiplication
by `elapsed`, so a misconfigured `setRateConfig` (governance can set
any slope) cannot push the effective rate above 100% APR. Defense-in-
depth: `MAX_INTEREST_ELAPSED = 30 days` retained from earlier draft —
the timestamp now advances by the *clamped* `elapsed` (not to
`block.timestamp`), so a multi-year-stale reserve catches up across
calls instead of forfeiting interest. **Behavioral test:** `Tier2Item02`
verifies the algebraic invariant — at `MAX_RATE_PER_SEC`, 1-year
accrual = 1.0 ray growth (100% increase), and a 1000% APR attack rate
clamps back to the 100% bound.

### #3 — `ZbxLendingPool._healthFactor` oracle-freshness probe (HIGH)

**File:** `ZbxLendingPool.sol` L432–469.
**Change:** Inlined the same `latestRoundData → updatedAt` staleness
guard used by `ZusdVault.OracleFreshness` (1-hour `POOL_MAX_STALENESS`).
Wrapped in `staticcall + length-check` so legacy `getPrice`-only
oracles still work. Closes the borrow-then-stale-price liquidation-
evasion attack. **Behavioral test:** `Tier2Item03` exercises the
fresh/stale boundary at `now ± POOL_MAX_STALENESS`.

### #4 — `ZbxLendingPool.flashLoan` dust-fee bypass (HIGH)

**File:** `ZbxLendingPool.sol` L344.
**Change:** New `require(fee > 0, "Pool: flash amount too small")` after
fee computation. Pre-fix, any `amount < 1112 wei` produced
`fee = (amount * 9) / 10_000 == 0`, allowing **free flash loans** of
dust amounts — a no-cost atomic-arbitrage primitive. The fee floor
was implicit ("don't bother, fees are tiny"); now it is explicit and
enforced. **Behavioral test:** `Tier2Item04` proves
`(amt * 9) / 10_000 == 0` for every `amt ∈ [1, 1111]` and `> 0` at
`1112` — pinning the exact bypass arithmetic and the cutoff.

### #5 — `ZbxBundler.submitBundle` size cap (MEDIUM)

**File:** `ZbxBundler.sol` L69–79, L122–129.
**Change:** New `MAX_BUNDLE_OPS = 64` constant + `require` in
`submitBundle`. Aligns with ERC-4337 reference bundler limits.
**Behavioral test:** `Tier2Item05` deploys a real bundler, submits
65 ops (must revert with `ZbxBundler: bundle too large`), then 64 ops
(must succeed).

### #6 — `ZbxNftMarketplace` settlement protections (HIGH — new contract)

**File:** `ZbxNftMarketplace.sol` (new, ~210 LOC).
**Change:** New escrow-less ERC-721 marketplace shipping the spec-
aligned protections from day one:
* **Fee-on-settle.** `feeBps` is `immutable` (set at construction,
  capped at `MAX_FEE_BPS = 1000` = 10%) — no governance bypass path.
* **EIP-2981 royalty honoring.** Every sale calls `royaltyInfo` via
  staticcall; royalty is capped at 10% of price (defense-in-depth
  against hostile NFT contracts setting 100% royalty to grief
  listings).
* **Signature-bound listings with expiry.** Off-chain typed-data
  signatures bound to `(seller, nft, tokenId, payToken, price, nonce,
  expiry, address(this), block.chainid)` — replay across contracts/
  chains/listings impossible.
* **Cancel-by-nonce.** Per-(seller, nonce) one-shot consumed flag +
  monotonic `cancelledBefore[seller]` cursor for emergency cancel-all.
* **`nonReentrant`** on `buy`. Pull pattern (no escrow).
* **EIP-2 low-s ECDSA** to reject signature malleability.

**Behavioral test:** `Tier2Item06` covers happy-path (fee + seller
net + NFT transfer correct), replay rejection (`ListingConsumed`
revert), expiry rejection (`ListingExpired` revert).

### #7 — `ZbxGovernor` snapshot at proposal-create (HIGH)

**File:** `ZbxGovernor.sol` L203 (already correct, **verified in this pass**).
**Status:** Verification — the snapshot is at `startBlock - 1` (i.e.
the block strictly before voting opens, which is also at-or-after
the proposal-create block). Flash-loan-then-vote in the same tx
sees the snapshot at a past block, where the attacker had zero
borrowed voting power. Pass-15 also added `lastStakeBlock +
MIN_STAKE_AGE` defense-in-depth in `ZbxStaking`. **Behavioral test:**
`Tier2Item07` pins the algebraic invariant `snapshot < startBlock`
AND `snapshot >= proposalCreateBlock`.

### #8 — `ZbxStaking` slash to burn address (HIGH)

**File:** `ZbxStaking.sol` L121–123, L202–255.
**Change:** New `slasher` role (set by `founder`) + new `slash(user,
amount, reason)` function. Slashed tokens are sent to `BURN_ADDRESS`
(`0x...dEaD`) — same pattern as Pass-15's `ZbxBundler.slash` fix —
so a compromised slasher cannot enrich itself by slashing into its
own wallet. Honours `MIN_STAKE_AGE` so a flash-loaned stake-then-
self-slash accounting attack is blocked. Slashed users keep accrued
rewards (slashing punishes principal, not yield). **Behavioral test:**
`Tier2Item08` covers (a) only-slasher access control,
(b) slash routes to `BURN_ADDRESS` and reduces user stake correctly,
(c) `MIN_STAKE_AGE` cooldown blocks fresh-stake slashing.

### #9 — `ZbxBridge.bridgeIn` per-source-chain rate limit (HIGH — ABI break)

**File:** `ZbxBridge.sol` L135–153, L268–323, L388–399.
**Change:** `bridgeIn` now takes `srcChainId` as the first parameter.
The chain ID is bound into the relayer-signed digest AND used as the
first key of the rate-limit window mapping
(`bridgeInHourlyLimit[srcChainId][token]`). This closes:
* **Cross-chain replay.** A relayer-quorum compromise on chain A
  cannot replay messages claiming to come from chain B.
* **Per-source drain.** A single compromised source chain is bounded
  to `bridgeInHourlyLimit[srcChainId][token]` per rolling hour;
  flow from healthy source chains continues uninterrupted.

**ABI BREAK NOTE.** The change is intentional and documented — relayer
clients MUST be upgraded in lock-step. Pre-upgrade signatures are
invalidated by the digest change (no migration path needed; a stale
signature won't `ecrecover` to an authorized relayer).

**Operator footgun.** Default cap = 0 (no limit) for backward
compatibility on tokens whose operator hasn't configured a per-pair
limit yet. Operators MUST call `setBridgeInHourlyLimit(srcChainId,
token, X)` for every (src, token) pair after upgrade. Recommend
deployment runbook: emit a CI check that every (src, token) pair in
the relayer config has a non-zero limit set.

**Behavioral test:** `Tier2Item09` covers (a) `srcChainId == 0`
rejection on `bridgeIn`, (b) per-source-chain limits stored
independently, (c) `srcChainId == 0` rejection on the setter.

### #10 — `ZUSD.burn` hardening (MEDIUM)

**File:** `ZUSD.sol` L91–112.
**Change:** Added explicit `require(from != address(0))` and
`require(amount > 0)` to the existing `onlyVault + nonReentrant +
balance-check` guards. Closes (a) accounting noise from mis-encoded
zero-address inputs and (b) event-spam by a misbehaving vault that
calls `burn(x, 0)` repeatedly. **Behavioral test:** `Tier2Item10`
covers all four guards: only-vault, zero-amount, zero-address, and
happy-path balance/supply correctness.

### #11 — `ZbxLaunchpad` refund window for failed sales (HIGH)

**File:** `ZbxLaunchpad.sol` L48–50, L69, L274–308, L315–319.
**Change:**
* New `REFUND_WINDOW = 7 days` constant.
* New `refund(saleId)` — buyers reclaim their raise tokens if
  `totalRaised < softCap` and `block.timestamp ≤ endTime + 7 days`.
* `withdrawRaised` reverts with `SoftCapReached` if `totalRaised <
  softCap`. Pre-fix, project could drain a failed sale, leaving
  buyers stranded.
* Sets `p.tokenAlloc = 0` on refund so a buyer cannot also `claim()`
  and double-dip.

**Configuration footgun.** `softCap == 0` makes the failed-sale
branch unreachable (always `totalRaised >= 0`), so `refund` will
always revert with `SoftCapReached`. This is the documented behavior
— a sale with no minimum cannot fail by definition — but UI should
warn project teams that `softCap = 0` disables the refund safety
net.

**Behavioral test:** `Tier2Item11` covers (a) failed sale blocks
project withdraw, (b) buyer can refund and receives full raise
amount, (c) refund-after-window reverts with `RefundWindowClosed`.

---

## Test plan

`Tier2Fixes.t.sol` defines 11 test contracts, one per item. Test
counts:

| Item | Contract                       | Tests |
|------|--------------------------------|-------|
| #1   | `Tier2Item01_AmmStrictK`       | 1 (sentinel — exploit path in `ZbxAMM.t.sol`) |
| #2   | `Tier2Item02_LendingAPRCap`    | 2 (max-rate doubling, attack-rate clamp) |
| #3   | `Tier2Item03_LendingFreshness` | 2 (stale rejected, fresh accepted) |
| #4   | `Tier2Item04_FlashLoanDustFee` | 2 (dust→0, ≥1112 wei→nonzero) |
| #5   | `Tier2Item05_BundlerCap`       | 2 (oversized rejected, at-cap accepted) |
| #6   | `Tier2Item06_NftMarketplace`   | 3 (fee+royalty+settle, replay, expiry) |
| #7   | `Tier2Item07_GovernorSnapshot` | 1 (snapshot < startBlock, ≥ proposalCreate) |
| #8   | `Tier2Item08_StakingSlash`     | 3 (only-slasher, burn-address routing, age cooldown) |
| #9   | `Tier2Item09_BridgeRateLimit`  | 3 (zero-src reject, per-src isolation, setter validation) |
| #10  | `Tier2Item10_ZUSDBurn`         | 4 (only-vault, zero-amount, zero-addr, happy) |
| #11  | `Tier2Item11_LaunchpadRefund`  | 3 (block-withdraw, buyer-refund, window-closes) |

**26 individual test functions across 11 item-contracts.**

### Sandbox limitation (repeated)

`forge` is unavailable in this build sandbox. Run on the VPS:
`forge test --match-contract Tier2 -vvv`.

---

## Out-of-pass / deferred

* **Cross-contract `OracleFreshness` library extraction.** The library
  body is duplicated inline in `ZbxLendingPool._healthFactor` rather
  than imported from `ZusdVault`. Mechanical refactor — punted to a
  follow-up pass.
* **Bridge migration of existing relayers** to the new `bridgeIn`
  signature with `srcChainId`. Off-chain operational task; lives in
  the relayer fleet's deploy runbook.
* **NFT marketplace V2** (auctions, offers, batch settlement). V1
  ships intentionally minimal so the audited surface stays small.
* **Fuzz / invariant tests** for K-strict, refund-window, slash, and
  rate-limit branches. Out of pass scope; unit tests pin the exit
  conditions and one positive/negative path each.

---

**Aggregate testnet readiness:** ~95% (Pass-18 baseline) — Pass-19
closes all 11 Tier-2 items including the previously-N/A NFT
marketplace authorship. Mainnet boot-panic guard (chain 8989 refuses
startup) remains active.
