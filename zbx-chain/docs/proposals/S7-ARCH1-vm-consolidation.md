# S7-ARCH1 — VM Consolidation Design Doc

**Status:** Draft for node-team review
**Author:** Replit Agent (audit handoff)
**Date:** 2026-05-01
**Audit cross-ref:** `AUDIT_2026-04-30.md` Sessions 7–9, finding ID `S7-ARCH1`
**Severity:** Architecture (no immediate exploit, but multiplies audit surface 3× and was directly responsible for the S7-EVM2 silent-no-op bug class)

---

## 1. Executive summary

The workspace currently ships **three independent EVM-class virtual-machine implementations** plus one orphan consumer crate:

| Crate | LOC | Purpose (claimed) | Production callers |
|-------|-----|-------------------|--------------------|
| `zbx-evm` | 923 | "EVM up to Shanghai" | **13** (zbx-execution, zbx-bundler, zbx-contracts, zbx-executor, zbx-launchpad, zbx-lending, zbx-nft, zbx-oracle-twap, zbx-pool, zbx-prover, zbx-telemetry, zbx-metrics, zbx-vm/zvm comment-refs only) |
| `zbx-vm` | 1339 | "complete EVM (Cancun-era, all 150+ opcodes)" | **0** (only audit-comment cross-references — see §3) |
| `zbx-zvm` | 1748 | "EVM superset + ZBX-native opcodes 0xC0–0xC9" | **1** — `zbx-ai-precompile` (which itself has 0 callers) |
| `zbx-ai-precompile` | n/a | (only known consumer of `zbx-zvm`) | **0** anywhere in workspace |

Audit conclusion: **`zbx-evm` is the production VM. `zbx-vm`, `zbx-zvm`, and `zbx-ai-precompile` are all effectively unreachable code**, totalling ~3000 LOC of compiled-but-never-called surface.

Recommended action is **Option B (delete-dead)** below: remove `zbx-vm` and (`zbx-zvm` + `zbx-ai-precompile`) entirely, then optionally re-introduce ZBX-native opcodes as a feature-gated extension layer on `zbx-evm`.

---

## 2. Why this matters (motivation)

### 2.1 Audit-surface multiplication

Every Phase-4 crypto fix in this audit had to be applied **two or three times** because each VM owned its own copy of the precompile dispatcher:

| Finding | Files patched |
|---------|--------------|
| S7-VM3 (precompile fail-explicit) | `zbx-vm/src/precompiles.rs` AND `zbx-evm/src/precompiles.rs` AND `zbx-zvm/src/precompiles.rs` |
| S7-EVM1 (ripemd160 + bn128_pairing fail-open) | `zbx-evm/src/precompiles.rs` (and partial mirror in `zbx-vm`) |
| S7-ZVM-DOC1 (opcode-range doc drift) | `zbx-zvm/src/lib.rs` + `zbx-zvm/src/opcodes.rs` |

Drift cost is **superlinear** in number of VMs because each fix has to be re-derived, re-reviewed, and re-tested per copy. The S7-ZVM-DOC1 finding (header table claimed 0xF0–0xF9, code used 0xC0–0xC9) is a textbook example: the doc-level drift on the dead VM was only caught because the audit expanded to cover all three.

### 2.2 The S7-EVM2 bug class

S7-EVM2 (Session 9) — top-level transactions to precompile addresses silently no-op'd because `zbx-execution` short-circuited them as "value transfer to a contractless account" — was *only possible* because the audit had to track which VM `zbx-execution` actually used. With three VMs in the tree, it was non-obvious that **only `zbx-evm` was on the production path**, and that `zbx-vm`'s separately-implemented (and also separately-buggy) precompile dispatcher was simply unreachable.

A single-VM workspace would have made the missing dispatch in `zbx-execution` obvious from day one of the audit.

### 2.3 CI / build cost

`zbx-vm` (1339 LOC) and `zbx-zvm` (1748 LOC) are both workspace members (`Cargo.toml` lines 45/47), so every `cargo build --workspace` and every CI typecheck pass compiles 3000+ LOC of code that no production binary links. On the rocksdb-blocked sandbox this is invisible (those crates compile fine in isolation), but in node-team CI it is real wall-clock cost on every PR.

### 2.4 Operator / contributor confusion

`docs/ZVM.md` describes `zbx-zvm` as the chain's execution environment ("ZBX Chain's execution environment ... a superset of EVM"). `docs/EVM_COMPATIBILITY.md` (not audited here) presumably describes `zbx-evm`. New contributors looking at "the VM" land on three different crates depending on which doc they read first. The header comment on `zbx-vm/src/lib.rs` claims "complete EVM (Cancun-era)" and looks the most production-ready by docstring, but is in fact the most dead.

---

## 3. Current state — evidence

All claims below are directly verifiable with the commands shown.

### 3.1 zbx-vm has no production callers

```sh
$ rg -l "zbx_vm|zbx-vm" --type rust --type toml crates/ \
    | rg -v "^crates/zbx-vm/"
crates/zbx-evm/src/precompiles.rs       # comment only (S7-VM3 cross-ref)
crates/zbx-zvm/src/precompiles.rs       # comment only (S7-VM3 cross-ref)
crates/zbx-execution/src/executor.rs    # comment only (S7-EVM2 cross-ref)
```

