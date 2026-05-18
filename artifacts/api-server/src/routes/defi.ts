import { Router, type IRouter } from "express";
import { GetDefiStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/defi/stats", async (_req, res): Promise<void> => {
  const zbxPrice = 0.0847 + Math.sin(Date.now() / 180000) * 0.003;
  const priceChange24h = parseFloat((Math.sin(Date.now() / 86400000) * 8.5).toFixed(2));

  const ammPoolTvl = 20_000_000 * zbxPrice;
  const stakingTvl = 52_000_000 * zbxPrice;
  const lendingTvl = 8_400_000 * zbxPrice;
  const totalTvl = ammPoolTvl + stakingTvl + lendingTvl;
  const dailyVolume = totalTvl * 0.042;
  const totalFees24h = dailyVolume * 0.003;

  res.json(
    GetDefiStatsResponse.parse({
      totalTvl: totalTvl.toFixed(2),
      ammPoolTvl: ammPoolTvl.toFixed(2),
      stakingTvl: stakingTvl.toFixed(2),
      lendingTvl: lendingTvl.toFixed(2),
      totalPools: 47,
      dailyVolume: dailyVolume.toFixed(2),
      totalFees24h: totalFees24h.toFixed(2),
      zbxPrice: parseFloat(zbxPrice.toFixed(4)),
      priceChange24h,
    })
  );
});

export default router;
