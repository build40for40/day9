# 100 years of Western fashion trends

The dataset behind Day 9: about 400 Western fashion trends from the 1920s to today, when each was in style, when it came back, and the evidence for it from books, museums and catwalks. It's high fashion as much as street style: what was in, not what everyone wore.

Everything ends up in one static file, `public/fashion.json`, which the site serves as is. There's no backend.

## What's in the file

- `meta`: title, years covered, region names, sources with licences and credits, and caveats.
- `trends`: one entry per trend with its name, aliases, category, gender, regions, periods, a short description and up to three Wikipedia quotes. Each also has its Ngram curves (aligned to `series.ngramYears`), sparse yearly `counts` from the V&A, the Met and Vogue Runway where `mappings.json` links it to them, and up to six V&A objects with images as `examples`. Each trend also has `origins`: sourced claims about where it started (`kind: "origin"`), who else claims it (`"rival"`) and what it was borrowed from (`"root"`), each with `place`, `lat`, `lon`, `year`, `yearPrecision` (`year`, `decade`, `century` or null), `who`, `confidence`, and the `quote` and `url` it rests on. The list is empty for the 265 trends with no sourced claim.
- `revivals`: when a trend (or a whole era, when `trend` is null) came back, with the quote that says so.
- `series`: totals to normalise against: V&A and Met objects per decade, and runway looks per year.
- `colours`: Pantone's Colours of the Year, and colour words found in V&A descriptions per decade.

Years are integers. Regions are `UK`, `US`, `FR`, `IT` or `global`.

## Sources

| Source | What it gives | Licence | Credit |
| --- | --- | --- | --- |
| Wikipedia | Trends, dates, regions, quotes and revivals from the decade in fashion and subculture articles | CC BY-SA 4.0 | Wikipedia contributors |
| Wikipedia, per trend | Where 134 trends started, rival claims and roots, from each trend's own article | CC BY-SA 4.0 | Wikipedia contributors |
| Google Books Ngram | How often each trend's phrases appear in British and American books, 1920 to 2022 | CC BY 3.0 | Google Books Ngram Viewer |
| V&A | About 6,500 womenswear objects with type, designer, place, materials, colours and images | Data free to reuse, images non-commercial with credit | © Victoria and Albert Museum, London |
| The Met | About 18,000 Costume Institute objects counted by name and year | CC0 | The Metropolitan Museum of Art Open Access |
| Vogue Runway | Share of catwalk looks with each auto tag, 1988 onwards | None stated, so only counts are kept | Vogue Runway, via the ROSCOSMOS dataset on Hugging Face, tags by AWS Rekognition |
| Pantone | Colour of the Year since 2000 | CC BY-SA 4.0 (via Wikipedia) | Pantone |

## Folders

- `scripts/`: one script per step. Node with no dependencies, plus one Python script run through `uv`.
- `parts/`: one pretty-printed JSON file per source. Committed, so any step can be rerun or edited by hand.
- `raw/`: downloads and caches. Gitignored, and about half a gigabyte once everything has run.
- `mappings.json`: which museum objects and runway tags count as evidence of each trend.

## Rebuilding

Run these from the repo root, in order. Each step caches what it downloads in `raw/`, so a rerun only fetches what's missing.

```sh
node datasets/fashion/scripts/fetch-wikipedia.mjs "1920s in Western fashion" "1930s in Western fashion" "1940s in Western fashion" "1950s in Western fashion" "1960s in fashion" "1970s in fashion" "1980s in fashion" "1990s in fashion" "2000s in fashion" "2010s in fashion" "2020s in fashion" "Athleisure" "Britpop" "Cottagecore" "Disco" "Flapper" "Glam rock" "Goth subculture" "Grunge fashion" "Hippie" "Indie sleaze" "Mod (subculture)" "New Romantic" "Normcore" "Preppy" "Punk fashion" "Rave" "Skinhead" "Teddy Boy" "Y2K aesthetic"
node datasets/fashion/scripts/build-wiki-1920s-1950s.mjs
node datasets/fashion/scripts/build-wiki-1960s-1980s.mjs
node datasets/fashion/scripts/build-wiki-1990s-2020s.mjs
node datasets/fashion/scripts/normalise-trends.mjs
node datasets/fashion/scripts/fetch-ngram.mjs
node datasets/fashion/scripts/fetch-vam.mjs
node datasets/fashion/scripts/reduce-met.mjs
uv run --with duckdb python -I datasets/fashion/scripts/reduce-runway.py
node datasets/fashion/scripts/fetch-pantone.mjs
node datasets/fashion/globe/origins/assemble.mjs
node datasets/fashion/scripts/assemble.mjs
```

The three `build-wiki` scripts turn hand-written extractions (the `.spec.txt` files and the table inside `build-wiki-1960s-1980s.mjs`) into rows, copying each quote word for word from the cached article. `normalise-trends.mjs` merges those rows into canonical trends and revivals using the trend table inside it. `fetch-vam.mjs --offline` rebuilds the V&A part from the cache without any requests.

