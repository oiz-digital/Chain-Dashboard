import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TOTAL_SUPPLY = 500_000_000;
const LABELS: Record<string, string> = {
  "zbx1foundation0000000000000000": "ZBX Foundation",
  "zbx1ecosystem00000000000000000": "Ecosystem Fund",
  "zbx1treasury000000000000000000": "Treasury",
  "zbx1team0000000000000000000000": "Team & Advisors",
  "zbx1validators0000000000000000": "Validator Pool",
};

const ACCOUNTS = Array.from({ length: 50 }, (_, i) => {
  const seed  = Math.sin(i * 137.508) * 0.5 + 0.5;
  const seed2 = Math.sin(i * 97.333 + 5) * 0.5 + 0.5;
  const fixed = [
    { address: "zbx1foundation0000000000000000", balance: 85_000_000, staked: 0, txCount: 412 },
    { address: "zbx1ecosystem00000000000000000", balance: 60_000_000, staked: 0, txCount: 218 },
    { address: "zbx1treasury000000000000000000", balance: 45_000_000, staked: 0, txCount: 87 },
    { address: "zbx1team0000000000000000000000", balance: 35_000_000, staked: 0, txCount: 134 },
    { address: "zbx1validators0000000000000000", balance: 18_420_000, staked: 18_420_000, txCount: 9842 },
  ];
  if (i < fixed.length) {
    const f = fixed[i];
    return {
      rank: i + 1,
      address: f.address,
      label: LABELS[f.address] ?? undefined,
      balance: f.balance.toString(),
      stakedAmount: f.staked.toString(),
      txCount: f.txCount,
      percentOfSupply: ((f.balance / TOTAL_SUPPLY) * 100).toFixed(4),
    };
  }
  const balance    = Math.round(1_000_000 * Math.pow(0.72, i - 5) * (0.7 + seed * 0.6));
  const staked     = Math.round(balance * seed2 * 0.4);
  const txCount    = Math.round(50 + seed * 2000);
  const addr       = `zbx1${Buffer.from(`account${i}`).toString("hex").slice(0, 26)}`;
  return {
    rank: i + 1,
    address: addr,
    label: undefined,
    balance: balance.toString(),
    stakedAmount: staked.toString(),
    txCount,
    percentOfSupply: ((balance / TOTAL_SUPPLY) * 100).toFixed(6),
  };
});

router.get("/leaderboard/accounts", async (req, res): Promise<void> => {
  const limit = Math.min(50, Number(req.query.limit) || 50);
  res.json({ accounts: ACCOUNTS.slice(0, limit), total: ACCOUNTS.length });
});

export default router;
