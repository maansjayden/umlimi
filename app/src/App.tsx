import { useEffect, useRef, useState } from 'react'
import { ANSWERS, LANG_NAME, LANGS, UI, type Lang } from './content'
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
  const a = new Audio(src)
  a.play().catch(() => {}) // clip may be missing in dev; text is always shown
}

const tr = (lang: Lang) => (k: string) => UI[k][lang]

// English line under the local-language text, so a reviewer can follow along.
function Gloss({ lang, text }: { lang: Lang; text: string }) {
  return lang === 'en' ? null : <p className="gloss">EN: {text}</p>
}

export default function App() {
  const [lang, setLang] = useState<Lang>('af')
  const [screen, setScreen] = useState<Screen>('home')
  const online = useOnline()
  const t = tr(lang)
  const next = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]

  useEffect(() => {
    loadModel().catch(() => {}) // warm the model so the first scan is instant
    if (online) syncQueue()
  }, [online])

  return (
    <div className="app">
      <header>
        {screen !== 'home' ? (
          <button className="link" onClick={() => setScreen('home')}>← {t('back')}</button>
        ) : (
          <div>
            <h1>🌽 {t('appName')}</h1>
            <small>{t('tagline')}</small>
          </div>
        )}
        <div className="right">
          <span className={`pill ${online ? 'on' : 'off'}`}>{online ? t('online') : t('offline')}</span>
          <button className="pill" onClick={() => setLang(next)}>{LANG_NAME[next]}</button>
        </div>
      </header>

      {screen === 'home' && (
        <main className="grid">
          <button className="tile" onClick={() => setScreen('scan')}>
            <span>📷</span>
            {t('scan')}
          </button>
          <button className="tile" onClick={() => setScreen('price')}>
            <span>💰</span>
            {t('price')}
          </button>
          <button className="tile" onClick={() => setScreen('queue')}>
            <span>🧑🏾‍🌾</span>
            {t('queue')} ({loadQueue().filter((c) => !c.synced).length})
          </button>
        </main>
      )}
      {screen === 'scan' && <Scan lang={lang} />}
      {screen === 'price' && <Price lang={lang} />}
      {screen === 'queue' && <Queue lang={lang} />}
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
          <button onClick={() => play(ans.audio[lang])}>🔊 {t('listen')}</button>
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
