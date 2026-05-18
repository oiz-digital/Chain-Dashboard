# ZEP-005: Dynamic Gas Fees (EIP-1559)

| Field         | Value                                      |
|:---|:---|
| ZEP Number    | ZEP-005                                    |
| Title         | Dynamic Gas Fee System (EIP-1559)          |
| Status        | **Active** — implemented in v0.1           |
| Category      | Core / Consensus                           |
| Authors       | Zebvix Core Team                           |
| Created       | Block 0 (Genesis)                          |
| Replaces      | Static 1 Gwei fee (pre-v0.1)              |

---

## Abstract

ZBX chain adopts the EIP-1559 gas fee mechanism (Ethereum London fork, 2021).
Gas fees automatically adjust ±12.5% per block based on network utilization.
This replaces the previous static hardcoded fee and makes ZBX more predictable
and economically sound for users and applications.

---

## Motivation

**Problem with static fees:**
- At low network usage: users overpay unnecessarily
- At high network usage: blocks fill up, transactions get stuck, no market signal
- No feedback mechanism for wallets/apps to set appropriate fees

**EIP-1559 solves this by:**
- Providing a predictable base fee that adjusts smoothly
- Burning base fees (deflationary pressure on ZBX)
- Separating priority fee (tip to validators) from base fee
- Enabling "set-and-forget" gas pricing in wallets

---

## Specification

### Parameters

| Parameter                    | Value         | Notes                              |
|:----|:----|:----|
| `BLOCK_GAS_LIMIT`           | 30,000,000    | Max gas per block                  |
| `BLOCK_GAS_TARGET`          | 15,000,000    | 50% of limit                       |
| `MIN_BASE_FEE_WEI`          | 100,000,000   | Floor: 0.1 Gwei (cheaper than ETH) |
| `INITIAL_BASE_FEE_WEI`      | 1,000,000,000 | Genesis: 1 Gwei                    |
| `MAX_BASE_FEE_WEI`          | 10,000,000,000,000 | Cap: 10,000 Gwei              |
| `BASE_FEE_CHANGE_DENOMINATOR`| 8            | Max change: 1/8 = 12.5% per block  |
| `PRIORITY_FEE_WEI`          | 100,000,000   | Recommended tip: 0.1 Gwei          |

### Algorithm

```
gas_target = block_gas_limit / 2  // 15,000,000

if gas_used == gas_target:
    next_base_fee = base_fee                // no change

elif gas_used > gas_target:                 // block too full
    delta = base_fee × (gas_used - gas_target) / gas_target / 8
    next_base_fee = base_fee + max(delta, 1)

else:                                       // block too empty
    delta = base_fee × (gas_target - gas_used) / gas_target / 8
    next_base_fee = max(base_fee - delta, MIN_BASE_FEE_WEI)

next_base_fee = clamp(next_base_fee, MIN_BASE_FEE_WEI, MAX_BASE_FEE_WEI)
```

### Transaction Types Supported

```
Type 0 (Legacy):   gas_price       — converted to EIP-1559 internally
Type 2 (EIP-1559): max_fee_per_gas + max_priority_fee_per_gas  ← default
```

**Effective gas price for Type 2:**
```
effective_price = min(max_fee_per_gas, base_fee + max_priority_fee_per_gas)
```

### Fee Burning

Base fee is burned (permanently removed from supply). This is deflationary:
at high usage, more ZBX is burned than is minted as validator reward.

```
burned_per_block  = base_fee × gas_used
minted_per_block  = block_reward (fixed, ZEP-002)
net_zbx_change    = minted - burned
```

At high utilization (>90%), ZBX becomes deflationary automatically.

### RPC Methods Updated

| Method                    | Before            | After                      |
|:----|:----|:----|
| `eth_gasPrice`           | static 1 Gwei     | base_fee + priority_fee    |
| `eth_maxPriorityFeePerGas`| static 1 Gwei    | 0.1 Gwei (dynamic in future)|
| `eth_feeHistory`         | static 1 block    | last 100 blocks real data  |
| `eth_getBlockByNumber`   | no baseFeePerGas  | includes real baseFeePerGas|

---

## Rationale

ZBX chose EIP-1559 over alternatives because:
1. **Ecosystem compatibility** — all EVM wallets already support it
2. **Predictability** — base_fee changes ≤12.5% per block (smooth, not chaotic)
3. **Deflationary** — base fee burning aligns validator/user interests
4. **Battle-tested** — Ethereum has run it since London (Aug 2021, block 12,965,000)

ZBX floor (0.1 Gwei) is 10× cheaper than Ethereum (1 Gwei) because:
- ZBX targets higher throughput at lower cost than Ethereum
- Early network has low base usage — floor prevents fee from going to 0

---

## Security Considerations

- **Griefing attacks**: A validator could fill blocks to raise fees for others.
  Mitigation: ±12.5% cap limits damage to sustained attack (takes 34 blocks to 2×).
- **Floor bypass**: MIN_BASE_FEE_WEI prevents spam at fee=0.
- **Overflow**: All fee arithmetic uses saturating operations (no overflow panic).

---

## Test Vectors

| Input                              | Expected base fee    |
|:----|:----|
| Base=1 Gwei, Gas=15M (50%)        | 1.000 Gwei (no change)|
| Base=1 Gwei, Gas=30M (100%)       | 1.125 Gwei (+12.5%)  |
| Base=1 Gwei, Gas=0   (0%)         | 0.875 Gwei (-12.5%)  |
| Base=1 Gwei, Gas=22.5M (75%)      | 1.0625 Gwei (+6.25%) |
| Base=0.1 Gwei (floor), Gas=0      | 0.1 Gwei (floor held)|
| Base=9,999 Gwei, Gas=30M (100%)   | 10,000 Gwei (capped) |