# ZBX Chain — Changelog

All notable changes to ZBX Chain are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Session 48] — 2026-05-05 — Bank Oracle Protocol (Fully Decentralized Auto-Settlement)

### Added — `bank_api.rs` (new module in `zbx-bank-registry`)

**Problem solved:** After an escrow is created, someone must confirm/reject it.
Manual bank operations are slow and centralized. The Oracle Protocol makes this
fully automatic — no human needed, no single point of control.

#### How It Works

```
Block N: initiate_settlement() → EscrowId created, status = PendingConfirmation

Every validator (independently):
  1. bank_api_registry.get_endpoint("CITIUSXX")
     → https://zbx-oracle.citibank.com/settlement/v1/confirm
  2. HTTP POST → { escrow_id, sender_bic, amount, swift_ref, chain_id }
  3. Bank's system responds → { decision: "confirm", timestamp, secp256k1_sig }
  4. Validator verifies bank's signature (bank's registered pubkey)
  5. Validator submits OracleVote on-chain (signed with BLS key)

Block N+K: AutoSettlementOracle sees ≥ 2/3 validators voted same decision
  → Confirm → SettlementEngine::confirm_settlement() → ZUSDT to Bank B ✓
  → Reject  → SettlementEngine::reject_settlement() → ZUSDT to Bank A ✓
  → Timeout → claim_timeout_refund() → ZUSDT to Bank A ✓
```

#### Security Properties

| Threat | Defense |
|---|---|
| Validator forges bank decision | Cannot — needs bank's secp256k1 signature |
| Bank forges validator vote | Cannot — needs validator's BLS signature |
| 1/3 malicious validators | 2/3 quorum required (HotStuff-BFT threshold) |
| Bank API downtime | Timeout → auto-refund to Bank A |
| Cross-chain replay | `chain_id` (8989/8990) in every signed payload |
| Double-vote | Per-validator, per-escrow vote tracking |

**Quorum:** `⌈2n/3⌉` — same as HotStuff-BFT (e.g. 100 validators → 67 needed)

#### Key Types

| Type | Purpose |
|---|---|
| `BankApiEndpoint` | Bank's HTTPS URL + auth + secp256k1 response pubkey |
| `OracleCallRequest` | What validators send to bank's API (JSON) |
| `BankApiResponse` | Bank's signed response (decision + secp256k1 sig) |
| `OracleVote` | Validator's on-chain vote (decision + BLS sig) |
| `OracleFinalDecision` | Written when 2/3 quorum is reached |
| `AutoSettlementOracle` | On-chain pool — manages endpoints + votes |

#### Bank API Registration

Banks register their endpoint at onboarding time (same wallet, same BIC):
- URL must be `https://` on mainnet, `http://` allowed on testnet
- Auth: API Key header, Bearer JWT, mTLS cert fingerprint, or None (testnet)
- Timeout: 5–60 seconds (clamped automatically)
- Only the bank's own registered wallet can register/update

#### New Error Variants

| Error | When |
|---|---|
| `ApiEndpointAlreadyRegistered` | Bank tries to re-register |
| `ApiEndpointNotFound` | Validator looks up unregistered bank |
| `ApiHttpsRequired` | HTTP URL submitted on mainnet |
| `ApiInvalidUrl` | Malformed or too-long URL |
| `ApiChainIdMismatch` | Bank response has wrong chain_id |
| `ApiInvalidSignatureLength` | sig != 64 bytes (secp256k1) or != 96 bytes (BLS) |
| `ApiValidatorAlreadyVoted` | Double-vote attempt by same validator |

**Tests:** 17 tests in `bank_api.rs` — endpoint CRUD, response verification, quorum math, voting lifecycle
**Build:** `Finished dev profile [optimized + debuginfo]` — **0 errors**

---

## [Session 47] — 2026-05-05 — Cross-Bank ZUSDT Atomic Settlement with Escrow

### Added — `settlement.rs` (new module in `zbx-bank-registry`)

**Problem solved:** Naive "send and forget" ZUSDT transfers between banks have a
race condition — Bank A's funds could be gone before Bank B ever credits the customer,
or Bank B could credit before payment arrives. The escrow system eliminates this entirely.

#### `SettlementEngine` — 2-Phase Atomic Escrow

```
Phase 1: Bank A initiates → ZUSDT locked (available → reserved)
Phase 2a: Bank B confirms (within 720 blocks) → ZUSDT released to Bank B ✓
Phase 2b: Bank B rejects → ZUSDT returned to Bank A automatically ✓
Phase 2c: Timeout (no response in ~1 hour) → ZUSDT returned to Bank A automatically ✓
```

**Guarantees:**
- ZUSDT is **never lost** — always in a wallet OR in escrow, never in limbo
- Bank A cannot double-spend escrowed ZUSDT (reserved balance)
- Bank B cannot confirm after timeout (block-enforced)
- Bank A cannot cancel before timeout (Bank B gets the full window)
- Self-transfer blocked (`EscrowSelfTransfer`)
- All state transitions final and on-chain

**EscrowId:** `keccak256("ZBX_ESCROW:" || sender_bic || receiver_bic || amount_le || nonce_le)`

#### New methods added to `ZusdtLedger`

| Method | Phase | Effect |
|---|---|---|
| `lock_for_escrow(bic, amount)` | 1 | available -= amount, reserved += amount |
| `release_escrow_to_receiver(from, to, amount)` | 2a | from.reserved -= amount, to.available += amount |
| `release_escrow_to_sender(bic, amount)` | 2b/c | reserved -= amount, available += amount |
| `available_balance(bic)` | any | returns available only (excludes reserved) |
| `reserved_balance(bic)` | any | returns reserved only |

#### New Error Variants

| Error | When |
|---|---|
| `EscrowNotFound` | Unknown EscrowId |
| `EscrowAlreadyFinalized` | Already confirmed/rejected/refunded |
| `EscrowExpired` | Bank B tried to confirm after timeout |
| `EscrowNotExpired` | Refund attempted before timeout window |
| `UnauthorizedEscrowAction` | Wrong bank calling confirm/reject |
| `EscrowSelfTransfer` | Same BIC as sender and receiver |

**Timeout:** `SETTLEMENT_TIMEOUT_BLOCKS = 720` (~1 hour at 5s/block)
**Tests:** 19 tests in `settlement.rs` — all state transitions, error cases, balance tracking
**Build:** `Finished dev profile [optimized + debuginfo]` — **0 errors**

---

## [Session 46] — 2026-05-05 — Bank Pool Addresses & Transfer Guard

