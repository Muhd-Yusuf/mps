"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Menu, X, Mic, Swords, Flame, Trophy, Users, MapPin, Ticket, Vote, Megaphone, ClipboardCheck, Star } from "lucide-react"

import { getPreset } from "@/lib/stages"
import { countdownParts, formatCountdown } from "@/lib/countdown"
// import { PartnersCarousel } from "@/components/partners-carousel"

// The competition journey, straight from the Official Contestants' Manual.
const JOURNEY = [
  {
    icon: ClipboardCheck,
    title: "Screening",
    body: "Applications reviewed — at least 80 poets selected per subregion.",
    publicVote: false,
  },
  {
    icon: Mic,
    title: "Blind Audition",
    body: "Poets perform unseen; coaches judge by voice alone. Unpicked poets enter the Danger Zone — your vote revives up to 6.",
    publicVote: true,
  },
  {
    icon: Swords,
    title: "Battle Round",
    body: "Head-to-head duets within each team. Losing poets can be Saved, Stolen — or revived by 5 audience votes.",
    publicVote: true,
  },
  {
    icon: Star,
    title: "Knockout Stage",
    body: "Solo original poems. Judges pick their qualifiers, and the audience votes 4 more poets into the Regional Finals.",
    publicVote: true,
  },
  {
    icon: Users,
    title: "Quarter Final — Abuja",
    body: "42 poets, 5 new teams, new coaches. The audience advances the top 2 poets from every team.",
    publicVote: true,
  },
  {
    icon: Flame,
    title: "Semi Final",
    body: "Judges save one poet per team. The rest face the Danger Zone — your vote saves one more from each team.",
    publicVote: true,
  },
  {
    icon: Trophy,
    title: "Grand Finale",
    body: "10 finalists. 100% judges' scores. One Grand Champion — the Arewa Poet of the Year.",
    publicVote: false,
  },
]

