import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Coins, Leaf, ScanLine, type LucideIcon } from 'lucide-react'
import { ANSWERS, LANG_NAME, UI, type Lang } from './content'
import { classify, loadModel, type Prediction } from './model'
import { addCase, hasConsent, loadQueue, setConsent, syncQueue, thumbnail, type Case } from './queue'
import { checkPrice, loadPrice, type PriceCheck, type PriceRef } from './price'
import './App.css'

type Screen = 'home' | 'scan' | 'price' | 'queue'

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    addEventListener('online', on)
    addEventListener('offline', off)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
    }
  }, [])
  return online
}

function play(src: string) {
  if (!src) return
  const a = new Audio(src)
  a.play().catch(() => {}) // clip may be missing in dev; text is always shown
}

const tr = (lang: Lang) => (k: string) => UI[k][lang]

// English line under the local-language text, so a reviewer can follow along.
function Gloss({ lang, text }: { lang: Lang; text: string }) {
  return lang === 'en' ? null : <p className="gloss">EN: {text}</p>
}

const SEGMENTS: Lang[] = ['en', 'zu', 'af']

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  badge,
  onClick,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card flex w-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
    >
      <span className="shrink-0 rounded-xl bg-emerald-50 p-3 text-emerald-700">
        <Icon size={26} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight text-slate-900">{title}</span>
          {!!badge && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">{badge}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
      <ChevronRight className="shrink-0 text-slate-300" size={20} />
    </button>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>('af')
  const [screen, setScreen] = useState<Screen>('home')
  const online = useOnline()
  const t = tr(lang)
  const waiting = loadQueue().filter((c) => !c.synced).length

  useEffect(() => {
    loadModel().catch(() => {}) // warm the model so the first scan is instant
    if (online) syncQueue()
  }, [online])

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between border-x border-slate-200 bg-slate-50 p-5 shadow-xl">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            {online ? t('onlineCached') : t('offlineMode')}
          </span>
          <span className="flex items-center gap-1">
            <Leaf size={12} /> on-device AI
          </span>
        </div>

        {screen === 'home' ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('appName')}</h1>
            <p className="text-sm text-slate-500">{t('tagline')}</p>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 self-start text-base font-medium text-slate-700"
            onClick={() => setScreen('home')}
          >
            <ChevronLeft size={20} /> {t('back')}
          </button>
        )}

        <div className="grid grid-cols-3 rounded-xl bg-slate-200/70 p-1 text-sm font-medium">
          {SEGMENTS.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-lg py-1.5 transition-all ${
                lang === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {LANG_NAME[l]}
            </button>
          ))}
        </div>

        {screen === 'home' && (
          <main className="flex flex-col gap-3">
            <ActionCard icon={ScanLine} title={t('scan')} subtitle={t('scanSub')} onClick={() => setScreen('scan')} />
            <ActionCard icon={Coins} title={t('price')} subtitle={t('priceSub')} onClick={() => setScreen('price')} />
            <ActionCard
              icon={Clock}
              title={t('queue')}
              subtitle={t('queueSub')}
              badge={waiting}
              onClick={() => setScreen('queue')}
            />
          </main>
        )}
        {screen === 'scan' && <Scan lang={lang} />}
        {screen === 'price' && <Price lang={lang} />}
        {screen === 'queue' && <Queue lang={lang} />}
      </div>

      <footer className="pt-6 text-center text-xs text-slate-400">{t('footer')}</footer>
    </div>
  )
}

function Scan({ lang }: { lang: Lang }) {
  const input = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<string>()
  const [file, setFile] = useState<File>()
  const [pred, setPred] = useState<Prediction>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const t = tr(lang)

  async function onFile(f?: File) {
    if (!f) return
    setFile(f)
    setPhoto(URL.createObjectURL(f))
    setPred(undefined)
    setSent(false)
    setError(undefined)
    setBusy(true)
    try {
      const p = await classify(f)
      setPred(p)
      play(ANSWERS[p.answer].audio[lang])
      // Fail-safe: anything the model is unsure about is queued for a person automatically.
      if (p.answer === 'unsure') {
        addCase({ answer: p.answer, label: p.label, confidence: p.confidence, thumb: await thumbnail(f) })
        setSent(true)
        syncQueue()
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendToOfficer() {
    if (!file || !pred) return
    addCase({ answer: pred.answer, label: pred.label, confidence: pred.confidence, thumb: await thumbnail(file) })
    setConsent(true)
    setSent(true)
    syncQueue()
  }

  const ans = pred && ANSWERS[pred.answer]
  return (
    <main>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button className="big" onClick={() => input.current?.click()}>📷 {t('takePhoto')}</button>
      {photo && <img className="photo" src={photo} alt="" />}
      {busy && <p className="muted">…</p>}
      {error && <p className="error">{error}</p>}
      {ans && pred && (
        <section className={`result ${ans.severity}`}>
          <h2>{ans.title[lang]}</h2>
          <p>{ans.advice[lang]}</p>
          <Gloss lang={lang} text={ans.advice.en} />
          {ans.audio[lang] && <button onClick={() => play(ans.audio[lang])}>🔊 {t('listen')}</button>}
          {pred.answer !== 'unsure' && pred.answer !== 'other' && (
            <button onClick={sendToOfficer} disabled={sent}>
              {sent ? `✓ ${t('saved')}` : `🧑🏾‍🌾 ${t('sendOfficer')}`}
            </button>
          )}
          {pred.answer === 'unsure' && <p className="muted">✓ {t('saved')}</p>}
          <details>
            <summary>
              {t('confidence')}: {Math.round(pred.confidence * 100)}% · {Math.round(pred.ms)} ms · on-device
            </summary>
            <ul>
              {Object.entries(pred.probs)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k}>
                    {k}: {(v * 100).toFixed(1)}%
                  </li>
                ))}
            </ul>
          </details>
          <p className="muted">{t('aiNote')}</p>
        </section>
      )}
    </main>
  )
}