No `Cargo.toml` in the workspace declares `zbx-vm` as a dependency. The three "matches" are all S7-* audit comments referencing `zbx-vm/src/...` as the canonical fix-pattern source. The actual code is unreachable.

### 3.2 zbx-zvm has only one (dead) consumer

```sh
$ rg -l "zbx_zvm|zbx-zvm" --type rust --type toml crates/ \
    | rg -v "^crates/zbx-zvm/"
crates/zbx-ai-precompile/Cargo.toml
```

And:

```sh
$ rg -l "zbx_ai_precompile|zbx-ai-precompile" --type rust --type toml crates/ \
    | rg -v "^crates/zbx-ai-precompile/"
(no matches)
```

So `zbx-zvm` is kept alive only by `zbx-ai-precompile`, which itself has zero callers. Deleting both is a no-op for every other crate.

### 3.3 zbx-evm is the real VM

```sh
$ rg -l "zbx_evm|zbx-evm" --type toml crates/ \
    | rg -v "^crates/zbx-evm/" | rg -v "^crates/zbx-vm/" | rg -v "^crates/zbx-zvm/"
crates/zbx-bundler/Cargo.toml
crates/zbx-contracts/Cargo.toml
crates/zbx-execution/Cargo.toml
crates/zbx-executor/Cargo.toml
crates/zbx-launchpad/Cargo.toml
crates/zbx-lending/Cargo.toml
crates/zbx-nft/Cargo.toml
crates/zbx-oracle-twap/Cargo.toml
crates/zbx-pool/Cargo.toml
crates/zbx-prover/Cargo.toml
```

Plus the actual execution call site:

```rust
// crates/zbx-execution/src/executor.rs
use zbx_evm::{EVMContext, EVMInterpreter, ExitStatus};
// ...
&& zbx_evm::precompiles::is_precompile(&callee)
match zbx_evm::precompiles::call_precompile(&callee, calldata, forwarded) { ... }
```

`zbx-execution::BlockExecutor::execute_tx` instantiates `EVMInterpreter` from `zbx-evm`. No other VM is reachable from a real transaction.

### 3.4 The dead zbx-zvm has the most opcodes

The cruel irony: the unreachable `zbx-zvm` is the only VM that implements the ZBX-native opcode set (PAYID/ZUSDBAL/ZBXPRICE/ZBXTIME/AASENDER/CHAINVER/BLOBFEE/PAYIDSET/ZBXBURN/ZVMLOG, plus KZG and ed25519 precompiles). So the chain's branded "ZVM" features are not actually exposed to executed bytecode today — calls to `0xC0`+ in real transactions hit `zbx-evm`'s opcode table, which treats them as `INVALID`.

This is itself a finding worth filing separately if it is news to the node team:

> **S7-ARCH1-A [HIGH, derived from S7-ARCH1] — All advertised ZBX-native opcodes (PAYID, ZUSDBAL, ZBXPRICE, ZBXTIME, AASENDER, CHAINVER, BLOBFEE, PAYIDSET, ZBXBURN, ZVMLOG) are unreachable in production.** They exist only in `zbx-zvm`, which has no path from `zbx-execution`. Any contract attempting to use them will hit `INVALID` (revert with no return data) under the current production execution path.

---

## 4. Options

### Option A — do nothing (status quo)

**Cost:** every future precompile or opcode change continues to require 3× implementation, 3× review, 3× test, 3× audit. The S7-EVM2 / S7-ARCH1-A bug class remains latent. New contributors continue to be confused about which VM is "the" VM.

**Benefit:** zero migration risk.

**Recommendation:** REJECT. The S7-EVM2 bug already cost a full audit session to find and fix, and S7-ARCH1-A may turn out to be a launch blocker if the chain markets ZVM-native opcodes (per `docs/ZVM.md`, this is a stated value-prop).

### Option B — delete-dead (recommended)

Steps:

1. Remove `zbx-vm` from the workspace.
   - Delete `crates/zbx-vm/`.
   - Remove `"crates/zbx-vm",` from root `Cargo.toml` line 45.
   - Remove S7-VM3 cross-reference comments in `zbx-evm/src/precompiles.rs:84` and `zbx-zvm/src/precompiles.rs:77,122,143` (replace with self-contained doc).
   - Remove the cross-ref comment in `zbx-execution/src/executor.rs:278` (replace with EVM-spec citation).
2. Remove `zbx-zvm` and `zbx-ai-precompile` from the workspace.
   - Delete `crates/zbx-zvm/` and `crates/zbx-ai-precompile/`.
   - Remove their entries from root `Cargo.toml`.
   - Update `docs/ZVM.md` to either (a) describe `zbx-evm` as the current VM, with ZVM-native opcodes marked as "planned, not implemented", or (b) be deleted if option C below is taken.
3. Run `cargo check --workspace` to confirm no other crate imported them transitively.
4. Run the full test suite to confirm zero behavioural change in production paths.
5. File ticket for S7-ARCH1-A: decide whether ZBX-native opcodes are a real launch requirement, and if so, plan their re-introduction (Option C).