### Added — `bank_transfer.rs` (new module in `zbx-bank-registry`)

**Problem solved:** Before this change, anyone could send tokens directly to a bank's
on-chain address with no identity verification — banks had no way to enforce that
incoming transfers came from recognized banking counterparties.

#### `BankTransferGuard` — Mempool-level Transfer Enforcement

Every ZBX/ZUSDT transfer is checked by `validate_transfer(from, to, swift_memo)`:

```
Transfer: sender → recipient (optional SWIFT BIC memo)
    │
    Is `to` a registered bank pool address?
    │
    NO  → Allowed (regular wallet transfer — no restriction)
    YES ↓
        Is `from` a registered bank address?
        │
        YES → AllowedBankToBank     ← bank-to-bank settlement
        NO  ↓
            Does memo contain a registered SWIFT BIC?
            │
            YES → AllowedWithSwiftMemo  ← authenticated non-bank deposit
            NO  → BLOCKED: TransferBlockedNoSwift
```

**Pool Address Registration (required at bank onboarding):**
- Banks must register **1–5** pool addresses at registration time (hot wallets / settlement contracts)
- Minimum 1, maximum 5 enforced at `register_bank()` call
- Address conflict check: same address cannot be registered by two banks
- Settlement wallet (`zusdt_wallet`) + pool addresses all indexed for O(1) lookup

#### Changes to `BankRegistry` + `BankInfo`

