import Image from "next/image"

// A poet is never shown without a face. When a portrait exists we render it;
// when one was never submitted we fall back to their initials on a colour
// derived from their name — so every poet still has a distinct, stable identity
// instead of nine identical grey boxes on the voting page.
//
// Fills its parent, which must be positioned (relative) and sized.

const AVATAR_COLORS = [
  "#667EEA", // indigo (brand)
  "#764BA2", // purple (brand)
  "#0F766E", // teal
  "#B45309", // amber
  "#BE123C", // rose
  "#1D4ED8", // blue
  "#15803D", // green
  "#7C2D12", // brown
]

function initialsOf(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ") // drop "(Stage Name)" so initials follow the real name
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w))
  if (!words.length) return "?"
  const first = words[0][0] ?? ""
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : ""
  return (first + last).toUpperCase()
}

// Stable per name, so a poet keeps the same colour everywhere they appear.
function colorOf(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface PoetAvatarProps {
  src?: string | null
  name: string
  /** Tailwind text-size class for the initials, tuned to the container. */
  textClassName?: string
  sizes?: string
}

export default function PoetAvatar({ src, name, textClassName = "text-sm", sizes }: PoetAvatarProps) {
  if (src) {
    return <Image src={src} alt={name} fill sizes={sizes} className="object-cover" />
  }
  return (
    <div
      className="absolute inset-0 flex items-center justify-center font-semibold text-white select-none"
      style={{ backgroundColor: colorOf(name) }}
      role="img"
      aria-label={name}
      title={name}
    >
      <span className={textClassName}>{initialsOf(name)}</span>
    </div>
  )
}
