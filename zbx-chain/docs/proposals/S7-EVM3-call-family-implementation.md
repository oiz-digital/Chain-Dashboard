# S7-EVM3 — CALL Family Implementation Plan (BOTH zbx-evm + zbx-zvm)

**Status:** Draft for node-team review
**Author:** Replit Agent (audit handoff)
**Date:** 2026-05-01
**Audit cross-ref:** `AUDIT_2026-04-30.md` Sessions 7–9, finding IDs `S7-EVM3`, `S7-ZVM-INVOPS`, `S7-ZVM-HOST*`, `S7-EVM2-TESTS`
**Severity:** CRITICAL (consensus-break / chain non-functional without this)
**Related:** `S7-ARCH1-vm-consolidation.md` Option C (this doc operationalises Option C — keep both VMs in production)

---

## 0. Why this doc exists

User decision (2026-05-01): **keep both `zbx-evm` and `zbx-zvm` in production with full functionality**, instead of the design doc's recommended Option B (delete dead VMs).

Audit cycle established that:

1. `zbx-evm`'s interpreter dispatches **only** `RETURN` from the 0xF0–0xFF system-call range (line 264). No CALL/CREATE/DELEGATECALL/STATICCALL/CALLCODE/CREATE2/REVERT/SELFDESTRUCT.
2. `zbx-zvm`'s interpreter dispatches **only** `RETURN` and `REVERT` (lines 216, 222). Same gap as zbx-evm.
3. `zbx-zvm`'s catch-all `_ =>` arm previously silently NOPed unimplemented opcodes (S7-ZVM-INVOPS — fixed this session).
4. `zbx-zvm/src/executor.rs` is a **single-frame** executor — `ZvmInterpreter::new(ctx, host).run()`. No nested call stack.
5. `ZvmHost` trait has **zero production implementations** in the workspace (only `MockZvmHost` for tests).
6. Neither VM is wired into `zbx-execution` for ZVM-bytecode dispatch (zbx-execution only ever instantiates `zbx_evm::EVMInterpreter`).

Net: the chain cannot execute any non-trivial Solidity contract today. All inter-contract calls and contract deployments revert. Implementing the CALL family in BOTH VMs + the dispatcher + a production `ZvmHost` is the work plan below.

---

## 1. Scope summary

| Workstream | Estimated LOC | Estimated days | Risk |
|------------|--------------:|---------------:|------|
| **W1.** CALL/CALLCODE/DELEGATECALL/STATICCALL in zbx-evm | ~600 | 2–3 | High |
| **W2.** CREATE/CREATE2 in zbx-evm | ~300 | 1–2 | High |
| **W3.** SELFDESTRUCT + REVERT in zbx-evm | ~80 | 0.5 | Medium |
| **W4.** Mirror W1+W2+W3 in zbx-zvm | ~800 | 2 | High |
| **W5.** Multi-frame executor in zbx-zvm/executor.rs (replace single-frame) | ~200 | 1 | High |
| **W6.** State journal contract: zbx-execution ↔ zbx-evm/zbx-zvm | ~150 | 1 | High |
| **W7.** ZVM dispatcher in zbx-execution::execute_tx (magic-prefix detection) | ~150 | 0.5 | Medium |
| **W8.** Production `ZvmHost` impl in zbx-execution (replaces MockZvmHost) | ~400 | 2 | Medium |
| **W9.** Cross-crate wiring for ZVM-native opcodes (PayID registry / ZUSD vault / oracle / AA bundler) | ~300 | 2 | Medium |
| **W10.** Test harness against ethereum/tests subset | ~500 | 3 | Medium |
| **W11.** Audit doc updates + architect reviews | n/a | 1 | Low |
| **TOTAL** | **~3500 LOC** | **~16 days** (one engineer) or **~8 days** (paired) | Critical |

---

## 2. Workstream W1 — CALL family in zbx-evm

### 2.1 File targets

