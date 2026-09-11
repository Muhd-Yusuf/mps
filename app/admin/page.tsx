"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LogOut, Lock, BarChart3, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useSession, signIn, signOut } from "next-auth/react"

import type { Participant, Team, Ticket } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import AdminTeamManager from "@/components/admin-team-manager"
import AdminVotingResults from "@/components/admin-voting-results"
import AdminCharts from "@/components/admin-charts"
import AdminStageManager from "@/components/admin-stage-manager"
import AdminRevenue from "@/components/admin-revenue"
import AdminSettings from "@/components/admin-settings"
import AdminReport from "@/components/admin-report"
import AdminVoterLog from "@/components/admin-voter-log"
import AdminRegionSwitcher from "@/components/admin-region-switcher"
import type { Region } from "@/lib/regions"

const statsIcons = ["📊", "👥", "🎤", "📈"] as const

type TeamWithParticipants = Team & { participants: Participant[] }

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [password, setPassword] = useState("")
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  // Login is two-step whenever an OTP email is configured in Settings:
  // password → emailed 6-digit code. With no address stored, step 1 signs in
  // directly and the code screen is never shown.
  const [loginStep, setLoginStep] = useState<"password" | "otp">("password")
  const [otp, setOtp] = useState("")
  const [otpSentTo, setOtpSentTo] = useState("")
  const [resendIn, setResendIn] = useState(0)

  const [teams, setTeams] = useState<TeamWithParticipants[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [codesSold, setCodesSold] = useState(0)
  const [codesUsed, setCodesUsed] = useState(0)

  // Which regional edition the dashboard is reporting on. Defaults to the live
  // one; "all" gives season totals. Purely a view filter — see the Settings tab
  // to change what the audience is actually voting in.
  const [regions, setRegions] = useState<Region[]>([])
  const [activeRegion, setActiveRegion] = useState("")
  const [viewRegion, setViewRegion] = useState("")

  const isAuthenticated = status === "authenticated"
  const isLoadingAuth = status === "loading"

  // Tick down the resend cooldown so the button re-enables on its own.
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const completeSignIn = useCallback(
    async (code?: string) => {
      const result = await signIn("credentials", {
        password,
        otp: code ?? "",
        redirect: false,
      })

      if (result?.error) {
        toast.error("Access Denied", {
          description: code ? "That code is wrong or has expired" : "Incorrect password",
        })
        return false
      }

      toast.success("Success", { description: "Logged in successfully" })
      return true
    },
    [password]
  )

  // Step 1 — check the password server-side and, if OTP is configured, send the
  // code. The code is only ever mailed; it never comes back in this response.
  const handleLogin = async () => {
    if (!password) return

    setIsLoginLoading(true)
    try {
      const response = await fetch("/api/admin/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error("Access Denied", { description: data?.error || "Incorrect password" })
        return
      }

      if (!data?.otpRequired) {
        await completeSignIn()
        return
      }

      setOtpSentTo(data.sentTo ?? "your email")
      setLoginStep("otp")
      setResendIn(data.cooldown ?? 60)
      toast.success("Verification required", { description: data.message })
    } catch (error) {
      toast.error("Error", {
        description: "Something went wrong during login",
      })
    } finally {
      setIsLoginLoading(false)
    }
  }

  // Step 2 — password + code are re-checked together inside NextAuth's
  // authorize(), so a code alone can never create a session.
  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your email")
      return
    }
    setIsLoginLoading(true)
    try {
      const ok = await completeSignIn(otp.trim())
      if (!ok) setOtp("")
    } catch (error) {
      toast.error("Error", { description: "Something went wrong during login" })
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (resendIn > 0) return
    setIsLoginLoading(true)
    try {
      const response = await fetch("/api/admin/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error("Could not resend", { description: data?.error || "Try again shortly" })
        return
      }
      setResendIn(data.cooldown ?? 60)
      toast.success("Code sent", { description: data.message })
    } catch (error) {
      toast.error("Could not resend", { description: "Try again shortly" })
    } finally {
      setIsLoginLoading(false)
    }
  }

  const resetLogin = () => {
    setLoginStep("password")
    setOtp("")
    setOtpSentTo("")
  }

  const fetchTeams = useCallback(async () => {
    if (!viewRegion) return
    try {
      setIsLoadingTeams(true)
      setTeamsError(null)
      // One automatic retry: serverless cold starts occasionally time out the
      // first request — don't surface an error for a self-healing blip.
      const url = `/api/teams?region=${encodeURIComponent(viewRegion)}`
      let response = await fetch(url, { cache: "no-store" }).catch(() => null)
      if (!response || !response.ok) {
        await new Promise((r) => setTimeout(r, 1500))
        response = await fetch(url, { cache: "no-store" })
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to fetch teams")
      }
      const data = await response.json()
      const normalized = (data?.teams ?? []).map((team: TeamWithParticipants) => ({
        ...team,
        participants: team.participants ?? [],
      }))
      setTeams(normalized)
    } catch (error: any) {
      setTeamsError(error?.message ?? "Unable to fetch teams")
      toast.error("Failed to load teams", {
        description: error?.message ?? "Please check your database connection.",
      })
    } finally {
      setIsLoadingTeams(false)
    }
  }, [viewRegion])

  // Load the edition list once signed in, and start on the live one.
  useEffect(() => {
    if (!isAuthenticated) return
    fetch("/api/regions", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return
        setRegions(data.regions ?? [])
        setActiveRegion(data.active ?? "")
        setViewRegion((current) => current || data.active || "")
      })
      .catch(() => toast.error("Could not load the region list"))
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      fetchTeams()
    } else {
      setTeams([])
      setTeamsError(null)
    }
  }, [isAuthenticated, fetchTeams])

  useEffect(() => {
    if (!isAuthenticated) {
      setTotalRevenue(0)
      return
    }
    if (!viewRegion) return
    const fetchRevenue = async () => {
      try {
        const response = await fetch(`/api/payments?region=${encodeURIComponent(viewRegion)}`, {
          cache: "no-store",
        })
        if (!response.ok) {
          console.error("Failed to fetch revenue data")
          return
        }
        const data = await response.json()
        const tickets: Ticket[] = data?.tickets ?? []
        const revenue = tickets.reduce((sum, ticket) => sum + ticket.amount, 0)
        setTotalRevenue(revenue)
        setCodesSold(tickets.length)
        setCodesUsed(tickets.filter((t) => t.hasVoted).length)
      } catch (error) {
        console.error("Error fetching revenue:", error)
      }
    }
    fetchRevenue()
  }, [isAuthenticated, viewRegion])

  const totalParticipants = useMemo(
    () => teams.reduce((sum, team) => sum + (team.participants?.length ?? 0), 0),
    [teams]
  )
  const totalVotes = useMemo(
    () =>
      teams.reduce(
        (sum, team) => sum + (team.participants ?? []).reduce((inner, participant) => inner + (participant.votes ?? 0), 0),
        0
      ),
    [teams]
  )

  const formattedTotalRevenue = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalRevenue)

  const stats = [
    { label: viewRegion === "all" ? "Total Votes (all regions)" : "Total Votes", value: totalVotes },
    { label: "Teams", value: teams.length },
    { label: "Poets", value: totalParticipants },
    {
      label: "Total Revenue",
      value: formattedTotalRevenue,
      // Sold vs used explains why revenue ≠ votes × price: some buyers
      // haven't cast their vote yet.
      note: `${codesSold} codes sold · ${codesUsed} used to vote`,
    },
  ]

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
        <Card className="bg-white border-border/40 backdrop-blur w-full max-w-md shadow-2xl animate-fade-in-up">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4">
              {loginStep === "otp" ? (
                <ShieldCheck className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Lock className="w-6 h-6 text-primary-foreground" />
              )}
            </div>
            <CardTitle className="text-foreground">
              {loginStep === "otp" ? "Verify It's You" : "Admin Login"}
            </CardTitle>
            <CardDescription>
              {loginStep === "otp"
                ? `Enter the 6-digit code sent to ${otpSentTo}`
                : "Enter admin password to access the dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loginStep === "password" ? (
              <>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
                />
                <Button
                  onClick={handleLogin}
                  disabled={isLoginLoading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                >
                  {isLoginLoading ? <Spinner size="sm" className="mr-2" /> : null}
                  Login
                </Button>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="bg-input border-border/40 text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-colors text-center text-2xl tracking-[0.5em] font-mono"
                />
                <Button
                  onClick={handleVerifyOtp}
                  disabled={isLoginLoading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                >
                  {isLoginLoading ? <Spinner size="sm" className="mr-2" /> : null}
                  Verify & Login
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={resetLogin}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendIn > 0 || isLoginLoading}
                    className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  The code expires in 10 minutes. Check your spam folder if it hasn&apos;t arrived.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {regions.length > 0 && (
              <AdminRegionSwitcher
                regions={regions}
                value={viewRegion}
                onChange={setViewRegion}
                activeRegion={activeRegion}
                disabled={isLoadingTeams}
              />
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchTeams}
              className="border-border/40 hover:bg-primary/10"
              disabled={isLoadingTeams}
            >
              {isLoadingTeams ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  <span className="hidden sm:inline">Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="border-border/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card
              key={stat.label}
              className="bg-white border-border/40 backdrop-blur hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 group animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {stat.value ?? 0}
                  </div>
                  <div className="text-3xl mb-1">{statsIcons[index]}</div>
                </div>
                {"note" in stat && stat.note && (
                  <p className="mt-2 text-xs text-muted-foreground">{stat.note}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {teamsError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {teamsError}. You can retry with the refresh button above.
          </div>
        )}

        <AdminReport region={viewRegion} />

        <Tabs defaultValue="results" className="space-y-6 w-full">
          <div className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
              <TabsTrigger value="results" className="data-[state=active]:bg-primary/20">
                Voting Results
              </TabsTrigger>
              <TabsTrigger value="charts" className="data-[state=active]:bg-primary/20">
                Charts & Analytics
              </TabsTrigger>
              <TabsTrigger value="teams" className="data-[state=active]:bg-primary/20">
                Teams & Poets
              </TabsTrigger>
              <TabsTrigger value="voters" className="data-[state=active]:bg-primary/20">
                Voter Log
              </TabsTrigger>
              <TabsTrigger value="revenue" className="data-[state=active]:bg-primary/20">
                Revenue
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary/20">
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="results" className="animate-fade-in-up">
            <AdminStageManager region={viewRegion} />
            <AdminVotingResults teams={teams} isLoading={isLoadingTeams} region={viewRegion} />
          </TabsContent>

          <TabsContent value="charts" className="animate-fade-in-up">
            <AdminCharts teams={teams} isLoading={isLoadingTeams} />
          </TabsContent>

          <TabsContent value="teams" className="animate-fade-in-up">
            <AdminTeamManager teams={teams} isLoading={isLoadingTeams} region={viewRegion} onRefresh={fetchTeams} />
          </TabsContent>
          <TabsContent value="voters" className="animate-fade-in-up">
            <AdminVoterLog region={viewRegion} />
          </TabsContent>
          <TabsContent value="revenue" className="animate-fade-in-up">
            <AdminRevenue region={viewRegion} />
          </TabsContent>
          <TabsContent value="settings" className="animate-fade-in-up">
            <AdminSettings
              region={viewRegion}
              regions={regions}
              activeRegion={activeRegion}
              onActiveRegionChange={setActiveRegion}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