`globe/origins/assemble.mjs` writes `parts/origins.json` from the hand reviewed origins research (see "The origins research" below). It needs no downloads.

`assemble.mjs` is deterministic: the same parts and mappings give the same bytes. It prints a warning for any mapping that points at a type, name or tag that doesn't exist, and for any part that's missing.

## The comeback forecast

```sh
node datasets/fashion/scripts/forecast.mjs
```

Reads `public/fashion.json` and writes `public/forecast.json`, which the globe and the comeback views at `/nerds-of-fashion` read for 2027 to 2029. Rerun it whenever `fashion.json` changes.

- A trend's periods, in any region, are merged into waves. Each wave either never returns or returns after a gap, and the model learns the gaps from every trend that came back.
- A trend that is out gets the chance a new wave starts by each of the next three years. A trend that is in gets the chance it is still in.
- A trend with one wave has no gap to learn from, so it is `unknown` and never gets a number.
- The script backtests itself from 1990 on and saves the result in `meta.backtest`, with `calibration` buckets of what it said against what happened. On this dataset it is close to a coin toss (`auc` near 0.5), because the periods come from decade-level article sections. Treat the numbers as a talking point, not a prediction.

## Extending it

- **Link a trend to museum or runway evidence:** add or edit its entry in `mappings.json`, then run `assemble.mjs`. The `about` block at the top explains the rule format. Keep it conservative: map a type only when it clearly is the trend.
- **Add or change a trend:** edit the trend table in `normalise-trends.mjs` (or the extraction it reads), rerun it, then `fetch-ngram.mjs` for any new phrases, then `assemble.mjs`.
- **Add or fix an origin:** see "The origins research" below. Never edit `parts/origins.json` or `fashion.json` by hand, both are generated.
- **Add a source:** write a script that saves a new file in `parts/`, then teach `assemble.mjs` to read it and add it to `meta.sources`.

## Caveats

- It's mostly high fashion from books, encyclopaedias and museums, not what everyone wore.
- Museums collect couture, famous names and whatever survived. Their counts show what got collected, not what was popular, and they thin out after 2000.
- Books trail clothes, so Ngram curves often peak years after a look was in the shops. Some phrases also mean other things (Paisley the town, Cardigan the earl), so compare the shape of a curve, not its height. The newest micro trends have no curve at all.
- Runway counts start in 1988 and are thin before 2000. They're auto tags, and the tagging changed over the years too. Years with fewer than 100 looks are left out.
- Museum dates pile up on round years, because an object dated to a decade gets its first year. Group by decade before reading much into a single year.
- A few periods and revival originals start before 1920, so clamp them to the timeline.
- The scope is Western: the UK, the US, France and Italy, plus looks not tied to one place.

## Who Wore It First?

`story/` builds Room VII of the exhibition: pick a look and a globe tells its origin story in a few stops (borrowed from, born, disputed, travelled, everywhere, back again), with the quotes and sources behind a tap. It is a deliberately simpler take on the Trend Atlas below, built from the same research.

```sh
node datasets/fashion/story/build.mjs
```

It reads `public/fashion.json` and `globe/arrivals-pilot.json`, and writes `raw/story/who-wore-it-first.html` (the page as a Claude artifact, gitignored) and `public/who-wore-it-first.html` (the same page with a document shell, served at `/nerds-of-fashion/who-wore-it-first`). The served file is committed, so rerun the build and commit it after changing `story/page.html` or the data. The build prints how many looks get each kind of stop.

A look only gets a stop when there is a source for it, so stories vary in length. When no origin is sourced, "born" falls back to the first country the dataset records the look in, and says it is a guess.

## The Trend Atlas globe

`globe/` builds a single self-contained page: a globe showing where each trend was born, where it travelled, when it came back, and what each place was wearing in any year. It was published as a Claude artifact on Day 9.

```sh
node datasets/fashion/globe/build.mjs
```

It reads `public/fashion.json` and writes `raw/globe/trend-atlas.html` (gitignored). The site no longer serves this page: `public/atlas.html` now redirects to Who Wore It First?. Run the build with `--site` to write the full atlas over that redirect again.

- `build.mjs`: works out birthplaces and journeys, embeds the photos, and inlines everything into the page. It prints how much of the dataset the globe covers.
- `page.html` and `page.js`: the page shell and its script. Edit these to change how it looks or behaves.
- `origins.json`: sourced birthplaces, rival claims and roots from the origins research (see below). The same rows are copied to `parts/origins.json` for the dataset. `rejected.json` holds every claim that was thrown out, and why.
- `arrivals-pilot.json`: sourced arrival years for eight trends in places beyond the dataset's four countries, copied from the `arrivals-pilot` branch of the `day9` repo.
- `land-110m.json`: coastlines from Natural Earth, via the `world-atlas` package.

The rules, which are choices and not facts:

