You are reading one Wikipedia article (in any language) about a fashion trend. Find every sentence that dates the trend in a named country or city, and return JSON only.

The trend: {{TERM}}

Return exactly this shape, with no text before or after it:

{
  "origin": { "place": "...", "place_type": "city" | "country", "year": 1964, "year_precision": "year" | "decade", "quote": "...", "quote_en": "..." } | null,
  "arrivals": [
    { "place": "...", "place_type": "city" | "country", "year": 1966, "year_precision": "year" | "decade", "event": "...", "quote": "...", "quote_en": "..." }
  ]
}

Rules:

- `origin` is where and when this trend first appeared as a fashion, if the article says so in one sentence. Otherwise null. Ignore ancient or unrelated precedents (a Bronze Age skirt is not the origin of the miniskirt).
- `arrivals` are other places the trend reached: where it was first worn, sold, shown, adopted, became popular, or was banned or condemned (a ban proves it had arrived). One entry per place per article, the earliest dated one. Leave out the origin place, later revivals and comebacks, and anything about one person's life that says nothing about the place.
- `place` is the English name of a country or city (use "United Kingdom", "United States", "Soviet Union", "West Germany" and so on as the sentence means). Regions wider than a country ("Europe", "the West", "Africa") do not count.
- `quote` is copied character for character from the article, in the article's language: one sentence, or at most two neighbouring sentences, under 400 characters. It must contain the year or decade itself, in digits. The place must be named in the quote, or be unmistakable from the quote (a city's street, a national newspaper). Do not stitch text from different parts of the article and do not tidy the spelling.
- `year` is the four-digit year the quote states. If the quote only gives a decade, set `year_precision` to "decade" and `year` to: the first year of the decade for "the 1960s" or "early 1960s", the fifth for "mid-1960s", the seventh for "late 1960s". Never work a year out from anything else and never use what you know from outside the article.
- `event` is a few English words for what happened ("first sold", "banned", "became popular").
- `quote_en` is a plain English translation of the quote (repeat the quote if it is already English).
- If the article dates nothing in a named place, return {"origin": null, "arrivals": []}.
