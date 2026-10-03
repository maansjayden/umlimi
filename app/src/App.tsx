import { useEffect, useRef, useState } from 'react'
import { ANSWERS, UI, type Lang } from './content'
import { classify, loadModel, type Prediction } from './model'
import { addCase, loadQueue, syncQueue, thumbnail, type Case } from './queue'
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

export default function App() {
  const [lang, setLang] = useState<Lang>('zu')
  const [screen, setScreen] = useState<Screen>('home')
  const online = useOnline()
  const t = (k: string) => UI[k][lang]

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
          <button className="pill" onClick={() => setLang(lang === 'zu' ? 'en' : 'zu')}>
            {lang === 'zu' ? 'English' : 'isiZulu'}
          </button>
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
  const t = (k: string) => UI[k][lang]

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

const VERDICT = {
  low: {
    zu: 'Le ntengo iphansi kunentengo ejwayelekile. Ungabuza abanye abathengi noma i-co-op ngaphambi kokuthengisa.',
    en: 'This offer is below the reference price. You may want to ask other buyers or your co-op before selling.',
  },
  fair: { zu: 'Le ntengo isondele entengweni ejwayelekile.', en: 'This offer is close to the reference price.' },
  good: { zu: 'Le ntengo ingaphezu kwentengo ejwayelekile.', en: 'This offer is above the reference price.' },
}

function Price({ lang }: { lang: Lang }) {
  const [ref, setRef] = useState<PriceRef>()
  const [maize, setMaize] = useState<'white' | 'yellow'>('white')
  const [unit, setUnit] = useState<'bag50' | 'ton'>('bag50')
  const [offer, setOffer] = useState('')
  const [km, setKm] = useState('40')
  const [res, setRes] = useState<PriceCheck>()
  const [error, setError] = useState<string>()
  const zu = lang === 'zu'

  useEffect(() => {
    loadPrice().then(setRef, (e) => setError(String(e)))
  }, [])

  const R = (n: number) => `R${Math.round(n).toLocaleString('en-ZA')}`
  return (
    <main className="form">
      <label>
        {zu ? 'Uhlobo lommbila' : 'Maize type'}
        <select value={maize} onChange={(e) => setMaize(e.target.value as 'white' | 'yellow')}>
          <option value="white">{zu ? 'Ommhlophe' : 'White'}</option>
          <option value="yellow">{zu ? 'Ophuzi' : 'Yellow'}</option>
        </select>
      </label>
      <label>
        {zu ? 'Umthengi unikeza (R)' : 'Buyer offers (R)'}
        <div className="row">
          <input inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="180" />
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'bag50' | 'ton')}>
            <option value="bag50">{zu ? 'isaka elingu-50kg' : 'per 50 kg bag'}</option>
            <option value="ton">{zu ? 'ithani' : 'per ton'}</option>
          </select>
        </div>
      </label>
      <label>
        {zu ? 'Ibanga eliya esilo esiseduze (km)' : 'Distance to nearest silo (km)'}
        <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
      </label>
      <button
        className="big"
        disabled={!ref || !offer}
        onClick={() => ref && setRes(checkPrice(ref, maize, Number(offer), unit, Number(km)))}
      >
        💰 {zu ? 'Hlola' : 'Check'}
      </button>
      {error && <p className="error">{error}</p>}
      {res && ref && (
        <section className={`result ${res.verdict === 'low' ? 'alert' : res.verdict === 'fair' ? 'warn' : 'ok'}`}>
          <h2>
            {res.diffPct > 0 ? '+' : ''}
            {res.diffPct.toFixed(0)}%
          </h2>
          <p>{VERDICT[res.verdict][lang]}</p>
          <p>
            {zu ? 'Okunikezwayo' : 'Offer'}: {R(res.offerPerTon)}/t ({R(res.offerPerTon / 20)}/50kg)
            <br />
            {zu ? 'Intengo elinganiselwe epulazini' : 'Estimated fair farm-gate'}: {R(res.farmGate)}/t (
            {R(res.farmGate / 20)}/50kg)
            <br />
            SAFEX: {R(res.safex)}/t · {ref.updated}
            {res.ageDays > 7 && <strong> · {zu ? 'intengo indala' : 'price is old'} ({res.ageDays}d)</strong>}
          </p>
          <details>
            <summary>{zu ? 'Kubalwa kanjani' : 'How this is calculated'}</summary>
            <p className="muted">
              SAFEX ({ref.source}) − transport R{ref.transport_r_per_ton_km}/t/km × {km} km − handling R
              {ref.handling_r_per_ton}/t. {zu ? 'Lezi yizilinganiso.' : 'These are estimates.'}
            </p>
          </details>
          <p className="muted">{UI.aiNote[lang]}</p>
        </section>
      )}
    </main>
  )
}

function Queue({ lang }: { lang: Lang }) {
  const [q, setQ] = useState<Case[]>(loadQueue())
  const zu = lang === 'zu'
  return (
    <main>
      <button onClick={async () => (await syncQueue(), setQ(loadQueue()))}>
        🔄 {zu ? 'Thumela manje' : 'Send now'}
      </button>
      {q.length === 0 && <p className="muted">{zu ? 'Akukho lutho.' : 'Nothing waiting.'}</p>}
      <ul className="cases">
        {q.map((c) => (
          <li key={c.id}>
            <img src={c.thumb} alt="" />
            <div>
              <strong>{ANSWERS[c.answer].title[lang]}</strong>
              <br />
              <small>
                {new Date(c.ts).toLocaleString('en-ZA')} · {Math.round(c.confidence * 100)}% ·{' '}
                {c.synced ? (zu ? '✓ kuthunyelwe' : '✓ sent') : zu ? '⏳ kulindile' : '⏳ waiting'}
              </small>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
