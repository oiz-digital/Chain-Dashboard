# EVM Compatibility

> **⚠ Known limitation (Session 13, OPEN — `S7-EVM3` CRITICAL):** the CALL family of
> opcodes (CALL / DELEGATECALL / STATICCALL / CALLCODE / CREATE / CREATE2 / SELFDESTRUCT /
> REVERT) is **not yet implemented** in either `zbx-evm` or `zbx-zvm` dispatch tables.
> Real-world impact: any Solidity contract that calls another contract (factories,
> proxies, Uniswap-style routers, ERC-4337 wallets, Aave-style multi-contract DeFi)
> will silently revert at the unimplemented opcode. Single-contract Solidity (ERC-20,
> simple logic, isolated NFTs) works today. The full implementation plan is in
> `docs/proposals/S7-EVM3-call-family-implementation.md` (~16 dev-days, P0-T03).
> The "fully EVM-compatible" claim below is the intended end-state, not the current
> state. See also `docs/DOC_STATUS.md`.

Zebvix Chain is fully EVM-compatible. Smart contracts compiled for Ethereum
deploy and execute without modification.

## Supported EIPs

| EIP    | Name                      | Status    |
|--------|---------------------------|-----------|
| 155    | Simple replay protection  | ✅ Active |
| 1559   | Fee market                | ✅ Active |
| 2929   | Gas cost increases        | ✅ Active |
| 2930   | Optional access lists     | ✅ Active |
| 3155   | EVM trace spec            | ✅ Active |
| 3529   | Reduction in gas refunds  | ✅ Active |
| 3541   | Reject 0xEF prefix        | ✅ Active |
| 3675   | Merge (PoS)               | ✅ Active |
| 3855   | PUSH0 instruction         | ✅ Active |
| 3860   | Limit initcode size       | ✅ Active |
| 4895   | Beacon withdrawals        | ✅ Active |
| 1153   | Transient storage         | ✅ Active |
| 5656   | MCOPY                     | ✅ Active |
| 4844   | Blob transactions         | 🔄 Planned |
| 7702   | Account abstraction (EOA) | 🔄 Planned |

## ZBX Extensions

Zebvix adds custom precompiles at addresses `0xZBX_{n}`:

| Address  | Name          | Gas cost | Description                    |
|----------|---------------|----------|--------------------------------|
| 0xZBX_01 | BLS G1 Add    | 500      | BLS12-381 G1 point addition    |
| 0xZBX_02 | BLS G1 Mul    | 12,000   | BLS12-381 G1 scalar multiply   |
| 0xZBX_03 | BLS G2 Add    | 800      | BLS12-381 G2 point addition    |
| 0xZBX_04 | BLS Pairing   | 65,000   | BLS12-381 pairing check        |
| 0xZBX_05 | Bridge Hook   | 3,000    | Native bridge call hook        |

## Chain-Specific Parameters

| Parameter         | Ethereum  | Zebvix Chain |
|-------------------|-----------|--------------|
| Chain ID          | 1         | 8989         |
| Block time        | 12s       | 5s           |
| Max gas per block | 30M       | 30M          |
| Address format    | EIP-55    | EIP-55       |
| Signature scheme  | secp256k1 | secp256k1    |

## Tooling Compatibility

| Tool         | Compatible | Notes                         |
|--------------|------------|-------------------------------|
| MetaMask     | ✅          | Add custom network (ID: 8989) |
| Hardhat      | ✅          | Use `chainId: 8989`           |
| Foundry       | ✅          | `--chain-id 8989`             |
| ethers.js    | ✅          | Connect to RPC endpoint       |
| viem         | ✅          | Define custom chain            |
| Remix IDE    | ✅          | Web3 provider injection        |
| Tenderly     | 🔄 Planned | Dashboard integration         |