function Price({ lang }: { lang: Lang }) {
  const [ref, setRef] = useState<PriceRef>()
  const [maize, setMaize] = useState<'white' | 'yellow'>('white')
  const [unit, setUnit] = useState<'bag50' | 'ton'>('bag50')
  const [offer, setOffer] = useState('')
  const [km, setKm] = useState('40')
  const [res, setRes] = useState<PriceCheck>()
  const [error, setError] = useState<string>()
  const t = tr(lang)

  useEffect(() => {
    loadPrice().then(setRef, (e) => setError(String(e)))
  }, [])

  const R = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`
  return (
    <main className="form">
      <label>
        {t('maizeType')}
        <select value={maize} onChange={(e) => setMaize(e.target.value as 'white' | 'yellow')}>
          <option value="white">{t('white')}</option>
          <option value="yellow">{t('yellow')}</option>
        </select>
      </label>
      <label>
        {t('buyerOffers')}
        <div className="row">
          <input inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="180" />
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'bag50' | 'ton')}>
            <option value="bag50">{t('perBag')}</option>
            <option value="ton">{t('perTon')}</option>
          </select>
        </div>
      </label>
      <label>
        {t('distance')}
        <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
      </label>
      <button
        className="big"
        disabled={!ref || !offer}
        onClick={() => ref && setRes(checkPrice(ref, maize, Number(offer), unit, Number(km)))}
      >
        💰 {t('check')}
      </button>
      {error && <p className="error">{error}</p>}
      {res && ref && (
        <section className={`result ${res.verdict === 'low' ? 'alert' : res.verdict === 'fair' ? 'warn' : 'ok'}`}>
          <h2>
            {res.diffPct > 0 ? '+' : ''}
            {res.diffPct.toFixed(0)}%
          </h2>
          <p>{t(res.verdict)}</p>
          <Gloss lang={lang} text={UI[res.verdict].en} />
          <p>
            {t('offer')}: {R(res.offerPerTon)}/t ({R(res.offerPerTon / 20)}/50kg)
            <br />
            {t('farmGate')}: {R(res.farmGate)}/t ({R(res.farmGate / 20)}/50kg)
            <br />
            SAFEX: {R(res.safex)}/t · {ref.updated}
            {res.ageDays > 7 && <strong> · {t('oldPrice')} ({res.ageDays}d)</strong>}
          </p>
          <details>
            <summary>{t('howCalc')}</summary>
            <p className="muted">
              SAFEX ({ref.source}) − transport R{ref.transport_r_per_ton_km}/t/km × {km} km − handling R
              {ref.handling_r_per_ton}/t. {t('estimates')}
            </p>
          </details>
          <p className="muted">{t('aiNote')}</p>
        </section>
      )}
    </main>
  )
}

function Queue({ lang }: { lang: Lang }) {
  const [q, setQ] = useState<Case[]>(loadQueue())
  const [consent, setC] = useState(hasConsent())
  const t = tr(lang)
  return (
    <main>
      <label className="consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => (setConsent(e.target.checked), setC(e.target.checked))}
        />
        {t('consent')}
      </label>
      <button onClick={async () => (await syncQueue(), setQ(loadQueue()))}>🔄 {t('sendNow')}</button>
      {q.length === 0 && <p className="muted">{t('nothing')}</p>}
      <ul className="cases">
        {q.map((c) => (
          <li key={c.id}>
            <img src={c.thumb} alt="" />
            <div>
              <strong>{ANSWERS[c.answer].title[lang]}</strong>
              <br />
              <small>
                {new Date(c.ts).toLocaleString('en-ZA')} · {Math.round(c.confidence * 100)}% ·{' '}
                {c.synced ? t('sent') : t('waiting')}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
