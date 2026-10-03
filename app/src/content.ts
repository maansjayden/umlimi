// The fixed list of answers. The app can only ever say one of these — nothing is generated at runtime.
// Adding a language = translating these strings and recording the clips; the model does not change.
// Afrikaans is primary; isiZulu shows the same fixed list in a less-supported language.
// Translations have not been checked by first-language speakers or an agronomist yet.

export type Lang = 'af' | 'zu' | 'en'
export const LANGS: Lang[] = ['af', 'zu', 'en']
export const LANG_NAME: Record<Lang, string> = { af: 'Afrikaans', zu: 'isiZulu', en: 'English' }

export type Label = 'faw' | 'gls' | 'nlb' | 'rust' | 'healthy' | 'other'
export type AnswerKey = Label | 'unsure'
type Text = Record<Lang, string>

export interface Answer {
  title: Text
  advice: Text
  severity: 'ok' | 'warn' | 'alert' | 'unknown'
  audio: Text // path under /audio
}

// No ElevenLabs voice model supports isiZulu yet, so isiZulu is text-only (empty path = no clip).
const clip = (key: string): Text => ({ af: `/audio/af/${key}.mp3`, zu: '', en: `/audio/en/${key}.mp3` })

export const ANSWERS: Record<AnswerKey, Answer> = {
  healthy: {
    title: { af: 'Blaar lyk gesond', zu: 'Iqabunga liphilile', en: 'Leaf looks healthy' },
    advice: {
      af: 'Die blaar lyk gesond. Hou aan om jou land elke week na te gaan.',
      zu: 'Iqabunga libukeka liphilile. Qhubeka uhlola insimu yakho njalo ngesonto.',
      en: 'No sign of armyworm or disease on this leaf. Keep scouting your field once a week.',
    },
    severity: 'ok',
    audio: clip('healthy'),
  },
  faw: {
    title: { af: 'Herfsleërruspe', zu: 'Isibungu sempi', en: 'Fall armyworm damage' },
    advice: {
      af: 'Dit lyk na skade deur die herfsleërruspe. Kyk in die kelk van die mielieplante vir ruspes en hul mis. Wys dit vir die voorligtingsbeampte voordat jy enigiets spuit.',
      zu: 'Lokhu kubukeka njengomonakalo wesibungu sempi. Hlola inhliziyo yommbila uthole izibungu nendle yazo. Bonisa umeluleki wezolimo ngaphambi kokufafaza.',
      en: 'This looks like fall armyworm feeding damage. Check the funnel (whorl) of nearby plants for larvae and sawdust-like droppings. Show the extension officer before spraying anything.',
    },
    severity: 'alert',
    audio: clip('faw'),
  },
  gls: {
    title: { af: 'Grysblaarvlek', zu: 'Isifo samabala ampunga', en: 'Grey leaf spot' },
    advice: {
      af: "Dit lyk na grysblaarvlek, 'n swamsiekte wat in vogtige weer versprei. Rapporteer dit aan die voorligtingsbeampte; moenie spuit sonder advies nie.",
      zu: 'Lokhu kubukeka njengesifo samabala ampunga. Sivamile uma kunomswakama. Bika kumeluleki wezolimo; ungalokothi ufafaze ngaphandle kweseluleko.',
      en: 'This looks like grey leaf spot, a fungal disease that spreads in humid weather. Report it to the extension officer; do not spray without advice.',
    },
    severity: 'warn',
    audio: clip('gls'),
  },
  nlb: {
    title: { af: 'Noordelike blaarskroei', zu: 'Isifo samabala amade', en: 'Northern leaf blight' },
    advice: {
      af: "Dit lyk na noordelike blaarskroei, 'n swamsiekte. Rapporteer dit aan die voorligtingsbeampte en vra oor bestande saad vir volgende seisoen.",
      zu: 'Lokhu kubukeka njengesifo samabala amade. Bika kumeluleki wezolimo. Ngonyaka ozayo cela imbewu engasheshi ukuthola lesi sifo.',
      en: 'This looks like northern leaf blight, a fungal disease. Report it to the extension officer, and ask about resistant seed for next season.',
    },
    severity: 'warn',
    audio: clip('nlb'),
  },
  rust: {
    title: { af: 'Gewone roes', zu: 'Ukugqwala', en: 'Common rust' },
    advice: {
      af: 'Dit lyk na gewone roes. Dit kom algemeen voor en veroorsaak gewoonlik min skade. Hou dit dop en rapporteer dit as dit vinnig versprei.',
      zu: 'Lokhu kubukeka njengokugqwala. Kuvamile futhi akuvamile ukulimaza kakhulu. Qhubeka uhlola, ubike uma kwanda.',
      en: 'This looks like common rust. It is common and usually causes limited loss. Keep watching, and report it if it spreads quickly.',
    },
    severity: 'warn',
    audio: clip('rust'),
  },
  other: {
    title: { af: "Nie 'n mielieblaar nie", zu: 'Akusilo iqabunga lommbila', en: 'Not a maize leaf' },
    advice: {
      af: "Dit lyk nie na 'n mielieblaar nie. Neem asseblief 'n nuwe foto naby een blaar, in daglig.",
      zu: 'Lesi akusona isithombe seqabunga lommbila. Sicela uthathe isithombe esisha eduze kweqabunga, ekukhanyeni kwemini.',
      en: 'This does not look like a maize leaf. Please take a new photo close to one leaf, in daylight.',
    },
    severity: 'unknown',
    audio: clip('other'),
  },
  unsure: {
    title: { af: 'Ek is nie seker nie', zu: 'Angiqiniseki', en: "I'm not sure" },
    advice: {
      af: 'Ek is nie seker nie. Vra asseblief die voorligtingsbeampte. Jou foto is gestoor en sal gestuur word sodra daar sein is.',
      zu: 'Angiqiniseki. Sicela ubuze umeluleki wezolimo. Isithombe sakho sigciniwe, sizothunyelwa uma kunenethiwekhi.',
      en: "I'm not sure. Please ask the extension officer. Your photo is saved and will be sent when there is network.",
    },
    severity: 'unknown',
    audio: clip('unsure'),
  },
}

