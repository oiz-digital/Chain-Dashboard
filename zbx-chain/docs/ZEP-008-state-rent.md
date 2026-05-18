# ZEP-008: State Rent and Expiry

| Field      | Value                                   |
|:---|:---|
| ZEP Number | ZEP-008                                 |
| Title      | State Rent and Expiry System            |
| Status     | **Draft** — targets block 250,000       |
| Category   | Core / Economics                        |
| Authors    | Zebvix Core Team                        |

## Abstract

ZEP-008 introduces a state rent mechanism to prevent unbounded state growth.
Accounts are charged for long-term storage usage. Dormant accounts with unpaid
rent are hibernated; after 2 years of hibernation, state is permanently pruned.

## Parameters

| Parameter                | Value                       |
|:---|:---|
| Slot rent / year         | 0.0001 ZBX / 32-byte slot   |
| Free slots per account   | 5 slots (160 bytes free)    |
| Min balance              | 0.01 ZBX                    |
| Hibernation threshold    | balance < min_balance        |
| Expiry period            | 2 years (~12.6M blocks)      |

## State Lifecycle

```
Active → [rent due, balance low] → Hibernated → [2 years] → Expired/Pruned
                                       ↑
                               [owner pays revival fee]
                                       ↓
                                    Active
```

## Revival

To revive a hibernated account:
```
revival_fee = back_rent_owed + MIN_BALANCE_WEI
```
State is restored from archived Merkle snapshot.

## Economic Impact

At 1M active accounts with average 20 slots each:
- State growth without rent: +20 GB/year
- With rent: self-limiting, ~steady-state after early adoption
- Revenue: redistributed to validators (50%) and treasury (50%)