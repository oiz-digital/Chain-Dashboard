import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { liquidityPoolsTable, swapTransactionsTable } from "@workspace/db";
import { desc, eq, sql, count } from "drizzle-orm";
import {
  ListDexPoolsResponse,
  GetDexPoolResponse,
  GetSwapQuoteResponse,
  ListSwapTransactionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dex/pools", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const sortBy = String(req.query.sortBy || "tvl");
  const offset = (page - 1) * limit;

  const orderCol =
    sortBy === "volume" ? liquidityPoolsTable.volume24h :
    sortBy === "apy"    ? liquidityPoolsTable.apy       :
    sortBy === "fees"   ? liquidityPoolsTable.fees24h   :
    liquidityPoolsTable.tvlUsd;

  const [pools, [{ total }]] = await Promise.all([
    db.select().from(liquidityPoolsTable)
      .orderBy(desc(orderCol))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(liquidityPoolsTable),
  ]);

  const mapped = pools.map(p => ({
    ...p,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  }));
  res.json(ListDexPoolsResponse.parse({ pools: mapped, total: Number(total) }));
});

router.get("/dex/pools/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [pool] = await db.select().from(liquidityPoolsTable)
    .where(eq(liquidityPoolsTable.id, id)).limit(1);
  if (!pool) { res.status(404).json({ error: "Pool not found" }); return; }
  res.json(GetDexPoolResponse.parse({
    ...pool,
    createdAt: pool.createdAt instanceof Date ? pool.createdAt.toISOString() : pool.createdAt,
  }));
});

router.get("/dex/swap/quote", async (req, res): Promise<void> => {
  const tokenIn  = String(req.query.tokenIn  || "ZBX");
  const tokenOut = String(req.query.tokenOut || "ZBXUSD");
  const amountIn = String(req.query.amountIn || "100");
  const slippage = String(req.query.slippage || "0.5");

  const [pool] = await db.select().from(liquidityPoolsTable)
    .where(
      sql`(token0_symbol = ${tokenIn} AND token1_symbol = ${tokenOut})
       OR (token0_symbol = ${tokenOut} AND token1_symbol = ${tokenIn})`
    )
    .limit(1);

  if (!pool) {
    const zbxPrice = 0.0847 + Math.sin(Date.now() / 180000) * 0.003;
    const amtOut   = (Number(amountIn) * zbxPrice * 0.997).toFixed(6);
    const slip     = Number(slippage) / 100;
    res.json(GetSwapQuoteResponse.parse({
      tokenIn, tokenOut, amountIn,
      amountOut: amtOut,
      priceImpact: "0.12",
      executionPrice: zbxPrice.toFixed(8),
      minimumReceived: (Number(amtOut) * (1 - slip)).toFixed(6),
      fee: (Number(amountIn) * 0.003).toFixed(6),
      poolId: 0,
      route: [tokenIn, tokenOut],
    }));
    return;
  }

  const r0 = Number(pool.token0Reserve);
  const r1 = Number(pool.token1Reserve);
  const isForward      = pool.token0Symbol === tokenIn;
  const resIn          = isForward ? r0 : r1;
  const resOut         = isForward ? r1 : r0;
  const amtIn          = Number(amountIn);
  const amtInWithFee   = amtIn * 0.997;
  const amtOut         = (amtInWithFee * resOut) / (resIn + amtInWithFee);
  const priceImpact    = ((amtIn / (resIn + amtIn)) * 100).toFixed(4);
  const execPrice      = (amtOut / amtIn).toFixed(8);
  const slip           = Number(slippage) / 100;

  res.json(GetSwapQuoteResponse.parse({
    tokenIn, tokenOut, amountIn,
    amountOut: amtOut.toFixed(6),
    priceImpact,
    executionPrice: execPrice,
    minimumReceived: (amtOut * (1 - slip)).toFixed(6),
    fee: (amtIn * 0.003).toFixed(6),
    poolId: pool.id,
    route: [tokenIn, tokenOut],
  }));
});

router.get("/dex/swaps", async (req, res): Promise<void> => {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const poolId = req.query.poolId ? Number(req.query.poolId) : undefined;
  const offset = (page - 1) * limit;

  const where = poolId
    ? eq(swapTransactionsTable.poolId, poolId)
    : sql`1=1`;

  const [swaps, [{ total }]] = await Promise.all([
    db.select().from(swapTransactionsTable)
      .where(where)
      .orderBy(desc(swapTransactionsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(swapTransactionsTable).where(where),
  ]);

  res.json(ListSwapTransactionsResponse.parse({
    swaps: swaps.map(s => ({
      ...s,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    })),
    total: Number(total),
  }));
});

export default router;
