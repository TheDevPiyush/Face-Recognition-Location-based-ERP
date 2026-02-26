import type { Request, Response, NextFunction } from "express";
import { throwError } from "../../middlewares/errorMiddleware";
import { generateSecureOTP } from "../../utils/generateOTP";
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationOTP } from "../../mail/sendMail";
import jwt from 'jsonwebtoken'

export const sendVerificatonCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body || {};

        if (!email) {
            throw (throwError("Valid email is required", 400));
        }

        const verificationCode = generateSecureOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP validity for 5 min only...

        const [user] = await db
            .insert(users)
            .values({
                email: email,
                loginOTP: verificationCode,
                loginOTPExpiresAt: expiresAt,
            })
            .onConflictDoUpdate({
                target: users.email,
                set: {
                    loginOTP: verificationCode,
                    loginOTPExpiresAt: expiresAt,
                },
            })
            .returning();

        if (user) {

            await sendVerificationOTP(user.loginOTP as string, user.email, "Steal - Login Code")

            return res.json({
                success: true,
                message: "OTP Sent",
                data: { email: user.email },
            })
        }
    }
    catch (e: any) {
        next(e)
    }
}

export const verifyCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, code } = req.body || {};

        if (!email || !code) {
            throw (throwError("Email & OTP Code is required", 400));
        }

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))

        if (!user) {
            throw (throwError("User not found for this email", 404));
        }

        if (!user?.loginOTP || !user?.loginOTPExpiresAt) {
            throw (throwError("No Sent OTP was found. Please request a new one.", 404));
        }

        const sentCode = user?.loginOTP;
        const isOTPExpired = user?.loginOTPExpiresAt < new Date()

        if (isOTPExpired) {
            throw (throwError("OTP Code is expired"));
        }

        if (sentCode !== code) {
            throw (throwError("Invalid OTP Code"));
        }

        await db
            .update(users)
            .set({
                loginOTP: null,
                loginOTPExpiresAt: null
            })
            .where(eq(users.email, email))

        const { email: userEmail } = user

        const token = jwt.sign(
            {
                email: userEmail
            },
            process.env.JSON_WEB_SECRET as string,
            {
                expiresIn: "7d"
            });

        res.json({
            success: true,
            message: "OTP Verified",
            data: { token }
        });
    }
    catch (e: any) {
        next(e)
    }
}