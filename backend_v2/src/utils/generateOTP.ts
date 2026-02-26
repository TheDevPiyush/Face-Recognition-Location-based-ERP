import crypto from "crypto";

export const generateSecureOTP = (): string => {
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
};
