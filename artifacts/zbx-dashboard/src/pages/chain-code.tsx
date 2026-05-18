import { useState, useCallback } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Code2, X, Loader2, ExternalLink, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const REPO = "servicefree310-ctrl/Chain-Dashboard";
const BASE_PATH = "zbx-chain-source/zbx-chain";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/${BASE_PATH}`;
const GITHUB_BASE = `https://github.com/${REPO}/blob/main/${BASE_PATH}`;

type TreeNode = {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: TreeNode[];
  description?: string;
};

const CRATE_DESCRIPTIONS: Record<string, string> = {
  "zbx-types": "Core primitives & types — addresses, hashes, U256",
  "zbx-primitives": "Low-level blockchain primitives",
  "zbx-crypto": "Ed25519 signing, Keccak256, Blake3 hashing",
  "zbx-codec": "Binary encoding/decoding for network messages",
  "zbx-rlp": "RLP encoding (Ethereum-compatible)",
  "zbx-abi": "ABI encoding for EVM-compatible contracts",
  "zbx-consensus": "BFT consensus engine (v0.2 multi-validator)",
  "zbx-block": "Block structure, validation, production",
  "zbx-finality": "Finality gadget & confirmation logic",
  "zbx-sequencer": "Transaction sequencing & ordering",
  "zbx-executor": "Block execution coordinator",
  "zbx-rewards": "Block reward calculation & halving",
  "zbx-network": "Noise XX encrypted P2P networking",
  "zbx-net": "Low-level network transport abstractions",
  "zbx-gossip": "Gossip protocol for tx & block propagation",
  "zbx-sync": "Chain sync & fast-sync protocol",
  "zbx-mempool": "Transaction mempool with priority queue",
  "zbx-tx": "Transaction types, signing & validation",
  "zbx-fee": "Fee estimation & gas price oracle",
  "zbx-bundler": "EIP-4337 account abstraction bundler",
  "zbx-mev": "MEV protection & fair ordering",
  "zbx-state": "Global state trie & account storage",
  "zbx-state-rent": "State rent mechanism (ZEP-018)",
  "zbx-storage": "RocksDB storage backend",
  "zbx-trie": "Modified Merkle Patricia Trie",
  "zbx-verkle": "Verkle tree implementation (ZEP-020)",
  "zbx-pruner": "State & history pruning",
  "zbx-snapshot": "Snapshot sync support",
  "zbx-execution": "Transaction execution engine",
  "zbx-evm": "EVM-compatible execution layer (revm)",
  "zbx-vm": "Native ZBX VM",
  "zbx-zvm": "Zero-knowledge VM",
  "zbx-wasm": "WASM smart contract runtime",
  "zbx-zk": "ZK proof generation & verification",
  "zbx-prover": "zkSNARK/STARK prover integration",
  "zbx-rpc": "JSON-RPC server (Ethereum-style)",
  "zbx-jsonrpc": "JSON-RPC method handlers",
  "zbx-xcl": "Native cross-chain layer (no bridges)",
  "zbx-staking": "Validator staking & delegation",
  "zbx-bridge": "Cross-chain bridge protocol",
  "zbx-genesis": "Genesis block creation & configuration",
  "zbx-config": "Node configuration management",
  "zbx-oracle": "Price oracle aggregator",
  "zbx-oracle-optimistic": "Optimistic oracle (ZEP-022)",
  "zbx-oracle-twap": "TWAP price oracle",
  "zbx-oracle-zk": "ZK-verified oracle feeds",
  "zbx-pool": "AMM liquidity pool — 20M ZBX seed",
  "zbx-payid": "PayID human-readable address protocol",
  "zbx-contracts": "Built-in system contracts",
  "zbx-lending": "DeFi lending protocol",
  "zbx-perp": "Perpetual futures protocol",
  "zbx-yield": "Yield aggregator & farming",
  "zbx-nft": "NFT minting & marketplace",
  "zbx-launchpad": "Token launchpad protocol",
  "zbx-gaming": "Gaming SDK & on-chain game state (ZEP-031)",
  "zbx-payment": "Payment gateway integration (ZEP-032)",
  "zbx-metrics": "Prometheus metrics & observability",
  "zbx-telemetry": "OpenTelemetry tracing",
  "zbx-trace": "Transaction trace & debug",
  "zbx-indexer": "On-chain data indexer",
  "zbx-explorer": "Block explorer API backend",
  "zbx-admin": "Node admin interface",
  "zbx-ai-precompile": "AI inference precompile",
  "zbx-ai-sdk": "AI model SDK for smart contracts",
  "zbx-ai-registry": "On-chain AI model registry",
  "zbx-threshold": "Threshold signature scheme",
  "zbx-keystore": "Encrypted keystore management",
  "zbx-pq": "Post-quantum cryptography (ZEP-015)",
  "zbx-confidential": "Confidential transactions (ZEP-025)",
  "zbx-sdk": "Developer SDK — the ZBX toolkit",
  "zbx-wallet": "Wallet implementation",
  "zbx-cli": "Command-line interface (zebvix-node)",
  "zbx-light": "Light client protocol",
  "zbx-da": "Data availability layer",
};

// Helpers to build tree concisely
function f(name: string, path: string): TreeNode { return { name, type: "file", path }; }
function d(name: string, path: string, children: TreeNode[], description?: string): TreeNode {
  return { name, type: "dir", path, children, description };
}

const CRATE_NAMES = Object.keys(CRATE_DESCRIPTIONS);

