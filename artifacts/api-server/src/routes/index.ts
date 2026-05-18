import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chainRouter from "./chain";
import blocksRouter from "./blocks";
import transactionsRouter from "./transactions";
import validatorsRouter from "./validators";
import walletRouter from "./wallet";
import tokensRouter from "./tokens";
import defiRouter from "./defi";
import adminRouter from "./admin";
import dexRouter from "./dex";
import stakingRouter from "./staking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chainRouter);
router.use(blocksRouter);
router.use(transactionsRouter);
router.use(validatorsRouter);
router.use(walletRouter);
router.use(tokensRouter);
router.use(defiRouter);
router.use(adminRouter);
router.use(dexRouter);
router.use(stakingRouter);

export default router;
