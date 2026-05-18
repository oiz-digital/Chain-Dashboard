import { Router, type IRouter } from "express";
import {
  ListTransactionsQueryParams,
  GetTransactionParams,
  ListTransactionsResponse,
  GetTransactionResponse,
} from "@workspace/api-zod";
import { VALIDATORS, hashFromHeight, getCurrentHeight } from "./blocks";

const router: IRouter = Router();

const TX_TYPES = ["transfer", "stake", "unstake", "delegate", "contract", "reward"] as const;
const TX_STATUSES = ["success", "success", "success", "success", "failed", "pending"] as const;

function txFromIndex(globalIdx: number) {
  const height = Math.floor(globalIdx / 3) + 1;
  const withinBlock = globalIdx % 3;
  const hash = hashFromHeight(height, withinBlock + 10);
  const type = TX_TYPES[globalIdx % TX_TYPES.length];
  const status = TX_STATUSES[globalIdx % TX_STATUSES.length];
  const secondsAgo = (getCurrentHeight() - height) * 5;
  const timestamp = new Date(Date.now() - secondsAgo * 1000).toISOString();
  const amount = ((globalIdx % 500) * 0.47 + 0.001).toFixed(6);
  const fee = "0.001";
  const nonce = Math.floor(globalIdx / 5);
  const gasLimit = 21000 + (globalIdx % 3) * 50000;
  const gasUsed = Math.floor(gasLimit * 0.85);
  const gasPrice = "0.000000001";

  return {
    hash,
    blockHeight: height,
    timestamp,
    from: VALIDATORS[globalIdx % VALIDATORS.length],
    to: VALIDATORS[(globalIdx + 2) % VALIDATORS.length],
    amount,
    fee,
    status,
    type,
    nonce,
    gasLimit,
    gasUsed,
    gasPrice,
    data: type === "contract" ? "0x" + hashFromHeight(globalIdx, 5).slice(2, 18) : "0x",
    confirmations: getCurrentHeight() - height,
  };
}

router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const page = query.data.page ?? 1;
  const limit = Math.min(query.data.limit ?? 20, 50);
  const latestHeight = getCurrentHeight();
  const totalTxs = Math.floor(latestHeight * 2.31);
  const startIdx = totalTxs - (page - 1) * limit;

  const transactions = [];
  for (let i = 0; i < limit; i++) {
    const idx = startIdx - i;
    if (idx < 0) break;
    const tx = txFromIndex(idx);
    transactions.push({
      hash: tx.hash,
      blockHeight: tx.blockHeight,
      timestamp: tx.timestamp,
      from: tx.from,
      to: tx.to,
      amount: tx.amount,
      fee: tx.fee,
      status: tx.status,
      type: tx.type,
    });
  }

  res.json(
    ListTransactionsResponse.parse({
      transactions,
      total: totalTxs,
      page,
      limit,
    })
  );
});

router.get("/transactions/:hash", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.hash) ? req.params.hash[0] : req.params.hash;
  const params = GetTransactionParams.safeParse({ hash: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const hash = params.data.hash;
  const seed = parseInt(hash.slice(2, 10), 16);
  const idx = Math.abs(seed % 10000);
  const tx = txFromIndex(idx);

  res.json(GetTransactionResponse.parse({ ...tx, hash }));
});

export default router;
