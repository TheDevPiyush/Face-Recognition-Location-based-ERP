import { Router } from "express";
import { authenticate, requireStaff } from "../middlewares/verifyToken";
import { createSubject, getSubject, getSubjects } from "../controllers/subject.controller";

const subjectRouter = Router();

subjectRouter.get("/", authenticate, getSubjects);
subjectRouter.post("/", authenticate, requireStaff, createSubject);
subjectRouter.get("/:pk", authenticate, getSubject);

export default subjectRouter;