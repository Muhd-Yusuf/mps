"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react"
import { LoadingSpinner } from "@/components/ui/spinner"

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [ticket, setTicket] = useState<any>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const verifyPayment = async () => {
      const reference = searchParams.get("reference")
      const ticketId = searchParams.get("ticketId")

      if (!reference || !ticketId) {
        setStatus("error")
        setError("Missing payment reference")
        return
      }

      try {
        const response = await fetch(`/api/payments/verify?reference=${reference}`)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData?.error ?? "Payment verification failed")
        }

        const data = await response.json()
        setTicket(data.ticket)
        setStatus("success")

        // Store voting code in localStorage
        if (data.ticket?.votingCode) {
          localStorage.setItem("votingCode", data.ticket.votingCode)
        }
      } catch (error: any) {
        setStatus("error")
        setError(error?.message ?? "Failed to verify payment")
      }
    }

    verifyPayment()
  }, [searchParams])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center">
        <Card className="bg-white border-border/40 backdrop-blur shadow-2xl max-w-md w-full mx-4">
          <CardContent className="pt-12 pb-12">
            <LoadingSpinner size="xl" text="Verifying your payment..." />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
        <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
              <ArrowLeft className="w-5 h-5" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                MPS Poetry Challenge
              </h1>
            </Link>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Card className="bg-white border-border/40 backdrop-blur shadow-2xl">
            <CardContent className="pt-12 pb-12 text-center">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-2xl font-bold text-foreground mb-2">Payment Verification Failed</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <div className="flex gap-4 justify-center">
                <Link href="/purchase">
                  <Button>Try Again</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline">Back to Home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MPS Poetry Challenge
            </h1>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-white border-border/40 backdrop-blur shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center animate-pulse-glow">
                <CheckCircle className="w-10 h-10 text-accent-foreground" />
              </div>
            </div>
            <CardTitle className="text-4xl text-foreground">Payment Successful!</CardTitle>
            <CardDescription className="text-lg mt-2">Your voting code has been purchased</CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Voting Code Display */}
            {ticket?.votingCode && (
              <div className="bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/40 rounded-2xl p-8 text-center">
                <p className="text-muted-foreground text-sm uppercase tracking-widest mb-3">Your Voting Code</p>
                <div className="text-5xl font-bold tracking-wider text-foreground font-mono mb-4 p-4 bg-background/50 rounded-xl border border-primary/20">
                  {ticket.votingCode}
                </div>
                <p className="text-muted-foreground text-sm">Use this code to vote and view leaderboard. Save it safely!</p>
              </div>
            )}

            {/* Email Confirmation */}
            {ticket?.email && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
                <p className="text-foreground font-semibold mb-2">Email Confirmation</p>
                <p className="text-muted-foreground text-sm">
                  Your voting code has been sent to <span className="font-mono font-bold text-foreground">{ticket.email}</span>
                </p>
              </div>
            )}

            {/* Order Summary */}
            <div className="space-y-3">
              <div className="flex justify-between text-muted-foreground">
                <span>Voting Code (5 Teams)</span>
                <span>₦{ticket?.amount?.toLocaleString() || "2,000"}.00</span>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-3">
                <span className="font-semibold text-foreground">Total Paid</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  ₦{ticket?.amount?.toLocaleString() || "2,000"}.00
                </span>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-secondary/50 border border-border/40 rounded-xl p-6 space-y-4">
              <h4 className="font-semibold text-foreground">What's Next?</h4>
              <ol className="space-y-3 text-muted-foreground text-sm">
                <li className="flex gap-3">
                  <span className="font-bold text-primary">1.</span>
                  <span>Copy your voting code or check your email</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary">2.</span>
                  <span>Go to the voting page and enter your code</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary">3.</span>
                  <span>Select one participant from each of the teams</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-primary">4.</span>
                  <span>View live vote counts on the leaderboard</span>
                </li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-col sm:flex-row">
              <Link href="/vote" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20" size="lg">
                  Enter Code & Vote
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent" size="lg">
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyPurchasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center">
        <Card className="bg-white border-border/40 backdrop-blur shadow-2xl max-w-md w-full mx-4">
          <CardContent className="pt-12 pb-12">
            <LoadingSpinner size="xl" text="Loading..." />
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}

