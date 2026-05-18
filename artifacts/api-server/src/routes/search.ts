import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  validatorsTable,
  chainTransactionsTable,
  accountsTable,
  governanceProposalsTable,
  liquidityPoolsTable,
} from "@workspace/db";
import { eq, like, or, sql } from "drizzle-orm";
import { VALIDATORS, MONIKERS, hashFromHeight, getCurrentHeight, blockData, deterministicHash } from "./blocks";

const router: IRouter = Router();

type SearchCategory = "block" | "transaction" | "address" | "validator" | "proposal" | "pool";

interface SearchResult {
  type:    SearchCategory;
  id:      string;
  title:   string;
  subtitle:string;
  data:    Record<string, unknown>;
}

router.get("/search", async (req, res): Promise<void> => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "Query must be at least 2 characters" });
    return;
  }

  const results: SearchResult[] = [];
  const latestHeight = getCurrentHeight();

  await Promise.allSettled([
    (async () => {
      if (/^\d+$/.test(q)) {
        const h = parseInt(q, 10);
        if (h >= 1 && h <= latestHeight) {
          const b = blockData(h);
          results.push({
            type:     "block",
            id:       String(h),
            title:    `Block #${h.toLocaleString()}`,
            subtitle: `${b.txCount} txns · ${b.validator.slice(0, 10)}...`,
            data:     b,
          });
        }
      }
    })(),

    (async () => {
      if (q.startsWith("0x") && q.length === 66) {
        const [dbTx] = await db.select().from(chainTransactionsTable)
          .where(eq(chainTransactionsTable.hash, q)).limit(1);
        if (dbTx) {
          results.push({
            type:     "transaction",
            id:       dbTx.hash,
            title:    `Tx ${dbTx.hash.slice(0, 18)}...`,
            subtitle: `Block #${dbTx.blockHeight} · ${dbTx.amount} ZBX`,
            data: {
              ...dbTx,
              timestamp: dbTx.timestamp instanceof Date ? dbTx.timestamp.toISOString() : dbTx.timestamp,
            },
          });
        } else {
          const seed = parseInt(q.slice(2, 10), 16);
          const h    = (Math.abs(seed) % Math.min(latestHeight, 1_000_000)) + 1;
          const b    = blockData(h);
          results.push({
            type:     "transaction",
            id:       q,
            title:    `Tx ${q.slice(0, 18)}...`,
            subtitle: `Block #${h} · simulated`,
            data:     { hash: q, blockHeight: h, timestamp: b.timestamp },
          });
        }
      }
    })(),

    (async () => {
      const isFullAddr   = q.startsWith("0x") && q.length === 42;
      const isZbxAddr    = q.startsWith("zbx1") && q.length >= 10;
      const isPartialHex = q.startsWith("0x") && q.length >= 6 && q.length < 42;

      if (isFullAddr || isZbxAddr) {
        const [acc] = await db.select().from(accountsTable)
          .where(eq(accountsTable.address, q)).limit(1);
        results.push({
          type:     "address",
          id:       q,
          title:    `Address ${q.slice(0, 10)}...${q.slice(-6)}`,
          subtitle: acc ? `${acc.balance} ZBX · ${acc.txCount} txns` : "No on-chain activity",
          data:     acc ?? { address: q },
        });
      } else if (isPartialHex) {
        const dbMatches = await db.select().from(accountsTable)
          .where(like(accountsTable.address, `${q}%`)).limit(5);
        for (const acc of dbMatches) {
          results.push({
            type:     "address",
            id:       acc.address,
            title:    `Address ${acc.address.slice(0, 10)}...${acc.address.slice(-6)}`,
            subtitle: `${acc.balance} ZBX · ${acc.txCount} txns`,
            data:     acc,
          });
        }
        if (dbMatches.length === 0) {
          const padded = q.padEnd(42, "0");
          results.push({
            type:     "address",
            id:       padded,
            title:    `Address ${q}... (partial match)`,
            subtitle: "Partial address — enter full 42-char address",
            data:     { address: padded },
          });
        }
      }
    })(),

    (async () => {
      const [byAddress] = await db.select().from(validatorsTable)
        .where(eq(validatorsTable.address, q)).limit(1);
      const byMoniker = await db.select().from(validatorsTable)
        .where(like(validatorsTable.moniker, `%${q}%`)).limit(5);

      const found = byAddress ? [byAddress, ...byMoniker.filter(v => v.id !== byAddress.id)] : byMoniker;
      for (const v of found) {
        results.push({
          type:     "validator",
          id:       v.address,
          title:    v.moniker,
          subtitle: `${v.status} · ${v.totalStaked} ZBX staked · rank #${v.rank}`,
          data:     v,
        });
      }

      const ql = q.toLowerCase();
      const simMatches = VALIDATORS.filter(addr => {
        const moniker = MONIKERS[addr] ?? "";
        return addr.toLowerCase().includes(ql) || moniker.toLowerCase().includes(ql);
      }).slice(0, 5);
      for (const addr of simMatches) {
        if (found.some(v => v.address === addr)) continue;
        results.push({
          type:     "validator",
          id:       addr,
          title:    MONIKERS[addr] ?? addr.slice(0, 20) + "...",
          subtitle: `active · simulation validator`,
          data:     { address: addr, moniker: MONIKERS[addr] ?? "" },
        });
      }
    })(),

    (async () => {
      const proposals = await db.select().from(governanceProposalsTable)
        .where(
          or(
            like(governanceProposalsTable.title,       `%${q}%`),
            like(governanceProposalsTable.description, `%${q}%`),
          )
        ).limit(3);
      for (const p of proposals) {
        results.push({
          type:     "proposal",
          id:       String(p.id),
          title:    p.title,
          subtitle: `#${p.id} · ${p.status} · ${p.proposalType}`,
          data: {
            ...p,
            submitTime:      p.submitTime      instanceof Date ? p.submitTime.toISOString()      : p.submitTime,
            depositEndTime:  p.depositEndTime  instanceof Date ? p.depositEndTime.toISOString()  : p.depositEndTime,
            votingStartTime: p.votingStartTime instanceof Date ? p.votingStartTime.toISOString() : p.votingStartTime,
            votingEndTime:   p.votingEndTime   instanceof Date ? p.votingEndTime.toISOString()   : p.votingEndTime,
            createdAt:       p.createdAt       instanceof Date ? p.createdAt.toISOString()       : p.createdAt,
          },
        });
      }
    })(),

    (async () => {
      const pools = await db.select().from(liquidityPoolsTable)
        .where(
          or(
            like(liquidityPoolsTable.token0Symbol, `%${q}%`),
            like(liquidityPoolsTable.token1Symbol, `%${q}%`),
          )
        ).limit(3);
      for (const p of pools) {
        results.push({
          type:     "pool",
          id:       String(p.id),
          title:    `${p.token0Symbol}/${p.token1Symbol}`,
          subtitle: `TVL $${Number(p.tvlUsd).toLocaleString()} · ${p.apy}% APY`,
          data: {
            ...p,
            createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
          },
        });
      }
    })(),
  ]);

  res.json({
    query:   q,
    total:   results.length,
    results: results.slice(0, 20),
  });
});

export default router;
