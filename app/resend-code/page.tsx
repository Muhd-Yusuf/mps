"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export default function ResendCodePage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter the email you bought your code with")
      return
    }

    try {
      setError("")
      setIsSubmitting(true)
      const response = await fetch("/api/tickets/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Failed to resend code")
      }
      setSent(true)
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/vote" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <ArrowLeft className="w-5 h-5" />
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MPS Media Poetry Challenge
            </h1>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-card/50 border-border/40 backdrop-blur shadow-2xl">
          {sent ? (
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Check Your Inbox</h3>
              <p className="text-muted-foreground mb-8">
                If <strong>{email.trim()}</strong> has a voting code for the current round, we&apos;ve re-sent
                it. Don&apos;t forget to check your spam folder.
              </p>
              <Link href="/vote">
                <Button className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20" size="lg">
                  Back to Voting
                </Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Lost Your Voting Code?
                </CardTitle>
                <CardDescription>
                  Enter the email you used when buying your code and we&apos;ll re-send it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError("")
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                  />
                </div>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Sending...
                    </>
                  ) : (
                    "Re-send My Code"
                  )}
                </Button>
                <Link href="/purchase" className="block">
                  <Button variant="outline" className="w-full bg-transparent">
                    Don&apos;t have a code? Get one now
                  </Button>
                </Link>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
