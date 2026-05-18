import { Router, type IRouter } from "express";
import {
  ListTransactionsQueryParams,
  GetTransactionParams,
  ListTransactionsResponse,
  GetTransactionResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { chainTransactionsTable, accountsTable } from "@workspace/db";
import { eq, desc, or, sql, count } from "drizzle-orm";
import { VALIDATORS, deterministicHash, getCurrentHeight } from "./blocks";
import { getOrCreateAccount } from "./wallet";
import {
  parseNetwork,
  getCurrentHeightForNetwork,
  TESTNET_VALIDATORS,
} from "./network-config";

const router: IRouter = Router();

const TX_TYPES    = ["transfer", "stake", "unstake", "delegate", "contract", "reward"] as const;
const TX_STATUSES = ["success",  "success", "success", "success",  "failed",  "pending"] as const;

function txFromIndex(globalIdx: number, isTestnet = false) {
  const validators   = isTestnet ? TESTNET_VALIDATORS : VALIDATORS;
  const chainSuffix  = isTestnet ? "chain8990" : "chain8989";
  const blockDivisor = isTestnet ? 2 : 3;
  const height       = Math.floor(globalIdx / blockDivisor) + 1;
  const withinBlock  = globalIdx % blockDivisor;
  const hash         = deterministicHash(`zbx:tx:${height}:${withinBlock}:${chainSuffix}`);
  const type         = TX_TYPES[globalIdx % TX_TYPES.length];
  const status       = TX_STATUSES[globalIdx % TX_STATUSES.length];
  const blockTime    = isTestnet ? 5 : 5;
  const secondsAgo   = isTestnet
    ? (getCurrentHeightForNetwork({ name: "testnet", baseHeight: 487_234, genesisDate: new Date("2026-01-01"), blockTimeSeconds: 5 } as any) - height) * blockTime
    : (getCurrentHeight() - height) * blockTime;
  const timestamp    = new Date(Date.now() - secondsAgo * 1000).toISOString();
  const amtSeed      = height * 31 + globalIdx * 7;
  const amount       = isTestnet
    ? ((amtSeed % 500) * 0.1 + 0.001).toFixed(6)
    : ((amtSeed % 10000) * 0.047 + 0.001).toFixed(6);
  const nonce        = Math.floor(globalIdx / 5);
  const gasLimit     = 21000 + (globalIdx % 3) * 50000;
  const gasUsed      = Math.floor(gasLimit * 0.85);

  return {
    hash,
    blockHeight: height,
    timestamp,
    from:        validators[globalIdx % validators.length],
    to:          validators[(globalIdx + 2) % validators.length],
    amount,
    fee:         isTestnet ? "0.0001" : "0.001",
    status,
    type,
    nonce,
    gasLimit,
    gasUsed,
    gasPrice:    "0.000000001",
    data:        type === "contract" ? "0x" + hash.slice(2, 18) : "0x",
    confirmations: isTestnet
      ? getCurrentHeightForNetwork({ name: "testnet", baseHeight: 487_234, genesisDate: new Date("2026-01-01"), blockTimeSeconds: 5 } as any) - height
      : getCurrentHeight() - height,
  };
}

router.get("/transactions", async (req, res): Promise<void> => {
  const cfg   = parseNetwork(req);
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const page   = query.data.page  ?? 1;
  const limit  = Math.min(query.data.limit ?? 20, 50);

  const latestHeight = getCurrentHeightForNetwork(cfg);
  const txPerBlock   = cfg.name === "testnet" ? 1.2 : 2.31;
  const simTotal     = Math.floor(latestHeight * txPerBlock);

  if (cfg.name === "testnet") {
    const startIdx = simTotal - (page - 1) * limit;
    const txs = [];
    for (let i = 0; i < limit; i++) {
      const idx = startIdx - i;
      if (idx < 0) break;
      const tx = txFromIndex(idx, true);
      txs.push({
        hash: tx.hash, blockHeight: tx.blockHeight, timestamp: tx.timestamp,
        from: tx.from, to: tx.to, amount: tx.amount, fee: tx.fee, status: tx.status, type: tx.type,
      });
    }
    res.json(ListTransactionsResponse.parse({ transactions: txs, total: simTotal, page, limit }));
    return;
  }

  const [dbTxs, [{ total: dbTotal }]] = await Promise.all([
    db.select().from(chainTransactionsTable)
      .orderBy(desc(chainTransactionsTable.timestamp))
      .limit(limit),
    db.select({ total: count() }).from(chainTransactionsTable),
  ]);

  const totalTxs  = simTotal + Number(dbTotal);
  const dbMapped  = dbTxs.map(t => ({
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
  const startIdx  = simTotal - (page - 1) * limit - dbMapped.length;
  const simTxs    = [];
  for (let i = 0; i < remaining; i++) {
    const idx = startIdx - i;
    if (idx < 0) break;
    const tx = txFromIndex(idx, false);
    simTxs.push({
      hash: tx.hash, blockHeight: tx.blockHeight, timestamp: tx.timestamp,
      from: tx.from, to: tx.to, amount: tx.amount, fee: tx.fee, status: tx.status, type: tx.type,
    });
  }

  res.json(ListTransactionsResponse.parse({ transactions: [...dbMapped, ...simTxs], total: totalTxs, page, limit }));
});

router.get("/transactions/:hash", async (req, res): Promise<void> => {
  const cfg  = parseNetwork(req);
  const raw  = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
  const params = GetTransactionParams.safeParse({ hash: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const hash = params.data.hash;

  if (cfg.name === "mainnet") {
    const [dbTx] = await db.select().from(chainTransactionsTable)
      .where(eq(chainTransactionsTable.hash, hash)).limit(1);
    if (dbTx) {
      res.json(GetTransactionResponse.parse({
        hash:          dbTx.hash,
        blockHeight:   dbTx.blockHeight,
        timestamp:     dbTx.timestamp instanceof Date ? dbTx.timestamp.toISOString() : dbTx.timestamp,
        from:          dbTx.fromAddress,
        to:            dbTx.toAddress,
        amount:        dbTx.amount,
        fee:           dbTx.fee,
        status:        dbTx.status,
        type:          dbTx.type,
        nonce:         dbTx.nonce,
        gasLimit:      dbTx.gasLimit,
        gasUsed:       dbTx.gasUsed,
        gasPrice:      dbTx.gasPrice,
        data:          dbTx.data,
        confirmations: getCurrentHeight() - dbTx.blockHeight,
      }));
      return;
    }
  }

  const seed = parseInt(hash.slice(2, 10), 16);
  const idx  = Math.abs(seed % 10000);
  const tx   = txFromIndex(idx, cfg.name === "testnet");
  res.json(GetTransactionResponse.parse({ ...tx, hash }));
});

router.post("/transactions/send", async (req, res): Promise<void> => {
  const cfg = parseNetwork(req);
  const { from, to, amount, fee, type = "transfer", data = "0x" } = req.body ?? {};

  if (!from || !to || !amount) {
    res.status(400).json({ error: "from, to, amount are required" });
    return;
  }

  const defaultFee = cfg.name === "testnet" ? "0.0001" : "0.001";
  const feeNum     = parseFloat(fee ?? defaultFee);
  const amtNum     = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const fromAcc  = await getOrCreateAccount(from);
  const bal      = parseFloat(fromAcc.balance);
  if (bal < amtNum + feeNum) {
    res.status(400).json({ error: `Insufficient balance: ${bal.toFixed(6)} ZBX available, need ${(amtNum + feeNum).toFixed(6)} ZBX` });
    return;
  }

  const height    = getCurrentHeightForNetwork(cfg);
  const nonce     = fromAcc.nonce + 1;
  const txHash    = deterministicHash(`zbx:send:${cfg.name}:${from}:${to}:${amount}:${nonce}:${Date.now()}`);
  const timestamp = new Date();

  if (cfg.name === "mainnet") {
    const txRecord = {
      hash:        txHash,
      blockHeight: height,
      fromAddress: from,
      toAddress:   to,
      amount:      amtNum.toFixed(6),
      fee:         feeNum.toFixed(6),
      status:      "success" as const,
      type:        (["transfer","stake","unstake","delegate","contract","reward","governance","swap"].includes(type) ? type : "transfer") as "transfer",
      nonce,
      gasLimit:    21000,
      gasUsed:     21000,
      gasPrice:    "0.000000001",
      data:        data || "0x",
      timestamp,
    };
    await db.insert(chainTransactionsTable).values(txRecord);
  }

  const newBalance = (parseFloat(fromAcc.balance) - amtNum - feeNum).toFixed(6);
  await db.insert(accountsTable).values({
    address:       from,
    balance:       newBalance,
    nonce,
    txCount:       1,
    totalSent:     amtNum.toFixed(6),
    totalReceived: "0",
    lastSeen:      timestamp,
  }).onConflictDoUpdate({
    target: accountsTable.address,
    set: {
      balance:  newBalance,
      nonce,
      txCount:  sql`${accountsTable.txCount} + 1`,
      totalSent:sql`(${accountsTable.totalSent}::numeric + ${amtNum})::text`,
      lastSeen: timestamp,
    },
  });

  const toNewBalance = amtNum.toFixed(6);
  await db.insert(accountsTable).values({
    address:       to,
    balance:       toNewBalance,
    nonce:         0,
    txCount:       1,
    totalSent:     "0",
    totalReceived: amtNum.toFixed(6),
    lastSeen:      timestamp,
  }).onConflictDoUpdate({
    target: accountsTable.address,
    set: {
      balance:       sql`(${accountsTable.balance}::numeric + ${amtNum})::text`,
      txCount:       sql`${accountsTable.txCount} + 1`,
      totalReceived: sql`(${accountsTable.totalReceived}::numeric + ${amtNum})::text`,
      lastSeen:      timestamp,
    },
  });

  res.status(201).json({
    txHash,
    blockHeight: height,
    status:      "success",
    timestamp:   timestamp.toISOString(),
    from,
    to,
    amount:      amtNum.toFixed(6),
    fee:         feeNum.toFixed(6),
    network:     cfg.name,
  });
});

export default router;
