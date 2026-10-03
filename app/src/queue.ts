// Store-and-forward: cases wait on the phone until there is signal, then go to the extension officer.
// Only sent if the farmer consented. Nothing leaves the device otherwise.
import type { AnswerKey, Label } from './content'

export interface Case {
  id: string
  ts: number
  answer: AnswerKey
  label: Label
  confidence: number
  thumb: string // small JPEG data URL (~10 KB)
  note?: string
  synced: boolean
}

const KEY = 'umlimi.queue'
const CONSENT = 'umlimi.consent'
const SYNC_URL = import.meta.env.VITE_SYNC_URL as string | undefined

// The farmer's explicit agreement to share queued photos with the extension officer.
export const hasConsent = () => localStorage.getItem(CONSENT) === 'yes'
export const setConsent = (yes: boolean) => localStorage.setItem(CONSENT, yes ? 'yes' : 'no')

export const loadQueue = (): Case[] => JSON.parse(localStorage.getItem(KEY) ?? '[]')
const save = (q: Case[]) => localStorage.setItem(KEY, JSON.stringify(q))

export function addCase(c: Omit<Case, 'id' | 'ts' | 'synced'>): Case {
  const full: Case = { ...c, id: crypto.randomUUID(), ts: Date.now(), synced: false }
  save([full, ...loadQueue()])
  return full
}

export async function syncQueue(): Promise<number> {
  if (!SYNC_URL || !navigator.onLine || !hasConsent()) return 0
  const q = loadQueue()
  let sent = 0
  for (const c of q.filter((c) => !c.synced)) {
    try {
      const r = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c),
      })
      if (r.ok) {
        c.synced = true
        sent++
      }
    } catch {
      break // lost signal again; try next time
    }
  }
  save(q)
  return sent
}

export async function thumbnail(file: Blob, size = 160): Promise<string> {
  const img = await createImageBitmap(file)
  const scale = size / Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.6)
}