**Cost:** ~1 day node-team work. Pure deletion + comment cleanup. No production behaviour change because none of the deleted code was reachable.

**Benefit:** ~3000 LOC removed, audit surface reduced to one VM, S7-EVM2-class bugs become impossible by construction (no parallel dispatcher to drift against), CI build time reduced, doc story simplified to "zbx-evm is the VM".

**Risk:** very low. The deleted code is provably dead per §3. Worst case is finding a comment-only reference that needs cleanup; no runtime behaviour can change.

### Option C — extension layer (post-Option-B follow-up, only if ZBX-native opcodes are a real product requirement)

If `docs/ZVM.md`'s ZBX-native opcodes are an actual product commitment (Pay ID resolution from bytecode, native ZUSD balance reads, etc.), re-introduce them as a **feature-gated extension trait on `zbx-evm`**, not as a parallel VM.

Sketch:

```rust
// crates/zbx-evm/src/lib.rs
#[cfg(feature = "zbx-opcodes")]
pub mod zbx_opcodes;

// crates/zbx-evm/src/interpreter.rs
match opcode {
    Opcode::SLOAD => ...,
    #[cfg(feature = "zbx-opcodes")]
    Opcode::PAYID => zbx_opcodes::payid::execute(self, host),
    Opcode::INVALID => ...,
}
```

Wire the feature flag from `zbx-execution`'s Cargo.toml, default-on for the production node, default-off for any tooling crate that only needs vanilla EVM (e.g. `zbx-bundler` building UserOps for general clients).

**Cost:** ~1 week node-team work + audit pass on the new opcode handlers + re-derivation of gas costs (ZEP-009 is the existing reference for dynamic-gas precompile pricing).

**Benefit:** chain's branded VM features actually reach executed bytecode, single canonical opcode table, audit surface stays at one VM.

**Risk:** medium. New opcodes are new attack surface; needs same level of fuzzing + spec-conformance testing as any EVM opcode addition.

### Option D — full merge (rejected)

Take the union of all three VMs' opcodes/precompiles and produce one mega-VM. **Rejected** because it would essentially reproduce `zbx-zvm` (which already claims to be that union) and would require auditing the diff between zbx-vm's claimed Cancun-era support and zbx-evm's Shanghai-only support. Cheaper to delete first (Option B), then add back what is genuinely needed (Option C).

---

## 5. Recommended path

1. **This audit cycle:** Option B (delete-dead). Low risk, high return, removes the bug class that produced S7-EVM2 and S7-ARCH1-A.
2. **Next product cycle (gated on PM decision about ZBX-native opcodes):** Option C, only if the marketing/docs commitment to ZVM-native opcodes is real. Otherwise, update `docs/ZVM.md` to drop the claim.

Sequencing matters: do not attempt Option C before Option B, or you re-introduce the dual-VM-with-drift pattern under a different name.

---

## 6. Out of scope for this doc

- **S7-PROD1** (production block_producer's `tx_root = [0u8; 32]`): orthogonal, separate fix in `crates/zbx-node/src/producer.rs`. Tracked separately in audit doc.
- **WASM contracts** (`docs/WASM_CONTRACTS.md`): if a future WASM VM is planned, it should live in its own crate from day one, with a clear "this is for WASM, not EVM" statement in its lib.rs header. The mistakes that produced the current 3-EVM mess should not be repeated for WASM.
- **The actual opcode-by-opcode diff between zbx-vm (claimed Cancun) and zbx-evm (Shanghai)**: not relevant under Option B because zbx-vm is being deleted. If Option B is rejected in favour of "merge the best parts", a separate audit task is required to enumerate what zbx-vm has that zbx-evm lacks.

---

## 7. Verification checklist (for the node-team engineer who picks this up)

Before merging any deletion PR:

- [ ] `rg "zbx_vm|zbx-vm" --type rust --type toml crates/` returns only the comment cross-refs identified in §3.1, OR is empty after comment cleanup.
- [ ] `rg "zbx_zvm|zbx-zvm" --type rust --type toml crates/` is empty after deletion.
- [ ] `rg "zbx_ai_precompile|zbx-ai-precompile" --type rust --type toml crates/` is empty after deletion.
- [ ] `cargo check --workspace --all-targets` passes.
- [ ] `cargo test --workspace` passes (no test in any crate transitively depended on the deleted code).
- [ ] `docs/ZVM.md` updated or deleted per Option B step 2.
- [ ] `AUDIT_2026-04-30.md` Session 9 / S7-ARCH1 entry updated to "CLOSED" with link to the deletion PR.
- [ ] If proceeding to Option C, file follow-up ticket "S7-ARCH1-C: re-introduce ZBX-native opcodes as zbx-evm feature".

---

## 8. Decision log

| Date | Decision | By |
|------|----------|-----|
| 2026-05-01 | Doc drafted, recommendation = Option B | Replit Agent (audit) |
| _pending_  | Option B accepted/rejected | node-team lead |
| _pending_  | Option C scoped or de-scoped | PM + node-team lead |
