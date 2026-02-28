import { Router } from "express";
import { authenticate, requireStaff } from "../middlewares/verifyToken";
import { createUniversity, getUniversities, getUniversity } from "../controllers/university.controller";

const universityRouter = Router();

universityRouter.get("/", authenticate, getUniversities);
universityRouter.post("/", authenticate, requireStaff, createUniversity);
universityRouter.get("/:pk", authenticate, getUniversity);

export default universityRouter;