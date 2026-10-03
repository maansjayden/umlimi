// On-device leaf classifier. Runs entirely in the browser via onnxruntime-web (WASM); no network after install.
import * as ort from 'onnxruntime-web/wasm'
import type { AnswerKey, Label } from './content'

ort.env.wasm.numThreads = 1 // threads need cross-origin isolation; one thread is fast enough for a 224px MobileNet

export interface ModelMeta {
  labels: Label[]
  input_size: number
  mean: [number, number, number]
  std: [number, number, number]
  // Below this top-1 probability the app abstains and escalates to a person (chosen on held-out field photos).
  threshold: number
  version: string
}

export interface Prediction {
  answer: AnswerKey
  label: Label
  confidence: number
  probs: Record<Label, number>
  ms: number
}

let session: ort.InferenceSession | null = null
let meta: ModelMeta | null = null

export async function loadModel(): Promise<ModelMeta> {
  if (session && meta) return meta
  meta = (await (await fetch('/model/meta.json')).json()) as ModelMeta
  session = await ort.InferenceSession.create('/model/maize.onnx', { executionProviders: ['wasm'] })
  return meta
}

function toTensor(img: ImageBitmap, m: ModelMeta): ort.Tensor {
  const s = m.input_size
  const canvas = new OffscreenCanvas(s, s)
  const ctx = canvas.getContext('2d')!
  // centre-crop to a square, then resize
  const side = Math.min(img.width, img.height)
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, s, s)
  const { data } = ctx.getImageData(0, 0, s, s)
  const out = new Float32Array(3 * s * s)
  for (let i = 0; i < s * s; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * s * s + i] = (data[i * 4 + c] / 255 - m.mean[c]) / m.std[c]
    }
  }
  return new ort.Tensor('float32', out, [1, 3, s, s])
}

function softmax(x: Float32Array): number[] {
  const max = Math.max(...x)
  const e = Array.from(x, (v) => Math.exp(v - max))
  const sum = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / sum)
}

export async function classify(file: Blob): Promise<Prediction> {
  const m = await loadModel()
  const img = await createImageBitmap(file)
  const t0 = performance.now()
  const out = await session!.run({ [session!.inputNames[0]]: toTensor(img, m) })
  const p = softmax(out[session!.outputNames[0]].data as Float32Array)
  const ms = performance.now() - t0

  const probs = Object.fromEntries(m.labels.map((l, i) => [l, p[i]])) as Record<Label, number>
  const best = p.indexOf(Math.max(...p))
  const label = m.labels[best]
  const confidence = p[best]
  // Fail-safe: low confidence never produces a diagnosis.
  const answer: AnswerKey = label === 'other' ? 'other' : confidence < m.threshold ? 'unsure' : label
  return { answer, label, confidence, probs, ms }
}
