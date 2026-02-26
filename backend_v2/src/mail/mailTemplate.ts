export const otpEmailTemplate = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Your OTP Code</title>
</head>
<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="420" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 8px 20px rgba(0,0,0,0.08);">
          
          <!-- Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <h2 style="margin:0; color:#2c3e50;">GeoAttend</h2>
              <p style="margin:5px 0 0; color:#7f8c8d; font-size:14px;">
                Our Modern day's ERP.
              </p>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td align="center" style="padding:20px 0;">
              <p style="font-size:16px; color:#2c3e50; margin:0;">
                Your One-Time Password
              </p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td align="center" style="padding:10px 0 25px;">
              <div style="
                display:inline-block;
                background:#f1f5f9;
                padding:15px 30px;
                font-size:28px;
                letter-spacing:6px;
                font-weight:bold;
                color:#1f2937;
                border-radius:8px;
                font-family:monospace;
              ">
                ${code}
              </div>
            </td>
          </tr>

          <!-- Info Text -->
          <tr>
            <td align="center">
              <p style="font-size:14px; color:#7f8c8d; margin:0;">
                This code will expire in 5 minutes.
              </p>
              <p style="font-size:13px; color:#9ca3af; margin-top:10px;">
                If you didn’t request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:25px;">
              <p style="font-size:12px; color:#b0b7c3; margin:0;">
                © ${new Date().getFullYear()} GeoAttend. Location & Face based ERP. <a href="https://thedevpiyush.com">TheDevPiyush.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
