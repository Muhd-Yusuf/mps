export function generateVotingCode(): string {
  const prefix = "MPS"
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${year}-${random}`
}

export function validateVotingCode(code: string): boolean {
  return /^MPS-\d{4}-[A-Z0-9]{6}$/.test(code)
}