export const UI: Record<string, Text> = {
  appName: { af: 'Umlimi', zu: 'Umlimi', en: 'Umlimi' },
  tagline: { af: 'Mieliehulp sonder internet', zu: 'Umsizi wommbila ongadingi inethiwekhi', en: 'Offline maize helper' },
  scanSub: {
    af: 'Soek herfsleërruspe, roes en blaarskroei — werk sonder internet',
    zu: 'Hlola isibungu sempi, ukugqwala nezifo — ngaphandle kwenethiwekhi',
    en: 'Scan for fall armyworm, rust & blight — works offline',
  },
  priceSub: {
    af: "Vergelyk 'n koper se aanbod met die SAFEX-prys",
    zu: 'Qhathanisa intengo yomthengi nentengo ye-SAFEX',
    en: "Compare a buyer's offer with the SAFEX price",
  },
  queueSub: {
    af: "Foto's gestoor vir die voorligtingsbeampte",
    zu: 'Izithombe ezigcinelwe umeluleki wezolimo',
    en: 'Photos saved for the extension officer',
  },
  onlineCached: { af: 'Aanlyn · gestoor', zu: 'Ku-inthanethi · kugciniwe', en: 'Online · cached' },
  offlineMode: { af: 'Vanlyn-modus', zu: 'Ngaphandle kwenethiwekhi', en: 'Offline mode' },
  footer: {
    af: 'Loop op jou foon · geen data nodig nie',
    zu: 'Isebenza efonini yakho · ayidingi idatha',
    en: 'Runs on your phone · no data needed',
  },
  scan: { af: "Toets 'n blaar", zu: 'Hlola iqabunga', en: 'Check a leaf' },
  price: { af: "Toets 'n prys", zu: 'Hlola intengo', en: 'Check a price' },
  queue: { af: 'Wag vir beampte', zu: 'Okulindele umeluleki', en: 'Waiting for officer' },
  takePhoto: { af: 'Neem foto', zu: 'Thatha isithombe', en: 'Take photo' },
  back: { af: 'Terug', zu: 'Emuva', en: 'Back' },
  listen: { af: 'Luister', zu: 'Lalela', en: 'Listen' },
  sendOfficer: { af: 'Stuur na beampte', zu: 'Thumela kumeluleki', en: 'Send to officer' },
  saved: { af: 'Gestoor', zu: 'Kugciniwe', en: 'Saved' },
  offline: { af: 'Geen sein', zu: 'Awukho kwinethiwekhi', en: 'Offline' },
  online: { af: 'Aanlyn', zu: 'Usenethiwekhini', en: 'Online' },
  confidence: { af: 'Sekerheid', zu: 'Ukuqiniseka', en: 'Confidence' },
  aiNote: {
    af: 'Dit is net raad. Jy neem die besluit.',
    zu: 'Lokhu kuyiseluleko kuphela. Isinqumo ngesakho.',
    en: 'This is guidance only. You make the decision.',
  },
  // price screen
  maizeType: { af: 'Soort mielies', zu: 'Uhlobo lommbila', en: 'Maize type' },
  white: { af: 'Wit', zu: 'Ommhlophe', en: 'White' },
  yellow: { af: 'Geel', zu: 'Ophuzi', en: 'Yellow' },
  buyerOffers: { af: 'Koper bied (R)', zu: 'Umthengi unikeza (R)', en: 'Buyer offers (R)' },
  perBag: { af: 'per 50 kg sak', zu: 'isaka elingu-50kg', en: 'per 50 kg bag' },
  perTon: { af: 'per ton', zu: 'ithani', en: 'per ton' },
  distance: { af: 'Afstand na naaste silo (km)', zu: 'Ibanga eliya esilo esiseduze (km)', en: 'Distance to nearest silo (km)' },
  check: { af: 'Toets', zu: 'Hlola', en: 'Check' },
  offer: { af: 'Aanbod', zu: 'Okunikezwayo', en: 'Offer' },
  farmGate: { af: 'Beraamde billike plekprys', zu: 'Intengo elinganiselwe epulazini', en: 'Estimated fair farm-gate' },
  oldPrice: { af: 'prys is oud', zu: 'intengo indala', en: 'price is old' },
  howCalc: { af: 'Hoe word dit bereken', zu: 'Kubalwa kanjani', en: 'How this is calculated' },
  estimates: { af: 'Dit is skattings.', zu: 'Lezi yizilinganiso.', en: 'These are estimates.' },
  low: {
    af: 'Hierdie aanbod is laer as die verwysingsprys. Jy kan ander kopers of jou koöperasie vra voordat jy verkoop.',
    zu: 'Le ntengo iphansi kunentengo ejwayelekile. Ungabuza abanye abathengi noma i-co-op ngaphambi kokuthengisa.',
    en: 'This offer is below the reference price. You may want to ask other buyers or your co-op before selling.',
  },
  fair: {
    af: 'Hierdie aanbod is naby die verwysingsprys.',
    zu: 'Le ntengo isondele entengweni ejwayelekile.',
    en: 'This offer is close to the reference price.',
  },
  good: {
    af: 'Hierdie aanbod is hoër as die verwysingsprys.',
    zu: 'Le ntengo ingaphezu kwentengo ejwayelekile.',
    en: 'This offer is above the reference price.',
  },
  // queue screen
  consent: {
    af: 'Ek stem in dat hierdie blaarfoto\'s met die voorligtingsbeampte gedeel word.',
    zu: 'Ngiyavuma ukuthi lezi zithombe zamaqabunga zabelwane nomeluleki wezolimo.',
    en: 'I agree to share these leaf photos with the extension officer.',
  },
  sentToast: {
    af: 'Gevalle na die voorligtingsbeampte gestuur',
    zu: 'Izimo zithunyelwe kumeluleki wezolimo',
    en: 'Cases sent to extension officer',
  },
  needConsent: {
    af: "Merk eers 'Ek stem in' hierbo.",
    zu: "Qala ngokumaka 'Ngiyavuma' ngenhla.",
    en: "Tick 'I agree' above first.",
  },
  noSignal: {
    af: 'Geen sein nie — die gevalle wag op die foon en word later gestuur.',
    zu: 'Ayikho inethiwekhi — izimo zilinda efonini, zizothunyelwa kamuva.',
    en: 'No signal — cases wait on the phone and will be sent later.',
  },
  demoNote: {
    af: "Op hierdie foon gestoor. In 'n volle ontplooiing gaan gevalle na die koöperasie se voorligtingsbeampte sodra daar sein is — in hierdie demo gesimuleer.",
    zu: 'Kugcinwe kule foni. Uma isetshenziswa ngokugcwele, izimo ziya kumeluleki we-co-op uma kunenethiwekhi — kulingiswa kule demo.',
    en: "Stored on this phone. In a full deployment, cases go to the co-op's extension officer once there is signal — simulated in this demo.",
  },
  trySample: { af: 'Probeer voorbeeld', zu: 'Zama isibonelo', en: 'Try sample' },
  sampleHint: {
    af: "Geen mielieblaar naby nie? Probeer 'n voorbeeldfoto:",
    zu: 'Alikho iqabunga lommbila eduze? Zama isithombe sesibonelo:',
    en: 'No maize leaf nearby? Try a sample photo:',
  },
  sendNow: { af: 'Stuur nou', zu: 'Thumela manje', en: 'Send now' },
  nothing: { af: 'Niks wag nie.', zu: 'Akukho lutho.', en: 'Nothing waiting.' },
  sent: { af: '✓ gestuur', zu: '✓ kuthunyelwe', en: '✓ sent' },
  waiting: { af: '⏳ wag', zu: '⏳ kulindile', en: '⏳ waiting' },
}
