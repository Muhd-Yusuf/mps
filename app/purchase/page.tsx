"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Lock } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const TICKET_PRICE = 2000

export default function PurchasePage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState("")

  const handlePayment = async () => {
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address")
      return
    }

    try {
      setIsProcessing(true)
      setError("")

      // Initialize payment on backend
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          amount: TICKET_PRICE,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error ?? "Failed to initialize payment")
      }

      const data = await response.json()

      // Redirect to Paystack payment page
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        throw new Error("Payment initialization failed")
      }
    } catch (error: any) {
      setError(error?.message ?? "Failed to initialize payment. Please try again.")
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
            <h1 className="text-md md:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MPS Media Poetry Challenge
            </h1>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 animate-fade-in-up">
          <h2 className="text-3xl font-extrabold text-foreground mb-3">GET YOUR VOTING CODE</h2>
          <p className="text-muted-foreground text-lg">Purchase a ticket to receive your unique voting code</p>
        </div>

        <Card className="bg-white border-border/40 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Secure Payment
            </CardTitle>
            <CardDescription>Complete your purchase to get voting access</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">Email Address</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError("")
                }}
                className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                disabled={isProcessing}
              />
              <p className="text-xs text-muted-foreground mt-2">Your voting code will be sent to this email</p>
            </div>

            {/* Pricing */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-6">
              <h4 className="font-semibold text-foreground mb-4">Package Details</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voting Access</span>
                  <span className="font-medium text-foreground">₦{TICKET_PRICE.toLocaleString()}.00</span>
                </div>
                <div className="flex justify-between border-t border-primary/20 pt-3">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    ₦{TICKET_PRICE.toLocaleString()}.00
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {/* Payment Button */}
            <Button
              onClick={handlePayment}
              disabled={isProcessing || !email.trim()}
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50 transition-all duration-300 group"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  Pay with Paystack - ₦{TICKET_PRICE.toLocaleString()}.00
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Secure payment powered by Paystack. Your payment information is encrypted and secure.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
