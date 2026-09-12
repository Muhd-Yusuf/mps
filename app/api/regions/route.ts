import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { REGIONS, getActiveRegion, setActiveRegion, isRegionKey } from "@/lib/regions"

// The list of regional editions and which one the public site is voting in.
// Public GET (the homepage and /vote need to know the live edition); the
// switch itself is admin-only.
export async function GET() {
  try {
    const active = await getActiveRegion()
    return NextResponse.json({ regions: REGIONS, active })
  } catch (error) {
    console.error("[GET_REGIONS_ERROR]", error)
    return NextResponse.json({ error: "Failed to fetch regions" }, { status: 500 })
  }
}

const schema = z.object({
  region: z.string().refine(isRegionKey, "Unknown region"),
})

export async function POST(request: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 })
  }
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Unknown region" }, { status: 400 })
    }
    const active = await setActiveRegion(parsed.data.region)
    return NextResponse.json({ active, regions: REGIONS })
  } catch (error) {
    console.error("[SET_REGION_ERROR]", error)
    return NextResponse.json({ error: "Failed to switch region" }, { status: 500 })
  }
}
