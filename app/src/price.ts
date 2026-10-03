// Fair-price reference. The SAFEX price is cached on the phone (refreshed when online / by SMS),
// so the check works offline. It informs the farmer; it never tells her to accept or refuse.

export interface PriceRef {
  updated: string // ISO date of the SAFEX price
  source: string
  white_r_per_ton: number
  yellow_r_per_ton: number
  // Assumptions used to go from the SAFEX (Randfontein) price to a farm-gate estimate. Shown to the user.
  transport_r_per_ton_km: number
  handling_r_per_ton: number
}

export type Verdict = 'low' | 'fair' | 'good'

export interface PriceCheck {
  safex: number
  farmGate: number // estimated fair farm-gate price, R/ton
  offerPerTon: number
  diffPct: number
  verdict: Verdict
  ageDays: number
}

const CACHE = 'umlimi.price'

export async function loadPrice(): Promise<PriceRef> {
  try {
    const fresh = (await (await fetch('/data/price.json', { cache: 'no-cache' })).json()) as PriceRef
    localStorage.setItem(CACHE, JSON.stringify(fresh))
    return fresh
  } catch {
    const cached = localStorage.getItem(CACHE)
    if (!cached) throw new Error('no price reference cached yet')
    return JSON.parse(cached)
  }
}

export function checkPrice(
  ref: PriceRef,
  maize: 'white' | 'yellow',
  offer: number,
  unit: 'bag50' | 'ton',
  distanceKm: number,
): PriceCheck {
  const safex = maize === 'white' ? ref.white_r_per_ton : ref.yellow_r_per_ton
  const farmGate = Math.max(0, safex - ref.transport_r_per_ton_km * distanceKm - ref.handling_r_per_ton)
  const offerPerTon = unit === 'bag50' ? offer * 20 : offer
  const diffPct = ((offerPerTon - farmGate) / farmGate) * 100
  const verdict: Verdict = diffPct < -10 ? 'low' : diffPct > 5 ? 'good' : 'fair'
  const ageDays = Math.floor((Date.now() - new Date(ref.updated).getTime()) / 86_400_000)
  return { safex, farmGate, offerPerTon, diffPct, verdict, ageDays }
}
