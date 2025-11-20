import { NextResponse } from "next/server"
import { z } from "zod"

import { connectToDatabase, TicketModel } from "@/lib/mongodb"
import { validateVotingCode } from "@/lib/code-utils"

const verifySchema = z.object({
  code: z.string().min(1, "Voting code is required"),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = verifySchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (!validateVotingCode(parsed.data.code)) {
      return NextResponse.json({ error: "Invalid voting code format" }, { status: 400 })
    }

    await connectToDatabase()

    const ticket = await TicketModel.findOne({
      votingCode: parsed.data.code.toUpperCase().trim(),
    })

    if (!ticket) {
      return NextResponse.json({ error: "Voting code not found" }, { status: 404 })
    }

    if (!ticket.isPaid) {
      return NextResponse.json({ error: "Ticket payment not completed" }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      ticket: {
        id: ticket._id.toString(),
        email: ticket.email,
        votingCode: ticket.votingCode,
        isPaid: ticket.isPaid,
        hasVoted: ticket.hasVoted,
      },
    })
  } catch (error: any) {
    console.error("[VERIFY_CODE_ERROR]", error)
    return NextResponse.json({ error: error?.message ?? "Failed to verify code" }, { status: 500 })
  }
}

