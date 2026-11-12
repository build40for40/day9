export interface IntentQuestion {
  instructions: string;
  criteria: { true: string; false: string };
}

export interface FallbackClues {
  text: string;
  trend: boolean;
  era: boolean;
}

export interface IntentComponent {
  id: string;
  label: string;
  available: boolean;
  // Each is one yes or no for Jev about `search`. The component's score is its best answer.
  questions: Record<string, IntentQuestion>;
  // Stands in for Jev when it's down or unset.
  fallback: (clues: FallbackClues) => boolean;
}

// At or above this, a component is shown (or, when it isn't built yet, counted as wanted). Between 0.3 and this the
// search didn't settle it, and the page shows nothing for it.
export const SHOW_THRESHOLD = 0.7;
// Jev's probability that the search is about a trend it only loosely matched by words.
export const TREND_THRESHOLD = 0.7;
export const MAX_QUERY = 120;
export const INTENT_ENDPOINT = "/nerds-of-fashion/api/intent";

const has = (pattern: RegExp) => (text: string) => pattern.test(text);
const asksWhere = has(/\b(where|country|countries|city|cities|place|places|world|map|globe|origin|origins|originated?|invented|london|paris|milan|new york|britain|british|england|america|american|france|french|italy|italian)\b/);
const asksWhen = has(/\b(when|what year|which year|how long|peak|peaked|heyday|timeline|history|in fashion|in style)\b/);
const asksFuture = has(/\b(coming back|come back|comeback|return|returning|again|next year|future|forecast|predict|prediction|will|2027|2028|2029)\b/);
const asksRevival = has(/\b(revival|revived|came back|come back|comeback|retro|vintage|throwback|inspired by)\b/);
const asksColour = has(/\b(colou?rs?|pantone|shade|shades|hue|hues|palette)\b/);
const asksShape = has(/\b(silhouettes?|shape|shapes|hemlines?|hems?|waists?|waistline|shoulders?|skirt length)\b/);
const asksMuseum = has(/\b(museums?|v&a|victoria and albert|the met|archive|archives|collection|collections|designers?|couture)\b/);
const asksWords = has(/\b(books?|written|wrote|word|words|mentions?|mentioned|ngram|called|jumper|sweater)\b/);
const asksWait = has(/\b(how long|how many years|wait|waits|take to)\b/);
const asksRule = has(/\b(rule|cycle|cycles|(20|twenty|30|thirty)[- ]years?)\b/);
const asksRhythm = has(/\b(clockwork|rhythm|regular|regularly|evenly|in circles|spiral)\b/);
const asksLate = has(/\b(late|later|lag|lags|behind|delay|delayed|trail|trails|catch up)\b/);
const asksBritish = has(/\b(british|britain|uk|english|england)\b/);
const asksAmerican = has(/\b(american|america|usa|states)\b/);
const asksFading = has(/\b(going out|on the way out|on its way out|fading|dying|over soon|still be in)\b/);
const asksTrust = has(/\b(accurate|accuracy|trust|trusted|reliable|backtest|backtested|calibrated|calibration|how good|how sure|tested)\b/);
const asksModel = has(/\b(forecast|forecasts|prediction|predictions|model|guess|guesses|odds)\b/);
const asksKinds = has(/\b(hair|make-?up|shoes|footwear|accessories|subcultures?|categories|kinds?|types?)\b/);

