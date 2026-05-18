import { Router, type IRouter } from "express";
import {
  GetWalletParams,
  GetWalletTransactionsParams,
  GetWalletResponse,
  GetWalletTransactionsResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { accountsTable, chainTransactionsTable } from "@workspace/db";
import { eq, or, desc, sql } from "drizzle-orm";
import { VALIDATORS, deterministicHash, hashFromHeight, getCurrentHeight } from "./blocks";

const router: IRouter = Router();

function addrSeed(address: string): number {
  return addrSeedFn(address);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function addrSeedFn(address: string): number {
  let hash = 5381;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) + hash + address.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export async function getOrCreateAccount(address: string) {
  const [existing] = await db.select().from(accountsTable)
    .where(eq(accountsTable.address, address)).limit(1);
  if (existing) return existing;

  const seed         = addrSeed(address);
  const balance      = ((seed % 100000) * 0.47 + 1.5).toFixed(6);
  const stakedAmount = ((seed % 50000) * 0.1).toFixed(6);
  const txCount      = (seed % 5000) + 10;
  const totalSent    = ((seed % 200000) * 0.3).toFixed(6);
  const totalReceived= (parseFloat(totalSent) + parseFloat(balance)).toFixed(6);
  const daysAgo      = (seed % 400) + 10;
  const firstSeen    = new Date(Date.now() - daysAgo * 86400 * 1000);
  const lastSeen     = new Date(Date.now() - Math.floor(seededRandom(seed) * 3600) * 1000);

  const newAcc = {
    address,
    balance,
    stakedAmount,
    nonce:         txCount,
    txCount,
    totalSent,
    totalReceived,
    firstSeen,
    lastSeen,
  };

  await db.insert(accountsTable).values(newAcc).onConflictDoNothing();
  return newAcc;
}

router.get("/wallet/:address", async (req, res): Promise<void> => {
  const raw    = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetWalletParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const account = await getOrCreateAccount(params.data.address);

  res.json(
    GetWalletResponse.parse({
      address:       account.address,
      balance:       account.balance,
      nonce:         account.nonce,
      totalSent:     account.totalSent,
      totalReceived: account.totalReceived,
      txCount:       account.txCount,
      stakedAmount:  account.stakedAmount,
      firstSeen:     account.firstSeen instanceof Date ? account.firstSeen.toISOString() : account.firstSeen,
      lastSeen:      account.lastSeen  instanceof Date ? account.lastSeen.toISOString()  : account.lastSeen,
    })
  );
});

router.get("/wallet/:address/transactions", async (req, res): Promise<void> => {
  const raw    = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetWalletTransactionsParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const address = params.data.address;
  const page    = Math.max(1, Number(req.query.page) || 1);
  const limit   = Math.min(50, Number(req.query.limit) || 20);
  const offset  = (page - 1) * limit;

  const dbTxs = await db.select().from(chainTransactionsTable)
    .where(or(
      eq(chainTransactionsTable.fromAddress, address),
      eq(chainTransactionsTable.toAddress,   address),
    ))
    .orderBy(desc(chainTransactionsTable.timestamp))
    .limit(limit).offset(offset);

  const account = await getOrCreateAccount(address);
  const seed    = addrSeed(address);
  const height  = getCurrentHeight();

  const TX_TYPES    = ["transfer", "stake",   "unstake", "delegate", "contract", "reward"] as const;
  const TX_STATUSES = ["success",  "success",  "success", "success",  "failed",   "pending"] as const;

  const dbMapped = dbTxs.map(t => ({
    hash:        t.hash,
    blockHeight: t.blockHeight,
    timestamp:   t.timestamp instanceof Date ? t.timestamp.toISOString() : t.timestamp,
    from:        t.fromAddress,
    to:          t.toAddress,
    amount:      t.amount,
    fee:         t.fee,
    status:      t.status,
    type:        t.type,
  }));

  const remaining = Math.max(0, limit - dbMapped.length);
  const simTxs    = Array.from({ length: remaining }, (_, i) => {
    const blockHeight = height - (seed % 1000) - (offset + i) * 50;
    const hash        = deterministicHash(`zbx:wallet:${address}:${offset + i}`);
    const type        = TX_TYPES[(seed + i) % TX_TYPES.length];
    const status      = TX_STATUSES[(seed + i) % TX_STATUSES.length];
    const isOutgoing  = (seed + i) % 2 === 0;
    const timestamp   = new Date(Date.now() - (height - Math.max(1, blockHeight)) * 5000).toISOString();
    return {
      hash,
      blockHeight: Math.max(1, blockHeight),
      timestamp,
      from:   isOutgoing ? address : VALIDATORS[i % VALIDATORS.length],
      to:     isOutgoing ? VALIDATORS[(i + 1) % VALIDATORS.length] : address,
      amount: (((seed + i) % 1000) * 0.1 + 0.001).toFixed(6),
      fee:    "0.001",
      status,
      type,
    };
  });

  res.json(
    GetWalletTransactionsResponse.parse({
      transactions: [...dbMapped, ...simTxs],
      total:        account.txCount,
      page,
      limit,
    })
  );
});

export default router;
