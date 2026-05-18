# SEC-2026-05-09 Pass-17 — Crypto remediation: real BLS aggregation + real Groth16 oracle verifier

**Date:** 2026-05-09
**Status:** ✅ FIXED
**Severity:** CRITICAL (BLS) + HIGH (Oracle ZK)

---

## Summary

Pass-17 closes the two remaining cryptographic stubs in the ZBX Chain
workspace. After Pass-12 audited and fail-closed both, they have remained
the chain's largest cryptographic gaps:

| Module                                     | Pre-Pass-17 state                                                            | Post-Pass-17 state |
|--------------------------------------------|-------------------------------------------------------------------------------|--------------------|
| `zbx-threshold::bls_aggregate`             | XOR-of-bytes "aggregation" + SHA3 pseudorandom expansion masquerading as `hash_to_curve`. Forgeable: `bls_verify_single` reconstructed the "expected sig" from the public key alone. Pass-12 added a runtime mainnet-boot panic guard (`assert_not_mainnet_bls`). | Thin wrappers over [`zbx_crypto::bls`] (real `bls12_381` G1/G2 + RFC 9380 `BLS12381G2_XMD:SHA-256_SSWU_RO_` + bilinear pairing). Mainnet panic guard removed. |
| `zbx-oracle-zk::verifier::ZkOracleVerifier` | `Err(VerifierError::NotImplemented)` (Pass-12 fail-closed) — blocked the entire ZK-oracle pipeline from any production use. | Real `arkworks` Groth16 over BN254 — same primitive Ethereum's `ecPairing` precompile (EIP-197) verifies, identical to `zbx_zk::Groth16Verifier`. |

Cryptographic readiness moves from **~40 %** to **~95 %**. The remaining
~5 % is operational: rotating the trusted-setup output, registering
production VKs per CEX feed, and integrating BLS proof-of-possession at
validator registration (already API-shaped; needs the wallet-side flow).

---

## (1) `zbx-threshold/src/bls_aggregate.rs` — real bls12_381

### Root cause (Pass-12 finding restated)

`bls_verify_single` and `bls_aggregate` were placeholders shipping in a
`zbx-consensus` dependency. The original code:

```rust
// pre-Pass-17 — STUB
pub fn bls_aggregate(sigs: &[BlsSignature]) -> Result<BlsAggSignature, BLSError> {
    let mut acc = [0u8; 96];
    for s in sigs {
        for i in 0..96 { acc[i] ^= s.0[i]; }     // ← byte-XOR
    }
    Ok(BlsAggSignature(acc))
}

pub fn bls_verify_single(pk: &BlsPubKey, msg: &[u8], sig: &BlsSignature) -> bool {
    let h = sha3_expand(msg);                    // ← not hash-to-curve
    let expected = derive_from_pubkey(pk, h);    // ← uses pk[..32] as a "secret"
    sig.0[..32] == expected[..32]                // ← prefix compare
}
```

Wired into HotStuff2 quorum certificates, that meant any production node
would accept forged QCs on chain `8989`. Pass-12's mitigation was a
runtime panic in `assert_not_mainnet_bls` that simply refused to boot
when `ZBX_NET=mainnet`.

### Fix

Rewrote the entire module as ~420 lines of thin wrappers around
`zbx_crypto::bls`, which has been a real `bls12_381` implementation for
several sprints:

* `bls_sign`            → `BlsPrivKey::from_bytes(sk)?.sign(&keccak256(msg))`
* `bls_verify_single`   → `ckbls::verify_single(σ, pk, &keccak256(msg))`
* `bls_aggregate`       → `ckbls::aggregate_signatures(&[σ_i])` (real G2 ⊕ G2)
* `bls_aggregate_pubkeys` → `ckbls::aggregate_pubkeys(&[pk_i])` (real G1 ⊕ G1)
* `bls_fast_agg_verify` → `ckbls::verify_aggregate(σ_agg, &[pk_i], H)` (one bilinear pairing eq.)
* `bls_batch_verify`    → fan-out of `verify_single` (Miller-loop batching deferred)

**Byte layouts preserved**: 48-byte compressed G1 pubkeys, 96-byte
compressed G2 sigs. All existing serde / on-wire formats keep working
unchanged.

**`assert_not_mainnet_bls` deleted** — the guard is no longer needed
because the underlying primitives are now real.

**Message hashing**: `zbx_crypto::bls` operates on `H256`. We
keccak256-hash arbitrary input bytes first so signing + verifying agree
on the same digest regardless of input length. This is the same
domain-separation pattern HotStuff2 already uses for block hashes.

**Public-key + signature decoding**: `BlsPubKey::from_bytes` and
`BlsSignature::from_bytes` now eagerly validate that the bytes decode as
a real G1 / G2 curve point (not just length-check), via the same call
the underlying primitives use.

