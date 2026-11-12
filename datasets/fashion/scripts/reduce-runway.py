"""Reduce the Vogue Runway metadata to yearly look, show, tag and category counts.

Run from anywhere: uv run --with duckdb python -I datasets/fashion/scripts/reduce-runway.py
"""

import json
import re
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw" / "runway"
OUT = ROOT / "parts" / "runway.json"

DATASET = "https://huggingface.co/datasets/ROSCOSMOS/Vogue-Runway-Weburl-Dataset"
PARQUET_URL = f"{DATASET}/resolve/main/train.parquet"
LABEL_ZIPS = [
    "https://docs.aws.amazon.com/rekognition/latest/dg/samples/AmazonRekognitionLabels_v2.0.zip",
    "https://docs.aws.amazon.com/rekognition/latest/dg/samples/AmazonRekognitionLabels_v3.0.zip",
]
FETCHED = "2026-11-12"
MIN_TAG_COUNT = 200


def download(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "40for40-dataset/1.0"})
            with urllib.request.urlopen(req, timeout=300) as res:
                tmp = dest.with_suffix(dest.suffix + ".part")
                tmp.write_bytes(res.read())
                tmp.rename(dest)
                return dest
        except urllib.error.HTTPError as err:
            if err.code != 429 and err.code < 500:
                raise
        except urllib.error.URLError:
            pass
        time.sleep(2 ** attempt)
    raise RuntimeError(f"gave up downloading {url}")


def norm(label: str) -> str:
    return re.sub(r"[^a-z0-9]", "", label.lower())


def rekognition_labels() -> set[str]:
    labels = set()
    for url in LABEL_ZIPS:
        path = download(url, RAW / url.rsplit("/", 1)[1])
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.endswith(".csv") or "__MACOSX" in name:
                    continue
                data = zf.read(name)
                try:
                    text = data.decode("utf-8-sig")
                except UnicodeDecodeError:
                    text = data.decode("latin-1")
                for line in text.splitlines():
                    labels.add(norm(line.split(",")[0].strip('"')))
    labels.discard("label")
    return labels


def sig4(x: float) -> float:
    return float(f"{x:.4g}")


def by_year(rows) -> dict[str, int]:
    return {str(year): n for year, n in sorted(rows)}


def main() -> None:
    parquet = download(PARQUET_URL, RAW / "train.parquet")
    labels = rekognition_labels()
    db = duckdb.connect()
    db.execute(f"create view looks as select * from read_parquet('{parquet.as_posix()}', file_row_number = true)")

    looks_by_year = by_year(db.sql("select year, count(*) from looks group by 1").fetchall())
    shows_by_year = by_year(
        db.sql(
            "select year, count(*) from (select distinct designer, season, year, category from looks) group by 1"
        ).fetchall()
    )

    categories: dict[str, dict[str, int]] = {}
    for cat, year, n in db.sql(
        "select coalesce(category, 'Uncategorised'), year, count(*) from looks group by 1, 2 order by 1, 2"
    ).fetchall():
        categories.setdefault(cat, {})[str(year)] = n

    tag_rows = db.sql(
        """
        select tag, year, count(*) from (
          select distinct file_row_number, year, lower(unnest(cast(tags as varchar[]))) as tag from looks
        ) group by 1, 2
        """
    ).fetchall()

    totals: dict[str, int] = {}
    counts: dict[str, dict[str, int]] = {}
    for tag, year, n in tag_rows:
        totals[tag] = totals.get(tag, 0) + n
        counts.setdefault(tag, {})[str(year)] = n

    names = {t for t in totals if norm(t) not in labels}
    rare = {t for t, n in totals.items() if n < MIN_TAG_COUNT and t not in names}
    kept = sorted(t for t in totals if t not in names and t not in rare)

    counts_by_tag_year = {t: dict(sorted(counts[t].items())) for t in kept}
    share_by_tag_year = {
        t: {y: sig4(n / looks_by_year[y]) for y, n in counts_by_tag_year[t].items()} for t in kept
    }

    out = {
        "source": DATASET,
        "licence": "None stated. Images are Condé Nast's, so only derived counts are kept, never URLs.",
        "fetched": FETCHED,
        "notes": [
            "Years are collection years as labelled by Vogue Runway, so Spring 2016 shows ran in late 2015.",
            "A show is a distinct designer, season, year and category.",
            "Tags are AWS Rekognition auto labels, lowercased. Face recognition names of models are dropped.",
            f"Tags seen on fewer than {MIN_TAG_COUNT} looks overall are dropped.",
            "Shares are a tag's looks divided by that year's looks, to 4 significant figures.",
        ],
        "dropped": {
            "personNameTags": len(names),
            "personNameTagLooks": sum(totals[t] for t in names),
            "rareTags": len(rare),
            "rareTagLooks": sum(totals[t] for t in rare),
        },
        "looksByYear": looks_by_year,
        "showsByYear": shows_by_year,
        "countsByTagYear": counts_by_tag_year,
        "shareByTagYear": share_by_tag_year,
        "categories": categories,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"{sum(looks_by_year.values())} looks, {sum(shows_by_year.values())} shows, "
        f"{len(kept)} tags kept, {len(names)} name tags and {len(rare)} rare tags dropped"
    )


if __name__ == "__main__":
    main()
