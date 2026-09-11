"use client"

import { MapPin, Radio } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Region } from "@/lib/regions"

const ALL_REGIONS = "all"

interface Props {
  regions: Region[]
  /** The edition currently being VIEWED in the dashboard (may be "all"). */
  value: string
  onChange: (region: string) => void
  /** The edition the PUBLIC site is voting in right now. */
  activeRegion: string
  disabled?: boolean
}

// Switches which edition the dashboard reports on. Purely a view control —
// changing it never affects what the audience sees; that is the "live edition"
// setting in the Settings tab.
export default function AdminRegionSwitcher({ regions, value, onChange, activeRegion, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-muted-foreground hidden sm:block" />
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[170px] sm:w-[210px] bg-white border-border/40">
          <SelectValue placeholder="Select edition" />
        </SelectTrigger>
        <SelectContent>
          {regions.map((region) => (
            <SelectItem key={region.key} value={region.key}>
              <span className="flex items-center gap-2">
                {region.short}
                {region.key === activeRegion && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700">
                    <Radio className="w-3 h-3" />
                    LIVE
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={ALL_REGIONS}>All regions (season total)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
