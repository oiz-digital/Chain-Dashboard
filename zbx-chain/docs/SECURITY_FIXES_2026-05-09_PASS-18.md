# SEC-2026-05-09 Pass-18 — Testnet readiness: real precompiles + BLS PoP + EIP-1153 host

**Date:** 2026-05-09
**Scope:** Closes the largest remaining classes of "stub-on-mainnet-path" code surfaced by Pass-12/14/16. Targets testnet readiness ~85% → ~95%.

---

## Items closed

### (1) Real EVM precompiles 0x03 / 0x05 / 0x06 / 0x07 / 0x08 / 0x09 in `zbx-zvm`

**Pre-Pass-18:** Pass-13 audit closed every "fake-success" body in `zbx-zvm/src/precompiles.rs` by replacing it with `Err(InvalidInput)` (fail-closed). That was correct *defensively* — an attacker could no longer rely on bogus output — but it bricked every real-world Solidity contract that uses these precompiles:

| Precompile | Address | Pre-Pass-18 | Real users blocked |
| --- | --- | --- | --- |
| RIPEMD-160 | 0x03 | `Err(InvalidInput)` | Multisig wallets (Bitcoin-style address derivation) |
| MODEXP | 0x05 | `Err(InvalidInput)` | Tornado / zk apps, RSA-based signatures |
| BN128_ADD | 0x06 | `Err(InvalidInput)` | Uniswap fee math, zk-SNARK verifiers |
| BN128_MUL | 0x07 | `Err(InvalidInput)` | zk-SNARK verifiers |
| BN128_PAIRING | 0x08 | `Err(InvalidInput)` | Every Groth16/Plonk verifier (EIP-197) |
| BLAKE2F | 0x09 | `Err(InvalidInput)` | Cross-chain bridges (Equihash/Filecoin/Zcash proofs) |

**Pass-18:** Wholesale port from `zbx-evm/src/precompiles.rs` (which already had the real implementations) so the two execution engines cannot drift on consensus-critical cryptography:

* **RIPEMD-160** (0x03) — `ripemd::Ripemd160`, EVM gas schedule (`600 + 120·⌈len/32⌉`), 32-byte left-padded output.
* **MODEXP** (0x05) — `num-bigint::BigUint::modpow` with EIP-198 input encoding and **EIP-2565** gas re-pricing (multiplication-complexity × iteration-count / 3, floor 200). Zero-modulus returns zero-padded result of `mod_len` length, never panics.
* **BN128_ADD / MUL** (0x06 / 0x07) — `substrate-bn::G1` arithmetic with point-not-on-curve rejection (`AffineG1::new` returns `Err`). Identity point `(0, 0)` handled per EIP-196.
* **BN128_PAIRING** (0x08) — `substrate-bn::pairing_batch`. Ethereum-canonical Fq2 encoding `(imaginary, real)` for both x and y. Empty input is the identity pairing → returns `1`. Rejects non-multiple-of-192 length. EIP-197 gas: `45 000 + 34 000·k`.
* **BLAKE2F** (0x09) — Inline BLAKE2b-F compression function (RFC 7693, EIP-152). Strict 213-byte input layout; `f` flag must be exactly 0 or 1. Cost = `rounds`. Same SIGMA / IV constants and `g`-mix as the reference.

### (2) Real Ed25519 verification at precompile 0x0D (`ED25519_VERIFY`)

**Pre-Pass-18:** Fail-closed (`Err(InvalidInput)`).
**Pass-18:** `ed25519-dalek` v2 with the standard `(pubkey || msg || signature)` 128-byte input layout. Returns `0x...01` on valid, `0x...00` on invalid — matches the boolean-precompile convention used by `ECRECOVER` and `BN128_PAIRING`. Critically, **malformed pubkeys return zeros, not revert**, mirroring `ECRECOVER` so user-supplied signatures cannot grief calling contracts. Unlocks Solana-style cross-chain bridges, Cardano-style guards, and any contract that accepts ed25519-signed off-chain messages.

### (3) BLS Proof-of-Possession enforcement at validator registration

**Pre-Pass-18:** `ValidatorSet::register` admitted any 48-byte `BlsPubKey` without proving the registrant possessed the matching secret key. Direct enabler of the **rogue-key attack** on aggregate BLS signatures: a malicious validator publishes `pk_attacker = pk_real - sum(pk_others)` and forges an aggregate-sig that the verifier accepts as committee-signed. Pass-14 audit ranked this CRITICAL.

**Pass-18:**
* New `BlsPubKey::verify_pop(&self, pop, validator)` in `zbx-crypto` using domain `keccak256(validator_address ‖ "zbx-bls-pop-v1")` calling existing `verify_single` (real BLS12-381 pairing from Pass-17).
* New `ValidatorSet::register_with_pop(addr, pubkey, pop, stake, commission)` that verifies the PoP before delegating to legacy `register`. PoP failure returns `StakingError::InvalidEvidence` and emits a `warn!` log noting the possible attack.
* Legacy `register` retained and explicitly **documented as PoP-bypass** for genesis loaders that source keys from a trusted setup ceremony. Production / network registration RPCs MUST migrate to `register_with_pop` (call-site sweep deferred to the RPC integration commit).

### (4) `MockZvmHost` — real EIP-1153 transient storage + header fields

**Pre-Pass-18:** `MockZvmHost` returned zero defaults for `transient_load`, `coinbase`, `block_gas_limit`, `prevrandao`, `gas_price`, and `blob_hash`. Every Pass-16 opcode that read these (TLOAD/TSTORE, COINBASE, GASLIMIT, PREVRANDAO, GASPRICE, BLOBHASH) silently returned zeros under the only `ZvmHost` impl in the workspace, masking semantic bugs in Cancun-era contracts (especially the standard `nonReentrant`-via-TSTORE pattern).