- `crates/zbx-evm/src/interpreter.rs` — add 4 byte-arm handlers in `step()` match
- `crates/zbx-evm/src/gas.rs` — add EIP-150 `gas_call_cost()` helper + EIP-2929 cold/warm
- `crates/zbx-evm/src/error.rs` — add `EvmError::CallDepthExceeded`, `EvmError::StaticStateChange`
- `crates/zbx-evm/src/interpreter.rs` — add `CallFrame` struct + `frames: Vec<CallFrame>` field

### 2.2 CALL (0xF1) — canonical implementation skeleton

Stack pop order (top → bottom): `gas, addr, value, argsOffset, argsSize, retOffset, retSize`.

```rust
// crates/zbx-evm/src/interpreter.rs, inside step()
0xf1 => { // CALL — EIP-150 / EIP-2929 / EIP-2200
    // 1. Pop 7 stack args
    let gas       = self.stack.pop_u64()?;
    let addr      = self.stack.pop_address()?;
    let value     = self.stack.pop_u256()?;
    let args_off  = self.stack.pop_u64()? as usize;
    let args_len  = self.stack.pop_u64()? as usize;
    let ret_off   = self.stack.pop_u64()? as usize;
    let ret_len   = self.stack.pop_u64()? as usize;

    // 2. Static-call check
    if self.ctx.is_static && !value.is_zero() {
        return Err(EvmError::StaticStateChange);
    }

    // 3. Call-depth check (EIP-150: max 1024)
    if self.frames.len() >= 1024 {
        self.stack.push_u64(0)?; // failure pushed as 0
        return Ok(None);
    }

    // 4. Read calldata from memory (with expansion gas)
    self.gas_charge_memory_expansion(args_off, args_len)?;
    let calldata = self.memory.read_slice(args_off, args_len).to_vec();

    // 5. Cold/warm access charge (EIP-2929: 2600 cold, 100 warm)
    let access_cost = self.access_list.touch_account(&addr);
    self.gas_charge(access_cost)?;

    // 6. Value transfer cost (positive_value_cost = 9000 if value > 0)
    let value_cost = if !value.is_zero() { 9000 } else { 0 };
    self.gas_charge(value_cost)?;

    // 7. New-account cost (25000 if recipient is empty + value > 0)
    let new_account_cost = if !value.is_zero() && self.host.is_empty(&addr) { 25_000 } else { 0 };
    self.gas_charge(new_account_cost)?;

    // 8. Compute forwarded gas with 63/64 rule (EIP-150)
    let stipend = if !value.is_zero() { 2300 } else { 0 };
    let forwarded = std::cmp::min(gas, self.gas - self.gas / 64) + stipend;

    // 9. Snapshot state (revert on failure)
    let snapshot = self.host.snapshot();

    // 10. Value transfer (atomic)
    if !value.is_zero() {
        if self.host.balance(&self.ctx.address) < value.as_u128() {
            self.host.revert_to(snapshot);
            self.stack.push_u64(0)?;
            return Ok(None);
        }
        self.host.transfer(&self.ctx.address, &addr, value.as_u128());
    }

    // 10b. Precompile dispatch — MUST happen BEFORE the host.code() check
    //      [HIGH, architect-flagged 2026-05-01]: precompile addresses
    //      0x01–0x09 (and the new ones from S7-EVM2) have empty bytecode
    //      in state. Without this branch, every CALL into a precompile
    //      would fall into the empty-code path below and return success
    //      with empty data — wrong. The CALL handler must mirror the
    //      execute_tx-level precompile dispatch (`zbx_evm::precompiles::
    //      is_precompile`) before fetching code.
    if zbx_evm::precompiles::is_precompile(&addr) {
        let precompile_result = zbx_evm::precompiles::dispatch(
            &addr, &calldata, forwarded
        );
        match precompile_result {
            Ok((output, gas_used)) => {
                self.return_data = output.clone();
                self.gas_charge_memory_expansion(ret_off, ret_len)?;
                let copy_len = std::cmp::min(ret_len, output.len());
                self.memory.write_slice(ret_off, &output[..copy_len]);
                self.gas_refund(forwarded.saturating_sub(gas_used));
                self.stack.push_u64(1)?;
                return Ok(None);
            }
            Err(_) => {
                self.host.revert_to(snapshot);
                self.return_data = vec![];
                self.stack.push_u64(0)?;
                return Ok(None);
            }
        }
    }

    // 11. Push frame, recurse
    let target_code = self.host.code(&addr);
    if target_code.is_empty() {
        // No code at target (and not a precompile): refund forwarded gas,
        // return success with empty data. This matches mainnet Ethereum
        // behaviour for CALLs into EOAs or unfunded addresses.
        self.return_data = vec![];
        self.gas_refund(forwarded);
        self.stack.push_u64(1)?;
        return Ok(None);
    }

    let sub_ctx = EVMContext {
        caller:   self.ctx.address,
        address:  addr,
        value:    value.as_u128(),
        calldata,
        gas_limit: forwarded,
        is_static: self.ctx.is_static,
        ..self.ctx.clone()
    };

    let mut sub_interpreter = EVMInterpreter::new(sub_ctx, self.host, target_code);
    sub_interpreter.frames = self.frames.clone();
    sub_interpreter.frames.push(CallFrame { snapshot, gas_at_entry: forwarded });
    let (sub_status, sub_gas_used) = sub_interpreter.run();

    // 12. Memory write of return data (with expansion gas)
    let ret = sub_interpreter.return_data;
    self.gas_charge_memory_expansion(ret_off, ret_len)?;
    let copy_len = std::cmp::min(ret_len, ret.len());
    self.memory.write_slice(ret_off, &ret[..copy_len]);
    self.return_data = ret;

    // 13. Settle gas
    let unused = forwarded.saturating_sub(sub_gas_used);
    self.gas_refund(unused);

    // 14. Push 0/1 success indicator
    let success = matches!(sub_status, ExitStatus::Succeeded);
    if !success {
        self.host.revert_to(snapshot);
    }
    self.stack.push_u64(if success { 1 } else { 0 })?;
}
```

### 2.3 CALLCODE (0xF2)

Same as CALL but **executes target's code in caller's storage context**. Stack pops the same 7 args. The difference is in step 11 — `sub_ctx.address = self.ctx.address` (storage stays with caller), but value/balance transfers still use the target. Deprecated in favour of DELEGATECALL but must be supported for legacy bytecode.

**Precompile note (architect-flagged 2026-05-01):** CALLCODE into a precompile address must dispatch the precompile (per step 10b above) but with `sub_ctx.address = caller` semantics — in practice the precompile output is the same regardless of storage context, so the dispatch path is identical to CALL's step 10b.

### 2.4 DELEGATECALL (0xF4)

Stack: `gas, addr, argsOffset, argsSize, retOffset, retSize` (NO value — uses caller's). Executes target's code in caller's full context (caller, value, address, storage all preserved). Sub-context:

```rust
let sub_ctx = EVMContext {
    caller:    self.ctx.caller,    // PRESERVED
    address:   self.ctx.address,   // PRESERVED
    value:     self.ctx.value,     // PRESERVED
    calldata,
    gas_limit: forwarded,
    is_static: self.ctx.is_static,
    ..self.ctx.clone()
};
```

### 2.5 STATICCALL (0xFA)

Same as CALL but `value = 0` (no stack pop) and `is_static = true` propagates. Inside the sub-frame, any state-mutating opcode (SSTORE, CREATE, CREATE2, SELFDESTRUCT, LOGn, CALL with value≠0) MUST revert with `EvmError::StaticStateChange`.

### 2.6 Gas constants (EIP-150 / EIP-2929 / EIP-3529 reference)

```rust
pub const GAS_CALL_COLD:        u64 = 2600;
pub const GAS_CALL_WARM:        u64 = 100;
pub const GAS_CALL_VALUE:       u64 = 9000;
pub const GAS_CALL_NEW_ACCOUNT: u64 = 25_000;
pub const GAS_CALL_STIPEND:     u64 = 2300;
pub const GAS_CALL_DEPTH_MAX:   usize = 1024;
```

### 2.7 Test vectors (W10 dependency)

Minimum subset of `ethereum/tests/GeneralStateTests/stCallCodes/` and `stStaticCall/`:
- `callcall_00.json`, `callcall_00_OOGE.json`
- `staticcall_createfails.json`, `staticcallToReturn1.json`
- `delegatecallAtTransition.json`
- `callcall_RETURN_HighGasUsage.json`

Plus internal regression: a Uniswap-V2 swap test (3-hop CALL chain).

---

## 3. Workstream W2 — CREATE/CREATE2 in zbx-evm

### 3.1 CREATE (0xF0)

Stack: `value, offset, length` (length is initcode length).

Address derivation:
```rust
let nonce = self.host.nonce(&self.ctx.address);
let new_addr = address_from_create(&self.ctx.address, nonce);
// new_addr = keccak256(rlp([sender, nonce]))[12..32]
```

EIP-3860 initcode size limit: `length <= 49152`. Charge `2 * ceil(length / 32)` gas as initcode-word-cost.

Steps:
1. Static-call check → if `is_static`: `EvmError::StaticStateChange`.
2. Charge GAS_CREATE (32000).
3. Charge initcode word cost.
4. Check call-depth (1024).
5. Check sender balance ≥ value.
6. Compute new_addr, increment sender nonce.
7. Collision check: if `host.code(new_addr).len() > 0 || host.nonce(new_addr) > 0`: revert with stack push 0.
8. Snapshot, transfer value to new_addr.
9. Read initcode from memory.
10. Recursive interpreter on initcode (sub_ctx with `address = new_addr`, `code = initcode`).
11. On success: deployed code = sub.return_data. Charge `200 * code.len()` gas. EIP-3541: reject deployed code starting with `0xEF` (except `0xEF000101` ZVM magic — see §5).
12. `host.set_code(new_addr, deployed_code)`.
13. Push new_addr on stack (or 0 on failure).

### 3.2 CREATE2 (0xF5)

Stack: `value, offset, length, salt`.

Address derivation:
```rust
let new_addr = keccak256(&[0xff, &sender, &salt, &keccak256(&initcode)].concat())[12..32];
```

Otherwise identical to CREATE except no nonce read, and address is salt-based-deterministic.

---

## 4. Workstream W3 — SELFDESTRUCT + REVERT in zbx-evm

### 4.1 REVERT (0xFD)

Stack: `offset, length`. Read memory range as return_data, then `return Ok(Some(ExitStatus::Reverted))`. Refunds remaining gas to caller (unlike INVALID which burns all gas). Existing `ExitStatus::Reverted` variant is presumed to exist (verify in `zbx-evm/src/interpreter.rs`).

### 4.2 SELFDESTRUCT (0xFF) — post-Cancun semantics

Per EIP-6780 (Cancun): SELFDESTRUCT only deletes code/storage if executed in the SAME transaction that CREATEd the contract. Otherwise, it just transfers balance to the beneficiary and the contract remains.

```rust
0xff => {
    if self.ctx.is_static { return Err(EvmError::StaticStateChange); }
    let beneficiary = self.stack.pop_address()?;
    let bal = self.host.balance(&self.ctx.address);
    self.host.transfer(&self.ctx.address, &beneficiary, bal);
    if self.frames.iter().any(|f| f.created_address == Some(self.ctx.address)) {
        // Created in this tx — full self-destruct
        self.host.set_code(&self.ctx.address, vec![]);
        self.host.clear_storage(&self.ctx.address);
    }
    return Ok(Some(ExitStatus::Succeeded));
}
```

---

## 5. Workstream W4 — Mirror W1+W2+W3 in zbx-zvm

Everything in W1/W2/W3 must be ported to `crates/zbx-zvm/src/interpreter.rs`. Pattern is identical — only differences:

1. `Opcode::CALL` etc. instead of byte-level `0xf1`.
2. ZVM uses `ZvmHost` trait instead of zbx-evm's `Host`.
3. ZVM has the additional `is_zvm_native` bytecode-prefix flag (per `executor.rs`); CALL into a target with ZVM magic prefix should set `sub_ctx.is_zvm_native = true`.
4. ZVM `ExecutionStatus::Revert` already exists; ensure SELFDESTRUCT path returns `ExecutionStatus::Success`.

**Critical constraint:** When a CALL crosses VM boundaries (EVM contract calls ZVM contract or vice versa), the dispatcher (W7) must route correctly. Recommendation: each interpreter only ever calls into its own type of bytecode; cross-VM calls revert with `EvmError::CrossVmCall` until W7 establishes the bridge.

---

## 6. Workstream W5 — Multi-frame executor in zbx-zvm

Replace `crates/zbx-zvm/src/executor.rs` (currently single-frame, 66 LOC) with a frame-stack model:

```rust
pub struct ZvmExecutor {
    frames: Vec<CallFrame>,
}

