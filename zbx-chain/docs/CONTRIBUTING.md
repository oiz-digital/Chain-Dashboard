# Contributing to Zebvix Chain

Thank you for considering contributing to Zebvix Chain!

## Getting Started

1. Fork the repository and clone your fork.
2. Install Rust (stable): `rustup toolchain install stable`
3. Install RocksDB build deps (required for `zbx-storage`):
   ```bash
   # Debian/Ubuntu
   apt-get install -y clang libclang-dev cmake pkg-config libssl-dev
   # NixOS / Replit
   export LIBCLANG_PATH=/nix/store/044lnsyyaf48bp8f1a1x00lkapj3pq40-clang-15.0.7-lib/lib
   ```
4. Build:
   ```bash
   cargo build --release --bin zbx-node --bin zbx-keygen
   ```
5. Run tests: `cargo test --all`
6. Type-check: `cargo check --all`

## Development Workflow

1. Create a branch: `git checkout -b feat/my-feature`
2. Make changes and add tests.
3. Run CI checks locally:
   ```bash
   cargo fmt --all --check
   cargo clippy --all -- -D warnings
   cargo test --all
   cargo audit
   ```
4. Commit with a conventional commit message:
   - `feat: add XYZ feature`
   - `fix: correct ABC bug`
   - `docs: update RPC reference`
   - `chore: bump dependencies`
5. Open a pull request against `main`.

## Code Style

- Run `cargo fmt --all` before committing.
- Address all `cargo clippy` warnings.
- All public items must have doc comments (`///`).
- Unsafe code requires a `// SAFETY:` comment explaining the invariants.
- Never use `console.log` — use `tracing::info!`, `tracing::warn!`, etc.

## Testing

- All new features must include unit tests.
- Bug fixes must include a regression test.
- Run `cargo test --all` to verify.
- For consensus or EVM changes, add integration tests in `tests/integration/`.
- For network/P2P changes, test with multi-validator local testnet.

## Adding a New Crate

1. Create `crates/zbx-<name>/` with `Cargo.toml` and `src/lib.rs`.
2. Add to workspace `Cargo.toml` `members` list.
3. Add doc comment at top of `lib.rs` explaining the crate's purpose.
4. Add to `docs/ARCHITECTURE.md` crate table.

## Key Files to Know

| File | Purpose |
|---|---|
| `node/src/config.rs` | `NodeConfig` TOML struct — all config fields |
| `node/src/genesis.rs` | `GenesisConfig` JSON struct — genesis format |
| `node/src/network.rs` | P2P TCP server — message handling |
| `node/src/bin/zbx-keygen.rs` | Validator key generation tool |
| `crates/zbx-network/src/messages.rs` | P2P message type definitions |
| `crates/zbx-rpc/src/eth_api.rs` | JSON-RPC `eth_*` handlers |
| `crates/zbx-rpc/src/zbx_api.rs` | JSON-RPC `zbx_*` handlers |
| `crates/zbx-crypto/src/bls.rs` | BLS12-381 key generation + signing |

## Review Process

- All PRs require at least 2 approvals from core maintainers.
- CI must pass: format, clippy, tests, audit, deny.
- Large changes should be discussed in a GitHub Issue first.
- Security-sensitive changes (consensus, crypto, bridge) require 3 approvals.

## Security Vulnerabilities

Do **not** open public GitHub Issues for security bugs.
See [SECURITY.md](../SECURITY.md) for the responsible disclosure process.
