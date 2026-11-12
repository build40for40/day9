You are reading one English Wikipedia article about a fashion trend. Find the sentences that say where the look started, who is credited, any competing claim, and what older place or culture it was borrowed from. Return JSON only.

The trend: {{TREND_NAME}} (id `{{TREND_ID}}`). What the dataset means by it: {{TREND_DESCRIPTION}}
The article: {{ARTICLE_TITLE}}

Return exactly this shape, with no text before or after it:

{
  "trend_id": "{{TREND_ID}}",
  "claims": [
    {
      "kind": "origin" | "rival" | "root",
      "place": "...",
      "place_type": "city" | "region" | "country" | "people",
      "year": 1964 | null,
      "year_precision": "year" | "decade" | "century" | null,
      "who": "..." | null,
      "hedged": true | false,
      "quote": "...",
      "note": "..."
    }
  ]
}

What each kind means:

- `origin`: where and when this look first appeared as the thing the trend names: where it was invented, first made, first sold, first worn as a fashion, or named. At most one origin per article, the one the article itself treats as the main account. `who` is the person, firm or group the sentence credits, if any.
- `rival`: a different origin the article presents as a competing or disputed claim for the same thing (another designer, city or country said to have done it first, or at the same time). One row per rival. Only when the article itself sets the claims against each other or credits more than one inventor. If you list a rival, there must also be an origin.
- `root`: the older place, people or culture the look was adopted, adapted, copied or imported from, where the article says so in words ("derived from", "adapted from", "introduced to Europe from", "originally worn by", "named after the town of"). `place` is where it came from. `year` is when the West (Europe or North America) picked it up, if the same quote says so, else null. `who` is who brought it over, if the quote says so. A trend can have a root and no origin, or several roots (one row each, at most three, the ones most directly about this look).

Rules:

- Never infer and never use what you know from outside the article. If the article does not say it in a sentence you can quote, leave it out. An empty `claims` list is a fine answer.
- `quote` is copied character for character from the article: one sentence, or at most two neighbouring sentences, under 400 characters. Do not stitch text from different parts of the article, do not tidy spelling or punctuation, do not add an ellipsis.
- The quote alone must carry the claim. `place` must be named in the quote, or be unmistakable from it (a street in a city, a people named after their homeland). If `year` is not null, the quote must contain that year, decade or century in digits or words.
- `place` is the most specific place the quote supports, as a plain English name: a city ("London", "Kanchipuram"), a region ("Kashmir", "Scottish Highlands", "West Africa", "Polynesia"), a country ("India", "Persia", "United States") or, when no place is given, a people ("Yoruba", "Plains Indians", "Inuit"). Use historical names as the quote does. "Europe", "the West", "the East", "Asia" and "the Orient" are too wide and do not count.
- `year`: the four-digit year the quote states. For a decade ("the 1960s", "early 1960s") set `year_precision` to "decade" and `year` to the first year of the decade, the fifth for "mid", the seventh for "late". For a century ("the 18th century") set `year_precision` to "century" and `year` to its first year (1700), 50 for "mid", 70 for "late". Years BC are negative. Never work a year out from anything else.
- `hedged` is true when the quote itself hedges or disputes the claim ("is said to", "may have", "according to legend", "claimed", "one theory", "possibly", "is often credited").
- Ignore later revivals and comebacks, where the look merely became popular later, and passing mentions of who wore it. Ignore ancient lookalikes that the article does not connect to this look.
- `note` is a few plain English words on what the quote says happened ("first shown at couture", "weavers copied Kashmiri shawls").
- If the article is about something broader than the trend (a whole company, a whole class of garment), only use sentences about the trend itself.
