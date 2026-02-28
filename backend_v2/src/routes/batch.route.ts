import { Router } from "express";
import { authenticate, requireStaff } from "../middlewares/verifyToken";
import { createBatch, getBatch, getBatches } from "../controllers/batch.controller";

const batchRouter = Router();

batchRouter.get("/", authenticate, getBatches);
batchRouter.post("/", authenticate, requireStaff, createBatch);
batchRouter.get("/:pk", authenticate, getBatch);

export default batchRouter;