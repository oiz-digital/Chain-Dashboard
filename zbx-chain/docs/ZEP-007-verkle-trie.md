# ZEP-007: Verkle Trie State Tree

| Field      | Value                                       |
|:---|:---|
| ZEP Number | ZEP-007                                     |
| Title      | Verkle Trie State Tree                      |
| Status     | **Scheduled** — activates at block 150,000 |
| Category   | Core / State                                |
| Authors    | Zebvix Core Team                            |

## Abstract

Replace the current Merkle-Patricia trie with a Verkle trie for state storage.
Verkle proofs are ~20× smaller (~150 bytes vs ~3 KB), enabling practical
stateless clients and reducing sync bandwidth by 90%.

## Benefits

- **Smaller proofs**: ~150 bytes per key vs ~3 KB (Merkle-Patricia)
- **Stateless clients**: Light nodes verify blocks without full state
- **Faster sync**: State witnesses gossiped with blocks (<10 KB)
- **Aggregatable**: Multiple proofs merge into one (no size scaling)

## Activation

| Block    | Action                                              |
|:---|:---|
| 150,000  | Dual-mode: read Merkle, write Verkle                |
| 175,000  | Verkle finalized; Merkle kept for 25,000 blocks     |
| 200,000  | Merkle-Patricia dropped; full Verkle mode           |

## Cryptography

- **Curve**: Bandersnatch (twisted Edwards over BLS12-381 scalar field)
- **Commitment**: Pedersen vector commitment
- **Proof system**: Inner Product Argument (IPA)
- **Hash-to-field**: SHA-256 domain-separated

## Security

- 128-bit security (same as BLS12-381)
- Binding and hiding (information-theoretic hiding under DL)
- Proofs unforgeable under Discrete Log assumption