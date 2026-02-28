import { db } from "../../db";
import { users } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateSecureOTP } from "../../utils/generateOTP";
import { sendVerificationOTP } from "../../mail/sendMail";
import jwt from "jsonwebtoken";

export async function sendOTP(email: string) {
    const otp       = generateSecureOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const [user] = await db
        .insert(users)
        .values({ email, loginOTP: otp, loginOTPExpiresAt: expiresAt })
        .onConflictDoUpdate({
            target: users.email,
            set:    { loginOTP: otp, loginOTPExpiresAt: expiresAt },
        })
        .returning();

    await sendVerificationOTP(user!.loginOTP as string, user!.email, "GeoAttend - Login OTP");

    return user!.email;
}

export async function verifyOTP(email: string, code: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user)                          throw { status: 404, message: "User not found for this email" };
    if (!user.loginOTP || !user.loginOTPExpiresAt) throw { status: 404, message: "No OTP found. Please request a new one." };
    if (user.loginOTPExpiresAt < new Date())       throw { status: 400, message: "OTP code is expired" };
    if (user.loginOTP !== code)                    throw { status: 400, message: "Invalid OTP code" };

    await db.update(users).set({ loginOTP: null, loginOTPExpiresAt: null }).where(eq(users.email, email));

    const token = jwt.sign(
        { email },
        process.env.JSON_WEB_SECRET as string,
        { expiresIn: "7d" },
    );

    return token;
}