const EVENTS = [
  { region: "North-East", city: "Bauchi", month: "August 2026" },
  { region: "North-West", city: "Kaduna", month: "September 2026" },
  { region: "North-Central", city: "Nasarawa", month: "October 2026" },
  { region: "Regional Finals", city: "Abuja", month: "November 2026" },
]

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [stage, setStage] = useState("Discover Exceptional Talent")
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [votingStart, setVotingStart] = useState<Date | null>(null)
  const [votingDeadline, setVotingDeadline] = useState<Date | null>(null)
  // Whether anything is actually votable right now (open team / flagged poet).
  const [votable, setVotable] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  // Tick every second while a schedule exists so the hero countdown stays live.
  useEffect(() => {
    if (!votingStart && !votingDeadline) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [votingStart, votingDeadline])

  const startPending = votingStart ? now < votingStart.getTime() : false
  const deadlinePassed = votingDeadline ? now > votingDeadline.getTime() : false
  const votingLive = !startPending && !deadlinePassed && votable && (votingStart || votingDeadline)
  // Code sales mirror the voting window exactly: nothing sellable before the
  // scheduled start, after the close, or when nothing is set up to vote on.
  const purchasable = !deadlinePassed && !startPending && votable

  useEffect(() => {
    const init = async () => {
      // Wait for both the fetch and a minimum delay to show the animation
      const minLoaderTime = new Promise((resolve) => setTimeout(resolve, 2000))
      const fetchPromise = (async () => {
        try {
          // The banner always reflects the LIVE competition stage. The manual
          // banner text is only a fallback for the general Team Voting preset.
          const [presetRes, stageRes, startRes, deadlineRes, teamsRes] = await Promise.all([
            fetch("/api/settings/preset"),
            fetch("/api/settings/stage"),
            fetch("/api/settings/start"),
            fetch("/api/settings/deadline"),
            fetch("/api/teams", { cache: "no-store" }),
          ])
          if (startRes.ok) {
            const startData = await startRes.json()
            const parsedStart = startData?.start ? new Date(startData.start) : null
            setVotingStart(parsedStart && !Number.isNaN(parsedStart.getTime()) ? parsedStart : null)
          }
          if (deadlineRes.ok) {
            const deadlineData = await deadlineRes.json()
            const parsedDeadline = deadlineData?.deadline ? new Date(deadlineData.deadline) : null
            setVotingDeadline(parsedDeadline && !Number.isNaN(parsedDeadline.getTime()) ? parsedDeadline : null)
          }
          let label = ""
          let presetMode: "teams" | "danger" = "teams"
          if (presetRes.ok) {
            const preset = getPreset((await presetRes.json()).preset)
            label = preset.publicLabel
            presetMode = preset.mode
          }
          if (teamsRes.ok) {
            const allTeams = (await teamsRes.json())?.teams ?? []
            setVotable(
              presetMode === "danger"
                ? allTeams.some((t: any) => t.participants?.some((p: any) => p.inDanger))
                : allTeams.some((t: any) => t.votingOpen)
            )
          }
          if (!label && stageRes.ok) {
            const data = await stageRes.json()
            if (data.stage && data.stage !== "Not Set") {
              label = data.stage
            }
          }
          if (label) setStage(label)
        } catch (error) {
          console.error("Failed to fetch stage:", error)
        }
      })()

      await Promise.all([minLoaderTime, fetchPromise])
      setIsLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <img
          src="https://res.cloudinary.com/doyjag1gz/image/upload/v1763647363/4_chleoz.png"
          alt="Loading..."
          className="w-20 h-20 md:w-32 md:h-32 animate-pulse object-contain"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 border-b z-50 transition-colors duration-300 ${isScrolled
          ? "bg-transparent border-white/20 backdrop-blur-sm"
          : "bg-transparent border-white/20 backdrop-blur-xs"
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              src="https://res.cloudinary.com/doyjag1gz/image/upload/v1763647363/4_chleoz.png"
              alt="MPS Media Poetry Logo"
              className="w-10 h-10 rounded-lg object-cover"
            />
            <h1 className="text-md md:text-2xl font-bold text-white">MPS Media Poetry Challenge</h1>
          </div>
          {/* Mobile Menu Button */}
          <div className="sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-white hover:bg-white/10"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
          {/* Desktop Menu — buttons follow the voting state */}
          <div className="hidden sm:flex flex-wrap gap-2 sm:gap-3 justify-center">
            {purchasable && (
              <Link href="/purchase">
                <Button className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group text-sm sm:text-base">
                  Buy Voting Code
                  <ArrowRight className="ml-2 w-8 h-8 font-extrabold group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            )}
            {!deadlinePassed && votable && (
              <Link href="/vote">
                <Button
                  variant="outline"
                  className="border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
                >
                  Vote Now
                </Button>
              </Link>
            )}
            {deadlinePassed && (
              <Button disabled variant="outline" className="border-white/30 bg-transparent text-white/60 text-sm sm:text-base cursor-not-allowed">
                Voting Closed
              </Button>
            )}
          </div>
        </div>
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="sm:hidden bg-black/20 backdrop-blur-lg">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {purchasable && (
                <Link href="/purchase">
                  <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group text-sm sm:text-base">
                    Buy Voting Code
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
              {!deadlinePassed && votable && (
                <Link href="/vote">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
                  >
                    Vote Now
                  </Button>
                </Link>
              )}
              {deadlinePassed && (
                <Button disabled variant="outline" className="w-full justify-start border-white/30 bg-transparent text-white/60 text-sm sm:text-base cursor-not-allowed">
                  Voting Closed
                </Button>
              )}
            </div>
          </div>
        )}
      </nav>
      {/* Hero Section */}
      <div className="relative w-full flex items-center justify-center min-h-screen">
        {/* MPS Media logo background */}
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url('https://res.cloudinary.com/doyjag1gz/image/upload/v1763647363/4_chleoz.png')` }}
        />

        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
            <div className="inline-block mb-4 sm:mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <p className="text-sm sm:text-lg font-medium text-white">{stage}</p>
            </div>

            {/* Voting-window countdown, driven by the admin's schedule */}
            {startPending && votingStart && (
              <div className="mb-6 sm:mb-8">
                <p className="text-white/90 text-base sm:text-xl font-semibold mb-3 uppercase tracking-widest">
                  Voting starts in
                </p>
                <div className="flex justify-center gap-2 sm:gap-4">
                  {(() => {
                    const parts = countdownParts(votingStart.getTime() - now)
                    const blocks = [
                      ...(parts.days > 0 ? [{ value: parts.days, label: "Days" }] : []),
                      { value: parts.hours, label: "Hours" },
                      { value: parts.minutes, label: "Minutes" },
                      { value: parts.seconds, label: "Seconds" },
                    ]
                    return blocks.map((block) => (
                      <div
                        key={block.label}
                        className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 min-w-[70px] sm:min-w-[100px]"
                      >
                        <p className="text-3xl sm:text-5xl font-extrabold text-white tabular-nums">
                          {String(block.value).padStart(2, "0")}
                        </p>
                        <p className="text-[10px] sm:text-xs font-semibold text-white/70 uppercase tracking-widest mt-1">
                          {block.label}
                        </p>
                      </div>
                    ))
                  })()}
                </div>
                <p className="text-white/70 text-sm sm:text-base mt-4">
                  Code sales and voting open when the countdown ends.
                </p>
              </div>
            )}

            {votingLive && (
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-400/40">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                  <p className="text-sm sm:text-lg font-bold text-white">Voting is LIVE</p>
                  {votingDeadline && (
                    <p className="text-xs sm:text-sm text-white/80">
                      · closes in {formatCountdown(votingDeadline.getTime() - now)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {deadlinePassed && (
              <div className="mb-6 sm:mb-8">
                <div className="inline-block px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                  <p className="text-sm sm:text-lg font-semibold text-white">Voting has closed for this stage</p>
                </div>
              </div>
            )}

            <br />
            {/* THE one call-to-action for the whole page. Buying is always the
                primary action while sales are open (Paystack); voting happens
                via the nav's Vote Now. Closed state blocks everything. */}
            {deadlinePassed ? (
              <Button
                size="lg"
                disabled
                className="bg-white/20 text-white font-bold p-10 text-2xl md:text-4xl cursor-not-allowed"
              >
                Voting Closed
              </Button>
            ) : purchasable ? (
              <div className="flex flex-col items-center gap-4">
                <Link href="/purchase">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group font-bold p-10 text-2xl md:text-4xl"
                  >
                    Buy Voting Code
                    <ArrowRight className="ml-2 w-10 h-10 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                {votable && !startPending && (
                  <Link href="/vote">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white/50 hover:bg-white/10 bg-transparent text-white font-semibold text-lg sm:text-xl px-8 py-6"
                    >
                      Already have a code? Vote Now →
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Button
                size="lg"
                disabled
                className="bg-white/20 text-white font-bold p-10 text-2xl md:text-4xl cursor-not-allowed"
              >
                Voting Opens Soon
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* The Journey — stage-by-stage, from the Contestants' Manual */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">The Journey</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From over 240 poets across Arewa to one Grand Champion. Seven stages — and at five of them,
              <strong> your vote decides who stays</strong>.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {JOURNEY.map((stage, index) => (
              <Card key={stage.title} className="bg-white border-border/40 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <stage.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">STAGE {index + 1}</span>
                  </div>
                  <CardTitle className="text-lg pt-2">{stage.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{stage.body}</p>
                  {stage.publicVote && (
                    <span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-primary">
                      <Vote className="w-3.5 h-3.5" /> Public voting stage
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Motto card completes the grid — the single CTA lives in the hero */}
            <Card className="bg-gradient-to-br from-primary to-accent border-0 flex flex-col justify-center">
              <CardContent className="py-8 text-center">
                <p className="text-white font-bold text-xl">Your vote writes the story.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Subregions & key dates */}
      <section className="py-16 bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Three Subregions. One Stage in Abuja.</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The 2026 Arewa Edition tours the North before the champions converge at the Regional Finals.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EVENTS.map((event) => (
              <Card key={event.region} className="bg-white border-border/40 text-center">
                <CardContent className="py-6">
                  <MapPin className="w-6 h-6 mx-auto mb-3 text-primary" />
                  <p className="font-bold text-foreground">{event.region}</p>
                  <p className="text-sm text-muted-foreground">{event.city}</p>
                  <p className="text-sm font-semibold text-primary mt-2">{event.month}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How voting works */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">How Voting Works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Ticket,
                title: "1. Get Your Code",
                body: "Buy a voting code — it's delivered instantly to your email.",
              },
              {
                icon: Vote,
                title: "2. Cast Your Vote",
                body: "Enter your code and pick the one poet you want to keep in the competition.",
              },
              {
                icon: Megaphone,
                title: "3. Results Announced",
                body: "MPS Media announces who advances at the live event. Every vote counts.",
              },
            ].map((step) => (
              <Card key={step.title} className="bg-white border-border/40 text-center">
                <CardContent className="py-8">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="font-bold text-foreground mb-2">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-primary font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Ready? Scroll up to get your voting code ↑
            </button>
          </div>
        </div>
      </section>

      {/* Partners Section — hidden for now */}
      {/* <PartnersCarousel /> */}


      <footer className="py-8 text-center text-muted-foreground">
        <p>
          Developed by{" "}
          <a
            href="https://sydatech.com.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Sydatech
          </a>
        </p>
      </footer>
    </div>
  )
}