const TREE: TreeNode = d("zbx-chain", "", [
  d(".github", ".github", [
    d("workflows", ".github/workflows", [
      f("mainnet-readiness.yml", ".github/workflows/mainnet-readiness.yml"),
    ]),
  ], "CI/CD workflows"),
  d("benches", "benches", [
    f("block_execution.rs", "benches/block_execution.rs"),
    f("crypto.rs", "benches/crypto.rs"),
    f("evm_opcodes.rs", "benches/evm_opcodes.rs"),
    f("tx_throughput.rs", "benches/tx_throughput.rs"),
  ], "Criterion benchmarks"),
  d("config", "config", [
    f("devnet.toml", "config/devnet.toml"),
    f("mainnet-genesis.json", "config/mainnet-genesis.json"),
    f("mainnet-validators.json", "config/mainnet-validators.json"),
    f("mainnet.toml", "config/mainnet.toml"),
    f("testnet-genesis-zusd-note.md", "config/testnet-genesis-zusd-note.md"),
    f("testnet-genesis.json", "config/testnet-genesis.json"),
    f("testnet.toml", "config/testnet.toml"),
  ], "Mainnet / testnet / devnet configs"),
  d("contracts", "contracts", [
    d("interfaces", "contracts/interfaces", [
      f("IBridgeMultisig.sol", "contracts/interfaces/IBridgeMultisig.sol"),
      f("IBridgeVault.sol", "contracts/interfaces/IBridgeVault.sol"),
      f("IERC3156FlashBorrower.sol", "contracts/interfaces/IERC3156FlashBorrower.sol"),
      f("IERC3156FlashLender.sol", "contracts/interfaces/IERC3156FlashLender.sol"),
      f("IZBX.sol", "contracts/interfaces/IZBX.sol"),
      f("IZBXGov.sol", "contracts/interfaces/IZBXGov.sol"),
      f("IZRC20.sol", "contracts/interfaces/IZRC20.sol"),
      f("IZRC20Burnable.sol", "contracts/interfaces/IZRC20Burnable.sol"),
      f("IZRC20Freezable.sol", "contracts/interfaces/IZRC20Freezable.sol"),
      f("IZRC20Lockable.sol", "contracts/interfaces/IZRC20Lockable.sol"),
      f("IZRC20Mintable.sol", "contracts/interfaces/IZRC20Mintable.sol"),
      f("IZRC721.sol", "contracts/interfaces/IZRC721.sol"),
      f("IZUSD.sol", "contracts/interfaces/IZUSD.sol"),
      f("IZbxAMM.sol", "contracts/interfaces/IZbxAMM.sol"),
      f("IZbxEntryPoint.sol", "contracts/interfaces/IZbxEntryPoint.sol"),
      f("IZbxFlashLoan.sol", "contracts/interfaces/IZbxFlashLoan.sol"),
      f("IZbxGovernor.sol", "contracts/interfaces/IZbxGovernor.sol"),
      f("IZbxLending.sol", "contracts/interfaces/IZbxLending.sol"),
      f("IZbxOracle.sol", "contracts/interfaces/IZbxOracle.sol"),
      f("IZbxPayId.sol", "contracts/interfaces/IZbxPayId.sol"),
      f("IZbxStaking.sol", "contracts/interfaces/IZbxStaking.sol"),
      f("IZbxStarkVerifier.sol", "contracts/interfaces/IZbxStarkVerifier.sol"),
      f("IZbxTimelock.sol", "contracts/interfaces/IZbxTimelock.sol"),
      f("IZbxTvlOracle.sol", "contracts/interfaces/IZbxTvlOracle.sol"),
      f("IZbxTwapOracle.sol", "contracts/interfaces/IZbxTwapOracle.sol"),
      f("IZusdVault.sol", "contracts/interfaces/IZusdVault.sol"),
    ]),
    d("libraries", "contracts/libraries", [
      f("FixedPoint.sol", "contracts/libraries/FixedPoint.sol"),
      f("GoldilocksField.sol", "contracts/libraries/GoldilocksField.sol"),
      f("Governable.sol", "contracts/libraries/Governable.sol"),
      f("MerklePatriciaProof.sol", "contracts/libraries/MerklePatriciaProof.sol"),
      f("ReentrancyGuard.sol", "contracts/libraries/ReentrancyGuard.sol"),
      f("RlpReader.sol", "contracts/libraries/RlpReader.sol"),
      f("SafeCast.sol", "contracts/libraries/SafeCast.sol"),
      f("SafeERC20.sol", "contracts/libraries/SafeERC20.sol"),
      f("StarkFri.sol", "contracts/libraries/StarkFri.sol"),
      f("StarkMerkle.sol", "contracts/libraries/StarkMerkle.sol"),
      f("StarkTranscript.sol", "contracts/libraries/StarkTranscript.sol"),
      f("ZvmOpcodes.sol", "contracts/libraries/ZvmOpcodes.sol"),
    ]),
    d("randomness", "contracts/randomness", [
      f("ZbxRandomBeacon.sol", "contracts/randomness/ZbxRandomBeacon.sol"),
    ]),
    d("test", "contracts/test", [
      f("Erc3156FlashMint.t.sol", "contracts/test/Erc3156FlashMint.t.sol"),
      f("GovernorVotesIntegration.t.sol", "contracts/test/GovernorVotesIntegration.t.sol"),
      f("MerklePatriciaProof.t.sol", "contracts/test/MerklePatriciaProof.t.sol"),
      f("Ownable2Step.t.sol", "contracts/test/Ownable2Step.t.sol"),
      f("Ownable2StepMigration.t.sol", "contracts/test/Ownable2StepMigration.t.sol"),
      f("PayableCallMigration.t.sol", "contracts/test/PayableCallMigration.t.sol"),
      f("SupportsInterface.t.sol", "contracts/test/SupportsInterface.t.sol"),
      f("Tier2Fixes.t.sol", "contracts/test/Tier2Fixes.t.sol"),
      f("ZRC20FreezeParity.t.sol", "contracts/test/ZRC20FreezeParity.t.sol"),
      f("ZRC20TokenAdvanced.t.sol", "contracts/test/ZRC20TokenAdvanced.t.sol"),
      f("ZUSD.t.sol", "contracts/test/ZUSD.t.sol"),
      f("ZbxAMM.t.sol", "contracts/test/ZbxAMM.t.sol"),
      f("ZbxEntryPoint.t.sol", "contracts/test/ZbxEntryPoint.t.sol"),
      f("ZbxStarkVerifier.t.sol", "contracts/test/ZbxStarkVerifier.t.sol"),
      f("ZbxTvlOracle.t.sol", "contracts/test/ZbxTvlOracle.t.sol"),
      f("ZbxTwapOracle.t.sol", "contracts/test/ZbxTwapOracle.t.sol"),
      f("ZusdVaultRedemption.t.sol", "contracts/test/ZusdVaultRedemption.t.sol"),
    ]),
    d("tokens", "contracts/tokens", [
      f("WZBX.sol", "contracts/tokens/WZBX.sol"),
      f("ZBXGov.sol", "contracts/tokens/ZBXGov.sol"),
      f("ZbxBNB.sol", "contracts/tokens/ZbxBNB.sol"),
      f("ZbxBTC.sol", "contracts/tokens/ZbxBTC.sol"),
      f("ZbxETH.sol", "contracts/tokens/ZbxETH.sol"),
      f("ZbxMATIC.sol", "contracts/tokens/ZbxMATIC.sol"),
      f("ZbxSOL.sol", "contracts/tokens/ZbxSOL.sol"),
      f("ZbxUSDC.sol", "contracts/tokens/ZbxUSDC.sol"),
      f("ZbxUSDT.sol", "contracts/tokens/ZbxUSDT.sol"),
    ]),
    d("upgradeable", "contracts/upgradeable", [
      f("ZbxProxy.sol", "contracts/upgradeable/ZbxProxy.sol"),
    ]),
    f("BridgeMultisig.sol", "contracts/BridgeMultisig.sol"),
    f("BridgeVault.sol", "contracts/BridgeVault.sol"),
    f("Multicall3.sol", "contracts/Multicall3.sol"),
    f("Ownable2Step.sol", "contracts/Ownable2Step.sol"),
    f("README.md", "contracts/README.md"),
    f("RewardPool.sol", "contracts/RewardPool.sol"),
    f("TokenRegistry.sol", "contracts/TokenRegistry.sol"),
    f("ZRC20.sol", "contracts/ZRC20.sol"),
    f("ZRC20Airdrop.sol", "contracts/ZRC20Airdrop.sol"),
    f("ZRC20Base.sol", "contracts/ZRC20Base.sol"),
    f("ZRC20Factory.sol", "contracts/ZRC20Factory.sol"),
    f("ZRC20FlashMint.sol", "contracts/ZRC20FlashMint.sol"),
    f("ZRC20Staking.sol", "contracts/ZRC20Staking.sol"),
    f("ZRC20Standard.md", "contracts/ZRC20Standard.md"),
    f("ZRC20Token.sol", "contracts/ZRC20Token.sol"),
    f("ZRC20TokenLocker.sol", "contracts/ZRC20TokenLocker.sol"),
    f("ZRC20Vesting.sol", "contracts/ZRC20Vesting.sol"),
    f("ZRC721Base.sol", "contracts/ZRC721Base.sol"),
    f("ZUSD.sol", "contracts/ZUSD.sol"),
    f("ZbxAMM.sol", "contracts/ZbxAMM.sol"),
    f("ZbxAMMFactory.sol", "contracts/ZbxAMMFactory.sol"),
    f("ZbxAggregatorV3.sol", "contracts/ZbxAggregatorV3.sol"),
    f("ZbxBridge.sol", "contracts/ZbxBridge.sol"),
    f("ZbxBundler.sol", "contracts/ZbxBundler.sol"),
    f("ZbxCardGame.sol", "contracts/ZbxCardGame.sol"),
    f("ZbxContractFactory.sol", "contracts/ZbxContractFactory.sol"),
    f("ZbxDatedFutures.sol", "contracts/ZbxDatedFutures.sol"),
    f("ZbxEntryPoint.sol", "contracts/ZbxEntryPoint.sol"),
    f("ZbxFaucet.sol", "contracts/ZbxFaucet.sol"),
    f("ZbxFlashLoan.sol", "contracts/ZbxFlashLoan.sol"),
    f("ZbxGameEscrow.sol", "contracts/ZbxGameEscrow.sol"),
    f("ZbxGameItems.sol", "contracts/ZbxGameItems.sol"),
    f("ZbxGovernor.sol", "contracts/ZbxGovernor.sol"),
    f("ZbxGroth16Verifier.sol", "contracts/ZbxGroth16Verifier.sol"),
    f("ZbxLaunchpad.sol", "contracts/ZbxLaunchpad.sol"),
    f("ZbxLendingPool.sol", "contracts/ZbxLendingPool.sol"),
    f("ZbxLiquidStaking.sol", "contracts/ZbxLiquidStaking.sol"),
    f("ZbxMemeFactory.sol", "contracts/ZbxMemeFactory.sol"),
    f("ZbxMemeToken.sol", "contracts/ZbxMemeToken.sol"),
    f("ZbxMultisig.sol", "contracts/ZbxMultisig.sol"),
    f("ZbxNFT.sol", "contracts/ZbxNFT.sol"),
    f("ZbxNameService.sol", "contracts/ZbxNameService.sol"),
    f("ZbxNftMarketplace.sol", "contracts/ZbxNftMarketplace.sol"),
    f("ZbxOptions.sol", "contracts/ZbxOptions.sol"),
    f("ZbxOracle.sol", "contracts/ZbxOracle.sol"),
    f("ZbxOracleConsumer.sol", "contracts/ZbxOracleConsumer.sol"),
    f("ZbxPayId.sol", "contracts/ZbxPayId.sol"),
    f("ZbxPaymaster.sol", "contracts/ZbxPaymaster.sol"),
    f("ZbxPaymentGateway.sol", "contracts/ZbxPaymentGateway.sol"),
    f("ZbxPerpetuals.sol", "contracts/ZbxPerpetuals.sol"),
    f("ZbxPredictionMarket.sol", "contracts/ZbxPredictionMarket.sol"),
    f("ZbxRaffle.sol", "contracts/ZbxRaffle.sol"),
    f("ZbxRewardDistributor.sol", "contracts/ZbxRewardDistributor.sol"),
    f("ZbxRouter.sol", "contracts/ZbxRouter.sol"),
    f("ZbxSmartWallet.sol", "contracts/ZbxSmartWallet.sol"),
    f("ZbxSpotOrderBook.sol", "contracts/ZbxSpotOrderBook.sol"),
    f("ZbxStaking.sol", "contracts/ZbxStaking.sol"),
    f("ZbxStarkVerifier.sol", "contracts/ZbxStarkVerifier.sol"),
    f("ZbxTimelock.sol", "contracts/ZbxTimelock.sol"),
    f("ZbxTimelockController.sol", "contracts/ZbxTimelockController.sol"),
    f("ZbxTvlOracle.sol", "contracts/ZbxTvlOracle.sol"),
    f("ZbxTwapOracle.sol", "contracts/ZbxTwapOracle.sol"),
    f("ZbxVRF.sol", "contracts/ZbxVRF.sol"),
    f("ZbxVaultRegistry.sol", "contracts/ZbxVaultRegistry.sol"),
    f("ZbxVerifier.sol", "contracts/ZbxVerifier.sol"),
    f("ZbxYieldOptimizer.sol", "contracts/ZbxYieldOptimizer.sol"),
    f("ZusdPricePeg.sol", "contracts/ZusdPricePeg.sol"),
    f("ZusdStabilityPool.sol", "contracts/ZusdStabilityPool.sol"),
    f("ZusdVault.sol", "contracts/ZusdVault.sol"),
    f("foundry.toml", "contracts/foundry.toml"),
  ], "Solidity smart contracts — ZRC20, ZRC721, DeFi, governance"),
  d("crates", "crates", [
    d("zbx-abi", "crates/zbx-abi", [d("src","crates/zbx-abi/src",[f("decode.rs","crates/zbx-abi/src/decode.rs"),f("encode.rs","crates/zbx-abi/src/encode.rs"),f("error.rs","crates/zbx-abi/src/error.rs"),f("event.rs","crates/zbx-abi/src/event.rs"),f("function.rs","crates/zbx-abi/src/function.rs"),f("lib.rs","crates/zbx-abi/src/lib.rs"),f("types.rs","crates/zbx-abi/src/types.rs")]),f("Cargo.toml","crates/zbx-abi/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-abi"]),
    d("zbx-admin", "crates/zbx-admin", [d("src","crates/zbx-admin/src",[d("_archive","crates/zbx-admin/src/_archive",[f("access_control.rs","crates/zbx-admin/src/_archive/access_control.rs"),f("audit_log.rs","crates/zbx-admin/src/_archive/audit_log.rs"),f("chain_params.rs","crates/zbx-admin/src/_archive/chain_params.rs"),f("emergency.rs","crates/zbx-admin/src/_archive/emergency.rs"),f("governance.rs","crates/zbx-admin/src/_archive/governance.rs"),f("treasury.rs","crates/zbx-admin/src/_archive/treasury.rs"),f("upgrades.rs","crates/zbx-admin/src/_archive/upgrades.rs"),f("validator_admin.rs","crates/zbx-admin/src/_archive/validator_admin.rs")]),f("auth.rs","crates/zbx-admin/src/auth.rs"),f("backup.rs","crates/zbx-admin/src/backup.rs"),f("cli.rs","crates/zbx-admin/src/cli.rs"),f("config.rs","crates/zbx-admin/src/config.rs"),f("db_inspect.rs","crates/zbx-admin/src/db_inspect.rs"),f("error.rs","crates/zbx-admin/src/error.rs"),f("lib.rs","crates/zbx-admin/src/lib.rs"),f("mempool_mgmt.rs","crates/zbx-admin/src/mempool_mgmt.rs"),f("metrics.rs","crates/zbx-admin/src/metrics.rs"),f("rpc.rs","crates/zbx-admin/src/rpc.rs"),f("validator_mgmt.rs","crates/zbx-admin/src/validator_mgmt.rs")]),f("Cargo.toml","crates/zbx-admin/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-admin"]),
    d("zbx-ai-precompile", "crates/zbx-ai-precompile", [d("src","crates/zbx-ai-precompile/src",[f("abi.rs","crates/zbx-ai-precompile/src/abi.rs"),f("da.rs","crates/zbx-ai-precompile/src/da.rs"),f("engine.rs","crates/zbx-ai-precompile/src/engine.rs"),f("error.rs","crates/zbx-ai-precompile/src/error.rs"),f("gas.rs","crates/zbx-ai-precompile/src/gas.rs"),f("lib.rs","crates/zbx-ai-precompile/src/lib.rs"),f("model.rs","crates/zbx-ai-precompile/src/model.rs"),f("precompile.rs","crates/zbx-ai-precompile/src/precompile.rs")]),f("Cargo.toml","crates/zbx-ai-precompile/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-ai-precompile"]),
    d("zbx-ai-registry", "crates/zbx-ai-registry", [d("src","crates/zbx-ai-registry/src",[f("error.rs","crates/zbx-ai-registry/src/error.rs"),f("governance.rs","crates/zbx-ai-registry/src/governance.rs"),f("lib.rs","crates/zbx-ai-registry/src/lib.rs"),f("payment.rs","crates/zbx-ai-registry/src/payment.rs"),f("proof.rs","crates/zbx-ai-registry/src/proof.rs"),f("registry.rs","crates/zbx-ai-registry/src/registry.rs")]),f("Cargo.toml","crates/zbx-ai-registry/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-ai-registry"]),
    d("zbx-ai-sdk", "crates/zbx-ai-sdk", [d("src","crates/zbx-ai-sdk/src",[f("agent.rs","crates/zbx-ai-sdk/src/agent.rs"),f("error.rs","crates/zbx-ai-sdk/src/error.rs"),f("executor.rs","crates/zbx-ai-sdk/src/executor.rs"),f("lib.rs","crates/zbx-ai-sdk/src/lib.rs"),f("oracle.rs","crates/zbx-ai-sdk/src/oracle.rs"),f("risk.rs","crates/zbx-ai-sdk/src/risk.rs"),f("strategy.rs","crates/zbx-ai-sdk/src/strategy.rs")]),f("Cargo.toml","crates/zbx-ai-sdk/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-ai-sdk"]),
    d("zbx-block", "crates/zbx-block", [d("src","crates/zbx-block/src",[f("body.rs","crates/zbx-block/src/body.rs"),f("builder.rs","crates/zbx-block/src/builder.rs"),f("compat.rs","crates/zbx-block/src/compat.rs"),f("header.rs","crates/zbx-block/src/header.rs"),f("lib.rs","crates/zbx-block/src/lib.rs"),f("validation.rs","crates/zbx-block/src/validation.rs")]),f("Cargo.toml","crates/zbx-block/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-block"]),
    d("zbx-bridge", "crates/zbx-bridge", [d("src","crates/zbx-bridge/src",[d("_archive","crates/zbx-bridge/src/_archive",[f("events.rs","crates/zbx-bridge/src/_archive/events.rs"),f("lock_unlock.rs","crates/zbx-bridge/src/_archive/lock_unlock.rs"),f("validator_set.rs","crates/zbx-bridge/src/_archive/validator_set.rs")]),f("error.rs","crates/zbx-bridge/src/error.rs"),f("lib.rs","crates/zbx-bridge/src/lib.rs"),f("multisig.rs","crates/zbx-bridge/src/multisig.rs"),f("persistence.rs","crates/zbx-bridge/src/persistence.rs"),f("proofs.rs","crates/zbx-bridge/src/proofs.rs"),f("relayer.rs","crates/zbx-bridge/src/relayer.rs"),f("token.rs","crates/zbx-bridge/src/token.rs")]),f("Cargo.toml","crates/zbx-bridge/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-bridge"]),
    d("zbx-bundler", "crates/zbx-bundler", [d("src","crates/zbx-bundler/src",[f("bundler.rs","crates/zbx-bundler/src/bundler.rs"),f("error.rs","crates/zbx-bundler/src/error.rs"),f("gas.rs","crates/zbx-bundler/src/gas.rs"),f("lib.rs","crates/zbx-bundler/src/lib.rs"),f("mempool.rs","crates/zbx-bundler/src/mempool.rs"),f("paymaster.rs","crates/zbx-bundler/src/paymaster.rs"),f("rpc.rs","crates/zbx-bundler/src/rpc.rs"),f("simulation.rs","crates/zbx-bundler/src/simulation.rs"),f("types.rs","crates/zbx-bundler/src/types.rs")]),f("Cargo.toml","crates/zbx-bundler/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-bundler"]),
    d("zbx-cli", "crates/zbx-cli", [d("src","crates/zbx-cli/src",[f("account.rs","crates/zbx-cli/src/account.rs"),f("chain.rs","crates/zbx-cli/src/chain.rs"),f("config.rs","crates/zbx-cli/src/config.rs"),f("contract.rs","crates/zbx-cli/src/contract.rs"),f("error.rs","crates/zbx-cli/src/error.rs"),f("genesis.rs","crates/zbx-cli/src/genesis.rs"),f("keystore.rs","crates/zbx-cli/src/keystore.rs"),f("lib.rs","crates/zbx-cli/src/lib.rs"),f("main.rs","crates/zbx-cli/src/main.rs"),f("node.rs","crates/zbx-cli/src/node.rs"),f("staking.rs","crates/zbx-cli/src/staking.rs"),f("tx.rs","crates/zbx-cli/src/tx.rs")]),f("Cargo.toml","crates/zbx-cli/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-cli"]),
    d("zbx-codec", "crates/zbx-codec", [d("src","crates/zbx-codec/src",[f("decode.rs","crates/zbx-codec/src/decode.rs"),f("encode.rs","crates/zbx-codec/src/encode.rs"),f("error.rs","crates/zbx-codec/src/error.rs"),f("lib.rs","crates/zbx-codec/src/lib.rs"),f("varint.rs","crates/zbx-codec/src/varint.rs")]),f("Cargo.toml","crates/zbx-codec/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-codec"]),
    d("zbx-confidential", "crates/zbx-confidential", [d("src","crates/zbx-confidential/src",[f("error.rs","crates/zbx-confidential/src/error.rs"),f("lib.rs","crates/zbx-confidential/src/lib.rs"),f("pedersen.rs","crates/zbx-confidential/src/pedersen.rs"),f("range_proof.rs","crates/zbx-confidential/src/range_proof.rs"),f("stealth.rs","crates/zbx-confidential/src/stealth.rs")]),f("Cargo.toml","crates/zbx-confidential/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-confidential"]),
    d("zbx-config", "crates/zbx-config", [d("src","crates/zbx-config/src",[f("lib.rs","crates/zbx-config/src/lib.rs"),f("network.rs","crates/zbx-config/src/network.rs"),f("node.rs","crates/zbx-config/src/node.rs")]),f("Cargo.toml","crates/zbx-config/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-config"]),
    d("zbx-consensus", "crates/zbx-consensus", [d("src","crates/zbx-consensus/src",[d("_archive","crates/zbx-consensus/src/_archive",[f("bls_aggregation.rs","crates/zbx-consensus/src/_archive/bls_aggregation.rs"),f("leader_election.rs","crates/zbx-consensus/src/_archive/leader_election.rs"),f("pacemaker.rs","crates/zbx-consensus/src/_archive/pacemaker.rs"),f("safety.rs","crates/zbx-consensus/src/_archive/safety.rs"),f("slashing.rs","crates/zbx-consensus/src/_archive/slashing.rs"),f("timeout.rs","crates/zbx-consensus/src/_archive/timeout.rs"),f("vote_aggregation.rs","crates/zbx-consensus/src/_archive/vote_aggregation.rs")]),f("bft.rs","crates/zbx-consensus/src/bft.rs"),f("block_vote.rs","crates/zbx-consensus/src/block_vote.rs"),f("committee.rs","crates/zbx-consensus/src/committee.rs"),f("error.rs","crates/zbx-consensus/src/error.rs"),f("lib.rs","crates/zbx-consensus/src/lib.rs"),f("messages.rs","crates/zbx-consensus/src/messages.rs"),f("proposer.rs","crates/zbx-consensus/src/proposer.rs"),f("round.rs","crates/zbx-consensus/src/round.rs"),f("state.rs","crates/zbx-consensus/src/state.rs"),f("timeout.rs","crates/zbx-consensus/src/timeout.rs"),f("validator.rs","crates/zbx-consensus/src/validator.rs")]),f("Cargo.toml","crates/zbx-consensus/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-consensus"]),
    d("zbx-contracts", "crates/zbx-contracts", [d("src","crates/zbx-contracts/src",[f("error.rs","crates/zbx-contracts/src/error.rs"),f("evm_precompiles.rs","crates/zbx-contracts/src/evm_precompiles.rs"),f("governance.rs","crates/zbx-contracts/src/governance.rs"),f("lib.rs","crates/zbx-contracts/src/lib.rs"),f("payid.rs","crates/zbx-contracts/src/payid.rs"),f("staking.rs","crates/zbx-contracts/src/staking.rs"),f("system.rs","crates/zbx-contracts/src/system.rs"),f("token_registry.rs","crates/zbx-contracts/src/token_registry.rs"),f("validator_registry.rs","crates/zbx-contracts/src/validator_registry.rs"),f("wasm_host.rs","crates/zbx-contracts/src/wasm_host.rs"),f("zrc20.rs","crates/zbx-contracts/src/zrc20.rs"),f("zrc721.rs","crates/zbx-contracts/src/zrc721.rs"),f("zusd.rs","crates/zbx-contracts/src/zusd.rs")]),f("Cargo.toml","crates/zbx-contracts/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-contracts"]),
    d("zbx-crypto", "crates/zbx-crypto", [d("src","crates/zbx-crypto/src",[f("bls.rs","crates/zbx-crypto/src/bls.rs"),f("error.rs","crates/zbx-crypto/src/error.rs"),f("hash.rs","crates/zbx-crypto/src/hash.rs"),f("kdf.rs","crates/zbx-crypto/src/kdf.rs"),f("lib.rs","crates/zbx-crypto/src/lib.rs"),f("merkle.rs","crates/zbx-crypto/src/merkle.rs"),f("mnemonic.rs","crates/zbx-crypto/src/mnemonic.rs"),f("schnorr.rs","crates/zbx-crypto/src/schnorr.rs"),f("secp256k1.rs","crates/zbx-crypto/src/secp256k1.rs"),f("sign.rs","crates/zbx-crypto/src/sign.rs"),f("vrf.rs","crates/zbx-crypto/src/vrf.rs"),f("zkp.rs","crates/zbx-crypto/src/zkp.rs")]),f("Cargo.toml","crates/zbx-crypto/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-crypto"]),
    d("zbx-da", "crates/zbx-da", [d("src","crates/zbx-da/src",[f("availability.rs","crates/zbx-da/src/availability.rs"),f("blob.rs","crates/zbx-da/src/blob.rs"),f("error.rs","crates/zbx-da/src/error.rs"),f("erasure.rs","crates/zbx-da/src/erasure.rs"),f("lib.rs","crates/zbx-da/src/lib.rs"),f("sampling.rs","crates/zbx-da/src/sampling.rs"),f("submit.rs","crates/zbx-da/src/submit.rs")]),f("Cargo.toml","crates/zbx-da/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-da"]),
    d("zbx-evm", "crates/zbx-evm", [d("src","crates/zbx-evm/src",[f("db.rs","crates/zbx-evm/src/db.rs"),f("error.rs","crates/zbx-evm/src/error.rs"),f("executor.rs","crates/zbx-evm/src/executor.rs"),f("gas.rs","crates/zbx-evm/src/gas.rs"),f("inspector.rs","crates/zbx-evm/src/inspector.rs"),f("lib.rs","crates/zbx-evm/src/lib.rs"),f("opcodes.rs","crates/zbx-evm/src/opcodes.rs"),f("precompile.rs","crates/zbx-evm/src/precompile.rs"),f("state.rs","crates/zbx-evm/src/state.rs"),f("trace.rs","crates/zbx-evm/src/trace.rs"),f("transfer.rs","crates/zbx-evm/src/transfer.rs"),f("tx.rs","crates/zbx-evm/src/tx.rs"),f("types.rs","crates/zbx-evm/src/types.rs"),f("validation.rs","crates/zbx-evm/src/validation.rs"),f("vm.rs","crates/zbx-evm/src/vm.rs")]),f("Cargo.toml","crates/zbx-evm/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-evm"]),
    d("zbx-execution", "crates/zbx-execution", [d("src","crates/zbx-execution/src",[f("block.rs","crates/zbx-execution/src/block.rs"),f("context.rs","crates/zbx-execution/src/context.rs"),f("engine.rs","crates/zbx-execution/src/engine.rs"),f("error.rs","crates/zbx-execution/src/error.rs"),f("fee.rs","crates/zbx-execution/src/fee.rs"),f("journal.rs","crates/zbx-execution/src/journal.rs"),f("lib.rs","crates/zbx-execution/src/lib.rs"),f("native.rs","crates/zbx-execution/src/native.rs"),f("parallel.rs","crates/zbx-execution/src/parallel.rs"),f("receipt.rs","crates/zbx-execution/src/receipt.rs"),f("state_transition.rs","crates/zbx-execution/src/state_transition.rs"),f("syscalls.rs","crates/zbx-execution/src/syscalls.rs"),f("wasm.rs","crates/zbx-execution/src/wasm.rs")]),f("Cargo.toml","crates/zbx-execution/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-execution"]),
    d("zbx-executor", "crates/zbx-executor", [d("src","crates/zbx-executor/src",[f("error.rs","crates/zbx-executor/src/error.rs"),f("executor.rs","crates/zbx-executor/src/executor.rs"),f("lib.rs","crates/zbx-executor/src/lib.rs")]),f("Cargo.toml","crates/zbx-executor/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-executor"]),
    d("zbx-explorer", "crates/zbx-explorer", [d("src","crates/zbx-explorer/src",[f("api.rs","crates/zbx-explorer/src/api.rs"),f("error.rs","crates/zbx-explorer/src/error.rs"),f("indexer.rs","crates/zbx-explorer/src/indexer.rs"),f("lib.rs","crates/zbx-explorer/src/lib.rs"),f("query.rs","crates/zbx-explorer/src/query.rs"),f("types.rs","crates/zbx-explorer/src/types.rs")]),f("Cargo.toml","crates/zbx-explorer/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-explorer"]),
    d("zbx-fee", "crates/zbx-fee", [d("src","crates/zbx-fee/src",[f("basefee.rs","crates/zbx-fee/src/basefee.rs"),f("error.rs","crates/zbx-fee/src/error.rs"),f("estimator.rs","crates/zbx-fee/src/estimator.rs"),f("lib.rs","crates/zbx-fee/src/lib.rs"),f("market.rs","crates/zbx-fee/src/market.rs"),f("priority.rs","crates/zbx-fee/src/priority.rs")]),f("Cargo.toml","crates/zbx-fee/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-fee"]),
    d("zbx-finality", "crates/zbx-finality", [d("src","crates/zbx-finality/src",[f("checkpoint.rs","crates/zbx-finality/src/checkpoint.rs"),f("error.rs","crates/zbx-finality/src/error.rs"),f("finality.rs","crates/zbx-finality/src/finality.rs"),f("lib.rs","crates/zbx-finality/src/lib.rs")]),f("Cargo.toml","crates/zbx-finality/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-finality"]),
    d("zbx-gaming", "crates/zbx-gaming", [d("src","crates/zbx-gaming/src",[f("escrow.rs","crates/zbx-gaming/src/escrow.rs"),f("error.rs","crates/zbx-gaming/src/error.rs"),f("items.rs","crates/zbx-gaming/src/items.rs"),f("lib.rs","crates/zbx-gaming/src/lib.rs"),f("state.rs","crates/zbx-gaming/src/state.rs")]),f("Cargo.toml","crates/zbx-gaming/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-gaming"]),
    d("zbx-genesis", "crates/zbx-genesis", [d("src","crates/zbx-genesis/src",[f("allocations.rs","crates/zbx-genesis/src/allocations.rs"),f("error.rs","crates/zbx-genesis/src/error.rs"),f("genesis.rs","crates/zbx-genesis/src/genesis.rs"),f("lib.rs","crates/zbx-genesis/src/lib.rs"),f("state.rs","crates/zbx-genesis/src/state.rs"),f("validators.rs","crates/zbx-genesis/src/validators.rs")]),f("Cargo.toml","crates/zbx-genesis/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-genesis"]),
    d("zbx-gossip", "crates/zbx-gossip", [d("src","crates/zbx-gossip/src",[f("error.rs","crates/zbx-gossip/src/error.rs"),f("fanout.rs","crates/zbx-gossip/src/fanout.rs"),f("lib.rs","crates/zbx-gossip/src/lib.rs"),f("peers.rs","crates/zbx-gossip/src/peers.rs"),f("protocol.rs","crates/zbx-gossip/src/protocol.rs"),f("topics.rs","crates/zbx-gossip/src/topics.rs")]),f("Cargo.toml","crates/zbx-gossip/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-gossip"]),
    d("zbx-indexer", "crates/zbx-indexer", [d("src","crates/zbx-indexer/src",[f("db.rs","crates/zbx-indexer/src/db.rs"),f("error.rs","crates/zbx-indexer/src/error.rs"),f("events.rs","crates/zbx-indexer/src/events.rs"),f("indexer.rs","crates/zbx-indexer/src/indexer.rs"),f("lib.rs","crates/zbx-indexer/src/lib.rs"),f("query.rs","crates/zbx-indexer/src/query.rs"),f("subscriptions.rs","crates/zbx-indexer/src/subscriptions.rs"),f("types.rs","crates/zbx-indexer/src/types.rs")]),f("Cargo.toml","crates/zbx-indexer/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-indexer"]),
    d("zbx-jsonrpc", "crates/zbx-jsonrpc", [d("src","crates/zbx-jsonrpc/src",[f("error.rs","crates/zbx-jsonrpc/src/error.rs"),f("eth.rs","crates/zbx-jsonrpc/src/eth.rs"),f("lib.rs","crates/zbx-jsonrpc/src/lib.rs"),f("middleware.rs","crates/zbx-jsonrpc/src/middleware.rs"),f("net.rs","crates/zbx-jsonrpc/src/net.rs"),f("server.rs","crates/zbx-jsonrpc/src/server.rs"),f("types.rs","crates/zbx-jsonrpc/src/types.rs"),f("web3.rs","crates/zbx-jsonrpc/src/web3.rs"),f("zbx.rs","crates/zbx-jsonrpc/src/zbx.rs")]),f("Cargo.toml","crates/zbx-jsonrpc/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-jsonrpc"]),
    d("zbx-keystore", "crates/zbx-keystore", [d("src","crates/zbx-keystore/src",[f("decrypt.rs","crates/zbx-keystore/src/decrypt.rs"),f("encrypt.rs","crates/zbx-keystore/src/encrypt.rs"),f("error.rs","crates/zbx-keystore/src/error.rs"),f("keystore.rs","crates/zbx-keystore/src/keystore.rs"),f("lib.rs","crates/zbx-keystore/src/lib.rs"),f("mnemonic.rs","crates/zbx-keystore/src/mnemonic.rs")]),f("Cargo.toml","crates/zbx-keystore/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-keystore"]),
    d("zbx-launchpad", "crates/zbx-launchpad", [d("src","crates/zbx-launchpad/src",[f("error.rs","crates/zbx-launchpad/src/error.rs"),f("fairlaunch.rs","crates/zbx-launchpad/src/fairlaunch.rs"),f("lib.rs","crates/zbx-launchpad/src/lib.rs"),f("presale.rs","crates/zbx-launchpad/src/presale.rs"),f("vesting.rs","crates/zbx-launchpad/src/vesting.rs"),f("whitelist.rs","crates/zbx-launchpad/src/whitelist.rs")]),f("Cargo.toml","crates/zbx-launchpad/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-launchpad"]),
    d("zbx-lending", "crates/zbx-lending", [d("src","crates/zbx-lending/src",[f("collateral.rs","crates/zbx-lending/src/collateral.rs"),f("error.rs","crates/zbx-lending/src/error.rs"),f("interest.rs","crates/zbx-lending/src/interest.rs"),f("lib.rs","crates/zbx-lending/src/lib.rs"),f("liquidation.rs","crates/zbx-lending/src/liquidation.rs"),f("oracle.rs","crates/zbx-lending/src/oracle.rs"),f("pool.rs","crates/zbx-lending/src/pool.rs"),f("position.rs","crates/zbx-lending/src/position.rs"),f("zusd.rs","crates/zbx-lending/src/zusd.rs")]),f("Cargo.toml","crates/zbx-lending/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-lending"]),
    d("zbx-light", "crates/zbx-light", [d("src","crates/zbx-light/src",[f("client.rs","crates/zbx-light/src/client.rs"),f("error.rs","crates/zbx-light/src/error.rs"),f("lib.rs","crates/zbx-light/src/lib.rs"),f("proof.rs","crates/zbx-light/src/proof.rs"),f("sync.rs","crates/zbx-light/src/sync.rs"),f("verification.rs","crates/zbx-light/src/verification.rs")]),f("Cargo.toml","crates/zbx-light/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-light"]),
    d("zbx-mempool", "crates/zbx-mempool", [d("src","crates/zbx-mempool/src",[f("error.rs","crates/zbx-mempool/src/error.rs"),f("eviction.rs","crates/zbx-mempool/src/eviction.rs"),f("fee_filter.rs","crates/zbx-mempool/src/fee_filter.rs"),f("lib.rs","crates/zbx-mempool/src/lib.rs"),f("mempool.rs","crates/zbx-mempool/src/mempool.rs"),f("nonce_tracker.rs","crates/zbx-mempool/src/nonce_tracker.rs"),f("ordering.rs","crates/zbx-mempool/src/ordering.rs"),f("pending.rs","crates/zbx-mempool/src/pending.rs"),f("pool.rs","crates/zbx-mempool/src/pool.rs"),f("queue.rs","crates/zbx-mempool/src/queue.rs"),f("replacement.rs","crates/zbx-mempool/src/replacement.rs"),f("tx_lookup.rs","crates/zbx-mempool/src/tx_lookup.rs"),f("validation.rs","crates/zbx-mempool/src/validation.rs")]),f("Cargo.toml","crates/zbx-mempool/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-mempool"]),
    d("zbx-metrics", "crates/zbx-metrics", [d("src","crates/zbx-metrics/src",[f("block.rs","crates/zbx-metrics/src/block.rs"),f("consensus.rs","crates/zbx-metrics/src/consensus.rs"),f("error.rs","crates/zbx-metrics/src/error.rs"),f("lib.rs","crates/zbx-metrics/src/lib.rs"),f("network.rs","crates/zbx-metrics/src/network.rs"),f("registry.rs","crates/zbx-metrics/src/registry.rs"),f("server.rs","crates/zbx-metrics/src/server.rs")]),f("Cargo.toml","crates/zbx-metrics/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-metrics"]),
    d("zbx-mev", "crates/zbx-mev", [d("src","crates/zbx-mev/src",[f("builder.rs","crates/zbx-mev/src/builder.rs"),f("commit_reveal.rs","crates/zbx-mev/src/commit_reveal.rs"),f("error.rs","crates/zbx-mev/src/error.rs"),f("fair_order.rs","crates/zbx-mev/src/fair_order.rs"),f("lib.rs","crates/zbx-mev/src/lib.rs"),f("ordering.rs","crates/zbx-mev/src/ordering.rs"),f("protection.rs","crates/zbx-mev/src/protection.rs"),f("sandwich.rs","crates/zbx-mev/src/sandwich.rs")]),f("Cargo.toml","crates/zbx-mev/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-mev"]),
    d("zbx-net", "crates/zbx-net", [d("src","crates/zbx-net/src",[f("codec.rs","crates/zbx-net/src/codec.rs"),f("connection.rs","crates/zbx-net/src/connection.rs"),f("error.rs","crates/zbx-net/src/error.rs"),f("framing.rs","crates/zbx-net/src/framing.rs"),f("lib.rs","crates/zbx-net/src/lib.rs"),f("tcp.rs","crates/zbx-net/src/tcp.rs"),f("transport.rs","crates/zbx-net/src/transport.rs")]),f("Cargo.toml","crates/zbx-net/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-net"]),
    d("zbx-network", "crates/zbx-network", [d("src","crates/zbx-network/src",[f("discovery.rs","crates/zbx-network/src/discovery.rs"),f("error.rs","crates/zbx-network/src/error.rs"),f("handshake.rs","crates/zbx-network/src/handshake.rs"),f("lib.rs","crates/zbx-network/src/lib.rs"),f("noise.rs","crates/zbx-network/src/noise.rs"),f("peer.rs","crates/zbx-network/src/peer.rs"),f("peerset.rs","crates/zbx-network/src/peerset.rs"),f("protocol.rs","crates/zbx-network/src/protocol.rs"),f("routing.rs","crates/zbx-network/src/routing.rs"),f("service.rs","crates/zbx-network/src/service.rs"),f("transport.rs","crates/zbx-network/src/transport.rs"),f("types.rs","crates/zbx-network/src/types.rs")]),f("Cargo.toml","crates/zbx-network/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-network"]),
    d("zbx-nft", "crates/zbx-nft", [d("src","crates/zbx-nft/src",[f("error.rs","crates/zbx-nft/src/error.rs"),f("lib.rs","crates/zbx-nft/src/lib.rs"),f("marketplace.rs","crates/zbx-nft/src/marketplace.rs"),f("metadata.rs","crates/zbx-nft/src/metadata.rs"),f("minting.rs","crates/zbx-nft/src/minting.rs"),f("royalty.rs","crates/zbx-nft/src/royalty.rs")]),f("Cargo.toml","crates/zbx-nft/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-nft"]),
    d("zbx-oracle", "crates/zbx-oracle", [d("src","crates/zbx-oracle/src",[d("_archive","crates/zbx-oracle/src/_archive",[f("band.rs","crates/zbx-oracle/src/_archive/band.rs"),f("chainlink.rs","crates/zbx-oracle/src/_archive/chainlink.rs"),f("pyth.rs","crates/zbx-oracle/src/_archive/pyth.rs")]),f("aggregator.rs","crates/zbx-oracle/src/aggregator.rs"),f("circuit_breaker.rs","crates/zbx-oracle/src/circuit_breaker.rs"),f("error.rs","crates/zbx-oracle/src/error.rs"),f("feeds.rs","crates/zbx-oracle/src/feeds.rs"),f("freshness.rs","crates/zbx-oracle/src/freshness.rs"),f("lib.rs","crates/zbx-oracle/src/lib.rs"),f("manipulation.rs","crates/zbx-oracle/src/manipulation.rs"),f("mediator.rs","crates/zbx-oracle/src/mediator.rs"),f("outlier.rs","crates/zbx-oracle/src/outlier.rs"),f("persistence.rs","crates/zbx-oracle/src/persistence.rs"),f("price.rs","crates/zbx-oracle/src/price.rs"),f("reporter.rs","crates/zbx-oracle/src/reporter.rs"),f("staking.rs","crates/zbx-oracle/src/staking.rs"),f("tvl.rs","crates/zbx-oracle/src/tvl.rs"),f("types.rs","crates/zbx-oracle/src/types.rs")]),f("Cargo.toml","crates/zbx-oracle/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-oracle"]),
    d("zbx-oracle-optimistic", "crates/zbx-oracle-optimistic", [d("src","crates/zbx-oracle-optimistic/src",[f("dispute.rs","crates/zbx-oracle-optimistic/src/dispute.rs"),f("error.rs","crates/zbx-oracle-optimistic/src/error.rs"),f("lib.rs","crates/zbx-oracle-optimistic/src/lib.rs"),f("optimistic.rs","crates/zbx-oracle-optimistic/src/optimistic.rs"),f("slash.rs","crates/zbx-oracle-optimistic/src/slash.rs"),f("window.rs","crates/zbx-oracle-optimistic/src/window.rs")]),f("Cargo.toml","crates/zbx-oracle-optimistic/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-oracle-optimistic"]),
    d("zbx-oracle-twap", "crates/zbx-oracle-twap", [d("src","crates/zbx-oracle-twap/src",[f("error.rs","crates/zbx-oracle-twap/src/error.rs"),f("lib.rs","crates/zbx-oracle-twap/src/lib.rs"),f("observation.rs","crates/zbx-oracle-twap/src/observation.rs"),f("twap.rs","crates/zbx-oracle-twap/src/twap.rs")]),f("Cargo.toml","crates/zbx-oracle-twap/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-oracle-twap"]),
    d("zbx-oracle-zk", "crates/zbx-oracle-zk", [d("src","crates/zbx-oracle-zk/src",[f("error.rs","crates/zbx-oracle-zk/src/error.rs"),f("lib.rs","crates/zbx-oracle-zk/src/lib.rs"),f("proof.rs","crates/zbx-oracle-zk/src/proof.rs"),f("verifier.rs","crates/zbx-oracle-zk/src/verifier.rs"),f("witness.rs","crates/zbx-oracle-zk/src/witness.rs"),f("zk_feed.rs","crates/zbx-oracle-zk/src/zk_feed.rs")]),f("Cargo.toml","crates/zbx-oracle-zk/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-oracle-zk"]),
    d("zbx-payid", "crates/zbx-payid", [d("src","crates/zbx-payid/src",[f("error.rs","crates/zbx-payid/src/error.rs"),f("lib.rs","crates/zbx-payid/src/lib.rs"),f("parser.rs","crates/zbx-payid/src/parser.rs"),f("registry.rs","crates/zbx-payid/src/registry.rs"),f("resolver.rs","crates/zbx-payid/src/resolver.rs")]),f("Cargo.toml","crates/zbx-payid/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-payid"]),
    d("zbx-payment", "crates/zbx-payment", [d("src","crates/zbx-payment/src",[f("error.rs","crates/zbx-payment/src/error.rs"),f("gateway.rs","crates/zbx-payment/src/gateway.rs"),f("lib.rs","crates/zbx-payment/src/lib.rs"),f("processor.rs","crates/zbx-payment/src/processor.rs"),f("webhook.rs","crates/zbx-payment/src/webhook.rs")]),f("Cargo.toml","crates/zbx-payment/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-payment"]),
    d("zbx-perp", "crates/zbx-perp", [d("src","crates/zbx-perp/src",[f("error.rs","crates/zbx-perp/src/error.rs"),f("funding.rs","crates/zbx-perp/src/funding.rs"),f("lib.rs","crates/zbx-perp/src/lib.rs"),f("liquidation.rs","crates/zbx-perp/src/liquidation.rs"),f("margin.rs","crates/zbx-perp/src/margin.rs"),f("market.rs","crates/zbx-perp/src/market.rs"),f("order.rs","crates/zbx-perp/src/order.rs"),f("position.rs","crates/zbx-perp/src/position.rs"),f("pricing.rs","crates/zbx-perp/src/pricing.rs"),f("settlement.rs","crates/zbx-perp/src/settlement.rs")]),f("Cargo.toml","crates/zbx-perp/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-perp"]),
    d("zbx-pool", "crates/zbx-pool", [d("src","crates/zbx-pool/src",[d("_archive","crates/zbx-pool/src/_archive",[f("bonding_curve.rs","crates/zbx-pool/src/_archive/bonding_curve.rs"),f("flash_loan.rs","crates/zbx-pool/src/_archive/flash_loan.rs"),f("governance.rs","crates/zbx-pool/src/_archive/governance.rs"),f("incentives.rs","crates/zbx-pool/src/_archive/incentives.rs"),f("multi_hop.rs","crates/zbx-pool/src/_archive/multi_hop.rs"),f("stable_pool.rs","crates/zbx-pool/src/_archive/stable_pool.rs"),f("yield_farm.rs","crates/zbx-pool/src/_archive/yield_farm.rs")]),f("amm.rs","crates/zbx-pool/src/amm.rs"),f("error.rs","crates/zbx-pool/src/error.rs"),f("fee.rs","crates/zbx-pool/src/fee.rs"),f("lib.rs","crates/zbx-pool/src/lib.rs"),f("liquidity.rs","crates/zbx-pool/src/liquidity.rs"),f("price.rs","crates/zbx-pool/src/price.rs"),f("router.rs","crates/zbx-pool/src/router.rs"),f("slippage.rs","crates/zbx-pool/src/slippage.rs"),f("swap.rs","crates/zbx-pool/src/swap.rs"),f("types.rs","crates/zbx-pool/src/types.rs")]),f("Cargo.toml","crates/zbx-pool/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-pool"]),
    d("zbx-pq", "crates/zbx-pq", [d("src","crates/zbx-pq/src",[f("dilithium.rs","crates/zbx-pq/src/dilithium.rs"),f("error.rs","crates/zbx-pq/src/error.rs"),f("kyber.rs","crates/zbx-pq/src/kyber.rs"),f("lib.rs","crates/zbx-pq/src/lib.rs"),f("sphincs.rs","crates/zbx-pq/src/sphincs.rs")]),f("Cargo.toml","crates/zbx-pq/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-pq"]),
    d("zbx-primitives", "crates/zbx-primitives", [d("src","crates/zbx-primitives/src",[f("error.rs","crates/zbx-primitives/src/error.rs"),f("lib.rs","crates/zbx-primitives/src/lib.rs"),f("receipt.rs","crates/zbx-primitives/src/receipt.rs"),f("signature.rs","crates/zbx-primitives/src/signature.rs"),f("transaction.rs","crates/zbx-primitives/src/transaction.rs"),f("trie.rs","crates/zbx-primitives/src/trie.rs")]),f("Cargo.toml","crates/zbx-primitives/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-primitives"]),
    d("zbx-prover", "crates/zbx-prover", [d("src","crates/zbx-prover/src",[f("backend.rs","crates/zbx-prover/src/backend.rs"),f("circuit.rs","crates/zbx-prover/src/circuit.rs"),f("error.rs","crates/zbx-prover/src/error.rs"),f("fri.rs","crates/zbx-prover/src/fri.rs"),f("groth16.rs","crates/zbx-prover/src/groth16.rs"),f("lib.rs","crates/zbx-prover/src/lib.rs"),f("plonky2.rs","crates/zbx-prover/src/plonky2.rs"),f("proof.rs","crates/zbx-prover/src/proof.rs"),f("stark.rs","crates/zbx-prover/src/stark.rs"),f("transcript.rs","crates/zbx-prover/src/transcript.rs"),f("verifier.rs","crates/zbx-prover/src/verifier.rs"),f("witness.rs","crates/zbx-prover/src/witness.rs")]),f("Cargo.toml","crates/zbx-prover/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-prover"]),
    d("zbx-pruner", "crates/zbx-pruner", [d("src","crates/zbx-pruner/src",[f("error.rs","crates/zbx-pruner/src/error.rs"),f("history.rs","crates/zbx-pruner/src/history.rs"),f("lib.rs","crates/zbx-pruner/src/lib.rs"),f("pruner.rs","crates/zbx-pruner/src/pruner.rs"),f("receipt.rs","crates/zbx-pruner/src/receipt.rs"),f("state.rs","crates/zbx-pruner/src/state.rs"),f("tx.rs","crates/zbx-pruner/src/tx.rs")]),f("Cargo.toml","crates/zbx-pruner/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-pruner"]),
    d("zbx-rewards", "crates/zbx-rewards", [d("src","crates/zbx-rewards/src",[f("distribution.rs","crates/zbx-rewards/src/distribution.rs"),f("halving.rs","crates/zbx-rewards/src/halving.rs"),f("lib.rs","crates/zbx-rewards/src/lib.rs"),f("schedule.rs","crates/zbx-rewards/src/schedule.rs")]),f("Cargo.toml","crates/zbx-rewards/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-rewards"]),
    d("zbx-rlp", "crates/zbx-rlp", [d("src","crates/zbx-rlp/src",[f("decode.rs","crates/zbx-rlp/src/decode.rs"),f("encode.rs","crates/zbx-rlp/src/encode.rs"),f("error.rs","crates/zbx-rlp/src/error.rs"),f("lib.rs","crates/zbx-rlp/src/lib.rs"),f("raw.rs","crates/zbx-rlp/src/raw.rs"),f("stream.rs","crates/zbx-rlp/src/stream.rs"),f("types.rs","crates/zbx-rlp/src/types.rs")]),f("Cargo.toml","crates/zbx-rlp/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-rlp"]),
    d("zbx-rpc", "crates/zbx-rpc", [d("src","crates/zbx-rpc/src",[f("api.rs","crates/zbx-rpc/src/api.rs"),f("auth.rs","crates/zbx-rpc/src/auth.rs"),f("cors.rs","crates/zbx-rpc/src/cors.rs"),f("error.rs","crates/zbx-rpc/src/error.rs"),f("filter.rs","crates/zbx-rpc/src/filter.rs"),f("lib.rs","crates/zbx-rpc/src/lib.rs"),f("middleware.rs","crates/zbx-rpc/src/middleware.rs"),f("rate_limit.rs","crates/zbx-rpc/src/rate_limit.rs"),f("server.rs","crates/zbx-rpc/src/server.rs"),f("subscribe.rs","crates/zbx-rpc/src/subscribe.rs"),f("types.rs","crates/zbx-rpc/src/types.rs"),f("ws.rs","crates/zbx-rpc/src/ws.rs")]),f("Cargo.toml","crates/zbx-rpc/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-rpc"]),
    d("zbx-sdk", "crates/zbx-sdk", [d("src","crates/zbx-sdk/src",[f("aa.rs","crates/zbx-sdk/src/aa.rs"),f("amm.rs","crates/zbx-sdk/src/amm.rs"),f("bridge.rs","crates/zbx-sdk/src/bridge.rs"),f("client.rs","crates/zbx-sdk/src/client.rs"),f("error.rs","crates/zbx-sdk/src/error.rs"),f("events.rs","crates/zbx-sdk/src/events.rs"),f("gas.rs","crates/zbx-sdk/src/gas.rs"),f("keystore.rs","crates/zbx-sdk/src/keystore.rs"),f("lib.rs","crates/zbx-sdk/src/lib.rs"),f("payid.rs","crates/zbx-sdk/src/payid.rs"),f("signer.rs","crates/zbx-sdk/src/signer.rs"),f("staking.rs","crates/zbx-sdk/src/staking.rs"),f("subscribe.rs","crates/zbx-sdk/src/subscribe.rs"),f("tx.rs","crates/zbx-sdk/src/tx.rs"),f("types.rs","crates/zbx-sdk/src/types.rs"),f("wallet.rs","crates/zbx-sdk/src/wallet.rs"),f("zusd.rs","crates/zbx-sdk/src/zusd.rs")]),f("Cargo.toml","crates/zbx-sdk/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-sdk"]),
    d("zbx-sequencer", "crates/zbx-sequencer", [d("src","crates/zbx-sequencer/src",[f("batch.rs","crates/zbx-sequencer/src/batch.rs"),f("commit.rs","crates/zbx-sequencer/src/commit.rs"),f("error.rs","crates/zbx-sequencer/src/error.rs"),f("lib.rs","crates/zbx-sequencer/src/lib.rs"),f("ordering.rs","crates/zbx-sequencer/src/ordering.rs"),f("queue.rs","crates/zbx-sequencer/src/queue.rs"),f("selection.rs","crates/zbx-sequencer/src/selection.rs"),f("sequencer.rs","crates/zbx-sequencer/src/sequencer.rs"),f("state.rs","crates/zbx-sequencer/src/state.rs")]),f("Cargo.toml","crates/zbx-sequencer/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-sequencer"]),
    d("zbx-snapshot", "crates/zbx-snapshot", [d("src","crates/zbx-snapshot/src",[f("error.rs","crates/zbx-snapshot/src/error.rs"),f("export.rs","crates/zbx-snapshot/src/export.rs"),f("import.rs","crates/zbx-snapshot/src/import.rs"),f("lib.rs","crates/zbx-snapshot/src/lib.rs")]),f("Cargo.toml","crates/zbx-snapshot/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-snapshot"]),
    d("zbx-staking", "crates/zbx-staking", [d("src","crates/zbx-staking/src",[d("_archive","crates/zbx-staking/src/_archive",[f("delegation.rs","crates/zbx-staking/src/_archive/delegation.rs"),f("epochs.rs","crates/zbx-staking/src/_archive/epochs.rs"),f("governance.rs","crates/zbx-staking/src/_archive/governance.rs"),f("redelegation.rs","crates/zbx-staking/src/_archive/redelegation.rs"),f("rewards_v1.rs","crates/zbx-staking/src/_archive/rewards_v1.rs"),f("slash_old.rs","crates/zbx-staking/src/_archive/slash_old.rs"),f("treasury.rs","crates/zbx-staking/src/_archive/treasury.rs"),f("unbonding_old.rs","crates/zbx-staking/src/_archive/unbonding_old.rs")]),f("delegation.rs","crates/zbx-staking/src/delegation.rs"),f("error.rs","crates/zbx-staking/src/error.rs"),f("jailing.rs","crates/zbx-staking/src/jailing.rs"),f("lib.rs","crates/zbx-staking/src/lib.rs"),f("rewards.rs","crates/zbx-staking/src/rewards.rs"),f("slashing.rs","crates/zbx-staking/src/slashing.rs"),f("stake.rs","crates/zbx-staking/src/stake.rs"),f("types.rs","crates/zbx-staking/src/types.rs"),f("unbonding.rs","crates/zbx-staking/src/unbonding.rs"),f("validator.rs","crates/zbx-staking/src/validator.rs")]),f("Cargo.toml","crates/zbx-staking/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-staking"]),
    d("zbx-state", "crates/zbx-state", [d("src","crates/zbx-state/src",[f("account.rs","crates/zbx-state/src/account.rs"),f("cache.rs","crates/zbx-state/src/cache.rs"),f("diff.rs","crates/zbx-state/src/diff.rs"),f("error.rs","crates/zbx-state/src/error.rs"),f("journal.rs","crates/zbx-state/src/journal.rs"),f("lib.rs","crates/zbx-state/src/lib.rs"),f("migration.rs","crates/zbx-state/src/migration.rs"),f("overlay.rs","crates/zbx-state/src/overlay.rs"),f("root.rs","crates/zbx-state/src/root.rs"),f("snapshot.rs","crates/zbx-state/src/snapshot.rs"),f("state.rs","crates/zbx-state/src/state.rs"),f("storage.rs","crates/zbx-state/src/storage.rs"),f("witness.rs","crates/zbx-state/src/witness.rs")]),f("Cargo.toml","crates/zbx-state/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-state"]),
    d("zbx-state-rent", "crates/zbx-state-rent", [d("src","crates/zbx-state-rent/src",[f("error.rs","crates/zbx-state-rent/src/error.rs"),f("eviction.rs","crates/zbx-state-rent/src/eviction.rs"),f("lib.rs","crates/zbx-state-rent/src/lib.rs"),f("pricing.rs","crates/zbx-state-rent/src/pricing.rs"),f("tracker.rs","crates/zbx-state-rent/src/tracker.rs")]),f("Cargo.toml","crates/zbx-state-rent/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-state-rent"]),
    d("zbx-storage", "crates/zbx-storage", [d("src","crates/zbx-storage/src",[f("batch.rs","crates/zbx-storage/src/batch.rs"),f("cache.rs","crates/zbx-storage/src/cache.rs"),f("columns.rs","crates/zbx-storage/src/columns.rs"),f("compaction.rs","crates/zbx-storage/src/compaction.rs"),f("db.rs","crates/zbx-storage/src/db.rs"),f("error.rs","crates/zbx-storage/src/error.rs"),f("iterator.rs","crates/zbx-storage/src/iterator.rs"),f("lib.rs","crates/zbx-storage/src/lib.rs"),f("migration.rs","crates/zbx-storage/src/migration.rs"),f("recovery.rs","crates/zbx-storage/src/recovery.rs"),f("schema.rs","crates/zbx-storage/src/schema.rs")]),f("Cargo.toml","crates/zbx-storage/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-storage"]),
    d("zbx-sync", "crates/zbx-sync", [d("src","crates/zbx-sync/src",[f("checkpoint.rs","crates/zbx-sync/src/checkpoint.rs"),f("downloader.rs","crates/zbx-sync/src/downloader.rs"),f("error.rs","crates/zbx-sync/src/error.rs"),f("fast_sync.rs","crates/zbx-sync/src/fast_sync.rs"),f("full_sync.rs","crates/zbx-sync/src/full_sync.rs"),f("gossip.rs","crates/zbx-sync/src/gossip.rs"),f("lib.rs","crates/zbx-sync/src/lib.rs"),f("pivot.rs","crates/zbx-sync/src/pivot.rs"),f("state_sync.rs","crates/zbx-sync/src/state_sync.rs"),f("sync.rs","crates/zbx-sync/src/sync.rs"),f("types.rs","crates/zbx-sync/src/types.rs"),f("validator.rs","crates/zbx-sync/src/validator.rs"),f("warp.rs","crates/zbx-sync/src/warp.rs")]),f("Cargo.toml","crates/zbx-sync/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-sync"]),
    d("zbx-telemetry", "crates/zbx-telemetry", [d("src","crates/zbx-telemetry/src",[f("error.rs","crates/zbx-telemetry/src/error.rs"),f("exporter.rs","crates/zbx-telemetry/src/exporter.rs"),f("lib.rs","crates/zbx-telemetry/src/lib.rs"),f("spans.rs","crates/zbx-telemetry/src/spans.rs"),f("tracer.rs","crates/zbx-telemetry/src/tracer.rs")]),f("Cargo.toml","crates/zbx-telemetry/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-telemetry"]),
    d("zbx-threshold", "crates/zbx-threshold", [d("src","crates/zbx-threshold/src",[f("aggregation.rs","crates/zbx-threshold/src/aggregation.rs"),f("dkg.rs","crates/zbx-threshold/src/dkg.rs"),f("error.rs","crates/zbx-threshold/src/error.rs"),f("lib.rs","crates/zbx-threshold/src/lib.rs"),f("participant.rs","crates/zbx-threshold/src/participant.rs"),f("scheme.rs","crates/zbx-threshold/src/scheme.rs"),f("secret_sharing.rs","crates/zbx-threshold/src/secret_sharing.rs"),f("signature.rs","crates/zbx-threshold/src/signature.rs"),f("vss.rs","crates/zbx-threshold/src/vss.rs"),f("vt.rs","crates/zbx-threshold/src/vt.rs")]),f("Cargo.toml","crates/zbx-threshold/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-threshold"]),
    d("zbx-trace", "crates/zbx-trace", [d("src","crates/zbx-trace/src",[f("error.rs","crates/zbx-trace/src/error.rs"),f("lib.rs","crates/zbx-trace/src/lib.rs"),f("recorder.rs","crates/zbx-trace/src/recorder.rs"),f("replay.rs","crates/zbx-trace/src/replay.rs"),f("types.rs","crates/zbx-trace/src/types.rs")]),f("Cargo.toml","crates/zbx-trace/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-trace"]),
    d("zbx-trie", "crates/zbx-trie", [d("src","crates/zbx-trie/src",[f("db.rs","crates/zbx-trie/src/db.rs"),f("error.rs","crates/zbx-trie/src/error.rs"),f("hasher.rs","crates/zbx-trie/src/hasher.rs"),f("iterator.rs","crates/zbx-trie/src/iterator.rs"),f("lib.rs","crates/zbx-trie/src/lib.rs"),f("nibbles.rs","crates/zbx-trie/src/nibbles.rs"),f("node.rs","crates/zbx-trie/src/node.rs"),f("proof.rs","crates/zbx-trie/src/proof.rs"),f("trie.rs","crates/zbx-trie/src/trie.rs"),f("types.rs","crates/zbx-trie/src/types.rs")]),f("Cargo.toml","crates/zbx-trie/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-trie"]),
    d("zbx-tx", "crates/zbx-tx", [d("src","crates/zbx-tx/src",[f("error.rs","crates/zbx-tx/src/error.rs"),f("lib.rs","crates/zbx-tx/src/lib.rs"),f("pool.rs","crates/zbx-tx/src/pool.rs"),f("signing.rs","crates/zbx-tx/src/signing.rs"),f("tx.rs","crates/zbx-tx/src/tx.rs"),f("types.rs","crates/zbx-tx/src/types.rs"),f("validation.rs","crates/zbx-tx/src/validation.rs")]),f("Cargo.toml","crates/zbx-tx/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-tx"]),
    d("zbx-types", "crates/zbx-types", [d("src","crates/zbx-types/src",[f("address.rs","crates/zbx-types/src/address.rs"),f("block.rs","crates/zbx-types/src/block.rs"),f("bytes.rs","crates/zbx-types/src/bytes.rs"),f("chain_id.rs","crates/zbx-types/src/chain_id.rs"),f("error.rs","crates/zbx-types/src/error.rs"),f("hash.rs","crates/zbx-types/src/hash.rs"),f("lib.rs","crates/zbx-types/src/lib.rs"),f("receipt.rs","crates/zbx-types/src/receipt.rs"),f("serde.rs","crates/zbx-types/src/serde.rs"),f("signature.rs","crates/zbx-types/src/signature.rs"),f("token.rs","crates/zbx-types/src/token.rs"),f("tx.rs","crates/zbx-types/src/tx.rs"),f("u256.rs","crates/zbx-types/src/u256.rs"),f("validator.rs","crates/zbx-types/src/validator.rs")]),f("Cargo.toml","crates/zbx-types/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-types"]),
    d("zbx-verkle", "crates/zbx-verkle", [d("src","crates/zbx-verkle/src",[f("commitment.rs","crates/zbx-verkle/src/commitment.rs"),f("error.rs","crates/zbx-verkle/src/error.rs"),f("lib.rs","crates/zbx-verkle/src/lib.rs"),f("node.rs","crates/zbx-verkle/src/node.rs"),f("proof.rs","crates/zbx-verkle/src/proof.rs"),f("trie.rs","crates/zbx-verkle/src/trie.rs")]),f("Cargo.toml","crates/zbx-verkle/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-verkle"]),
    d("zbx-vm", "crates/zbx-vm", [d("src","crates/zbx-vm/src",[f("context.rs","crates/zbx-vm/src/context.rs"),f("error.rs","crates/zbx-vm/src/error.rs"),f("gas.rs","crates/zbx-vm/src/gas.rs"),f("interpreter.rs","crates/zbx-vm/src/interpreter.rs"),f("lib.rs","crates/zbx-vm/src/lib.rs"),f("memory.rs","crates/zbx-vm/src/memory.rs"),f("opcodes.rs","crates/zbx-vm/src/opcodes.rs"),f("stack.rs","crates/zbx-vm/src/stack.rs"),f("storage.rs","crates/zbx-vm/src/storage.rs"),f("types.rs","crates/zbx-vm/src/types.rs")]),f("Cargo.toml","crates/zbx-vm/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-vm"]),
    d("zbx-wallet", "crates/zbx-wallet", [d("src","crates/zbx-wallet/src",[f("account.rs","crates/zbx-wallet/src/account.rs"),f("derivation.rs","crates/zbx-wallet/src/derivation.rs"),f("error.rs","crates/zbx-wallet/src/error.rs"),f("hd.rs","crates/zbx-wallet/src/hd.rs"),f("keystore.rs","crates/zbx-wallet/src/keystore.rs"),f("lib.rs","crates/zbx-wallet/src/lib.rs"),f("signer.rs","crates/zbx-wallet/src/signer.rs"),f("tx.rs","crates/zbx-wallet/src/tx.rs"),f("types.rs","crates/zbx-wallet/src/types.rs"),f("wallet.rs","crates/zbx-wallet/src/wallet.rs")]),f("Cargo.toml","crates/zbx-wallet/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-wallet"]),
    d("zbx-wasm", "crates/zbx-wasm", [d("src","crates/zbx-wasm/src",[f("engine.rs","crates/zbx-wasm/src/engine.rs"),f("error.rs","crates/zbx-wasm/src/error.rs"),f("gas.rs","crates/zbx-wasm/src/gas.rs"),f("host.rs","crates/zbx-wasm/src/host.rs"),f("imports.rs","crates/zbx-wasm/src/imports.rs"),f("lib.rs","crates/zbx-wasm/src/lib.rs"),f("memory.rs","crates/zbx-wasm/src/memory.rs")]),f("Cargo.toml","crates/zbx-wasm/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-wasm"]),
    d("zbx-xcl", "crates/zbx-xcl", [d("src","crates/zbx-xcl/src",[f("channel.rs","crates/zbx-xcl/src/channel.rs"),f("error.rs","crates/zbx-xcl/src/error.rs"),f("lib.rs","crates/zbx-xcl/src/lib.rs"),f("message.rs","crates/zbx-xcl/src/message.rs"),f("packet.rs","crates/zbx-xcl/src/packet.rs"),f("proof.rs","crates/zbx-xcl/src/proof.rs"),f("relay.rs","crates/zbx-xcl/src/relay.rs"),f("routing.rs","crates/zbx-xcl/src/routing.rs"),f("state.rs","crates/zbx-xcl/src/state.rs"),f("timeout.rs","crates/zbx-xcl/src/timeout.rs"),f("types.rs","crates/zbx-xcl/src/types.rs")]),f("Cargo.toml","crates/zbx-xcl/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-xcl"]),
    d("zbx-yield", "crates/zbx-yield", [d("src","crates/zbx-yield/src",[f("error.rs","crates/zbx-yield/src/error.rs"),f("lib.rs","crates/zbx-yield/src/lib.rs"),f("optimizer.rs","crates/zbx-yield/src/optimizer.rs"),f("vault.rs","crates/zbx-yield/src/vault.rs")]),f("Cargo.toml","crates/zbx-yield/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-yield"]),
    d("zbx-zk", "crates/zbx-zk", [d("src","crates/zbx-zk/src",[f("circuit.rs","crates/zbx-zk/src/circuit.rs"),f("error.rs","crates/zbx-zk/src/error.rs"),f("lib.rs","crates/zbx-zk/src/lib.rs"),f("proof.rs","crates/zbx-zk/src/proof.rs"),f("verifier.rs","crates/zbx-zk/src/verifier.rs"),f("witness.rs","crates/zbx-zk/src/witness.rs")]),f("Cargo.toml","crates/zbx-zk/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-zk"]),
    d("zbx-zvm", "crates/zbx-zvm", [d("src","crates/zbx-zvm/src",[f("bytecode.rs","crates/zbx-zvm/src/bytecode.rs"),f("compiler.rs","crates/zbx-zvm/src/compiler.rs"),f("context.rs","crates/zbx-zvm/src/context.rs"),f("error.rs","crates/zbx-zvm/src/error.rs"),f("gas.rs","crates/zbx-zvm/src/gas.rs"),f("interpreter.rs","crates/zbx-zvm/src/interpreter.rs"),f("lib.rs","crates/zbx-zvm/src/lib.rs"),f("memory.rs","crates/zbx-zvm/src/memory.rs"),f("native_calls.rs","crates/zbx-zvm/src/native_calls.rs"),f("opcodes.rs","crates/zbx-zvm/src/opcodes.rs"),f("stack.rs","crates/zbx-zvm/src/stack.rs"),f("storage.rs","crates/zbx-zvm/src/storage.rs"),f("types.rs","crates/zbx-zvm/src/types.rs"),f("validation.rs","crates/zbx-zvm/src/validation.rs")]),f("Cargo.toml","crates/zbx-zvm/Cargo.toml")], CRATE_DESCRIPTIONS["zbx-zvm"]),
    f("_ARCHIVE_MANIFEST.md", "crates/_ARCHIVE_MANIFEST.md"),
  ], `${CRATE_NAMES.length} Rust workspace crates`),
  d("deploy", "deploy", [
    d("monitoring", "deploy/monitoring", [f("prometheus.yml", "deploy/monitoring/prometheus.yml")]),
    d("nginx", "deploy/nginx", [f("zbx-rpc.conf", "deploy/nginx/zbx-rpc.conf")]),
    d("scripts", "deploy/scripts", [f("deploy.sh", "deploy/scripts/deploy.sh")]),
    d("systemd", "deploy/systemd", [f("zbx-mainnet.service", "deploy/systemd/zbx-mainnet.service"), f("zbx-testnet.service", "deploy/systemd/zbx-testnet.service")]),
    f("DEPLOY_GUIDE.md", "deploy/DEPLOY_GUIDE.md"),
    f("docker-compose.production.yml", "deploy/docker-compose.production.yml"),
    f("genesis-fill.sh", "deploy/genesis-fill.sh"),
    f("mainnet-genesis.template.json", "deploy/mainnet-genesis.template.json"),
    f("mainnet.production.toml", "deploy/mainnet.production.toml"),
    f("vps-setup.sh", "deploy/vps-setup.sh"),
  ], "Deployment scripts, systemd, nginx, compose"),
  d("docker", "docker", [
    f("Dockerfile", "docker/Dockerfile"),
    f("docker-compose.yml", "docker/docker-compose.yml"),
  ], "Docker images & compose"),
  d("docs", "docs", [
    d("proposals", "docs/proposals", [
      f("DEVNET-LAUNCH-PLAN-2026-05-01.md", "docs/proposals/DEVNET-LAUNCH-PLAN-2026-05-01.md"),
      f("PHASE-PLAN-2026-05-01.md", "docs/proposals/PHASE-PLAN-2026-05-01.md"),
      f("S13-CHAIN-ID-DRIFT-fix.md", "docs/proposals/S13-CHAIN-ID-DRIFT-fix.md"),
      f("S33-state-root-mpt.md", "docs/proposals/S33-state-root-mpt.md"),
      f("S7-ARCH1-vm-consolidation.md", "docs/proposals/S7-ARCH1-vm-consolidation.md"),
      f("S7-EVM3-call-family-implementation.md", "docs/proposals/S7-EVM3-call-family-implementation.md"),
      f("ZEP-000-INDEX.md", "docs/proposals/ZEP-000-INDEX.md"),
      f("ZEP-001-PAYID.md", "docs/proposals/ZEP-001-PAYID.md"),
      f("ZEP-002-ZUSD.md", "docs/proposals/ZEP-002-ZUSD.md"),
      f("ZEP-003-DA-LAYER.md", "docs/proposals/ZEP-003-DA-LAYER.md"),
      f("ZEP-004-ZVM.md", "docs/proposals/ZEP-004-ZVM.md"),
      f("ZEP-005-ZUSD-REDEMPTION.md", "docs/proposals/ZEP-005-ZUSD-REDEMPTION.md"),
      f("ZEP-006-ZRC20-ADVANCED.md", "docs/proposals/ZEP-006-ZRC20-ADVANCED.md"),
      f("ZEP-007-TVL-ORACLE.md", "docs/proposals/ZEP-007-TVL-ORACLE.md"),
      f("ZEP-008-TWAP-ORACLE.md", "docs/proposals/ZEP-008-TWAP-ORACLE.md"),
      f("ZEP-013-ZINR.md", "docs/proposals/ZEP-013-ZINR.md"),
      f("ZEP-014-AMM-POOL-SECURITY.md", "docs/proposals/ZEP-014-AMM-POOL-SECURITY.md"),
      f("ZEP-015-POST-QUANTUM.md", "docs/proposals/ZEP-015-POST-QUANTUM.md"),
      f("ZEP-016-BLS-AGGREGATION.md", "docs/proposals/ZEP-016-BLS-AGGREGATION.md"),
      f("ZEP-017-ACCOUNT-ABSTRACTION.md", "docs/proposals/ZEP-017-ACCOUNT-ABSTRACTION.md"),
      f("ZEP-018-MEV-PROTECTION.md", "docs/proposals/ZEP-018-MEV-PROTECTION.md"),
      f("ZEP-019-ZK-ROLLUP.md", "docs/proposals/ZEP-019-ZK-ROLLUP.md"),
      f("ZEP-020-PARALLEL-EVM.md", "docs/proposals/ZEP-020-PARALLEL-EVM.md"),
      f("ZEP-021-STATE-EXPIRY.md", "docs/proposals/ZEP-021-STATE-EXPIRY.md"),
      f("ZEP-022-HOTSTUFF2.md", "docs/proposals/ZEP-022-HOTSTUFF2.md"),
      f("ZEP-023-SLASHING.md", "docs/proposals/ZEP-023-SLASHING.md"),
      f("ZEP-024-LIGHT-CLIENT.md", "docs/proposals/ZEP-024-LIGHT-CLIENT.md"),
      f("ZEP-025-CONFIDENTIAL-TX.md", "docs/proposals/ZEP-025-CONFIDENTIAL-TX.md"),
      f("ZEP-026-CROSS-CHAIN.md", "docs/proposals/ZEP-026-CROSS-CHAIN.md"),
      f("ZEP-031-GAMING.md", "docs/proposals/ZEP-031-GAMING.md"),
      f("ZEP-032-PAYMENT-GATEWAY.md", "docs/proposals/ZEP-032-PAYMENT-GATEWAY.md"),
      f("ZEP-033-LIQUID-STAKING.md", "docs/proposals/ZEP-033-LIQUID-STAKING.md"),
      f("ZEP-034-PERPETUALS.md", "docs/proposals/ZEP-034-PERPETUALS.md"),
      f("ZEP-035-YIELD-OPTIMIZER.md", "docs/proposals/ZEP-035-YIELD-OPTIMIZER.md"),
      f("ZEP-036-LAUNCHPAD.md", "docs/proposals/ZEP-036-LAUNCHPAD.md"),
      f("ZEP-037-ZNS.md", "docs/proposals/ZEP-037-ZNS.md"),
      f("ZEP-038-CONTRACT-FACTORY.md", "docs/proposals/ZEP-038-CONTRACT-FACTORY.md"),
      f("ZEP-039-RAFFLE.md", "docs/proposals/ZEP-039-RAFFLE.md"),
      f("ZEP-040-PREDICTION-MARKET.md", "docs/proposals/ZEP-040-PREDICTION-MARKET.md"),
      f("ZEP-041-CARD-GAME.md", "docs/proposals/ZEP-041-CARD-GAME.md"),
      f("ZEP-042-SPOT-ORDERBOOK.md", "docs/proposals/ZEP-042-SPOT-ORDERBOOK.md"),
      f("ZEP-043-DATED-FUTURES.md", "docs/proposals/ZEP-043-DATED-FUTURES.md"),
      f("ZEP-044-OPTIONS.md", "docs/proposals/ZEP-044-OPTIONS.md"),
      f("ZEP-045-MEME-FACTORY.md", "docs/proposals/ZEP-045-MEME-FACTORY.md"),
    ]),
    f("ACCOUNT_ABSTRACTION.md", "docs/ACCOUNT_ABSTRACTION.md"),
    f("API_REFERENCE.md", "docs/API_REFERENCE.md"),
    f("ARCHITECTURE.md", "docs/ARCHITECTURE.md"),
    f("AUDIT-2026-05-09-FULL.md", "docs/AUDIT-2026-05-09-FULL.md"),
    f("BFT_ROADMAP.md", "docs/BFT_ROADMAP.md"),
    f("BRIDGE.md", "docs/BRIDGE.md"),
    f("CHAIN_COMPARISON.md", "docs/CHAIN_COMPARISON.md"),
    f("CHANGELOG.md", "docs/CHANGELOG.md"),
    f("CONFIGURATION.md", "docs/CONFIGURATION.md"),
    f("CONSENSUS.md", "docs/CONSENSUS.md"),
    f("CONTRIBUTING.md", "docs/CONTRIBUTING.md"),
    f("CROSS_CHAIN.md", "docs/CROSS_CHAIN.md"),
    f("DA_LAYER.md", "docs/DA_LAYER.md"),
    f("EVM_COMPATIBILITY.md", "docs/EVM_COMPATIBILITY.md"),
    f("GOVERNANCE.md", "docs/GOVERNANCE.md"),
    f("INCIDENT-RESPONSE-RUNBOOK.md", "docs/INCIDENT-RESPONSE-RUNBOOK.md"),
    f("LIGHT_CLIENT.md", "docs/LIGHT_CLIENT.md"),
    f("MAINNET-READINESS-2026-05-09.md", "docs/MAINNET-READINESS-2026-05-09.md"),
    f("MAINNET_LAUNCH_CHECKLIST.md", "docs/MAINNET_LAUNCH_CHECKLIST.md"),
    f("MEV_PROTECTION.md", "docs/MEV_PROTECTION.md"),
    f("NETWORK_PROTOCOL.md", "docs/NETWORK_PROTOCOL.md"),
    f("NFT_STANDARD.md", "docs/NFT_STANDARD.md"),
    f("PAYID.md", "docs/PAYID.md"),
    f("PERFORMANCE.md", "docs/PERFORMANCE.md"),
    f("RPC_API.md", "docs/RPC_API.md"),
    f("SDK_GUIDE.md", "docs/SDK_GUIDE.md"),
    f("SECURITY_AUDIT.md", "docs/SECURITY_AUDIT.md"),
    f("SECURITY_AUDIT_2026-05-09_PASS-12.md", "docs/SECURITY_AUDIT_2026-05-09_PASS-12.md"),
    f("SECURITY_AUDIT_2026-05-09_PASS-14_FULL_EXPLORE.md", "docs/SECURITY_AUDIT_2026-05-09_PASS-14_FULL_EXPLORE.md"),
    f("SECURITY_FIXES_2026-05-09.md", "docs/SECURITY_FIXES_2026-05-09.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-13.md", "docs/SECURITY_FIXES_2026-05-09_PASS-13.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-15.md", "docs/SECURITY_FIXES_2026-05-09_PASS-15.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-16.md", "docs/SECURITY_FIXES_2026-05-09_PASS-16.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-17.md", "docs/SECURITY_FIXES_2026-05-09_PASS-17.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-18.md", "docs/SECURITY_FIXES_2026-05-09_PASS-18.md"),
    f("SECURITY_FIXES_2026-05-09_PASS-19.md", "docs/SECURITY_FIXES_2026-05-09_PASS-19.md"),
    f("SECURITY_FIXES_VPS_HARDENING.md", "docs/SECURITY_FIXES_VPS_HARDENING.md"),
    f("STAKING.md", "docs/STAKING.md"),
    f("SUBSYSTEM-MATURITY-AUDIT-2026-05-09.md", "docs/SUBSYSTEM-MATURITY-AUDIT-2026-05-09.md"),
    f("TESTNET-VS-MAINNET-FEATURES.md", "docs/TESTNET-VS-MAINNET-FEATURES.md"),
    f("TOKENOMICS.md", "docs/TOKENOMICS.md"),
    f("UPGRADE_GUIDE.md", "docs/UPGRADE_GUIDE.md"),
    f("VALIDATOR_GUIDE.md", "docs/VALIDATOR_GUIDE.md"),
    f("WASM_CONTRACTS.md", "docs/WASM_CONTRACTS.md"),
    f("ZEP-005-dynamic-gas.md", "docs/ZEP-005-dynamic-gas.md"),
    f("ZEP-007-verkle-trie.md", "docs/ZEP-007-verkle-trie.md"),
    f("ZEP-008-state-rent.md", "docs/ZEP-008-state-rent.md"),
    f("ZEP-009-ai-precompile.md", "docs/ZEP-009-ai-precompile.md"),
    f("ZEP-010-threshold-signatures.md", "docs/ZEP-010-threshold-signatures.md"),
    f("ZEP-011-oracle.md", "docs/ZEP-011-oracle.md"),
    f("ZEP-012-oracle-nextgen.md", "docs/ZEP-012-oracle-nextgen.md"),
    f("ZK_PROOFS.md", "docs/ZK_PROOFS.md"),
    f("ZUSD.md", "docs/ZUSD.md"),
    f("ZVM.md", "docs/ZVM.md"),
    f("DOC_STATUS.md", "docs/DOC_STATUS.md"),
  ], "99 docs — architecture, ZEPs, audits, validator guide"),
  d("fuzz", "fuzz", [
    d("fuzz_targets", "fuzz/fuzz_targets", [
      f("block_import.rs", "fuzz/fuzz_targets/block_import.rs"),
      f("fuzz_payid_parser.rs", "fuzz/fuzz_targets/fuzz_payid_parser.rs"),
      f("fuzz_rlp_decode_arbitrary.rs", "fuzz/fuzz_targets/fuzz_rlp_decode_arbitrary.rs"),
      f("fuzz_rlp_encode_decode.rs", "fuzz/fuzz_targets/fuzz_rlp_encode_decode.rs"),
      f("fuzz_trie_node_decode.rs", "fuzz/fuzz_targets/fuzz_trie_node_decode.rs"),
      f("fuzz_zvm_bytecode.rs", "fuzz/fuzz_targets/fuzz_zvm_bytecode.rs"),
      f("fuzz_zvm_native_opcodes.rs", "fuzz/fuzz_targets/fuzz_zvm_native_opcodes.rs"),
      f("fuzz_zvm_opcodes.rs", "fuzz/fuzz_targets/fuzz_zvm_opcodes.rs"),
      f("rlp_decode.rs", "fuzz/fuzz_targets/rlp_decode.rs"),
      f("tx_decode.rs", "fuzz/fuzz_targets/tx_decode.rs"),
    ]),
    f("Cargo.toml", "fuzz/Cargo.toml"),
  ], "cargo-fuzz targets — RLP, ZVM, trie, block import"),
  d("k8s", "k8s", [
    f("archive-node.yaml", "k8s/archive-node.yaml"),
    f("bridge-relayer.yaml", "k8s/bridge-relayer.yaml"),
    f("bundler.yaml", "k8s/bundler.yaml"),
    f("da-node.yaml", "k8s/da-node.yaml"),
    f("explorer.yaml", "k8s/explorer.yaml"),
    f("faucet.yaml", "k8s/faucet.yaml"),
    f("indexer.yaml", "k8s/indexer.yaml"),
    f("light-node.yaml", "k8s/light-node.yaml"),
    f("monitoring.yaml", "k8s/monitoring.yaml"),
    f("prover.yaml", "k8s/prover.yaml"),
    f("redis.yaml", "k8s/redis.yaml"),
    f("rpc-service.yaml", "k8s/rpc-service.yaml"),
    f("validator-deployment.yaml", "k8s/validator-deployment.yaml"),
  ], "Kubernetes manifests for all node types"),
  d("monitoring", "monitoring", [
    d("alerts", "monitoring/alerts", [f("chain.yml", "monitoring/alerts/chain.yml")]),
    d("grafana", "monitoring/grafana", [f("zbx_dashboard.json", "monitoring/grafana/zbx_dashboard.json")]),
    f("alertmanager.yml", "monitoring/alertmanager.yml"),
    f("grafana-dashboard.json", "monitoring/grafana-dashboard.json"),
    f("prometheus.yml", "monitoring/prometheus.yml"),
  ], "Prometheus, Alertmanager, Grafana"),
  d("node", "node", [
    d("configs", "node/configs", [
      f("devnet.toml", "node/configs/devnet.toml"),
      f("mainnet.toml", "node/configs/mainnet.toml"),
      f("testnet.toml", "node/configs/testnet.toml"),
      f("trusted_setup.txt", "node/configs/trusted_setup.txt"),
      f("trusted_setup_devnet.txt", "node/configs/trusted_setup_devnet.txt"),
    ]),
    d("src", "node/src", [
      d("bin", "node/src/bin", [
        f("zbx-keygen.rs", "node/src/bin/zbx-keygen.rs"),
      ]),
      f("block_producer.rs", "node/src/block_producer.rs"),
      f("config.rs", "node/src/config.rs"),
      f("consensus.rs", "node/src/consensus.rs"),
      f("genesis.rs", "node/src/genesis.rs"),
      f("lib.rs", "node/src/lib.rs"),
      f("main.rs", "node/src/main.rs"),
      f("network.rs", "node/src/network.rs"),
      f("node.rs", "node/src/node.rs"),
      f("noise.rs", "node/src/noise.rs"),
      f("readiness.rs", "node/src/readiness.rs"),
      f("snapshot_import.rs", "node/src/snapshot_import.rs"),
    ]),
    d("tests", "node/tests", [
      f("pruner_producer_e2e.rs", "node/tests/pruner_producer_e2e.rs"),
      f("snapshot_import_boundary.rs", "node/tests/snapshot_import_boundary.rs"),
    ]),
    f("Cargo.toml", "node/Cargo.toml"),
  ], "zebvix-node binary — block producer, consensus, networking"),
  d("proto", "proto", [
    f("consensus.proto", "proto/consensus.proto"),
    f("da.proto", "proto/da.proto"),
    f("node.proto", "proto/node.proto"),
    f("prover.proto", "proto/prover.proto"),
  ], "Protocol Buffer / gRPC definitions"),
  d("scripts", "scripts", [
    f("benchmark.sh", "scripts/benchmark.sh"),
    f("cargo-env.sh", "scripts/cargo-env.sh"),
    f("check-chain-id.sh", "scripts/check-chain-id.sh"),
    f("check-orphans.sh", "scripts/check-orphans.sh"),
    f("ci-check.sh", "scripts/ci-check.sh"),
    f("da-submit.sh", "scripts/da-submit.sh"),
    f("deploy-contracts.sh", "scripts/deploy-contracts.sh"),
    f("export-state.sh", "scripts/export-state.sh"),
    f("fuzz-ci.sh", "scripts/fuzz-ci.sh"),
    f("generate-genesis.sh", "scripts/generate-genesis.sh"),
    f("keygen.sh", "scripts/keygen.sh"),
    f("load-test.sh", "scripts/load-test.sh"),
    f("mainnet-launch.sh", "scripts/mainnet-launch.sh"),
    f("run-fuzz.sh", "scripts/run-fuzz.sh"),
    f("slither.config.json", "scripts/slither.config.json"),
    f("snapshot.sh", "scripts/snapshot.sh"),
    f("testnet-add-validator.sh", "scripts/testnet-add-validator.sh"),
    f("testnet-deploy.sh", "scripts/testnet-deploy.sh"),
    f("testnet-genesis-keygen.sh", "scripts/testnet-genesis-keygen.sh"),
    f("upgrade-contracts.sh", "scripts/upgrade-contracts.sh"),
    f("verify-contracts.sh", "scripts/verify-contracts.sh"),
  ], "21 shell scripts — CI, deployment, genesis, benchmarks"),
  d("sdk", "sdk", [
    d("ethers-zbx", "sdk/ethers-zbx", [
      d("examples", "sdk/ethers-zbx/examples", [
        f("basic.ts", "sdk/ethers-zbx/examples/basic.ts"),
        f("dapp-react.tsx", "sdk/ethers-zbx/examples/dapp-react.tsx"),
      ]),
      d("src", "sdk/ethers-zbx/src", [
        f("bridge.ts", "sdk/ethers-zbx/src/bridge.ts"),
        f("chain.ts", "sdk/ethers-zbx/src/chain.ts"),
        f("index.ts", "sdk/ethers-zbx/src/index.ts"),
        f("payid.ts", "sdk/ethers-zbx/src/payid.ts"),
        f("perps.ts", "sdk/ethers-zbx/src/perps.ts"),
        f("provider.ts", "sdk/ethers-zbx/src/provider.ts"),
        f("staking.ts", "sdk/ethers-zbx/src/staking.ts"),
        f("types.ts", "sdk/ethers-zbx/src/types.ts"),
        f("vault.ts", "sdk/ethers-zbx/src/vault.ts"),
        f("wallet.ts", "sdk/ethers-zbx/src/wallet.ts"),
        f("zusd.ts", "sdk/ethers-zbx/src/zusd.ts"),
        f("zvm.ts", "sdk/ethers-zbx/src/zvm.ts"),
      ]),
      f("package.json", "sdk/ethers-zbx/package.json"),
    ]),
    d("zebvix-js", "sdk/zebvix-js", [
      d("examples", "sdk/zebvix-js/examples", [
        f("browser-minimal.html", "sdk/zebvix-js/examples/browser-minimal.html"),
        f("full-demo.ts", "sdk/zebvix-js/examples/full-demo.ts"),
        f("node-quickstart.ts", "sdk/zebvix-js/examples/node-quickstart.ts"),
      ]),
      d("src", "sdk/zebvix-js/src", [
        f("aa.ts", "sdk/zebvix-js/src/aa.ts"),
        f("amm.ts", "sdk/zebvix-js/src/amm.ts"),
        f("batch.ts", "sdk/zebvix-js/src/batch.ts"),
        f("bridge.ts", "sdk/zebvix-js/src/bridge.ts"),
        f("client.ts", "sdk/zebvix-js/src/client.ts"),
        f("constants.ts", "sdk/zebvix-js/src/constants.ts"),
        f("contract.ts", "sdk/zebvix-js/src/contract.ts"),
        f("crypto.ts", "sdk/zebvix-js/src/crypto.ts"),
        f("errors.ts", "sdk/zebvix-js/src/errors.ts"),
        f("fee.ts", "sdk/zebvix-js/src/fee.ts"),
        f("index.ts", "sdk/zebvix-js/src/index.ts"),
        f("lending.ts", "sdk/zebvix-js/src/lending.ts"),
        f("meme.ts", "sdk/zebvix-js/src/meme.ts"),
        f("middleware.ts", "sdk/zebvix-js/src/middleware.ts"),
        f("payid.ts", "sdk/zebvix-js/src/payid.ts"),
        f("perp.ts", "sdk/zebvix-js/src/perp.ts"),
        f("receipt.ts", "sdk/zebvix-js/src/receipt.ts"),
        f("staking.ts", "sdk/zebvix-js/src/staking.ts"),
        f("subscribe.ts", "sdk/zebvix-js/src/subscribe.ts"),
        f("types.ts", "sdk/zebvix-js/src/types.ts"),
        f("vault.ts", "sdk/zebvix-js/src/vault.ts"),
        f("wallet.ts", "sdk/zebvix-js/src/wallet.ts"),
        f("zusd.ts", "sdk/zebvix-js/src/zusd.ts"),
        f("zvm.ts", "sdk/zebvix-js/src/zvm.ts"),
      ]),
      f("package.json", "sdk/zebvix-js/package.json"),
    ]),
  ], "JS SDKs — zebvix-js & ethers-zbx"),
  d("tests", "tests", [
    d("integration", "tests/integration", [
      f("aa_test.rs", "tests/integration/aa_test.rs"),
      f("amm_test.rs", "tests/integration/amm_test.rs"),
      f("bridge_test.rs", "tests/integration/bridge_test.rs"),
      f("bundler_test.rs", "tests/integration/bundler_test.rs"),
      f("consensus.rs", "tests/integration/consensus.rs"),
      f("consensus_test.rs", "tests/integration/consensus_test.rs"),
      f("da_test.rs", "tests/integration/da_test.rs"),
      f("evm.rs", "tests/integration/evm.rs"),
      f("evm_test.rs", "tests/integration/evm_test.rs"),
      f("fee_market_test.rs", "tests/integration/fee_market_test.rs"),
      f("governance_test.rs", "tests/integration/governance_test.rs"),
      f("lending_test.rs", "tests/integration/lending_test.rs"),
      f("mempool.rs", "tests/integration/mempool.rs"),
      f("mev_test.rs", "tests/integration/mev_test.rs"),
      f("oracle_test.rs", "tests/integration/oracle_test.rs"),
      f("prover_test.rs", "tests/integration/prover_test.rs"),
      f("rpc_test.rs", "tests/integration/rpc_test.rs"),
      f("staking_test.rs", "tests/integration/staking_test.rs"),
      f("sync_test.rs", "tests/integration/sync_test.rs"),
      f("wasm_test.rs", "tests/integration/wasm_test.rs"),
      f("zusd_test.rs", "tests/integration/zusd_test.rs"),
      f("zvm_test.rs", "tests/integration/zvm_test.rs"),
    ]),
    d("property", "tests/property", [
      f("consensus_fuzz.rs", "tests/property/consensus_fuzz.rs"),
      f("execution_fuzz.rs", "tests/property/execution_fuzz.rs"),
      f("tx_fuzz.rs", "tests/property/tx_fuzz.rs"),
    ]),
    d("unit", "tests/unit", [
      f("abi.rs", "tests/unit/abi.rs"),
      f("bridge.rs", "tests/unit/bridge.rs"),
      f("consensus.rs", "tests/unit/consensus.rs"),
      f("crypto.rs", "tests/unit/crypto.rs"),
      f("execution.rs", "tests/unit/execution.rs"),
      f("fee.rs", "tests/unit/fee.rs"),
      f("mempool.rs", "tests/unit/mempool.rs"),
      f("payid.rs", "tests/unit/payid.rs"),
      f("prover.rs", "tests/unit/prover.rs"),
      f("state.rs", "tests/unit/state.rs"),
      f("trie.rs", "tests/unit/trie.rs"),
      f("types.rs", "tests/unit/types.rs"),
    ]),
  ], "37 tests — unit, integration, property-based"),
  f(".gitignore", ".gitignore"),
  f("AUDIT_2026-04-30.md", "AUDIT_2026-04-30.md"),
  f("CHANGELOG.md", "CHANGELOG.md"),
  f("CONTRIBUTING.md", "CONTRIBUTING.md"),
  f("Cargo.lock", "Cargo.lock"),
  f("Cargo.toml", "Cargo.toml"),
  f("HARDENING_TODO.md", "HARDENING_TODO.md"),
  f("PRODUCTION_AUDIT.md", "PRODUCTION_AUDIT.md"),
  f("README.md", "README.md"),
  f("SECURITY.md", "SECURITY.md"),
  f("build.rs", "build.rs"),
  f("deny.toml", "deny.toml"),
]);

function fileLanguage(name: string): string {
  if (name.endsWith(".rs")) return "rust";
  if (name.endsWith(".toml")) return "toml";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript";
  if (name.endsWith(".sh")) return "bash";
  if (name.endsWith(".sol")) return "solidity";
  if (name.endsWith(".proto")) return "protobuf";
  if (name.endsWith(".html")) return "html";
  return "text";
}

function TreeNodeRow({ node, depth, selectedPath, onSelect }: {
  node: TreeNode; depth: number; selectedPath: string | null; onSelect: (n: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isDir = node.type === "dir";
  const isSelected = selectedPath === node.path;
  const hasChildren = isDir && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isDir) { if (hasChildren) setExpanded(e => !e); }
    else onSelect(node);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-[3px] px-2 rounded cursor-pointer select-none group transition-colors",
          isSelected ? "bg-primary/15 text-primary" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 13 + 6}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <span className="w-3.5 flex-shrink-0">
            {hasChildren ? (expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
          </span>
        ) : <span className="w-3.5 flex-shrink-0" />}

        {isDir
          ? expanded
            ? <FolderOpen className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-yellow-400" : "text-yellow-500/80")} />
            : <Folder className={cn("h-4 w-4 flex-shrink-0", depth === 0 ? "text-yellow-400" : "text-yellow-500/80")} />
          : <File className={cn("h-4 w-4 flex-shrink-0",
              node.name.endsWith(".rs") ? "text-orange-400/80" :
              node.name.endsWith(".sol") ? "text-violet-400/80" :
              node.name.endsWith(".ts") || node.name.endsWith(".tsx") ? "text-blue-400/80" :
              node.name.endsWith(".toml") ? "text-green-400/70" :
              node.name.endsWith(".md") ? "text-slate-400/80" :
              node.name.endsWith(".yml") || node.name.endsWith(".yaml") ? "text-cyan-400/70" :
              node.name.endsWith(".json") ? "text-yellow-400/70" :
              node.name.endsWith(".proto") ? "text-pink-400/70" :
              "text-blue-400/60"
            )} />
        }

        <span className={cn("text-xs font-mono truncate", isSelected && "text-primary font-semibold")}>{node.name}</span>

        {node.description && isDir && depth > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground/50 truncate hidden group-hover:block flex-shrink-0">{node.description}</span>
        )}
      </div>

      {isDir && expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

const CRATE_CATEGORIES: Record<string, string> = {
  "zbx-types": "Core", "zbx-primitives": "Core", "zbx-crypto": "Core", "zbx-codec": "Core", "zbx-rlp": "Core", "zbx-abi": "Core",
  "zbx-consensus": "Consensus", "zbx-block": "Consensus", "zbx-finality": "Consensus", "zbx-sequencer": "Consensus", "zbx-executor": "Consensus", "zbx-rewards": "Consensus",
  "zbx-network": "Network", "zbx-net": "Network", "zbx-gossip": "Network", "zbx-sync": "Network",
  "zbx-mempool": "Txs", "zbx-tx": "Txs", "zbx-fee": "Txs", "zbx-bundler": "Txs", "zbx-mev": "Txs",
  "zbx-state": "State", "zbx-state-rent": "State", "zbx-storage": "State", "zbx-trie": "State", "zbx-verkle": "State", "zbx-pruner": "State", "zbx-snapshot": "State",
  "zbx-execution": "VM", "zbx-evm": "VM", "zbx-vm": "VM", "zbx-zvm": "VM", "zbx-wasm": "VM", "zbx-zk": "VM", "zbx-prover": "VM",
  "zbx-rpc": "RPC", "zbx-jsonrpc": "RPC",
  "zbx-xcl": "Bridge", "zbx-bridge": "Bridge",
  "zbx-staking": "Econ", "zbx-genesis": "Econ", "zbx-config": "Econ",
  "zbx-oracle": "Oracle", "zbx-oracle-optimistic": "Oracle", "zbx-oracle-twap": "Oracle", "zbx-oracle-zk": "Oracle",
  "zbx-pool": "DeFi", "zbx-lending": "DeFi", "zbx-perp": "DeFi", "zbx-yield": "DeFi", "zbx-payid": "DeFi", "zbx-contracts": "DeFi", "zbx-nft": "DeFi", "zbx-launchpad": "DeFi",
  "zbx-gaming": "App", "zbx-payment": "App",
  "zbx-metrics": "Obs", "zbx-telemetry": "Obs", "zbx-trace": "Obs",
  "zbx-indexer": "Tools", "zbx-explorer": "Tools", "zbx-admin": "Tools",
  "zbx-ai-precompile": "AI", "zbx-ai-sdk": "AI", "zbx-ai-registry": "AI",
  "zbx-threshold": "Crypto", "zbx-keystore": "Crypto", "zbx-pq": "Crypto", "zbx-confidential": "Crypto",
  "zbx-sdk": "Client", "zbx-wallet": "Client", "zbx-cli": "Client", "zbx-light": "Client", "zbx-da": "Client",
};

const CAT_COLORS: Record<string, string> = {
  Core: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  Consensus: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  Network: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Txs: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  State: "text-green-400 bg-green-400/10 border-green-400/20",
  VM: "text-red-400 bg-red-400/10 border-red-400/20",
  RPC: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Bridge: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  Econ: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Oracle: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  DeFi: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  App: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20",
  Obs: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Tools: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  AI: "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  Crypto: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  Client: "text-sky-400 bg-sky-400/10 border-sky-400/20",
};

export default function ChainCode() {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tree" | "crates">("tree");

  const handleSelect = useCallback(async (node: TreeNode) => {
    setSelectedNode(node);
    setFileContent(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${RAW_BASE}/${node.path}`);
      if (!res.ok) {
        setError(res.status === 404 ? "File not found in repository." : `HTTP ${res.status}: Could not load file.`);
        return;
      }
      setFileContent(await res.text());
    } catch { setError("Network error loading file."); }
    finally { setLoading(false); }
  }, []);

  const lang = selectedNode ? fileLanguage(selectedNode.name) : "text";
  const githubUrl = selectedNode ? `${GITHUB_BASE}/${selectedNode.path}` : null;

  const totalFiles = 1427;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chain Code</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono">
            zbx-chain-source/zbx-chain &mdash; {CRATE_NAMES.length} crates &mdash; {totalFiles} files &mdash; Rust 2021 Edition
          </p>
        </div>
        <a
          href={`https://github.com/${REPO}/tree/main/${BASE_PATH}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded border border-border hover:bg-muted/40"
        >
          <GitBranch className="h-3.5 w-3.5" /> View on GitHub
        </a>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border flex-shrink-0 px-6">
        {(["tree", "crates"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize",
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "tree" ? "File Tree" : `Crate Map (${CRATE_NAMES.length})`}
          </button>
        ))}
      </div>

      {activeTab === "crates" ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {CRATE_NAMES.map(name => {
              const cat = CRATE_CATEGORIES[name] ?? "Core";
              const color = CAT_COLORS[cat] ?? "text-gray-400 bg-gray-400/10 border-gray-400/20";
              return (
                <div key={name} className="flex items-center gap-2 p-2 rounded border border-border/40 hover:border-border hover:bg-muted/30 transition-colors">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-foreground truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{CRATE_DESCRIPTIONS[name]}</div>
                  </div>
                  <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0", color)}>{cat}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Tree */}
          <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto bg-card/30 py-2">
            <TreeNodeRow node={TREE} depth={0} selectedPath={selectedNode?.path ?? null} onSelect={handleSelect} />
          </div>

          {/* Viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedNode ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/20 flex-shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <File className="h-4 w-4 text-blue-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-foreground truncate">{selectedNode.path}</span>
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded flex-shrink-0">{lang}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {githubUrl && (
                      <a href={githubUrl} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors" title="Open on GitHub">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button onClick={() => { setSelectedNode(null); setFileContent(null); setError(null); }}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-[#0d1117]">
                  {loading && (
                    <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading...</span>
                    </div>
                  )}
                  {error && !loading && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-8 text-center">
                      <File className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{error}</p>
                      {githubUrl && (
                        <a href={githubUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> View on GitHub
                        </a>
                      )}
                    </div>
                  )}
                  {fileContent && !loading && (
                    <pre className="text-xs font-mono leading-5 p-4 text-[#e6edf3] whitespace-pre overflow-auto h-full">
                      <code>{fileContent}</code>
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <div className="p-6 rounded-2xl bg-muted/20 border border-border/40">
                  <Code2 className="h-12 w-12 opacity-30" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-foreground/60">Select a file to view</p>
                  <p className="text-sm mt-1">Browse the ZBX chain source tree on the left</p>
                  <p className="text-xs mt-3 font-mono text-muted-foreground/60">
                    {CRATE_NAMES.length} crates &bull; {totalFiles} files &bull; Rust 2021 &bull; Ed25519 + EVM + ZVM
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
