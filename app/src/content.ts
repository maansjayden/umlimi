// The fixed list of answers. The app can only ever say one of these — nothing is generated at runtime.
// isiZulu drafts MUST be checked by a first-language speaker and the advice by an agronomist before field use.

export type Lang = 'zu' | 'en'
export type Label = 'faw' | 'gls' | 'nlb' | 'rust' | 'healthy' | 'other'
export type AnswerKey = Label | 'unsure'

export interface Answer {
  title: Record<Lang, string>
  advice: Record<Lang, string>
  severity: 'ok' | 'warn' | 'alert' | 'unknown'
  audio: Record<Lang, string> // path under /audio
}

const clip = (key: string) => ({ zu: `/audio/zu/${key}.mp3`, en: `/audio/en/${key}.mp3` })

export const ANSWERS: Record<AnswerKey, Answer> = {
  healthy: {
    title: { zu: 'Iqabunga liphilile', en: 'Leaf looks healthy' },
    advice: {
      zu: 'Iqabunga libukeka liphilile. Qhubeka uhlola insimu yakho njalo ngesonto.',
      en: 'No sign of armyworm or disease on this leaf. Keep scouting your field once a week.',
    },
    severity: 'ok',
    audio: clip('healthy'),
  },
  faw: {
    title: { zu: 'Isibungu sempi (Fall armyworm)', en: 'Fall armyworm damage' },
    advice: {
      zu: 'Lokhu kubukeka njengomonakalo wesibungu sempi. Hlola inhliziyo yommbila uthole izibungu nendle yazo. Bonisa umeluleki wezolimo ngaphambi kokufafaza.',
      en: 'This looks like fall armyworm feeding damage. Check the funnel (whorl) of nearby plants for larvae and sawdust-like droppings. Show the extension officer before spraying anything.',
    },
    severity: 'alert',
    audio: clip('faw'),
  },
  gls: {
    title: { zu: 'Isifo samabala ampunga (Grey leaf spot)', en: 'Grey leaf spot' },
    advice: {
      zu: 'Lokhu kubukeka njengesifo samabala ampunga. Sivamile uma kunomswakama. Bika kumeluleki wezolimo; ungalokothi ufafaze ngaphandle kweseluleko.',
      en: 'This looks like grey leaf spot, a fungal disease that spreads in humid weather. Report it to the extension officer; do not spray without advice.',
    },
    severity: 'warn',
    audio: clip('gls'),
  },
  nlb: {
    title: { zu: 'Isifo samabala amade (Northern leaf blight)', en: 'Northern leaf blight' },
    advice: {
      zu: 'Lokhu kubukeka njengesifo samabala amade. Bika kumeluleki wezolimo. Ngonyaka ozayo cela imbewu engasheshi ukuthola lesi sifo.',
      en: 'This looks like northern leaf blight, a fungal disease. Report it to the extension officer, and ask about resistant seed for next season.',
    },
    severity: 'warn',
    audio: clip('nlb'),
  },
  rust: {
    title: { zu: 'Ukugqwala (Common rust)', en: 'Common rust' },
    advice: {
      zu: 'Lokhu kubukeka njengokugqwala. Kuvamile futhi akuvamile ukulimaza kakhulu. Qhubeka uhlola, ubike uma kwanda.',
      en: 'This looks like common rust. It is common and usually causes limited loss. Keep watching, and report it if it spreads quickly.',
    },
    severity: 'warn',
    audio: clip('rust'),
  },
  other: {
    title: { zu: 'Akusilo iqabunga lommbila', en: 'Not a maize leaf' },
    advice: {
      zu: 'Lesi akusona isithombe seqabunga lommbila. Sicela uthathe isithombe esisha eduze kweqabunga, ekukhanyeni kwemini.',
      en: 'This does not look like a maize leaf. Please take a new photo close to one leaf, in daylight.',
    },
    severity: 'unknown',
    audio: clip('other'),
  },
  unsure: {
    title: { zu: 'Angiqiniseki', en: "I'm not sure" },
    advice: {
      zu: 'Angiqiniseki. Sicela ubuze umeluleki wezolimo. Isithombe sakho sigciniwe, sizothunyelwa uma kunenethiwekhi.',
      en: "I'm not sure. Please ask the extension officer. Your photo is saved and will be sent when there is network.",
    },
    severity: 'unknown',
    audio: clip('unsure'),
  },
}

export const UI: Record<string, Record<Lang, string>> = {
  appName: { zu: 'Umlimi', en: 'Umlimi' },
  tagline: { zu: 'Umsizi wommbila ongadingi inethiwekhi', en: 'Offline maize helper' },
  scan: { zu: 'Hlola iqabunga', en: 'Check a leaf' },
  price: { zu: 'Hlola intengo', en: 'Check a price' },
  cattle: { zu: 'Inkomo', en: 'Cattle' },
  queue: { zu: 'Okulindele umeluleki', en: 'Waiting for officer' },
  takePhoto: { zu: 'Thatha isithombe', en: 'Take photo' },
  back: { zu: 'Emuva', en: 'Back' },
  listen: { zu: 'Lalela', en: 'Listen' },
  sendOfficer: { zu: 'Thumela kumeluleki', en: 'Send to officer' },
  saved: { zu: 'Kugciniwe', en: 'Saved' },
  offline: { zu: 'Awukho kwinethiwekhi', en: 'Offline' },
  online: { zu: 'Usenethiwekhini', en: 'Online' },
  confidence: { zu: 'Ukuqiniseka', en: 'Confidence' },
  aiNote: {
    zu: 'Lokhu kuyiseluleko kuphela. Isinqumo ngesakho.',
    en: 'This is guidance only. You make the decision.',
  },
}
