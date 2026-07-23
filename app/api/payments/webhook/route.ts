import { NextResponse } from "next/server"
import crypto from "crypto"

import { connectToDatabase, TicketModel } from "@/lib/mongodb"
import { sendEmail, createVotingCodeEmailTemplate, createVotingCodeEmailText } from "@/lib/brevo"

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY

export async function POST(request: Request) {
    try {
        if (!PAYSTACK_SECRET_KEY) {
            console.error("Paystack secret key not configured")
            return NextResponse.json({ error: "Paystack secret key not configured" }, { status: 500 })
        }

        const body = await request.text()
        const signature = request.headers.get("x-paystack-signature")

        if (!signature) {
            return NextResponse.json({ error: "No signature provided" }, { status: 400 })
        }

        const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex")

        if (hash !== signature) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
        }

        const event = JSON.parse(body)
        console.log("[WEBHOOK_RECEIVED]", JSON.stringify(event, null, 2))

        // Handle charge.success event
        if (event.event === "charge.success") {
            await connectToDatabase()

            // In our initialize flow, we set the reference to be the ticketId
            const reference = event.data.reference

            const ticket = await TicketModel.findById(reference)

            if (!ticket) {
                console.error(`Ticket not found for reference: ${reference}`)
                return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
            }

            // Check if ticket was already paid to avoid duplicate processing
            if (!ticket.isPaid) {
                // One code per email per round: don't grant a second code if this
                // email already has a paid ticket for the same round.
                const duplicatePaid = await TicketModel.findOne({
                    _id: { $ne: ticket._id },
                    email: ticket.email,
                    isPaid: true,
                    ...(ticket.round != null ? { round: ticket.round } : {}),
                })
                if (duplicatePaid) {
                    console.log(`Duplicate ticket for ${ticket.email} round ${ticket.round}; not granting a second code`)
                    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
                }

                // Update ticket as paid
                await TicketModel.findByIdAndUpdate(ticket._id, {
                    isPaid: true,
                    paystackReference: event.data.reference,
                    paidAt: new Date(),
                    paymentMetadata: event.data // Store full payment metadata for future reference
                })

                // Send voting code email
                try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
                    await sendEmail({
                        to: ticket.email,
                        subject: "Your MPS Media Poetry Challenge Voting Code",
                        htmlContent: createVotingCodeEmailTemplate(ticket.votingCode, appUrl),
                        textContent: createVotingCodeEmailText(ticket.votingCode, appUrl),
                    })
                    console.log(`Voting code email sent to ${ticket.email}`)
                } catch (emailError: any) {
                    console.error("[WEBHOOK_SEND_EMAIL_ERROR]", emailError)
                    // We don't return error here because payment was successful
                }
            } else {
                console.log(`Ticket ${reference} already paid, skipping update`)
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })
    } catch (error: any) {
        console.error("[WEBHOOK_ERROR]", error)
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
    }
}
