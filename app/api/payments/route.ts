import { NextResponse } from "next/server"
import { connectToDatabase, TicketModel } from "@/lib/mongodb"

function serializeTicket(ticket: any) {
  return {
    id: ticket._id.toString(),
    email: ticket.email,
    votingCode: ticket.votingCode,
    amount: ticket.amount,
    isPaid: ticket.isPaid,
    paystackReference: ticket.paystackReference,
    hasVoted: ticket.hasVoted,
    createdAt: ticket.createdAt?.toISOString?.() ?? ticket.createdAt,
    updatedAt: ticket.updatedAt?.toISOString?.() ?? ticket.updatedAt,
  }
}

export async function GET() {
  try {
    await connectToDatabase()
    const tickets = await TicketModel.find({ isPaid: true }).sort({ createdAt: -1 }).lean()

    return NextResponse.json({ tickets: tickets.map(serializeTicket) })
  } catch (error) {
    console.error("[GET_PAYMENTS_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 })
  }
}
