# Day 9

Day 9 of 40 for 40, built live on Twitch on Thursday 12 November 2026. The problem is "Deciding what to wear", from Samira. Work is tracked on the Superthread `day9` board and the "Day 9" page.

- **Form factor:** data visualisation.
- **Name:** TBC. Once it has one, this repo is renamed after it and the app is served at `build40for40.com/<app>/`.

Shared 40 for 40 context lives in `../AGENTS.md`.

## The problem

i want a clueless wardrobe app that tells me what to wear from my cupboard.

## Arrivals pilot: when did each trend reach each place?

The globe ("Who wore it first?") needs, for each trend, where it started and the year it caught on elsewhere. `scripts/arrivals.mjs` tests four ways of getting that on ten trends (miniskirt, punk fashion, the New Look, bell-bottoms, shoulder pads, hip hop fashion, grunge fashion, skinny jeans, Harajuku street style, athleisure) and writes `data/arrivals.json`. Every row carries its source and the sentence or counts it rests on. A pair nobody dates is left out, never guessed.

```sh
node scripts/arrivals.mjs             # all four methods, then assemble (responses are cached in data/raw/, gitignored)
node scripts/arrivals.mjs --assemble  # only rebuild data/arrivals.json from the parts in data/arrivals/
```

The Wikipedia step calls Claude (`claude-sonnet-5-5`, or `ARRIVALS_MODEL`) and needs `ANTHROPIC_API_KEY` for any article with no cached answer. Without a key it re-checks the answers already in `data/raw/`. For the pilot run there was no key, so Sonnet subagents in Claude Code answered the same prompt (`scripts/arrivals-1-prompt.md`); the API path in `arrivals-1-wikipedia-extract.mjs` has not been run yet.

**Result (12 Nov 2026): 80 rows, 49 trend and country or city pairs, plus 30 trend and language pairs from Ngram. 29 of the 49 are medium or high confidence.** Miniskirt has 17 places, Harajuku and athleisure one each.

| Method | Works? | Pairs dated | Trust |
| --- | --- | --- | --- |
| 3. Newspaper archives | Yes, the best one | 29 (Norway 9 of 10 trends, Netherlands 7, Luxembourg 7, Germany 3, Estonia 3) | High when the word is unmistakable: "minirok" goes from 0 Dutch articles in 1965 to 429 in 1966. Medium for music words (punk, hip hop, grunge), where it dates the scene, not the clothes. Low when the busiest year has under 50 hits |
| 1. Wikipedia in every language + Claude | Partly | 21 kept from 73 extracted sentences (99 articles read out of 170 language editions) | Every quote is checked word for word against its article, so nothing is made up. But a real quote is not always an arrival: a hand review of the 26 that survived the rules rejected 5 (`data/arrivals/rejected.json`). Famous trends only: miniskirt gives 13 places, hip hop, grunge, Harajuku and athleisure give none |
| 2. Google Books Ngram | Weak | 30, by language not country | Low. The first rise in books is a real signal (miniskirt rises in 1966 in English, French, German, Spanish and Italian alike), but lags are 0 to 3 years, about the size of the noise, and a language is not a place on a globe |
| 4. Wikidata | No | 0 | One inception year in ten trends (grunge, 1980) and no place of origin. Origins come from Wikipedia instead |

**Can the globe run on real data? Yes, for a north-west Europe slice; no, for the whole world.** Newspapers put a trustworthy year on Norway, the Netherlands and Luxembourg for most trends, and Wikipedia adds scattered far places (Japan, the Soviet Union, Australia, Mexico City) for the famous ones. Nothing here dates Africa, South America or most of Asia.

**Scaling to 150 trends: realistic for roughly half.** The newspaper method is mechanical once each trend has a local word in Dutch, Norwegian, German and French (`data/arrivals/terms.json`, hand-edited), at about 30 requests per trend per archive. It only works for trends with a distinctive name. Colours, silhouettes and everyday garments ("dress", "red") cannot be counted this way. The Wikipedia step costs about 35k tokens per trend and needs a human pass over what it returns.

How the rules work, briefly:

- **Origin** is the place and year in the English Wikipedia article when it gives an exact year, else the year most editions agree on, else a decade (marked `origin_year_precision: "decade"`). Shoulder pads and skinny jeans have no sourced origin, so theirs is `null`.
- **Newspaper arrival** is the first year a count reaches 5% of the first wave's busiest year (and twice the background noise) with the next year reaching it too.
- **Wikipedia arrival** must fall within 15 years of the origin. Bans and moral panics are kept as `year_is: "latest"` with low confidence: they prove the trend was there by then.
- **Ngram arrival** is the origin year plus the lag between the local word's first rise and the English (or French) word's first rise.
- **High confidence** means a sharp jump on an unmistakable word in a big archive, or two methods agreeing within two years.

Gotchas found on the way:

- **Wikimedia `api.php` rate limits anonymous scripts to a handful of requests a minute** (429). `index.php?action=render` and `action=raw` are not limited, so article text comes from there.
- **Ngram silently returns English for a corpus name it does not know.** Hebrew is `iw`, not `he`; `zh` works, `zh-Hans` does not.
- **Ngram first rise must be measured against the first wave**, not the all-time peak, which for most trends is decades later.
- **Short words pick up OCR noise**: "punk" matches hundreds of Norwegian and Estonian pages a year before 1976. Use "punkrock" or "punkere".
- English Wikipedia has no New Look article (it redirects to Dior), so language links are taken from the French one.

Dead ends for newspapers, don't retry: Gallica (Cloudflare 403), Trove and NYT (need a key), Chronicling America (moved under loc.gov, 404, and the Library of Congress API is blocked), Papers Past (Incapsula challenge), Swiss e-newspaperarchives, the Spanish Hemeroteca Digital, the California Digital Newspaper Collection, NYS Historic Newspapers and the National Library of Israel (403 or a browser challenge), Swedish data.kb.se (returns no full-text hits), Finnish digi.kansalliskirjasto.fi, Austrian ANNO and BelgicaPress (web pages only, no API), GDELT (429). DIGAR in Estonia works but starts answering 403 after a few hundred requests, so the hip hop row is missing. The German portal has only a few thousand pages a year after 1950. Delpher stops in 1995, so it cannot date skinny jeans or athleisure.

Wikipedia text is CC BY-SA and Ngram is CC BY 3.0: credit both on the site.