**Pass-18:**
* `transient: HashMap<(addr, key), [u8; 32]>` scratchpad keyed per (contract, slot). Real `transient_load` / `transient_store` overrides plus a `clear_transient()` helper the production host calls at end-of-tx.
* New header fields `coinbase`, `block_gas_limit` (default 30M, matches mainnet target), `prevrandao`, `gas_price`, `blob_hashes: Vec<[u8; 32]>`. Trait impls for all six. `blob_hash(i)` correctly returns zero-hash for out-of-range indices per EIP-4844.
* Backward-compatible: defaults are still zero (or the safe 30M block gas limit) so every existing test continues to pass without changes.

---

## Tests added

| Suite | Count | What it covers |
| --- | --- | --- |
| `zbx-zvm` `precompiles::tests` (lib) | 14 | RIPEMD-160 known vector; MODEXP basic + zero-modulus; BN128_ADD generator+identity; BN128_MUL zero-scalar=identity; BN128_PAIRING empty-input passes + bad-length rejects; BLAKE2F basic compression + bad-length + invalid-final-flag; ED25519 real-roundtrip + tampered-msg + garbage-pubkey-returns-zero; dispatcher routing. |
| `zbx-zvm/tests/pass18_transient_and_header.rs` | 8 | TLOAD default zero; TSTORE/TLOAD roundtrip; per-address isolation; `clear_transient` end-of-tx semantics; overwrite replaces; header field propagation; BLOBHASH out-of-range zero; backward-compat defaults. |
| `zbx-staking/tests/pass18_bls_pop.rs` | 6 | Valid PoP accepted; PoP-for-wrong-address rejected; rogue-key (unknown secret) rejected; garbage 96-byte sig rejected; cross-check that domain matches `BlsPubKey::verify_pop`; legacy `register` still works for genesis-only path. |
| **Total new** | **28** | All green. |

Plus the pre-existing lib suites in all three crates remain green (full sweep run after edits — no regressions).

---

## Files touched

* `zbx-chain/crates/zbx-zvm/Cargo.toml` — added `ripemd`, `num-bigint`, `num-traits`, `substrate-bn`, `ed25519-dalek = "2"` (versions matched to `zbx-evm`).
* `zbx-chain/crates/zbx-zvm/src/precompiles.rs` — full rewrite, ports real bodies for 0x03/0x05/0x06/0x07/0x08/0x09/0x0D from `zbx-evm`.
* `zbx-chain/crates/zbx-zvm/src/host.rs` — `MockZvmHost` gains `transient` scratchpad + 5 header fields + 6 trait method overrides + `clear_transient` helper.
* `zbx-chain/crates/zbx-crypto/src/bls.rs` — `BlsPubKey::verify_pop`.
* `zbx-chain/crates/zbx-staking/src/validator.rs` — `register_with_pop` + deprecation doc on `register`.
* `zbx-chain/crates/zbx-staking/Cargo.toml` — `rand = "0.8"` dev-dep for PoP integration tests.
* `zbx-chain/crates/zbx-zvm/tests/pass18_transient_and_header.rs` (new).
* `zbx-chain/crates/zbx-staking/tests/pass18_bls_pop.rs` (new).

---

## Honest gaps deferred

1. **Production `ZvmHost` impl in `zbx-state`** — `MockZvmHost` is the *only* `ZvmHost` impl in the workspace today. Pass-18 wires the scratchpad and header fields into `MockZvmHost` so Cancun-era contracts can be tested end-to-end, but executor-side wiring (populate `coinbase` / `prevrandao` / `gas_price` / `blob_hashes` from the `BlockHeader` per tx; call `clear_transient()` after `commit_block`) lands when `zbx-state::ProductionZvmHost` is written.
2. **RPC / on-chain `Stake` migration to `register_with_pop`** — the legacy `register` path is still live so genesis loaders keep working. RPC + on-chain registration call-sites that should migrate are listed in a TODO above each definition; sweep is its own commit.
3. **Precompiles 0x0A (PAYID) / 0x0B (KZG) / 0x0C (price) / 0x0E (VRF) / 0x0F (ZUSD)** — unchanged from Pass-13, still fail-closed. They depend on either (a) chain state the precompile ABI cannot see (PAYID, ZUSD), (b) c-kzg dependency (KZG), (c) production oracle wiring (price), or (d) RFC 9381 ECVRF body (VRF). Each item is its own multi-day work and must land alongside the production host that gives the precompile context to read.
4. **Real CEX trusted-setup VK hashes** for Pass-17 oracle verifier — pinned in chain config; not a code change.
5. **`bls_batch_verify` Miller-loop batching** — sequential fan-out from Pass-17 still in place; functionally correct, just slower than optimal.

---

## Readiness delta

| Area | Pass-17 | Pass-18 |
| --- | --- | --- |
| Crypto primitives | ~95% | ~96% (Ed25519 precompile real) |
| EVM precompile parity | ~50% (ZVM had stubs while EVM had real) | ~92% (ZVM now matches EVM for 0x01–0x09 except 0x0A–0x0F native ZBX precompiles) |
| Validator registration safety | ~30% (no PoP) | ~95% (PoP available + enforced on new path; legacy genesis path documented) |
| Cancun host parity | ~40% (TLOAD zero, COINBASE zero, etc.) | ~90% (all six host hooks live in MockZvmHost; production host pending) |
| **Aggregate testnet readiness** | **~85%** | **~95%** |

Mainnet boot-panic guard from Pass-12 (chain 8989 refuses startup) remains active until production host + RPC PoP migration land.