pub struct CallFrame {
    pub interpreter: ZvmInterpreter,
    pub return_to: Option<MemoryRange>, // where parent wants the return data written
    pub gas_at_entry: u64,
    pub snapshot_id: SnapshotId,
}

impl ZvmExecutor {
    pub fn execute<H: ZvmHost>(&mut self, ctx: ZvmContext, host: &mut H) -> ZvmResult {
        self.frames.push(CallFrame::new(ctx));
        loop {
            let top = self.frames.last_mut().unwrap();
            match top.interpreter.run_until_call_or_finish(host) {
                Yield::Finish(result) => {
                    let frame = self.frames.pop().unwrap();
                    if self.frames.is_empty() { return result; }
                    self.frames.last_mut().unwrap().resume_with(result);
                }
                Yield::Call(sub_ctx, return_to) => {
                    self.frames.push(CallFrame::new_sub(sub_ctx, return_to));
                }
            }
        }
    }
}
```

Trade-off vs. recursion: trampoline avoids Rust stack overflow at depth 1024 (each frame is ~1–2 KB; 1024 × 1.5 KB = 1.5 MB which is fine on default stack but risky if Rust adds debug guards). Recommendation: **trampoline**.

---

## 7. Workstream W6 — State journal contract

`zbx-execution::BlockExecutor` already manages its own state journal (transaction-level). The VM call frames need a sub-journal that:

1. Snapshots on every CALL/CALLCODE/DELEGATECALL/STATICCALL/CREATE/CREATE2 entry.
2. Either commits (on Succeeded sub-result) or reverts (on Reverted/Failed) on exit.
3. The TOP-level commit (end of execute_tx) propagates to BlockExecutor's tx-level journal, which then commits to RocksDB at end of block.

Minimum trait extension on `Host` (zbx-evm) and `ZvmHost` (zbx-zvm):

```rust
type SnapshotId;
fn snapshot(&mut self) -> SnapshotId;
fn revert_to(&mut self, id: SnapshotId);
fn commit(&mut self, id: SnapshotId);
```

`zbx-execution::ProductionHost` (W8) implements this by maintaining a `Vec<StateDiff>` stack and applying/discarding on commit/revert.

---

## 8. Workstream W7 — ZVM dispatcher in zbx-execution

Insert in `crates/zbx-execution/src/executor.rs` between the precompile dispatch (S7-EVM2 closure) and the value-transfer short-circuit:

```rust
// S7-EVM2: precompile dispatch (existing)
if tx.tx.to.is_some() && zbx_evm::precompiles::is_precompile(&callee) { ... }

