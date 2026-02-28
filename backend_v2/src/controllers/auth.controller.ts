import type { Request, Response, NextFunction } from "express";
import { throwError } from "../middlewares/errorMiddleware";
import { sendOTP, verifyOTP } from "./../services/controller_services/auth.service";


export async function sendVerificatonCode(req: Request, res: Response, next: NextFunction) {
    try {

        const { email } = req.body || {};
        if (!email)
            throw throwError("Valid email is required", 400);

        const sentTo = await sendOTP(email);
        return res.json({ success: true, message: "OTP Sent", data: { email: sentTo } });

    } catch (e) {
        next(e);
    }
}


export async function verifyCode(req: Request, res: Response, next: NextFunction) {
    try {

        const { email, code } = req.body || {};
        if (!email || !code)
            throw throwError("Email & OTP code is required", 400);

        const token = await verifyOTP(email, code);
        return res.json({ success: true, message: "OTP Verified", data: { token } });

    } catch (e) {
        next(e);
    }
}