- **Birthplace, the fallback rule:** the named country (UK, US, France or Italy) where a trend is first recorded, but only when that is no later than its first worldwide period. Otherwise the country is just where a later revival was written up, and the trend is left off the globe. About 40% of trends pass. The page labels these "rough guess".
- **Birthplace, sourced:** when `origins.json` has an `origin` row for a trend, that place, year and credit win over the fallback rule and the page labels it "sourced", with the quote. If the place is inside one of the four countries the trend still belongs to that country's wardrobe, and the dot is drawn at the exact spot. Anywhere else becomes a new place on the globe. Its year on the timeline is the sourced year (never before 1920, where the timeline starts), or the earliest record anywhere if the source gives no year.
- **Rival claims** (`rival` rows) are shown as contenders beside the origin, each with its own quote, under "it depends who you ask". Journeys are still drawn from the origin, because a line has to start somewhere.
- **Roots** (`root` rows) are where the look was borrowed from. Each draws a dotted line from the root to the birthplace. "Send it home" pulls the journeys back to the birthplace and then walks the trend on to its first root (the best sourced one), so the birthplace loses it too. That only happens when the birthplace is in the West. A trend born outside it (the kaftan in West Asia) is already home, and its root is listed as the route it took.
- **A root and no birthplace:** the trend goes on the globe at its root, labelled "roots only".
- **On record earlier:** when a sourced origin overrules the fallback rule, the other country's older record stays as a dashed line marked "on record earlier" (punk: sourced to the UK in the mid 1970s, on record in the US from 1970).
- **A journey** is another country's first period. It is drawn dashed as "picked up later" when it starts more than five years after the birthplace's first wave ended, because that is a revival and not travel.
- **A place is lit** in a year when one of its periods covers that year. Places from the pilot have no end date, so they stay lit from their arrival year.

### The origins research

`origins.json` answers three questions per trend, from each trend's own English Wikipedia article and not the decade summaries the rest of the dataset uses: where did it start and who gets the credit (`origin`), who else claims it (`rival`), and what was it borrowed from (`root`). Every row has the place with its latitude and longitude, a year with its precision (`year`, `decade` or `century`, or null), who is credited, a confidence, the article link and the exact sentence. Years BC are negative. The rows also go into `fashion.json` as each trend's `origins`.

262 of the 399 trends have been researched (`origins/pilot.json`): a pilot of 86 (the trends the globe listed as having a well dated journey, plus every trend whose name hints at roots outside the UK, the US, France and Italy), then every other garment, accessory, fabric, pattern and shoe. Colours, silhouettes, makeup, hair and subcultures are not done.

```sh
node datasets/fashion/globe/origins/fetch.mjs      # 1. cache each article as text in raw/origins/
                                                   # 2. answer origins/prompt.md for each article, into origins/extracted/
node datasets/fashion/globe/origins/check.mjs      # 3. check every claim against its article, by rule
                                                   # 4. hand review: a verdict for every surviving claim in origins/review.json
node datasets/fashion/globe/origins/assemble.mjs   # 5. write globe/origins.json, parts/origins.json and globe/rejected.json
node datasets/fashion/scripts/assemble.mjs         # 6. fold the part into fashion.json
```

- **Step 2 is a language model, steps 3 to 6 are not.** On 12 Nov 2026 the prompt was answered by Claude Sonnet subagents in Claude Code, one answer file per trend. No API key was needed and none is in the scripts.
- **The rules in `check.mjs`:** the quote must be in the cached article word for word and under 400 characters, the place must be narrower than a continent, the quote must state the year, decade or century it is filed under, and a rival needs an origin to rival.
- **The hand review** (`origins/review.json`) gives every surviving claim a verdict and a reason. It can refile a real quote (an "earliest evidence anywhere" origin becomes a root), fix its place or drop a year the quote does not really give, or lower its confidence. It never edits a quote. Coordinates in `origins/places.json` are typed in by hand.
- **Confidence is a rule:** high for an exact year with no hedging in the quote, low when the quote hedges ("is said to", "claimed") or gives no better than a century or no date, medium otherwise.
- **To add a trend:** give it a title in `origins/pilot.json` and run the steps. `assemble.mjs` refuses to finish until every claim has a verdict and every kept place has coordinates.
- **Result:** 215 claims extracted, 2 rejected by rule, 20 by hand, 193 kept. 113 trends have an origin, 15 a rival claim and 49 a root, 134 trends in all. 128 researched trends got nothing.
- **Where it fails:** 37 trends have no article of their own (the New Look, logomania, ripped jeans, statement jewellery), or share one with another trend. Titles that land on a broad article give nothing (maxi dress on Dress, skirt suit on Suit, tube socks on Sock). Many articles tell the story without one sentence naming a place (cardigan, little black dress, go-go boots, power suit). Peoples and regions are a point on the map only by convention. 126 of the 193 rows are low confidence, mostly because they carry no date.
