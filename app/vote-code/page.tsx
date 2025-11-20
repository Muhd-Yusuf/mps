"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Lock, AlertCircle } from "lucide-react"
import { validateVotingCode } from "@/lib/code-utils"
import { mockVotingTickets } from "@/lib/mock-data"

export default function VoteCodePage() {
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isValid, setIsValid] = useState(false)

  const handleVerifyCode = () => {
    setError("")

    if (!code.trim()) {
      setError("Please enter your voting code")
      return
    }

    if (!validateVotingCode(code)) {
      setError("Invalid code format. Code should be like MPS-2025-ABC123")
      return
    }

    const ticketExists = mockVotingTickets.some((t) => t.votingCode === code)
    if (!ticketExists) {
      setError("This code is not valid. Please check and try again.")
      return
    }

    setIsValid(true)
    localStorage.setItem("votingCode", code)
    setTimeout(() => {
      window.location.href = "/vote"
    }, 1500)
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

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 animate-fade-in-up">
          <h2 className="text-4xl font-bold text-foreground mb-3">Enter Your Voting Code</h2>
          <p className="text-muted-foreground text-lg">You received this code when you purchased your voting ticket</p>
        </div>

        <Card className="bg-card/50 border-border/40 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Verify Your Code
            </CardTitle>
            <CardDescription>Enter your voting code to access the voting platform</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isValid ? (
              <div className="bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/40 rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">✓</div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Code Verified!</h3>
                <p className="text-muted-foreground">Redirecting to voting page...</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-3">Voting Code</label>
                  <Input
                    placeholder="MPS-2025-ABC123"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase())
                      setError("")
                    }}
                    className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors text-lg tracking-widest text-center font-mono"
                    disabled={isValid}
                  />
                  <p className="text-xs text-muted-foreground mt-2">Check your email or your ticket confirmation</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {/* Demo Codes */}
                <div className="bg-secondary/50 border border-border/40 rounded-lg p-4">
                  <p className="text-xs font-semibold text-foreground mb-3 uppercase tracking-widest">
                    Demo Codes (for testing)
                  </p>
                  <div className="space-y-2">
                    {mockVotingTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => {
                          setCode(ticket.votingCode)
                          setError("")
                        }}
                        className="w-full text-left px-3 py-2 rounded border border-primary/20 hover:bg-primary/10 transition-colors text-sm font-mono text-muted-foreground hover:text-foreground"
                      >
                        {ticket.votingCode}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleVerifyCode}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group"
                  size="lg"
                >
                  <Lock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  Verify Code & Vote
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