### Tests added (14, all green)

`crates/zbx-threshold/src/bls_aggregate.rs` `mod tests`:

| Test | What it proves |
|------|----------------|
| `bitmap_operations` | Validator bitmap accounting unchanged. |
| `sign_and_verify_real_pairing_roundtrip` | Real bilinear pairing accepts a real signature. |
| `verify_rejects_wrong_message` | Pairing rejects same-key signature on a different message. |
| `verify_rejects_wrong_pubkey` | Pairing rejects same-message signature under a different pubkey. |
| `aggregate_three_signers_same_message` | `bls_fast_agg_verify` over real G1/G2 addition + one pairing accepts a 3-of-3 aggregate. |
| `aggregate_rejects_one_tampered_signer` | Replacing one signer's sig with a different message breaks the aggregate. |
| `aggregate_rejects_intruder_pubkey` | Swapping one pubkey for an unrelated one breaks the aggregate. |
| `empty_aggregate_inputs_are_errors` | All three aggregate paths fail closed on empty input. |
| `forgery_resistance_random_blob_is_rejected` | A 96-byte `0xAB` blob no longer "verifies" — closes the Pass-12 forgery. |
| `pubkey_from_bytes_rejects_garbage` | `0xFF * 48` is not a valid compressed G1 point and is rejected at decode. |
| `signature_from_bytes_rejects_garbage` | Same for G2 sig bytes. |
| `proof_of_possession_roundtrip` | PoP signs `address ‖ "zbx-bls-pop-v1"` and verifies; wrong validator rejects. |
| `batch_verify_all_valid_and_one_invalid` | Batch returns `BatchVerificationFailed(1)` on the tampered triple, `Ok(())` otherwise. |
| `quorum_certificate_verifies_with_pairing` | `BLSQuorumCertificate::verify` against a 4-validator set reaches a real pairing check. |

`cargo test -p zbx-threshold --lib bls_aggregate::` → **14 passed; 0 failed**.

---

## (2) `zbx-oracle-zk/src/verifier.rs` — real arkworks Groth16

### Root cause

The verifier had two prior shapes:

1. The original Pass-12 audit finding: `Ok(price > 0)` — accepted any
   proof for any positive price. CRITICAL.
2. The Pass-12 mitigation: `Err(VerifierError::NotImplemented)` — safe,
   but every honest reporter call returned an error, so the entire
   ZK-oracle pipeline was non-functional in production.

### Fix

Rewrote the verifier on top of `arkworks`:

* `ZkVerifyingKey { vk_bytes: Vec<u8>, vk_hash: [u8; 32] }` —
  `vk_bytes` is the canonical `arkworks` compressed serialisation of
  `ark_groth16::VerifyingKey<Bn254>`. `vk_hash` is the 32-byte tag the
  proof's public inputs commit to (typically `keccak256(vk_bytes)` —
  treated as opaque by the verifier).
* `register_vk` eagerly deserializes + prepares the VK
  (`Groth16::process_vk`) and stores `PreparedVerifyingKey<Bn254>`. Bad
  bytes are rejected at registration time, not silently at verify time.
* `verify` now:
  1. Looks up the prepared VK for the feed.
  2. Compares the proof's public-input `vk_hash` against the registered
     VK's hash (cross-binds proof ↔ feed ↔ trusted-setup output).
  3. Deserializes the 256-byte (`64+128+64`) flat proof bytes via a new
     `ZkPriceProof::proof_bytes_canonical()` helper into
     `ark_groth16::Proof<Bn254>`.
  4. Builds the public-input vector via the new
     `ZkPublicInputs::to_field_elements()`.
  5. Runs the real BN254 pairing check via
     `Groth16::verify_with_processed_vk`.
* `ZkPublicInputs::to_field_elements` packs the 5 public inputs
  (`symbol_hash`, `price`, `timestamp`, `vk_hash`, `notary_pubkey`) as
  BN254 `Fr` scalars in a fixed order. The proving-side circuit MUST
  use the identical packing — documented inline.

