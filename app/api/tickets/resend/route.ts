import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, TicketModel, SettingModel } from "@/lib/mongodb"
import { sendEmail, createVotingCodeEmailTemplate, createVotingCodeEmailText } from "@/lib/brevo"

const resendSchema = z.object({
  email: z.string().email("Enter a valid email address"),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = resendSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }

    await connectToDatabase()

    const roundSetting = await SettingModel.findOne({ key: "current_round" }).lean()
    const currentRound = roundSetting ? parseInt(roundSetting.value, 10) || 1 : 1

    const email = parsed.data.email.toLowerCase().trim()

    // Most recent paid ticket for this email in the current round (legacy
    // tickets without a round are included so old buyers aren't stranded).
    const ticket = await TicketModel.findOne({
      email,
      isPaid: true,
      $or: [{ round: currentRound }, { round: null }, { round: { $exists: false } }],
    }).sort({ paidAt: -1 })

    if (ticket) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        await sendEmail({
          to: ticket.email,
          subject: "Your MPS Media Poetry Challenge Voting Code",
          htmlContent: createVotingCodeEmailTemplate(ticket.votingCode, appUrl),
          textContent: createVotingCodeEmailText(ticket.votingCode, appUrl),
        })
      } catch (emailError) {
        console.error("[RESEND_CODE_EMAIL_ERROR]", emailError)
        return NextResponse.json({ error: "Could not send the email right now. Please try again shortly." }, { status: 500 })
      }
    }

    // Same response whether or not a ticket exists, so the endpoint can't be
    // used to probe which emails bought codes.
    return NextResponse.json({
      success: true,
      message: "If this email has a voting code for the current round, we've re-sent it. Check your inbox and spam folder.",
    })
  } catch (error: any) {
    console.error("[RESEND_CODE_ERROR]", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
