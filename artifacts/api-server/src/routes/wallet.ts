import { Router, type IRouter } from "express";
import {
  GetWalletParams,
  GetWalletTransactionsParams,
  GetWalletResponse,
  GetWalletTransactionsResponse,
} from "@workspace/api-zod";
import { VALIDATORS, hashFromHeight, getCurrentHeight } from "./blocks";

const router: IRouter = Router();

function addrSeed(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return hash;
}

router.get("/wallet/:address", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetWalletParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const address = params.data.address;
  const seed = addrSeed(address);
  const balance = ((seed % 100000) * 0.47 + 1.5).toFixed(6);
  const stakedAmount = ((seed % 50000) * 0.1).toFixed(6);
  const txCount = (seed % 5000) + 10;
  const nonce = txCount;
  const totalSent = ((seed % 200000) * 0.3).toFixed(6);
  const totalReceived = (parseFloat(totalSent) + parseFloat(balance)).toFixed(6);
  const daysAgo = (seed % 400) + 10;
  const firstSeen = new Date(Date.now() - daysAgo * 86400 * 1000).toISOString();
  const lastSeen = new Date(Date.now() - Math.floor(Math.random() * 3600) * 1000).toISOString();

  res.json(
    GetWalletResponse.parse({
      address,
      balance,
      nonce,
      totalSent,
      totalReceived,
      txCount,
      stakedAmount,
      firstSeen,
      lastSeen,
    })
  );
});

router.get("/wallet/:address/transactions", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.address) ? req.params.address[0] : req.params.address;
  const params = GetWalletTransactionsParams.safeParse({ address: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const address = params.data.address;
  const seed = addrSeed(address);
  const height = getCurrentHeight();
  const TX_TYPES = ["transfer", "stake", "unstake", "delegate", "contract", "reward"] as const;
  const TX_STATUSES = ["success", "success", "success", "success", "failed", "pending"] as const;

  const transactions = Array.from({ length: 20 }, (_, i) => {
    const blockHeight = height - (seed % 1000) - i * 50;
    const hash = hashFromHeight(blockHeight, seed + i);
    const type = TX_TYPES[(seed + i) % TX_TYPES.length];
    const status = TX_STATUSES[(seed + i) % TX_STATUSES.length];
    const isOutgoing = (seed + i) % 2 === 0;
    const timestamp = new Date(Date.now() - (height - blockHeight) * 5000).toISOString();

    return {
      hash,
      blockHeight: Math.max(1, blockHeight),
      timestamp,
      from: isOutgoing ? address : VALIDATORS[i % VALIDATORS.length],
      to: isOutgoing ? VALIDATORS[(i + 1) % VALIDATORS.length] : address,
      amount: (((seed + i) % 1000) * 0.1 + 0.001).toFixed(6),
      fee: "0.001",
      status,
      type,
    };
  });

  res.json(
    GetWalletTransactionsResponse.parse({
      transactions,
      total: (seed % 5000) + 10,
      page: 1,
      limit: 20,
    })
  );
});

export default router;
