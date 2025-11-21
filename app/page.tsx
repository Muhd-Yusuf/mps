"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Sparkles, Users, TrendingUp, Menu, X } from "lucide-react"
import { PartnersCarousel } from "@/components/partners-carousel"

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [stage, setStage] = useState("Discover Exceptional Talent")
  const [isScrolled, setIsScrolled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      // Wait for both the fetch and a minimum delay to show the animation
      const minLoaderTime = new Promise((resolve) => setTimeout(resolve, 2000))
      const fetchPromise = (async () => {
        try {
          const response = await fetch("/api/settings/stage")
          if (response.ok) {
            const data = await response.json()
            if (data.stage && data.stage !== "Not Set") {
              setStage(data.stage)
            }
          }
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
          className="w-24 h-24 md:w-32 md:h-32 animate-pulse object-contain"
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
            <h1 className="text-md md:text-2xl font-bold text-white">MPS Media Poetry Challange </h1>
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
          {/* Desktop Menu */}
          <div className="hidden sm:flex flex-wrap gap-2 sm:gap-3 justify-center">
            <Link href="/purchase">
              <Button className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group text-sm sm:text-base">
                Get Voting Ticket
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/vote">
              <Button
                variant="outline"
                className="border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
              >
                Vote Now
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                variant="outline"
                className="border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
              >
                Leaderboard
              </Button>
            </Link>
          </div>
        </div>
        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="sm:hidden bg-black/20 backdrop-blur-lg">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link href="/purchase">
                <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group text-sm sm:text-base">
                  Get Voting Ticket
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/vote">
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
                >
                  Vote Now
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button
                  variant="outline"
                  className="w-full justify-start border-white/30 hover:bg-white/10 bg-transparent text-white text-sm sm:text-base"
                >
                  Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>
      {/* Hero Section */}
      <div className="relative w-full flex items-center justify-center min-h-screen">
        {/* Small screen background */}
        <div
          className="absolute inset-0 sm:hidden bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url('https://res.cloudinary.com/doyjag1gz/image/upload/v1763512051/VOTE_1_-min_k29htv.png')` }}
        />
        {/* Larger screen background */}
        <div
          className="absolute inset-0 hidden sm:block bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url('https://res.cloudinary.com/doyjag1gz/image/upload/v1763510826/VOTE-min_fpp6di.png')` }}
        />

        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 w-full">
          <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
            <div className="inline-block mb-4 sm:mb-6 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <p className="text-sm sm:text-lg font-medium text-white">{stage}</p>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-4 sm:mb-6 leading-tight font-rubik-marker-hatch">
              VOTE FOR YOUR <span className="text-white">FAVORITE POETS</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2">
              Support talented poets competing across 5 teams. Purchase a voting ticket and help determine who advances
              to the next stage of the competition.
            </p>
            <Link href="/purchase">
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 group text-sm sm:text-base"
              >
                Get Voting Ticket
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Partners Section */}
      <PartnersCarousel />

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            {
              icon: TrendingUp,
              title: "Real-time Results",
              description:
                "See live vote counts for each participant. Share with friends to encourage more votes for your favorite poets.",
            },
            {
              icon: Users,
              title: "Fair Competition",
              description: "Coaches select top performers, and the audience votes for the remaining spot on each team.",
            },
            {
              icon: Sparkles,
              title: "Easy Voting",
              description:
                "Purchase a ticket to receive a voting code. Use your code to vote for one participant from each team.",
            },
          ].map((feature, idx) => (
            <Card
              key={idx}
              className="bg-card/50 border-border/40 backdrop-blur hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 group animate-fade-in-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg sm:text-base text-foreground">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm sm:text-base text-muted-foreground">{feature.description}</CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 sm:mt-20 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-8 sm:p-12 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Ready to Vote?</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-xl mx-auto">
            Join thousands of supporters in discovering and voting for the next generation of talented poets.
          </p>
          <Link href="/purchase">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/20 text-sm sm:text-base"
            >
              Get Your Voting Ticket Now
            </Button>
          </Link>
        </div>
      </div>
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
