"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function VoteConfirmation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-white">MPS Media Poetry Challenge</h1>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="text-6xl mb-4">✓</div>
            <CardTitle className="text-3xl text-white">Votes Recorded!</CardTitle>
            <CardDescription className="text-lg">
              Thank you for participating in the MPS Media Poetry Challenge
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">What happens next?</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex gap-3">
                  <span className="text-green-400">✓</span>
                  <span>Your votes have been securely recorded</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400">✓</span>
                  <span>You can view live vote counts on the voting page</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400">✓</span>
                  <span>Share the voting link with friends to encourage more votes</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-green-400">✓</span>
                  <span>Results will be finalized at the end of the voting period</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center">
              <Link href="/vote">
                <Button variant="outline">View Vote Counts</Button>
              </Link>
              <Link href="/">
                <Button className="bg-blue-600 hover:bg-blue-700">Back to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
