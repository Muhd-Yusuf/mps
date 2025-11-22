interface SendEmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
}

const BREVO_API_KEY = process.env.BREVO_API_KEY
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "MPS Poetry Challenge"

export async function sendEmail({ to, subject, htmlContent, textContent }: SendEmailParams): Promise<void> {
  if (!BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured")
  }

  if (!BREVO_SENDER_EMAIL) {
    throw new Error("BREVO_SENDER_EMAIL is not configured")
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL,
      },
      to: [
        {
          email: to,
        },
      ],
      subject,
      htmlContent,
      textContent: textContent || subject,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.message || `Failed to send email: ${response.statusText}`)
  }
}

export function createVotingCodeEmailTemplate(votingCode: string, appUrl?: string): string {
  const voteUrl = appUrl ? `${appUrl}/vote` : "/vote"
  const leaderboardUrl = appUrl ? `${appUrl}/leaderboard` : "/leaderboard"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Voting Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">MPS Poetry Challenge</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Your Voting Code</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">Thank You for Your Purchase! 🎉</h2>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Your payment has been successfully processed. Below is your unique voting code that you can use to cast your votes.
              </p>
              
              <!-- Voting Code Box -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="margin: 0 0 10px; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Your Voting Code</p>
                <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: 4px; font-family: 'Courier New', monospace;">${votingCode}</p>
              </div>
              
              <p style="margin: 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                <strong>What's Next?</strong>
              </p>
              
              <ul style="margin: 0 0 30px; padding-left: 20px; color: #4a4a4a; font-size: 16px; line-height: 1.8;">
                <li style="margin-bottom: 10px;">Use this code to access the voting page</li>
                <li style="margin-bottom: 10px;">Cast your votes for your favorite participants</li>
                <li style="margin-bottom: 10px;">View live leaderboard results</li>
              </ul>
              
              <!-- CTA Buttons -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0 10px 10px;">
                    <a href="${voteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Start Voting</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 0 10px;">
                    <a href="${leaderboardUrl}" style="display: inline-block; background-color: #f5f5f5; color: #667eea; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; border: 2px solid #667eea;">View Leaderboard</a>
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                  <strong>Important:</strong> Please keep this code safe and do not share it with others. Each code can only be used once for voting.
                </p>
                <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.6;">
                  If you have any questions or need assistance, please contact our support team.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background-color: #f9f9f9; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} MPS Poetry Challenge. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function createVotingCodeEmailText(votingCode: string, appUrl?: string): string {
  const voteUrl = appUrl ? `${appUrl}/vote` : "/vote"
  const leaderboardUrl = appUrl ? `${appUrl}/leaderboard` : "/leaderboard"

  return `
MPS Poetry Challenge - Your Voting Code

Thank You for Your Purchase!

Your payment has been successfully processed. Below is your unique voting code that you can use to cast your votes.

Your Voting Code: ${votingCode}

What's Next?
- Use this code to access the voting page
- Cast your votes for your favorite participants
- View live leaderboard results

Start Voting: ${voteUrl}
View Leaderboard: ${leaderboardUrl}

Important: Please keep this code safe and do not share it with others. Each code can only be used once for voting.

If you have any questions or need assistance, please contact our support team.

© ${new Date().getFullYear()} MPS Poetry Challenge. All rights reserved.
  `.trim()
}