// S7-EVM3 W7: ZVM vs EVM bytecode dispatch
else if !is_pure_value_transfer && !code_to_run.is_empty() {
    let is_zvm = code_to_run.starts_with(&zbx_zvm::ZVM_MAGIC); // [0xEF, 0x5A, 0x42]
    if is_zvm {
        // Route to zbx-zvm
        let zvm_ctx = build_zvm_context(&tx, &header, calldata, gas_limit, intrinsic);
        let mut zvm_host = ProductionZvmHost::new(view); // W8
        let result = ZvmExecutor::default().execute(zvm_ctx, &mut zvm_host); // W5
        translate_zvm_result_to_exit_status(result)
    } else {
        // Route to zbx-evm (existing path)
        ... existing EVM dispatch ...
    }
}
```

**Edge case:** EVM contract CALLs a ZVM contract address. The EVM CALL handler (W1 step 11) reads `host.code(&addr)`, which returns ZVM-prefixed bytecode. The EVM interpreter would then attempt to execute ZVM bytecode as EVM bytecode — first byte 0xEF maps to nothing in EVM (EIP-3541 reject), so the call would revert. **This is correct behaviour** — cross-VM calls in this design are not supported until W9 ZBX-native opcode integration is paired with cross-VM trait calls. Document as Out Of Scope for this phase.

---

## 9. Workstream W8 — Production ZvmHost impl

New file: `crates/zbx-execution/src/zvm_host.rs`:

```rust
pub struct ProductionZvmHost<'a> {
    view: &'a mut StateView,
    pay_id_registry: &'a PayIdRegistry,
    zusd_vault: &'a ZusdVault,
    oracle: &'a OracleTwap,
    aa_context: Option<AaContext>,
    snapshots: Vec<StateDiff>,
}

