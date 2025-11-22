"use client"

import { useState } from "react"
import type { VoteSelection } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { X, CheckCircle, Lock } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

interface CheckoutModalProps {
  email: string
  selections: VoteSelection
  onClose: () => void
}

export default function CheckoutModal({ email, selections, onClose }: CheckoutModalProps) {
  const [cardNumber, setCardNumber] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [cvv, setCvv] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const handlePayment = async () => {
    if (!cardNumber || !expiryDate || !cvv) {
      alert("Please fill in all payment details")
      return
    }

    setIsProcessing(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsProcessing(false)
    setPaymentSuccess(true)

    setTimeout(() => {
      onClose()
      window.location.href = "/vote-confirmation"
    }, 3000)
  }

  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
        <Card className="bg-card/95 border-border/40 backdrop-blur w-full max-w-md shadow-2xl">
          <CardContent className="pt-12 text-center pb-12">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center animate-pulse-glow">
                <CheckCircle className="w-8 h-8 text-accent-foreground" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-3">Payment Successful!</h3>
            <p className="text-muted-foreground mb-2">Your votes have been recorded.</p>
            <p className="text-sm text-muted-foreground">Redirecting...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-up">
      <Card className="bg-card/95 border-border/40 backdrop-blur w-full max-w-md shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Complete Payment
            </CardTitle>
            <CardDescription>Secure checkout</CardDescription>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-primary/10 rounded-lg"
          >
            <X size={20} />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Order Summary */}
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-5">
            <h4 className="font-semibold text-foreground mb-4">Order Summary</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Voting Code (5 teams)</span>
                <span className="font-medium text-foreground">₦2,000.00</span>
              </div>
              <div className="border-t border-primary/20 pt-3 mt-3 flex justify-between font-semibold text-foreground">
                <span>Total</span>
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">₦2,000.00</span>
              </div>
            </div>
          </div>

          {/* Email Display */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">Email</label>
            <div className="bg-input border border-border/40 rounded-lg px-4 py-3 text-foreground font-medium">
              {email}
            </div>
          </div>

          {/* Card Details */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-3">Card Number</label>
            <Input
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
              className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">Expiry Date</label>
              <Input
                placeholder="MM/YY"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">CVV</label>
              <Input
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Payment Button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
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
                Pay ₦2,000.00
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            This is a demo. Use card 4242 4242 4242 4242 for testing.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