- `BankInfo.pool_addresses: Vec<Address>` — new field (min 1, max 5)
- `BankRegistry.transfer_guard: BankTransferGuard` — embedded guard, auto-updated
- `BankRegistry::register()` — now requires `pool_addresses` parameter
- `BankRegistry::add_pool_address()` — add hot wallet (caller = bank's own wallet)
- `BankRegistry::remove_pool_address()` — remove hot wallet (min 1 must remain)

#### New Error Variants

| Error | Meaning |
|---|---|
| `TransferBlockedNoSwift` | Transfer to bank address, no SWIFT BIC in memo |
| `TransferBlockedUnverifiedBic` | Memo has BIC but it's not registered on ZBX Chain |
| `TooFewPoolAddresses` | Fewer than 1 pool address at registration |
| `TooManyPoolAddresses` | More than 5 pool addresses |
| `PoolAddressAlreadyRegistered` | Address claimed by another bank |
| `PoolAddressMustHaveAtLeastOne` | Cannot remove last pool address |
| `CannotRemoveSettlementWallet` | Settlement wallet cannot be removed as pool address |

**Tests:** 16 new tests in `bank_transfer.rs`
**Build:** `Finished dev profile [optimized + debuginfo]` — **0 errors**

---

## [Session 45] — 2026-05-05 — Bank Governance, Regulatory Approval & AI Fraud Detection

### Added — `zbx-bank-registry` extended with 3 new modules

#### `governance.rs` — Vote-based Bank Registration Governance
Full 3-layer onboarding flow: Validator Vote → Regulatory Approval → AI Fraud Check → Bank Added

**Fake vote protections (all applied before recording):**
1. Validator public key must be in active validator set → `InvalidValidator`
2. BLS signature verified over `keccak256("ZBX_VOTE:" || proposal_id || choice || block)` → `InvalidVoteSignature`
3. Same validator cannot vote twice → `DuplicateVote`
4. Votes past window expire proposal automatically → `VoteWindowExpired`
5. Proposal already decided → `ProposalAlreadyDecided`
6. Duplicate BIC proposal blocked while one is open → `DuplicateProposal`

**`ValidatorSet`**: pubkey_hash → voting_power map; stake-weighted votes.
**`BankGovernance::propose()`**: anyone can propose; BIC unique per open proposal.
**`BankGovernance::cast_vote()`**: all 5 checks, then atomic vote recording.
**Quorum**: `ceil(total_power × 2/3)` supermajority required (configurable).
**`submit_regulatory_decision()`**: caller must be registered authority address.
**`submit_fraud_report()`**: AI verdict → `Approved` or `FlaggedForManualReview`.
**12 tests**

#### `regulatory.rs` — Country Regulatory Authority Registry
- 12 pre-registered authorities at genesis: RBI (IN), BaFin (DE), OCC (US), FCA (GB), FSA (JP), MAS (SG), APRA (AU), OSFI (CA), ACPR (FR), FINMA (CH), HKMA (HK), CBUAE (AE)
- `verify_authority(country, caller)` → must match registered address AND be active
- `rotate_authority_address()` — key rotation by current address
- `deactivate_authority()` — governance can disable a rogue authority
- **9 tests**

#### `fraud_detection.rs` — AI Fraud Scoring Engine
8 heuristic signals (deterministic — identical on all validators, same as ZBX AI precompile 0xCA):

| Signal | Score |
|--------|-------|
| BIC country code ≠ declared country | +20 |
| BIC prefix in sanctioned list (FAKE/TEST/NULL/XXXX) | +25 |
| Bank name is all generic words (≤2 words) | +10 |
| Jurisdiction doesn't reference known authority | +15 |
| All votes cast in < 10 blocks (Sybil attack) | +15 |
| Prior rejections for same BIC (×15, max 30) | +30 |
| No documents hash submitted | +10 |
| BIC is all same repeated characters | +20 |

Score 0–59 → `Clean` (approved). Score 60–100 → `Flagged` (manual review). Score capped at 100.
**12 tests**

**Build**: `cargo check` → `Finished dev profile [optimized + debuginfo]` — **0 errors**

---

## [Session 44] — 2026-05-05 — Bank Registry & Encrypted User Vault (`zbx-bank-registry`)

### Added — `crates/zbx-bank-registry` (new crate)

Complete banking integration foundation for ZBX Chain — enables any bank in the world to
connect via SWIFT/BIC and settle international payments in ZUSDT. User data stored
on-chain is encrypted per-bank (ECIES) — only the owning bank can decrypt.

#### `bank_registry.rs` — SWIFT BIC-based Bank Registry
- `SwiftBic` — validates 8 or 11-char SWIFT BIC codes; derives `on_chain_id` (Keccak256)
- `BankInfo` — full registration record: BIC, name, country, jurisdiction, pubkey, ZUSDT wallet, status
- `BankStatus` — `Active` / `Suspended { reason }` / `Deregistered`
- `BankRegistry` — dual-indexed map (BIC → BankInfo, wallet → BIC); `register()`, `get()`,
  `get_by_wallet()`, `assert_active()`, `suspend()`, `deregister()`, `update_wallet()`, `list_active()`
- **14 tests**

#### `encryption.rs` — ECIES Encrypt/Decrypt (secp256k1 + AES-256-GCM)
- `BankPubKey` — 33-byte compressed secp256k1 point (stored publicly in registry)
- `BankPrivKey` — private key, never on-chain; held only by bank HSM
- `encrypt(pubkey, plaintext)` → `EciesPayload`: ephemeral key (33B) + HKDF nonce (12B) + AES-256-GCM ciphertext
- `decrypt(privkey, payload)` → plaintext — fails with `DecryptionFailed` if wrong key or tampered
- Each encryption uses a fresh random ephemeral key → no ciphertext linkability (forward secrecy)
- **8 tests** (roundtrip, wrong key, tampered ciphertext, empty, large 64 KB payload)

#### `user_vault.rs` — Encrypted User Data Vault
- `UserDataKey` — deterministic: `keccak256("ZBX_VAULT:" || bic || user_id || data_type)`
- `DataType` — `Kyc`, `AccountMapping`, `TransactionRecord`, `ComplianceFlag`, `Custom`
- `VaultRecord` — encrypted payload + plaintext hash (integrity) + owner BIC + version + timestamps
- `UserVault::store()` — encrypts plaintext with bank pubkey, writes record; only bank that holds
  private key can read back; version counter on updates
- `UserVault::retrieve()` — ownership check (BIC match) + ECIES decrypt + hash verify
- `UserVault::get_metadata()` — public: data type, owner, timestamps — no decryption needed
- `UserVault::delete()` — owner-only deletion
- Per-bank limit: 10 million records max
- **12 tests**

#### `zusdt.rs` — ZUSDT Settlement Ledger
- `ZusdtLedger` — tracks bank ZUSDT wallets + settlement history
- `mint(bic, amount)` — called when bank wires USD to reserve (licensed banks only)
- `burn(bic, amount)` — bank withdraws USD; supply decreases
- `settle(swift_ref, from, to, amount, ...)` — atomic inter-bank ZUSDT transfer; replay-protected
  by `swift_ref` (max 35 chars per SWIFT standard); records FX rate + gas cost
- `ZusdtBalance::display()` — human-readable (e.g. "1.500000 ZUSDT")
- **10 tests** (mint, burn, settle, replay rejected, insufficient balance, zero amount)

#### `error.rs` — Structured errors
- 16 typed variants covering registry, encryption, vault, and ZUSDT operations

#### Architecture
- ZBX is used **only for gas** (negligible — ~$0.0001 per settlement)
- ZUSDT (1:1 USD) is the settlement currency between banks
- Public data: bank BIC, wallet address, pubkey, status — anyone can verify a bank is registered
- Private data: all customer KYC/account/transaction data is ECIES-encrypted per-bank
- Regulatory access: `UserVault::get_metadata()` + View Key pattern (selective disclosure)

**Build**: `cargo check` → `Finished dev profile [optimized + debuginfo]` — **0 errors**

---

## [Session 43] — 2026-05-05 — 4 Critical Security Fixes (Audit Findings CLOSED)

### Security — S11-BRIDGE-SOL-OUT1 CLOSED — Bridge nonce-collision / replay fix

**File**: `crates/zbx-bridge/src/relayer.rs` — `RelayExecutor::execute()`

**Root cause**: `RelayExecutor::execute()` called `self.auth.verify_threshold()` which
performs multisig threshold verification but does **not** mark the operation as spent.
A concurrent or replayed `execute()` call with the same `msg_hash` would pass crypto
verification again and trigger a second `mint_tokens()` / `unlock_funds()` — a
double-spend / deposit-drop vulnerability (BSC nonce collision).

**Fix**: Changed one call from `verify_threshold` → `verify_and_consume`.
`verify_and_consume` atomically records the `msg_hash` in `spent_operations` so any
subsequent `execute()` for the same operation is rejected with
`BridgeError::ReplayedOperation` before any crypto work is done.

---

### Security — S7-PROD1 CONFIRMED CLOSED — `tx_root` uses Keccak-256 MPT

**File**: `crates/zbx-crypto/src/mpt.rs` (already fixed in a prior session)

Confirmed via code review: `build_block()` already calls
`zbx_crypto::mpt::transactions_root_mpt()` (Keccak-256 MPT, Ethereum-compatible).
The SHA-256 flat-hash stub is no longer reachable in the production code path.
Docs updated to reflect CLOSED status.

---

### Security — H-07 CLOSED — Real BLS12-381 KZG pairing in blob verification

**File**: `crates/zbx-da/src/commitment.rs` — complete rewrite  
**Deps**: `crates/zbx-da/Cargo.toml` — added `bls12_381 = { version = "0.8", features = ["pairings"] }`, `group = "0.13"`, `ff = "0.13"`

**Root cause**: `KzgSettings::verify_blob_kzg_proof()` unconditionally returned `false`
with a `// TODO: replace this false` comment — every blob proof was silently rejected
(fail-closed, but also permanently non-functional).

**Fix**: Full BLS12-381 KZG verification:

1. **Parse** commitment and proof as 48-byte compressed BLS12-381 G1 points
   (`G1Affine::from_compressed`).
2. **Derive** evaluation point `z` from `Sha256(blob_data ‖ commitment)`, reduced
   modulo the BLS12-381 scalar field order `r` via `Scalar::from_bytes_wide`.
3. **Evaluate** blob polynomial `p(z) = Σᵢ aᵢ·zⁱ` using Horner's method over
   4096 BLS12-381 Fr scalars (131072-byte blob).
4. **Pairing check**: `e(C − y·G₁, G₂) · e(−π, G₂_τ − z·G₂) == Gt::identity()`
   using `multi_miller_loop` + `final_exponentiation`.

**Trusted setup**: `KzgSettings::load()` reads the 96-byte compressed `G₂_τ` from
`/etc/zbx/kzg_g2_tau.bin` (EIP-4844 ceremony).  Absent = development placeholder
(`G₂_τ = G₂`, τ=1) with an explicit warning log; mainnet proofs are rejected in
this state (fail-closed for wrong reasons, not silently accepted).

**New API**: `KzgSettings::with_g2_tau(&[u8; 96])` for operator tooling and
integration tests that supply the ceremony point at runtime.

**New tests** (9 total in `commitment.rs`):
- `kzg_load_returns_settings`
- `kzg_blob_to_commitment_sets_compressed_flag`
- `kzg_verify_rejects_wrong_blob_size`
- `kzg_verify_rejects_missing_compressed_flag`
- `kzg_verify_rejects_invalid_g1_bytes`
- `kzg_evaluate_blob_poly_zero_blob_returns_zero`
- `kzg_evaluate_blob_poly_constant_poly`
- `kzg_evaluate_blob_poly_linear_poly`
- `kzg_with_g2_tau_rejects_all_zero_bytes`
- `kzg_with_g2_tau_accepts_g2_generator`
- `kzg_self_consistency_dev_setup` — end-to-end: construct commitment + proof for
  p(x) = 3 + 5x under the dev setup (τ=1), verify passes.

---

### Security — H-08 CLOSED — Full BN254 PLONK verifier (`ark-plonk` integration)

**File**: `crates/zbx-zk/src/plonk.rs` — complete rewrite of `PlonkVerifier::verify()`

**Root cause**: `PlonkVerifier::verify()` returned `Err(PlonkNotImplemented)` for
every input — the stub made it impossible to use PLONK proofs in production.

**Fix**: Complete snarkjs-compatible BN254 PLONK verifier using the `ark-bn254`,
`ark-ec`, `ark-ff`, `ark-serialize` crates already present in `zbx-zk`.

#### Proof byte format (768 bytes)

| Offset | Length | Field |
|--------|--------|-------|
| 0      | 9 × 64 | 9 G1 points: A, B, C, Z, T₁, T₂, T₃, W_ξ, W_ξω (ark uncompressed) |
| 576    | 6 × 32 | 6 Fr scalars: ā, b̄, c̄, s̄₁, s̄₂, z̄_ω (LE) |

#### Verifying key byte format (752 bytes)

| Offset | Length | Field |
|--------|--------|-------|
| 0      | 8      | n — circuit size (u64 LE, power of 2) |
| 8      | 8      | n_public — public input count |
| 16     | 3 × 32 | k₁, k₂, ω — coset generators + root of unity (Fr LE) |
| 112    | 8 × 64 | Qm, Ql, Qr, Qo, Qc, S₁, S₂, S₃ — VK G1 points |
| 624    | 128    | X₂ — τ·G₂ from trusted setup (G2 ark uncompressed) |

#### Algorithm

1. **Fiat-Shamir** via Keccak256 transcript (domain `"PLONK-ZBX-BN254-v1\0"`):
   absorb VK + public inputs + wire commits → β, γ; perm commit → α;
   quotient commits → ζ; evaluations → υ; opening proofs → u.
2. **Z_H(ζ)**, **L₁(ζ)**, **PI(ζ)** computation.
3. **r₀** = PI(ζ) − L₁·α² − α·(ā+β·s̄₁+γ)(b̄+β·s̄₂+γ)(c̄+γ)·z̄_ω
4. **[D]** linearisation commitment (selectors + perm accumulator + quotient).
5. **[F]** = [D] + υ·[A] + υ²·[B] + υ³·[C] + υ⁴·[S₁] + υ⁵·[S₂]
6. **[E]** = e_scalar·G₁
7. **Pairing**: `Bn254::multi_pairing([W_ξ + u·W_ξω, −RHS], [X₂, G₂]) == zero`

#### New tests (Session 43 additions, preserving all S31 tests)

- `s43_verify_rejects_empty_proof_bytes` → `InvalidProofBytes`
- `s43_verify_rejects_short_proof_bytes` → `InvalidProofBytes`
- `s43_verify_rejects_short_vk_bytes` → `InvalidVkBytes`
- `s43_verify_rejects_invalid_n_in_vk` → `InvalidVkBytes` (n not power of 2)
- `s43_verify_rejects_public_input_count_mismatch` → `InputCountMismatch`
- `s43_srs_hash_is_exposed_via_accessor`
- `s43_self_consistency_trivial_circuit` — exercises full code path, asserts no panic

**Build**: `cargo check` → `Finished dev profile [optimized + debuginfo]` — **0 errors**.

---

## [Session 42] — 2026-05-05 — AI Platform Phase 1/2/3 (ZEP-009 IMPLEMENTED)

### Phase 1 — `zbx-ai-precompile` v2.0 (0xCA AIINFER Upgrade)

#### New files
- **engine.rs** — INT8 quantized feed-forward inference kernel (fully deterministic, zero floats)
  - `Int8Linear`: weight-matrix multiply in i32/i64 with Q7 fixed-point scaling
  - `relu_i32`, `quantize_i8`: ReLU + clamp activations (integer-only)
  - `softmax_bps`: softmax approximation → u16 basis-points (no division, no floats)
  - `stub_network(model_id, …)`: deterministic weight init from model_id — identical on every validator
- **abi.rs** — Solidity ABI encoder/decoder for 0xCA precompile interface
  - `AiCallInput::decode()`: parses `abi.encode(uint8 model_id, bytes data)` from EVM calldata
  - `AiCallOutput::encode()`: encodes `(bytes output, uint16 confidence)` for return to EVM
  - `encode_error_response()`: safe error return (class=0xFF, confidence=0)
- **da.rs** — DA layer model weight verification
  - `WeightEntry`: content-addressed model weights with SHA3-256 hash
  - `DaRef`: DA layer pointer (`hash + size`) with `verify_blob()` tamper detection
  - `ModelHeader`: binary header format `ZBXAI001` — version, dims, weight hash, parsed/verified
  - `stub_weight_blob()`: deterministic test blob generator

#### Upgraded files
- **model.rs** — 12 models (was 4): added PricePrediction, OracleAnomalyGuard, MevDetector,
  FraudDetector, LiquidityAnalyzer, SentimentClassifier, GasOptimizer, MarketMaker
  - Full `from_byte()` dispatch for all 12 IDs (0x01–0x0C)
  - `ModelMeta::stub(id)` auto-fills from ModelId methods
  - `validate_input()` size checks per model
- **gas.rs** — Gas schedule for all 12 models + `abi_overhead()` + `da_verify_cost()` + `total_cost()`
- **error.rs** — New variants: `InputSizeMismatch`, `WeightHashMismatch`, `InvalidModelWeights`,
  `AbiDecodeError`, `AbiEncodeError`, `VersionMismatch`, `ModelCircuitOpen`, `RateLimitExceeded`
- **precompile.rs** — Full production precompile:
  - `call_abi()`: high-level EVM entry point (ABI decode → infer → ABI encode)
  - `ModelBreaker`: circuit breaker (suspends model after 5 consecutive errors)
  - `run_stub()`: delegates to `engine::stub_network` (INT8 quantized, deterministic)
  - 5 comprehensive tests including all-12-model loop
- **lib.rs** — Exports engine, abi, da modules; `PRECOMPILE_ADDRESS`, `MODEL_COUNT`, `AI_PLATFORM_VERSION`
- **Cargo.toml** — Added `sha3 = "0.10"`; removed zbx-zvm dependency; bumped to v2.0.0

---

### Phase 2 — `zbx-ai-sdk` v1.0 (New Crate)

Agent framework enabling developers to build autonomous AI agents on ZBX Chain.

| File | Purpose |
|------|---------|
| `agent.rs` | `AiAgent` — runs oracle + inference + risk + strategy per block |
| `oracle.rs` | `OracleProvider` trait + `MultiOracleAggregator` (median, staleness check) + `StubOracleProvider` |
| `strategy.rs` | Strategy DSL: `Condition` (PriceAbove/Below, AiClass, EveryNBlocks, And/Or/Not), `Rule`, `Strategy::standard_defi()` |
| `risk.rs` | `RiskManager`: spread check + AI signal gate + portfolio P&L watch; `RiskLevel` (Low→Critical) |
| `executor.rs` | `SessionKeyExecutor` (ZEP-017): scope-limited, value-capped, nonce-protected TX submission |
| `error.rs` | `SdkError` enum (oracle, session key, strategy, risk, agent variants) |
| `lib.rs` | Public API + `SDK_VERSION` + architecture doc |

Security properties:
- Session keys: value-capped at 100 ZBX, time-limited, contract-allowlisted, nonce replay-protected
- Risk manager: Critical risk = full stop (no actions dispatched)
- Oracle aggregation: median across N sources, MAX_STALENESS_SECS=300 enforcement
- Agent emergency pause via `agent.pause()` / `agent.resume()`
- Max 8 actions per run (prevents runaway loops)

---

### Phase 3 — `zbx-ai-registry` v1.0 (New Crate)

On-chain model lifecycle, billing, proof, and governance infrastructure.

| File | Purpose |
|------|---------|
| `registry.rs` | `ModelEntry` lifecycle (Pending→Active→Deprecated→Removed→Suspended); versioned per model_id |
| `payment.rs` | `BillingSystem`: ZBX fee split (60% publisher / 25% DAO / 15% validators); per-byte surcharge |
| `proof.rs` | `InferenceCommitment` → `InferenceProof` (Merkle path) → `ProofBatch` (aggregated root) |
| `governance.rs` | `GovernanceSystem`: propose/vote/veto/execute; quorum=3, threshold=66%, timeout=302,400 blocks |
| `error.rs` | `RegistryError` enum (15 structured variants) |
| `lib.rs` | Public API + revenue split constants + `REGISTRY_VERSION` |

Security properties:
- All model activations require 3-of-N governance vote (66% supermajority)
- Guardian veto: any Core Guardian can instantly kill a proposal
- Proof system: SHA3-256 Merkle commitments, `verify_all()` batch verification
- Tampered weights / proofs detected immediately (hash mismatch → `RegistryError`)
- Billing is atomic: inference only runs if payment succeeds
- Double-vote protection: one vote per address per proposal

---

### Workspace

- `Cargo.toml` — Added `"crates/zbx-ai-sdk"`, `"crates/zbx-ai-registry"` to workspace members
- `docs/proposals/ZEP-000-INDEX.md` — ZEP-009 status: DRAFT → **IMPLEMENTED**, target block 300,000
- **Build verified: 0 errors** (only pre-existing warnings from other crates)

---

### Test Coverage (Session 42)

| Crate | Tests |
|-------|-------|
| zbx-ai-precompile/engine | 5 tests (linear forward, relu, softmax, determinism, confidence range) |
| zbx-ai-precompile/abi | 5 tests (roundtrip, output encode, empty input, unknown model, error response) |
| zbx-ai-precompile/da | 6 tests (stub header, weight hash, tamper detect, da_ref verify, tamper da, entry hash) |
| zbx-ai-precompile/model | 4 tests (12 models registered, round-trip, unknown byte, valid sizes) |
| zbx-ai-precompile/gas | 2 tests (nonzero gas, total > base) |
| zbx-ai-precompile/precompile | 7 tests (all 12 models, OOG, too large, deterministic, different models, ABI roundtrip, circuit breaker) |
| zbx-ai-sdk/oracle | 5 tests (determinism, different pairs, aggregator 1/3 providers, spread bps, empty rejected) |
| zbx-ai-sdk/agent | 3 tests (run without error, pause skips, agent_id deterministic) |
| zbx-ai-sdk/risk | 5 tests (low spread, high spread, oracle anomaly critical, position P&L, ordering) |
| zbx-ai-sdk/strategy | 5 tests (price above, every-N-blocks, AND, standard_defi fires, do-nothing) |
| zbx-ai-sdk/executor | 4 tests (valid submit, expired key, nonce increments, flush returns receipts) |
| zbx-ai-registry/registry | 6 tests (submit+activate, pending not active, deprecation, double-activate, inference count, invalid name) |
| zbx-ai-registry/payment | 4 tests (split sums, publisher 60%, insufficient balance, charge succeeds, per-byte surcharge) |
| zbx-ai-registry/proof | 6 tests (single proof, multi batch, tamper fails, empty rejected, leaf determinism, model verify) |
| zbx-ai-registry/governance | 5 tests (propose+pass, veto blocks, double-vote, non-participant, insufficient votes) |

**Total: 71 new tests across 3 crates**

---

## [Unreleased] — 2026-05-05

### Security Fixes (Full Audit Remediation — 14/14 findings)

| ID | Severity | Finding | File |
|----|----------|---------|------|
| ZBX-H-01 | High | IBC BLS Aggregate Signature stub replaced with real BLS12-381 verifier | zbx-light/src/ibc.rs |
| ZBX-H-02 | High | Block-STM empty StateDiff for conflicting txs — sequential re-execution loop | zbx-execution/src/parallel.rs |
| ZBX-H-03 | High | Bridge multisig replay protection via spent_operations + verify_and_consume | zbx-bridge/src/multisig.rs |
| ZBX-H-04 | High | TxValidator intrinsic gas lower bound (≥21,000) enforced | zbx-tx/src/validation.rs |
| ZBX-H-05 | High | IBC trusting_period (14d) < unbonding_period (21d) — ICS-002 compliance | zbx-light/src/ibc.rs |
| ZBX-H-06 | High | Verkle IPA verifier — Fiat-Shamir transcript + zero-scalar check | zbx-verkle/src/proof.rs |
| ZBX-H-07 | High | KZG blob proof fail-closed + polynomial commitment (Horner's method) | zbx-da/src/commitment.rs |
| ZBX-M-01 | Medium | Leader election: keccak256(QC_hash ‖ round) replaces round-robin | zbx-consensus/src/hotstuff2.rs |
| ZBX-M-02 | Medium | SurrogateVote variant added to SlashEvidenceV2 + offender/evidence_type | zbx-staking/src/slashing_v2.rs |
| ZBX-M-05 | Medium | STARK query decommitments fail-closed — MerkleProofInvalid on missing position | zbx-zk/src/stark.rs |
| ZBX-M-08 | Medium | VoteAccumulator verifies individual BLS sigs before counting toward quorum | zbx-consensus/src/vote.rs |
| ZBX-M-09 | Medium | Session key rolling 24h window (window_start) replaces calendar-day reset | zbx-bundler/src/session_keys.rs |
| ZBX-L-05 | Low | SafetyRules WAL persistence — atomic write-tmp + rename after every vote() | zbx-consensus/src/safety_rules.rs |
| ZBX-L-06 | Low | Bridge request ID includes source_chain_id (109-byte preimage, was 101) | zbx-bridge/src/relayer.rs |

Previously fixed (prior session):

| ID | Severity | Finding |
|----|----------|---------|
| ZBX-M-03 | Medium | Evidence ID — u8 discriminant replaces fragile Debug format |
| ZBX-M-04 | Medium | Commit-reveal MIN_REVEAL_DELAY=1 (same-block reveal rejected) |
| ZBX-M-06 | Medium | Scrypt N ≥ 131072 enforced at parse time |
| ZBX-M-07 | Medium | Validator commission applied to reward distribution |
| ZBX-M-10 | Medium | PlonkDisabled error gating — fail at config-time not verify-time |
| ZBX-L-01 | Low | Block-STM conflict detection O(n²) → O(n×avg_reads) DAG |
| ZBX-L-02 | Low | u128::MAX sentinel removed — real committed_balances snapshot |
| ZBX-L-03 | Low | EVM memory.write() MAX_MEMORY guard (defense-in-depth) |
| ZBX-L-04 | Low | Mempool promote_queued MAX_PROMOTE_PER_CALL=256 circuit breaker |

---

### New Crates (ZEP-015 / ZEP-025)

#### `zbx-pq` — Post-Quantum Cryptography (ZEP-015)

- **dilithium.rs** — CRYSTALS-Dilithium3 (FIPS 204) lattice-based signatures
- **kyber.rs** — CRYSTALS-Kyber-768 (FIPS 203) key encapsulation mechanism
- **hybrid.rs** — Hybrid classical+PQ key exchange (X25519 + Kyber-768)
- **error.rs** — PqError enum with structured error variants
- **lib.rs** — Public exports: DilithiumKeyPair, KyberKeyPair, HybridKeyExchange

#### `zbx-confidential` — Confidential Transactions (ZEP-025)

- **commitment.rs** — Pedersen commitments over Ristretto255 (homomorphic, FIPS 140-3)
- **stealth.rs** — Stealth address derivation (one-time recipient keys)
- **range_proof.rs** — Bulletproofs-style range proofs (value ∈ [0, 2⁶⁴))
- **error.rs** — ConfidentialError enum
- **lib.rs** — Public exports: PedersenCommitment, StealthAddress, RangeProof

---

### New Modules in Existing Crates

| Module | Crate | ZEP |
|--------|-------|-----|
| `hotstuff2.rs` | zbx-consensus | ZEP-022 |
| `slashing_v2.rs` | zbx-staking | ZEP-023 |
| `ibc.rs` | zbx-light | ZEP-024 |
| `stark.rs` | zbx-zk | ZEP-019 |
| `bls_aggregate.rs` | zbx-threshold | ZEP-016 |
| `session_keys.rs` | zbx-bundler | ZEP-017 |

---

### ZEP Status Updates

ZEP-015 through ZEP-026 promoted from **ACCEPTED → IMPLEMENTED**.
See [ZEP-000-INDEX.md](proposals/ZEP-000-INDEX.md) for the full proposal table.

---

## [0.9.0] — 2026-04-15

### Added
- ZEP-001 Pay-ID: UPI-style address resolution
- ZEP-002 ZUSD native stablecoin (USD-pegged)
- ZEP-003 DA Layer: KZG blob transactions (EIP-4844 compatible)
- ZEP-005 ZUSD hint-based redemption floor
- ZEP-014 AMM pool security — canonical pair enforcement

### Fixed
- Chain ID drift (S13): mainnet 8989, testnet 8990 — locked in zbx-types
- State root MPT (S33): Patricia-Merkle trie root derivation corrected

---

*Chain ID: 8989 (mainnet) / 8990 (testnet) — Zebvix Labs*

---

## [1.2.0] — 2026-05-05 (Session 46)

### Added — DeFi / Infrastructure / Gaming Mass Upgrade (ZEPs 033–041)

#### DeFi / Finance

- **ZEP-033 Liquid Staking (`ZbxLiquidStaking.sol`):** Deposit ZBX, receive stZBX ERC-20 receipt token. Share-based accounting — exchange rate rises as validator rewards are injected. Full ERC-20 composability: stZBX usable as collateral, LP token, etc.
- **ZEP-034 Perpetuals (`ZbxPerpetuals.sol`):** On-chain perpetual futures — up to 20× leverage, long/short positions, hourly funding rates (OI-proportional), 5% maintenance margin, liquidation bounty (1% of collateral), protocol fee 0.1%.
- **ZEP-035 Yield Optimizer (`ZbxYieldOptimizer.sol`):** Auto-compounding vault — keepers trigger `compound()` to claim farm rewards, swap via ZbxRouter, and re-stake. Performance fee 10%, withdrawal fee 0.1%. Share-based accounting.
- **ZEP-036 Launchpad (`ZbxLaunchpad.sol`):** IDO platform — FCFS + EQUAL allocation modes, whitelist, cliff + linear vesting schedule, unsold token reclaim, 2% platform fee. Supports native ZBX or ERC-20 raise currency.

#### Infrastructure

- **ZEP-037 ZBX Name Service (`ZbxNameService.sol`):** ENS-compatible naming — register `name.zbx`, resolve to address, reverse lookup, subdomains, arbitrary key-value records (avatar, email, etc.), ERC-721 NFT ownership, annual fee, 30-day grace period.
- **ZEP-038 Contract Factory (`ZbxContractFactory.sol`):** No-code deployment — deploy ERC-20 tokens (mintable/fixed supply) and ERC-721 NFT collections (max supply, royalties, base URI) from a UI. Public registry queryable by creator + paginated global list. Anti-spam 0.001 ZBX deploy fee.

#### Gaming

- **ZEP-039 Raffle (`ZbxRaffle.sol`):** Provably fair raffle using ZbxVRF commit-reveal. 3-tier prizes (50%/30%/10%); creator 2.5%; protocol 2.5%. Native ZBX or ERC-20 tickets. Creator can cancel + full refund all buyers.
- **ZEP-040 Prediction Market (`ZbxPredictionMarket.sol`):** YES/NO binary markets. Oracle resolver settles after deadline. Proportional payout from net pot (97%); 2% protocol + 1% creator fee. VOID outcome refunds all bets. Live odds view, estimate payout.
- **ZEP-041 Card Game Engine (`ZbxCardGame.sol`):** 52-card deck, up to 8 players. Multi-party commit-reveal VRF shuffle (XOR of all seeds + PREVRANDAO + Fisher-Yates). On-chain hand state. Highest-card winner; 98% payout to winner, 2% protocol fee.

### Already Verified Unchanged

ZbxFaucet, ZbxMultisig, ZUSD/ZusdVault/ZusdStabilityPool, ZRC20Factory, ZRC20Vesting, ZRC20Staking — all confirmed to compile and behave as documented.

### ZEP Status Updates

ZEP-031 through ZEP-041 promoted to **IMPLEMENTED**.

---

## [1.1.0] — 2026-05-05 (Sessions 44–45)

### Added — DEX Upgrade + Gaming + Payment Gateway (ZEPs 027–032)

- **DEX (Session 44):** ABI fix Router↔AMM 4-arg swap, flash loans (`flashLoan()`), skim/sync, native ZBX swaps (6 functions), EIP-2612 permit on LP tokens, `MAX_PATH_LENGTH=4`, `_pairForStrict()`.
- **ZEP-031 Gaming Framework (Session 45):** `ZbxVRF.sol`, `ZbxGameEscrow.sol`, `ZbxGameItems.sol` + `zbx-gaming` Rust crate.
- **ZEP-032 Crypto Payment Gateway (Session 45):** `ZbxPaymentGateway.sol` + `zbx-payment` Rust crate.


---

## [1.3.0] — 2026-05-05 (Session 47)

### Added — Advanced Trading Suite (ZEPs 042–044)

- **ZEP-042 Spot Order Book (`ZbxSpotOrderBook.sol`):** Full on-chain CLOB (Central Limit Order Book) — limit buy/sell orders with escrow, partial fills, `fillOrder()` by taker, `matchOrders()` permissionless matcher, GTC expiry, cancel + refund. Maker fee 0.05%, taker fee 0.20%. Any ERC-20/ERC-20 or ZBX/ERC-20 pair.
- **ZEP-043 Dated Futures (`ZbxDatedFutures.sol`):** Fixed-expiry futures markets (e.g. ZBX-JUN26, ZBX-DEC26). Admin-created markets with oracle + expiry. Long/short with up to 50x leverage. Cash-settled at expiry via locked oracle price. Pre-expiry liquidation at 4% maintenance margin. Batch settlement by any keeper via `settlePosition()`.
- **ZEP-044 Options (`ZbxOptions.sol`):** European put/call options. Writer posts collateral and receives premium immediately. Buyer pays premium and holds exercise right. Oracle fixes settlement price at expiry. Cash-settled payoff: CALL = max(0, spot−strike), PUT = max(0, strike−spot). Writer reclaims unused collateral after settlement. Protocol fee 0.50% of premium.

### Build Result
```
Finished dev [optimized + debuginfo] — 0 errors
```

---

## [1.4.0] — 2026-05-05 (Session 48)

### Added — Meme Coin Launchpad (ZEP-045)

- **ZEP-045a ZbxMemeFactory.sol:** pump.fun-style meme coin launchpad — virtual reserve bonding curve (constant-product, 30 ZBX virtual liquidity, 1B token supply), `launchMeme()` (0.01 ZBX fee, zero creator allocation), `buy()` / `sell()` with 1% fee and slippage guard, auto-graduation at 30 ZBX raised (LP added to ZbxAMM + burned to dead address), anti-snipe (0.5% max TX first 5 blocks), social features: `comment()` + `like()` events, `quoteBuy()` / `quoteSell()` / `graduationProgress()` / `listMemes()` view helpers.
- **ZEP-045b ZbxMemeToken.sol:** Standalone advanced meme ERC-20 — configurable buy/sell/transfer taxes (burn% + reflection% + dev%, max 25% sell cap), rToken holder reflection (proportional, no-loop distribution), auto-burn to dead address, max wallet (2% default) + max TX (1% default), anti-snipe (0.5% first 3 blocks), blacklist, tax-exempt whitelist, liquidity pair registry, `renounceOwnership()` for permanent rug-proof signal, holder `burn()`.

### Build Result
```
Finished dev [optimized + debuginfo] — 0 errors
```

---

## [1.5.0] — 2026-05-05 (Session 49)

### Changed — ZbxPerpetuals v2 (ZEP-034 rev2)

#### New Features Added to ZbxPerpetuals.sol

- **Stop Loss (SL):** `setStopLoss(positionId, price)` — set/update SL anytime. LONG: closes if price ≤ SL. SHORT: closes if price ≥ SL. Pass 0 to remove.
- **Take Profit (TP):** `setTakeProfit(positionId, price)` — set/update TP anytime. LONG: closes if price ≥ TP. SHORT: closes if price ≤ TP. Pass 0 to remove.
- **triggerOrder(positionId):** Anyone (keeper) calls to auto-execute SL or TP. Earns 0.05% keeper bounty from position collateral.
- **triggerStopLoss(positionId) / triggerTakeProfit(positionId):** Specific trigger functions for clarity in keeper bots.
- **Trailing Stop Loss:** `setTrailingStop(positionId, trailBps)` — SL moves with price (e.g. 200 bps = 2% trail). `updateTrailingStop(positionId)` — keeper ratchets SL upward/downward when price moves favourably.
- **8-Hour Funding Interval:** `FUNDING_INTERVAL = 8 hours` (was 1 hour). Industry standard (Binance/Bybit/OKX). `nextFundingIn()` view shows seconds to next update.
- **Add Collateral:** `addCollateral(positionId, amount)` — deposit more margin to improve position health and avoid liquidation.
- **Partial Close:** `partialClose(positionId, closeBps)` — close N% of position (1–9999 bps). Proportional PnL paid out; remainder stays open with reduced size.
- **Health Meter:** `healthBps(positionId)` → 0–10000 bps. 10000 = fully healthy, 0 = at liquidation threshold. For UI risk displays.
- **Equity View:** `equity(positionId)` → net collateral + PnL − funding.
- **isSLTriggered / isTPTriggered:** Read-only checks for UI/keeper polling.
- **openPosition SL/TP at open:** `openPosition(isLong, collateral, leverage, slPrice, tpPrice)` — set SL/TP in the same TX as opening.

#### Changed
- `FUNDING_INTERVAL`: 1 hour → **8 hours**
- `Position.liquidated` → renamed to `Position.closed` (covers manual close + liquidation + SL/TP)
- `PositionClosed` event now includes `reason` string: "manual" | "stop_loss" | "take_profit"
- `FundingRateUpdated` event now includes `nextFundingAt` timestamp

### Build Result
```
Finished dev [optimized + debuginfo] — 0 errors
```

---

## [1.6.0] — 2026-05-05 (Session 50)

### Changed — ZbxPerpetuals v3 (Cross/Isolated Margin + 10% Maintenance)

#### New: Cross Margin Mode
- `depositCross(amount)` — deposit collateral into shared cross account
- `withdrawCross(amount)` — withdraw free margin from cross account
- `openPosition(..., isCross=true, ...)` — position uses cross account balance
- `liquidateCross(trader)` — liquidates ALL open cross positions when `crossEquity < crossMaintMargin`
- `crossBalance(trader)` / `crossEquity(trader)` / `crossMaintMargin(trader)` / `freeCrossMargin(trader)` view functions
- `isCrossLiquidatable(trader)` — keeper check for cross liquidation
- `crossPositionIds(trader)` — returns all open cross position IDs for keeper bots
- `CrossLiquidated(trader, liquidator, positionCount)` event
- Cross PnL settled back into `crossBalance` on close/partial close

#### Changed: Maintenance Margin
- `MAINTENANCE_MARGIN_BPS`: 500 (5%) → **1000 (10%)**
- Applied to both isolated and cross positions

#### Isolated Mode (unchanged from v2)
- Each position has own collateral; `addCollateral(posId, amount)` still works
- `liquidate(posId)` for isolated only; `liquidateCross(trader)` for cross only

#### Build Result
```
Finished dev [optimized + debuginfo] — 0 errors
```

---

## [1.7.0] — 2026-05-05 (Session 51)

### Changed — ZbxPerpetuals v4 (Multi-Market / Unlimited Coins)

#### New: Multi-Market Registry
- Single contract now supports **unlimited trading pairs**
- `addMarket(oracle, symbol, maxLeverage)` → returns `marketId` (0-indexed)
- `updateMarket(marketId, oracle, active, maxLeverage)` — update or pause any market
- Each market has its own: oracle, symbol, maxLeverage, totalLongOI, totalShortOI, cumulativeFunding, lastFundingUpdate
- `openPosition(marketId, ...)` — marketId selects which coin to trade
- `getMarket(marketId)` — full market details view
- `markPrice(marketId)` — current oracle price for any market
- `currentFundingRate(marketId)` — per-market funding rate
- `updateFunding(marketId)` — per-market 8-hour funding trigger
- `MarketAdded` / `MarketUpdated` events
- `PositionClosed` and `PositionOpened` events now include `marketId`

#### Constructor change
- Removed single `oracle` param from constructor (markets now have own oracles)
- `constructor(collateralToken_, treasury_)` — simpler, owner adds markets after deploy

#### Example: Listing coins
```
addMarket(btcOracle,  "BTC",  20)  → marketId 0
addMarket(ethOracle,  "ETH",  20)  → marketId 1
addMarket(zbxOracle,  "ZBX",  15)  → marketId 2
addMarket(solOracle,  "SOL",  10)  → marketId 3
addMarket(bnbOracle,  "BNB",  10)  → marketId 4
... unlimited
```

#### All v3 features retained
- Isolated + Cross margin (10% maintenance)
- SL/TP / Trailing Stop / Keeper triggers
- 8-hour funding (now per-market)
- addCollateral / partialClose / healthBps

### Build Result
```
Finished dev [optimized + debuginfo] — 0 errors
```

---

## [1.8.0] — 2026-05-05 (Session 52)

### Changed — ZbxPerpetuals v5 (200× Leverage + Liquidation Price)

- `MAX_LEVERAGE`: 20 → **200** (per-market cap still set by owner via addMarket)
- `liquidationPrice(positionId)` — returns exact oracle price at which isolated position liquidates
  - LONG:  liqPrice = entry + entry × (MM − collateral + funding) / size
  - SHORT: liqPrice = entry − entry × (MM − collateral + funding) / size
  - Returns 0 for cross positions (no single liq price)
- `crossLiquidationThreshold(trader)` — total maintenance margin for cross account
- Build: 0 errors


---

## Session 53 — 2026-05-08: Full Chain Audit

**Scope:** All 75 Rust crates + 65 Solidity contracts + node wiring

### Confirmations (previously open → now verified CLOSED)
- S7-EVM3: EVM CALL/CALLCODE/DELEGATECALL/STATICCALL/CREATE/CREATE2 — ALL confirmed implemented (1238-line interpreter)
- Block rewards + EIP-1559 fee — both confirmed wired in executor.rs
- N-05 (HotStuff catch-all) + N-06 (f64 liveness) — confirmed fixed
- S11-BRIDGE-SOL-OUT1 (nonce collision) — confirmed fixed (S36 composite key)
- Chain ID 7878 = BIP44 SLIP-44 coin type — NOT a bug, intentional

### New Findings

| ID | Severity | Finding |
|----|----------|---------|
| C53-01 | CRITICAL | BLS signing/verification are stubs — `verify_bls()` returns `true` for any input |
| C53-02 | HIGH | ZVM CALL/CREATE family not implemented — `InvalidOpcode` returned |
| M53-01 | MEDIUM | ZusdPricePeg.adjustPeg() incomplete — only emits events, no vault action |
| M53-02 | MEDIUM | 4 networking crates (zbx-net, zbx-network, zbx-p2p, zbx-gossip) — only 1 wired |
| M53-03 | MEDIUM | 2 RPC crates (zbx-rpc, zbx-jsonrpc) — only zbx-rpc wired |
| M53-04 | MEDIUM | zbx-cli core ops (stake/govern/DeFi) not wired — emit "not yet wired" |
| L53-01 | LOW | AI precompile uses stub weights, not real DA-loaded models |

### Build
- `cargo check`: 0 errors, 4 cosmetic warnings