impl<'a> ZvmHost for ProductionZvmHost<'a> {
    fn balance(&self, addr: &Address) -> u128 {
        self.view.get_account(addr).map(|a| a.balance).unwrap_or(0)
    }
    fn storage_load(&self, addr: &Address, key: &[u8; 32]) -> [u8; 32] {
        self.view.get_storage(addr, key).unwrap_or([0u8; 32])
    }
    // ... etc for all 12 trait methods
    fn resolve_pay_id(&self, pay_id: &str) -> Option<Address> {
        self.pay_id_registry.resolve(pay_id)
    }
    fn zusd_balance(&self, addr: &Address) -> u128 {
        self.zusd_vault.balance_of(addr)
    }
    fn zbx_price_usd(&self) -> u128 {
        self.oracle.current_price()
    }
    fn burn_zbx(&mut self, addr: &Address, amount: u128) -> Result<(), ZvmError> {
        let acct = self.view.get_account_mut(addr).ok_or(ZvmError::Account)?;
        acct.balance = acct.balance.checked_sub(amount).ok_or(ZvmError::InsufficientBalance)?;
        Ok(())
    }
    fn emit_zvm_log(&mut self, key: &str, value: &str) {
        // Append to BlockExecutor's structured log buffer
        self.view.push_zvm_log(key, value);
    }
}
```

**Critical sub-finding to fix in MockZvmHost first** (S7-ZVM-HOST1):
- `MockZvmHost::code_hash` uses **SHA256** (`use sha2::{Digest, Sha256}`) instead of **keccak256**. EVM convention (EXTCODEHASH at 0x3F) is keccak256. Fix:
```rust
fn code_hash(&self, addr: &Address) -> [u8; 32] {
    use sha3::{Digest, Keccak256};
    Keccak256::digest(&self.code(addr)).into()
}
```

---

## 10. Workstream W9 — Cross-crate wiring for ZVM-native opcodes

Each ZVM-native opcode handler is already implemented in `zbx-zvm/src/interpreter.rs` — they just call `self.host.X()`. The work is making the production host (W8) call into real subsystems:

| Opcode | Wiring needed | Source crate |
|--------|---------------|--------------|
| `PAYID` 0xC0 | `PayIdRegistry::resolve(&str) -> Option<Address>` | exists in `zbx-payid` (verify) or new |
| `ZUSDBAL` 0xC1 | `ZusdVault::balance_of(&Address) -> u128` | exists in `zbx-zusd` (verify) |
| `ZBXPRICE` 0xC2 | `OracleTwap::current_price() -> u128` | exists in `zbx-oracle-twap` |
| `ZBXTIME` 0xC3 | constant 5000 — no wiring | n/a |
| `AASENDER` 0xC4 | `AaContext::original_sender()` from `zbx-bundler` | needs context propagation through tx |
| `CHAINVER` 0xC5 | constant — no wiring | n/a |
| `BLOBFEE` 0xC6 | `header.blob_base_fee` | already in BlockHeader |
| `PAYIDSET` 0xC7 | `PayIdRegistry::is_set(&Address) -> bool` | same as PAYID |
| `ZBXBURN` 0xC8 | `view.burn(&Address, u128)` | exists in `zbx-state` (verify) |
| `ZVMLOG` 0xC9 | `BlockExecutor::push_zvm_log(key, val)` | new field on BlockExecutor |

For each crate marked "verify", an audit pre-flight is required: confirm the API exists with the expected signature, or file a sub-ticket to add it. Most should already exist since the chain advertises these as features.

---

## 11. Workstream W10 — Test harness against ethereum/tests

Add `crates/zbx-evm/tests/` and `crates/zbx-zvm/tests/` integration test directories.

Minimum test corpora:
1. **`ethereum/tests/GeneralStateTests/`** (a curated subset, ~100 tests):
   - `stCall*` — CALL/CALLCODE/DELEGATECALL/STATICCALL semantics
   - `stCreate*` — CREATE/CREATE2 semantics
   - `stStaticCall` — static-context enforcement
   - `stRevertTest` — REVERT semantics
   - `stSelfBalance` — self-balance edge cases
   - `stSStoreTest` — storage gas (EIP-2200/3529)
2. **Internal regressions:**
   - Uniswap-V2 swap (3-hop CALL chain on real fork)
   - ERC-20 `transfer` (basic CALL → success)
   - OpenZeppelin proxy (DELEGATECALL into impl)
   - ERC-721 `safeTransferFrom` (nested CALL with onERC721Received check)

Test harness pattern:
```rust
#[test]
fn ethereum_test_call_callcode_00() {
    let test = load_state_test("stCallCodes/callcall_00.json");
    let result = run_evm_state_test(&test);
    assert_eq!(result.post_state_root, test.expected.post_state_root);
}
```

The harness needs a JSON fixture loader (~150 LOC) and a state-test runner (~200 LOC). Both depend on a working CALL/CREATE implementation, so W10 sequences AFTER W1+W2+W3.

---

## 12. Sequencing & dependency graph

**[architect-revised 2026-05-01]:** W6 (state journal trait extension on `Host`/`ZvmHost`) is now a HARD prerequisite of W1/W2 because both call `self.host.snapshot()` / `revert_to()` / `commit()` which don't exist on the trait until W6 lands. Original plan listed W6 in parallel — corrected:

```
S7-ZVM-INVOPS (DONE Session 10) ─────────────┐
S7-EVM-INVOPS (DONE Session 10) ─────────────┤
                                             ▼
                              W6 (state journal trait extension)
                                  │   adds snapshot/revert_to/commit
                                  │   to Host AND ZvmHost
                                  ▼
                  ┌───────────────┼───────────────┐
                  ▼               ▼               ▼
       W3.REVERT (zbx-evm)   W1 (CALL ×4)   W2 (CREATE ×2)
                  │               │               │
                  └───────┬───────┴───────────────┘
                          ▼
              W3.SELFDESTRUCT (needs CREATE tx-tracking)
                          │
                          ▼
                  W10 (test harness — validates W1+W2+W3)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        W4 (mirror in zbx-zvm)   W7 (dispatcher in zbx-execution)
              │
              ▼
        W5 (multi-frame zvm executor)
              │
              ▼
        W8 (ProductionZvmHost — uses W6 trait surface)
              │
              ▼
        W9 (cross-crate ZVM-native wiring)
              │
              ▼
        W11 (audit doc closure + final architect review)
