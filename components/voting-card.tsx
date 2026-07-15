"use client"

import type { Participant } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"
import Image from "next/image"

interface VotingCardProps {
  participant: Participant
  isSelected: boolean
  onSelect: () => void
  teamColor: string
}

export default function VotingCard({ participant, isSelected, onSelect, teamColor }: VotingCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-300 border group overflow-hidden rounded-xl ${
        isSelected
          ? "border-accent bg-accent/10 shadow-lg shadow-accent/20"
          : "border-border/50 bg-white hover:bg-muted/30 hover:shadow-md hover:-translate-y-0.5"
      }`}
      onClick={onSelect}
    >
      {/* Slim team-color accent strip ties the participant to its team */}
      <div className="h-1 w-full" style={{ backgroundColor: teamColor }} />
      <div className="p-4 sm:p-5 relative">
        {/* Background accent */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity"
          style={{ backgroundColor: teamColor }}
        />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/20">
                <Image
                  src={participant.image || "/placeholder.svg"}
                  alt={participant.name}
                  fill
                  className="object-cover"
                />
              </div>
              <h4 className="font-semibold text-foreground text-lg">{participant.name}</h4>
            </div>
            <div className="w-3 h-3 rounded-full flex-shrink-0 ml-2 shadow-md" style={{ backgroundColor: teamColor }} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className={`w-4 h-4 ${isSelected ? "fill-accent text-accent" : "text-muted-foreground"}`} />
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {participant.votes}
                </span>
                <span className="text-muted-foreground ml-1 text-sm">votes</span>
              </div>
            </div>
            <Button
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
              }}
              className={`transition-all duration-300 ${
                isSelected
                  ? "bg-gradient-to-r from-accent to-primary hover:shadow-lg hover:shadow-accent/30"
                  : "border-border/40 hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              {isSelected ? "✓ Selected" : "Vote"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