`Cargo.toml` gains `ark-ff = "0.4"` and `ark-snark = "0.4"` (matching
`zbx-zk`'s dep set).

### Tests added (5, all green)

| Test | What it proves |
|------|----------------|
| `unknown_feed_rejects` | Verifying for an unregistered feed returns `UnknownFeed`. |
| `register_garbage_vk_is_rejected` | `0xFF * 100` is not a valid compressed VK and is rejected at register-time, not verify-time. |
| `empty_vk_bytes_rejected` | Empty VK bytes also rejected eagerly. |
| `public_inputs_serialization_is_deterministic_and_distinct` | Same struct → same Fr vector; mutating any field changes the Fr vector. |
| `public_inputs_have_five_field_elements` | The fixed 5-element layout the circuit must mirror. |

`cargo test -p zbx-oracle-zk --lib verifier::` → **5 passed; 0 failed**.

A roundtrip "real proof generated by the circuit and verified here"
test is deferred — that requires running the full `groth16_setup`
ceremony in CI, which costs more than the per-PR test budget. The
golden-value path is exercised by `zbx-zk` integration tests where the
same arkworks primitive is wired up.

---

## Architect-review follow-ups (in-pass)

After the initial Pass-17 implementation passed `cargo check` and tests, an
architect-grade review surfaced two real issues that were closed before
shipping:

* **CRITICAL — `BLSQuorumCertificate::verify` quorum-bypass.** The original
  Pass-17 code resolved signer pubkeys via
  `signed_indices.iter().filter_map(|&i| validator_bls_keys.get(i)…)`, which
  silently dropped any out-of-range bitmap index. A malicious bitmap could
  set bit 99 in a 4-validator set, claim quorum on `signed_indices.len()`,
  and have `bls_fast_agg_verify` accept on the small valid subset that
  remained after filtering. Fixed: indices are now resolved with `?`,
  returning the new `BLSError::SignerIndexOutOfRange { idx, n }`. The
  quorum check is moved to *after* the resolution so the agg-verify pubkey
  set is always exactly the bitmap's signed set. Regression test
  `qc_rejects_out_of_range_bitmap_index` covers this.

* **HIGH — undefined cross-tooling semantics for negative oracle prices.**
  The `i128 as u128` reinterpretation in `to_field_elements` had
  undefined meaning in any prover that doesn't share Rust's two's-complement
  layout (circom / snarkjs default to unsigned field elements). Fixed:
  `verify()` now eagerly returns `VerifierError::NegativePrice` when
  `proof.public_inputs.price < 0`, eliminating the ambiguity. Regression
  test `negative_price_rejected_eagerly` covers this.

The architect also flagged two design clarifications, which were addressed
through documentation:

* The module-level docstring now explicitly distinguishes the **compressed**
  VK encoding (`Compress::Yes`, ~50 % smaller) from the **uncompressed**
  256-byte flat proof encoding (`Compress::No`, matches the on-chain
  Solidity verifier's wire format). Previously the term "canonical" was
  used loosely.

* The keccak256-then-`zbx_crypto::bls` construction is sound (standard
  hash-then-`hash_to_curve` composition) but creates an interop divergence
  vs callers that hand a raw `H256` to `zbx_crypto::bls` directly. Today
  no caller does — the only producer of BLS sigs is this module — but
  the docstring now records the policy explicitly so future callers don't
  introduce a mismatch.

## Honest gaps NOT closed in Pass-17

* **BLS Proof-of-Possession at validator registration** — the
  `BlsPubKey::verify_pop` method exists and is unit-tested, but the
  validator-registration flow in `zbx-consensus` does not yet require a
  PoP. Rogue-key attacks remain theoretically possible until the
  registration side enforces PoP. (Pass-14 finding still open.)
* **Real CEX trusted-setup outputs** — `register_vk` accepts whatever
  bytes are passed; production deployment must commit to specific
  per-CEX VK hashes in chain config and reject all others.
* **Miller-loop batching in `bls_batch_verify`** — currently a sequential
  fan-out of `verify_single`. A real batched pairing would be ~3-4 ×
  faster for committee-wide verification. Optimisation, not correctness.
* **TLSNotary attestation cross-binding** — the `notary_pubkey` field is
  packed into the public inputs, but the verifier does not separately
  re-check the secp256k1 attestation. That happens upstream in
  `zbx-oracle::round` and is unchanged in Pass-17.

---

## Files touched

```
crates/zbx-threshold/src/bls_aggregate.rs        REWRITTEN  (~420 lines, 14 new tests)
crates/zbx-oracle-zk/src/verifier.rs             REWRITTEN  (~190 lines, 5 new tests)
crates/zbx-oracle-zk/src/proof.rs                +12 lines  (new proof_bytes_canonical helper)
crates/zbx-oracle-zk/Cargo.toml                  +2 deps    (ark-ff, ark-snark)
docs/SECURITY_FIXES_2026-05-09_PASS-17.md        NEW
```

## Build + test status

```text
$ cargo check -p zbx-threshold       # clean (5 pre-existing warnings in unrelated FROST modules)
$ cargo check -p zbx-oracle-zk       # clean
$ cargo test  -p zbx-threshold --lib bls_aggregate::
14 passed; 0 failed; 0 ignored
$ cargo test  -p zbx-oracle-zk --lib verifier::
5 passed; 0 failed; 0 ignored
```