```

Critical path: **W6 → W1+W2+W3.REVERT in parallel → W3.SELFDESTRUCT → W10**. Then ZVM track (W4/W5/W8/W9) can proceed in parallel with dispatcher (W7) and audit closure (W11).

Recommendation: do **W6 + W1 + W3.REVERT + W10 (just the harness, no ZVM mirror)** first as a one-week milestone. This makes zbx-evm executable for real Solidity contracts (Uniswap, ERC-20). Then expand to ZVM in week 2.

**Why W6 first matters in practice:** if W1 is implemented against stub `snapshot()`/`revert_to()` methods, then partial state changes from a failed sub-call will *leak* into the parent frame's state. This is a silent consensus-break vector — precisely the class of bug S7-ZVM-INVOPS surfaced. Implement the journal first, write a one-frame integration test that validates revert atomicity (e.g. SSTORE then INVALID-revert and confirm storage reverted), THEN start CALL/CREATE.

---

## 13. Rollback plan

Each workstream is git-isolated:
- **W1+W2+W3 rollback:** `git revert` the zbx-evm changes. Chain reverts to "non-functional EVM" state. No data loss because no transactions could execute the affected opcodes anyway.
- **W4+W5 rollback:** `git revert` zbx-zvm changes. Chain still has zbx-evm working (post W1+W2+W3).
- **W7 (dispatcher) rollback:** `git revert` the dispatcher branch in `zbx-execution::execute_tx`. ZVM bytecodes go back to being dispatched as EVM (which then reverts via EIP-3541). No corruption.
- **W8 (ProductionZvmHost) rollback:** ZVM dispatch falls back to MockZvmHost-style stubs. ZVM-native opcodes return zeros. EVM continues working.

State backwards-compat: post-launch, you cannot rollback CREATE if real contracts have been deployed (their state is in the Merkle tree). Pre-launch, all rollbacks are safe.

---

## 14. New findings surfaced during this planning

These are filed alongside this doc; node-team should add them to `AUDIT_2026-04-30.md` finding-ID quick index:

| ID | Severity | Where | Description |
|----|---------:|-------|-------------|
| **S7-EVM3** | **CRITICAL** | `zbx-evm/src/interpreter.rs::step()` | Entire 0xF0–0xFF system-call range missing from byte-dispatch (only RETURN at 0xF3 wired). EVM is non-functional for any contract using CALL/CREATE/etc. This doc's W1+W2+W3. |
| **S7-ZVM-INVOPS** | **CRITICAL** | `zbx-zvm/src/interpreter.rs::step()` catch-all | **Fixed this session.** Was silently NOPing all unknown opcodes, would have masked CALL/CREATE silent failures. Now returns `ExecutionStatus::InvalidOpcode(byte)` per yellow-paper appendix H. |
| **S7-ZVM-HOST1** | HIGH | `zbx-zvm/src/host.rs::MockZvmHost::code_hash` | Uses SHA256 instead of keccak256. Test-only impact today (MockZvmHost is the only impl), but if used as a template for ProductionZvmHost (W8) would be a consensus break. Fix included in W8. |
| **S7-ZVM-HOST2** | MEDIUM | workspace | Zero production `ZvmHost` implementations exist. Only `MockZvmHost`. Closed by W8. |
| **S7-ZVM-EXEC1** | HIGH | `zbx-zvm/src/executor.rs` | Single-frame executor, no nested call support. Closed by W5. |
| **S7-ZVM-DOC2** | LOW | `zbx-zvm/src/opcodes.rs:1,5` | File-header doc-block still claims "EVM (0x00–0xEF) + ZBX-native (0xF0–0xF9)" — wrong on both halves (EVM is 0x00–0xFF, ZBX-native is 0xC0–0xC9). S7-ZVM-DOC1 (Session 8) fixed `lib.rs` and an inline comment but missed this header. Pure comment fix. |

---

## 15. Architect-review checkpoints

Recommend a code-review checkpoint at the end of each of:
- W1 (CALL family in zbx-evm) — gas accounting is the highest-risk surface
- W5 (multi-frame executor) — frame stack design + journal interaction
- W7 (dispatcher) — magic-prefix detection + cross-VM behaviour
- W8 (ProductionZvmHost) — keccak vs sha vs blake usage

---

## 16. Decision log

| Date | Decision | By |
|------|----------|-----|
| 2026-05-01 | User chose Option C (keep both VMs in production with full functionality) over Option B (delete dead VMs). This doc operationalises Option C. | User + Replit Agent |
| 2026-05-01 | S7-ZVM-INVOPS fix applied this session (CRITICAL silent-NOP catch-all → InvalidOpcode revert). | Replit Agent |
| 2026-05-01 | All other workstreams (W1–W11) deferred to node-team. Sandbox compile-verify constraint (rocksdb SIGKILL on zbx-execution / zbx-zvm) prevents safe in-session implementation of consensus-critical CALL/CREATE handlers. | Replit Agent |
| _pending_ | W1 first-iteration architect review | node-team |
| _pending_ | W7 dispatcher design sign-off | node-team lead + PM |
