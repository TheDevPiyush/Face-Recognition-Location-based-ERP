import { Router } from "express";
import { sendVerificatonCode, verifyCode } from "../../controllers/auth/auth.controller";

export const authRouter = Router()

authRouter.post('/send-code', sendVerificatonCode);
authRouter.post('/verify-code', verifyCode)