// One entry per view in src/nerds/views, by its id, plus the ones people ask for that aren't built yet.
export const components = [
  {
    id: "globe",
    label: "the globe",
    available: true,
    questions: {
      where: {
        instructions: "Does the person who typed `search` want to know where in the world a fashion trend started or was worn?",
        criteria: {
          true: "They ask which place, country or city a garment, look or subculture came from or was popular in.",
          false: "They ask something else about fashion, such as when it was worn or what it is, and no place is asked about.",
        },
      },
      place: {
        instructions: "Does the person who typed `search` want to know what people in a named country or city were wearing?",
        criteria: {
          true: "They name a country or city and ask what was in fashion there.",
          false: "They name no country or city, such as when they only name a year, a decade or a garment.",
        },
      },
    },
    fallback: ({ text }) => asksWhere(text) && !asksWords(text),
  },
  {
    id: "board",
    label: "the Big Board",
    available: true,
    questions: {
      when: {
        instructions: "Does the person who typed `search` want to know when a named garment or look was in fashion?",
        criteria: {
          true: "They name a garment, look or subculture and ask about the years it was worn, how long it lasted or when it peaked.",
          false: "They name no garment or look, or they ask where it came from, what it is or whether it will return.",
        },
      },
    },
    fallback: ({ text, trend }) => trend && asksWhen(text) && !asksFuture(text),
  },
  {
    id: "dancefloor",
    label: "the Dance Floor",
    available: true,
    questions: {
      era: {
        instructions: "Does the person who typed `search` want to know which fashion trends were popular in a particular year or decade?",
        criteria: {
          true: "They name a year, a decade or an era and ask what was in fashion then, without naming one garment or one place.",
          false: "They name no year, decade or era, or they ask about one named garment or one named place.",
        },
      },
    },
    fallback: ({ text, trend, era }) => era && !trend && !asksWhere(text) && !asksColour(text) && !asksShape(text) && !asksMuseum(text),
  },
  {
    id: "stream",
    label: "the River of Trends",
    available: true,
    questions: {
      kinds: {
        instructions: "Does the person who typed `search` want to compare how busy different kinds of fashion were over the years?",
        criteria: {
          true: "They ask how clothes, subcultures, shoes and accessories, or hair and make-up rose and fell against each other over time.",
          false: "They ask about one named garment or look, or about a single year.",
        },
      },
    },
    fallback: ({ text, trend }) => !trend && asksKinds(text) && asksWhen(text),
  },
  {
    id: "strings",
    label: "String Theory",
    available: true,
    questions: {
      revival: {
        instructions: "Does the person who typed `search` want to know which past fashion a look was a revival of, or which looks have come back before?",
        criteria: {
          true: "They ask about a comeback that has already happened: what was revived, when, or which earlier era a look copied.",
          false: "They ask about the future, or about a look's first time in fashion.",
        },
      },
    },
    fallback: ({ text }) => asksRevival(text) && !asksFuture(text),
  },
  {
    id: "gaps",
    label: "the comeback clock",
    available: true,
    questions: {
      comeback: {
        instructions: "Does the person who typed `search` want to know whether or when a garment or look will be in fashion again in the coming years?",
        criteria: {
          true: "They name a garment or look and ask whether it is coming back or when it will return.",
          false: "They ask only about the past or the present, or they ask what will be worn next without naming a garment or look.",
        },
      },
      wait: {
        instructions: "Does the person who typed `search` want to know how many years fashion trends take to come back?",
        criteria: {
          true: "They ask how long a look stays away before it returns, or what the usual wait between comebacks is.",
          false: "They ask about one moment in time, or whether a named rule such as the 20 year cycle is true.",
        },
      },
    },
    fallback: ({ text, trend }) => asksFuture(text) && (trend || asksWait(text)) && !asksRule(text) && !asksTrust(text),
  },
  {
    id: "comeback-odds",
    label: "the comeback odds board",
    available: true,
    questions: {
      next: {
        instructions: "Does the person who typed `search` want to know which fashion trends are likely to come back in the next few years?",
        criteria: {
          true: "They ask what is due a comeback, which looks are about to return or what will be in fashion in a coming year such as 2028, without asking about one named garment.",
          false: "They ask whether one named garment or look will return, or they ask only about the past or the present.",
        },
      },
      fading: {
        instructions: "Does the person who typed `search` want to know which of today's fashion trends are about to go out of style?",
        criteria: {
          true: "They ask what is on its way out, what people will stop wearing soon or how much longer a current look will last.",
          false: "They ask about looks that went out of fashion in the past, or about what is coming back.",
        },
      },
    },
    fallback: ({ text, trend }) => (asksFading(text) || (asksFuture(text) && !trend && !asksWait(text))) && !asksRule(text) && !asksRhythm(text) && !asksTrust(text),
  },
  {
    id: "cycle",
    label: "the 20 year rule on trial",
    available: true,
    questions: {
      rule: {
        instructions: "Does the person who typed `search` want to know whether the saying that fashion repeats every 20 to 30 years is true?",
        criteria: {
          true: "They mention a rule or cycle of a set number of years, such as the 20 year rule, and ask whether fashion really follows it.",
          false: "They ask how long comebacks take without mentioning a rule or a set number of years, or they ask whether one named garment will return.",
        },
      },
    },
    fallback: ({ text }) => asksRule(text) && !asksRhythm(text),
  },
  {
    id: "spiral",
    label: "the comeback spiral",
    available: true,
    questions: {
      rhythm: {
        instructions: "Does the person who typed `search` want to know whether fashion comebacks happen at regular intervals?",
        criteria: {
          true: "They ask whether trends return like clockwork, whether fashion goes round in circles, or whether one look's comebacks are evenly spaced.",
          false: "They ask how many years a comeback takes, whether a 20 year rule is true, or about a single comeback.",
        },
      },
    },
    fallback: ({ text }) => asksRhythm(text),
  },
  {
    id: "backtest",
    label: "the forecast's school report",
    available: true,
    questions: {
      trust: {
        instructions: "Does the person who typed `search` want to know how accurate this site's fashion comeback forecast is?",
        criteria: {
          true: "They ask whether the predictions can be trusted, how the forecast was tested or how often its past guesses came true.",
          false: "They ask what the forecast says will come back, and nothing about how reliable it is.",
        },
      },
    },
    fallback: ({ text }) => asksTrust(text) && asksModel(text),
  },
  {
    id: "colour",
    label: "a century in colour",
    available: true,
    questions: {
      colour: {
        instructions: "Does the person who typed `search` want to know which colours were in fashion?",
        criteria: {
          true: "They ask about a colour, or about the colours of a year, a decade or an era.",
          false: "They ask about garments, shapes, places or dates and mention no colour.",
        },
      },
    },
    fallback: ({ text }) => asksColour(text),
  },
  {
    id: "silhouette",
    label: "the silhouette",
    available: true,
    questions: {
      shape: {
        instructions: "Does the person who typed `search` want to know how the shape of women's clothes changed?",
        criteria: {
          true: "They ask about hemlines, waistlines, shoulders or the overall outline of an outfit in a year or across the years.",
          false: "They ask about a garment, a colour or a subculture without asking about its shape or length.",
        },
      },
    },
    fallback: ({ text }) => asksShape(text),
  },
  {
    id: "museum",
    label: "the museum wardrobes",
    available: true,
    questions: {
      kept: {
        instructions: "Does the person who typed `search` want to see real garments that museums have kept?",
        criteria: {
          true: "They ask about museum collections, surviving pieces, designers' work in an archive, or what a real garment from a period looked like.",
          false: "They ask about a trend in general and mention no museum, archive, designer or surviving piece.",
        },
      },
    },
    fallback: ({ text }) => asksMuseum(text),
  },
  {
    id: "words",
    label: "the books chart",
    available: true,
    questions: {
      written: {
        instructions: "Does the person who typed `search` want to know how much a garment or look was written about?",
        criteria: {
          true: "They ask how often it appeared in books or when the word for it took off.",
          false: "They ask when or where it was worn, and nothing about writing, books or words.",
        },
      },
    },
    fallback: ({ text }) => asksWords(text) && !asksLate(text) && !(asksBritish(text) && asksAmerican(text)),
  },
  {
    id: "lag",
    label: "the late books chart",
    available: true,
    questions: {
      delay: {
        instructions: "Does the person who typed `search` want to know how long after a look is first worn books write about it the most?",
        criteria: {
          true: "They ask whether books or writers are late to fashion trends, or how many years the writing trails behind what people wear.",
          false: "They ask how often one garment was written about, and nothing about a delay between wearing it and writing about it.",
        },
      },
    },
    fallback: ({ text }) => asksWords(text) && asksLate(text),
  },
  {
    id: "uk-vs-us",
    label: "Britain against America in print",
    available: true,
    questions: {
      atlantic: {
        instructions: "Does the person who typed `search` want to compare how British books and American books wrote about a fashion?",
        criteria: {
          true: "They ask how writing about a look differed between Britain and America, such as which country's books took it up first or kept at it longer.",
          false: "They ask about books from one country or books in general, or they ask where a look was worn and nothing about writing.",
        },
      },
    },
    fallback: ({ text }) => asksWords(text) && asksBritish(text) && asksAmerican(text),
  },
  {
    id: "arcs",
    label: "Everything Comes Back",
    available: true,
    questions: {
      comeback: {
        instructions: "Does the person who typed `search` want to know which looks have come back, or how long comebacks take?",
        criteria: {
          true: "They ask about comebacks, revivals or the gap before a look returns, past or future.",
          false: "They ask about something other than looks returning.",
        },
      },
    },
    // Keywords already send comebacks to the gaps view, so only Jev picks this one.
    fallback: () => false,
  },
  {
    id: "ebb",
    label: "The Ebb and Flow",
    available: true,
    questions: {
      overview: {
        instructions: "Does the person who typed `search` want an overview of which trends rose and fell across the century?",
        criteria: {
          true: "They ask what was in over time, which trends defined each decade, or how fashion changed overall.",
          false: "They ask about one specific trend's detail, place, colour or shape.",
        },
      },
    },
    fallback: () => false,
  },
  {
    id: "hear",
    label: "Hear the Century",
    available: true,
    questions: {
      sound: {
        instructions: "Does the person who typed `search` want to hear fashion, or ask about sound or music?",
        criteria: {
          true: "They mention sound, music, listening, hearing or playing something.",
          false: "They mention nothing about sound or music.",
        },
      },
    },
    fallback: ({ text }) => /\b(sound|sounds|music|hear|listen|play|audio|song)\b/.test(text),
  },
  {
    id: "trend-card",
    label: "a trend card",
    available: false,
    questions: {
      what: {
        instructions: "Does the person who typed `search` want to know what a named garment or look is?",
        criteria: {
          true: "They name a garment, look or subculture and ask what it is, what it looks like or who wore it, or they type only its name.",
          false: "They name no garment or look, or they ask only where, when or whether it will return.",
        },
      },
    },
    fallback: ({ text, trend }) => trend && ![asksWhere, asksWhen, asksFuture, asksRevival, asksColour, asksShape, asksMuseum, asksWords].some((asks) => asks(text)),
  },
] as const satisfies readonly IntentComponent[];

export type ComponentId = (typeof components)[number]["id"];

export interface ComponentScore {
  id: ComponentId;
  score: number;
  available: boolean;
}

export interface IntentResult {
  q: string;
  components: ComponentScore[];
  trend: { id: string; name: string; score: number } | null;
  year: number | null;
  decade: number | null;
  ms: number;
  fallback: boolean;
}
