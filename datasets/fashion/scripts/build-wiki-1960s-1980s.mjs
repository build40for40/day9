#!/usr/bin/env node
// Usage: node fetch-wikipedia.mjs <titles below> && node build-wiki-1960s-1980s.mjs
// Rows were extracted by hand from the cached article text. Each row names a fragment of
// its supporting sentence; this script expands it to the full verbatim sentence and fails
// if a fragment is missing or ambiguous.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, "..", "raw", "wikipedia");
const outFile = join(here, "..", "parts", "wiki-1960s-1980s.json");

const ARTICLES = {
  s60: "1960s in fashion",
  s70: "1970s in fashion",
  s80: "1980s in fashion",
  mod: "Mod (subculture)",
  hip: "Hippie",
  punk: "Punk fashion",
  glam: "Glam rock",
  disco: "Disco",
  nr: "New Romantic",
  goth: "Goth subculture",
  skin: "Skinhead",
  prep: "Preppy",
};

const CATEGORIES = new Set([
  "garment", "silhouette", "colour", "pattern", "fabric", "accessory",
  "footwear", "hair", "makeup", "subculture",
]);
const GENDERS = new Set(["women", "men", "unisex"]);
const REGIONS = new Set(["UK", "US", "FR", "IT", "global"]);

const specs = [];
const revivalSpecs = [];
let article = null;

const art = (key) => {
  article = key;
};

// q(fragment, defaults, ...items): every item is "term:category" or ["term:category", overrides].
// defaults/overrides: g gender, y [start, end], r region, s subculture.
function q(fragment, defaults, ...items) {
  for (const item of items) {
    const [label, over = {}] = Array.isArray(item) ? item : [item];
    const [term, category] = label.split(":");
    const o = { g: "unisex", r: "global", s: null, ...defaults, ...over };
    specs.push({ term, category, gender: o.g, start: o.y[0], end: o.y[1], region: o.r, subculture: o.s, article, fragment });
  }
}

function rv(term, original, revival, fragment) {
  revivalSpecs.push({ term, original, revival, article, fragment });
}

// ---------------------------------------------------------------- 1960s in fashion
art("s60");
const e60 = [1960, 1963], m60 = [1964, 1966], l60 = [1967, 1969], d60 = [1960, 1969];

q("Designer Mary Quant helped popularize the miniskirt", { g: "women", y: [1964, 1969], r: "UK" }, "miniskirt:garment");
q("Examples included the miniskirt, culottes, go-go boots", { g: "women", y: [1964, 1969], r: "UK" }, "culottes:garment");
q("Bright colors and bold patterns were also fashionable", { y: d60 }, "bright colours:colour", "bold patterns:pattern");
q("psychedelic prints becoming associated with the counterculture", { y: l60, s: "hippie" }, "psychedelic prints:pattern");
q("During the early and mid-1960s, the Mod subculture", { g: "men", y: [1960, 1966], r: "UK", s: "mod" }, "mod:subculture");
q("Mods favored tailored suits, narrow trousers", { g: "men", y: [1960, 1966], r: "UK", s: "mod" }, "tailored suit:garment", "narrow trousers:garment");
q("By the late 1960s, the hippie movement had influenced clothing styles", { y: l60, s: "hippie" },
  "hippie:subculture", "batik:pattern", "paisley:pattern", "tie-dye:pattern");

q("In addition to tailored skirts, women wore tapered-toe", { g: "women", y: e60 },
  "tailored skirt:garment", "stiletto pumps:footwear", "gloves:accessory", "bouffant:hair",
  "boxy suit jacket:garment", ["chanel-style cardigan suit:garment", { r: "FR" }]);
q("known as shifts, were also in style", { g: "women", y: e60 }, "shift dress:garment");
q("regal-looking full-skirted or columnar evening dresses", { g: "women", y: e60 },
  "full-skirted evening gown:garment", "column gown:garment", "brocade:fabric", "damask:fabric",
  "cloqué:fabric", "chiffon:fabric", "boatneck:silhouette", "fitted waist:silhouette");
q("With their eveningwear, women would wear evening gloves", { g: "women", y: e60, r: "US" }, "evening gloves:accessory");
q("The early 1960s gave birth to drainpipe jeans and capri pants", { g: "women", y: e60 }, "drainpipe jeans:garment", "capri pants:garment");
q("Casual dress became more unisex and often consisted of plaid button-down shirts", { y: e60 },
  "plaid button-down shirt:garment", "slim jeans:garment", ["slacks:garment", { g: "women" }]);
q("These included Levi Strauss jeans", { g: "women", y: e60, r: "US" }, "levi's jeans:garment", ["stretch jeans:garment", { r: "global" }], ["elastane:fabric", { r: "global" }]);
q("it had become acceptable for women to wear them every day", { g: "women", y: e60 }, "women's trousers:garment");
q("Mid-thigh cut trousers, also known as shorts, evolved around 1969", { g: "women", y: [1969, 1969] }, "shorts:garment");
q("designers occasionally presented full palazzo pants", { g: "women", y: e60 }, "palazzo pants:garment");
q("with stirrup pants extending the length further", { g: "women", y: e60 }, "stirrup pants:garment");
q("These were given names like stretch pants or ski pants", { g: "women", y: e60 }, "ski pants:garment");
q("skirt-looking trousers called culottes", { g: "women", y: e60, r: "US" }, "culottes:garment", "culotte suit:garment");
q("chiffon culottes and harem pants", { g: "women", y: [1961, 1963], r: "US" }, "harem pants:garment");
q("pointy-toed ankle boots had begun to be seen", { g: "women", y: [1959, 1963] }, "pointy-toed ankle boots:footwear", "flat knee-high boots:footwear");
q("the first signs of what would become a norm that would last for at least twenty years", { g: "women", y: [1962, 1982] }, "women's boots:footwear");
q("Boots for warm weather were presented as well", { g: "women", y: [1962, 1973] }, "summer boots:footwear");
q("with some reaching the thigh", { g: "women", y: [1963, 1963], r: "FR" }, "thigh-high boots:footwear");
q("Calf-high boots were the most favored at this time", { g: "women", y: [1963, 1965], r: "FR" }, "calf-high boots:footwear");
q("would be the first boots to be referred to as go-go boots", { g: "women", y: [1963, 1969] }, "go-go boots:footwear");

q("rather large versions of bikinis were featured", { g: "women", y: [1963, 1966], r: "US" }, "bikini:garment");
q("The monokini, also known as", { g: "women", y: [1964, 1964], r: "US" }, "monokini:garment");
q("even designers like Yves Saint Laurent showed the look during its peak", { g: "women", y: [1963, 1967], r: "FR" }, "space age:silhouette");
q("Synthetic material was popular among space-age fashion designers", { g: "women", y: m60 }, "synthetic fabrics:fabric");
q("fabrics like nylon, corfam, orlon, terylene, lurex and spandex", { g: "women", y: m60 },
  "nylon:fabric", "orlon:fabric", "terylene:fabric", "lurex:fabric", "spandex:fabric");
q("12 Unwearable Dresses in Contemporary Materials", { g: "women", y: [1966, 1966], r: "FR" }, "chain mail:fabric", "plastic dress:garment");
q("Non-cloth material, such as polyester, lucite, and PVC", { g: "women", y: m60 }, "polyester:fabric", "lucite:fabric", "pvc:fabric");
q("The space age look featured boxy shapes, thigh-length hemlines", { g: "women", y: m60 }, "boxy silhouette:silhouette", "thigh-length hemline:silhouette");
q("For daytime outerwear, vinyl raincoats", { g: "women", y: m60 },
  "vinyl raincoat:garment", "swing coat:garment", "bubble dress:garment", "helmet hat:accessory", "faux fur:fabric");
q("In 1966, the Nehru jacket arrived on the fashion scene", { y: [1966, 1969] }, "nehru jacket:garment");
q("Waistlines for women were left unmarked", { g: "women", y: m60 }, "unmarked waist:silhouette", "rising hemlines:silhouette");
q("Metallic silver was a prominent color in space-age fashions", { g: "women", y: [1965, 1966] }, "metallic silver:colour", ["white:colour", { y: m60, r: "FR" }]);
q("The futuristic-looking geometry of the Op Art", { g: "women", y: m60 }, "op art print:pattern", ["mondrian dress:garment", { y: [1965, 1965], r: "FR" }]);
q("Fluorescent colors (also known as day-glo or neon)", { g: "women", y: [1964, 1967] }, "neon colours:colour", ["light-up dress:garment", { y: [1967, 1967], r: "US" }]);
q("Footwear for women included low-heeled sandals and kitten-heeled pumps", { g: "women", y: m60 },
  "low-heeled sandals:footwear", "kitten heels:footwear", "clear plastic shoes:footwear");
q("Shoes and boots were often made of patent leather or vinyl", { g: "women", y: m60 }, "patent leather:fabric", "vinyl:fabric");
q("Pierre Cardin was best known for his helmets, short tunics, and goggles", { g: "women", y: m60, r: "FR" }, "short tunic:garment", "goggles:accessory");

q("The so-called \"Chelsea Look\"", { g: "women", y: [1961, 1966], r: "UK" }, "chelsea girl:subculture");
q("heralded the arrival of the \"moon girl\" look", { g: "women", y: [1964, 1966], r: "FR" }, "moon girl:silhouette");
q("the term \"Youthquake\" came to mean the power of young people", { y: m60, r: "UK" }, "youthquake:subculture");
q("The fabulous \"little girl\" look was introduced to USA", { g: "women", y: m60, r: "US" },
  "little girl look:silhouette", "bows:accessory", "patterned knee socks:accessory");
q("During the mid-1960s, mod girls wore very short miniskirts", { g: "women", y: m60, r: "UK", s: "mod" },
  "houndstooth:pattern", "geometric prints:pattern", "sleeveless tunic:garment");
q("Flared trousers and bell bottoms appeared in 1964", { g: "women", y: [1964, 1969] }, "flared trousers:garment");
q("Bell bottoms were usually worn with chiffon blouses", { g: "women", y: m60 }, "chiffon blouse:garment", "polo neck:garment", "crop top:garment");
q("These were made in a variety of materials including heavy denims", { g: "women", y: m60 }, "denim:fabric", "silk:fabric");
q("Variations of polyester were worn along with acrylics", { g: "women", y: m60 }, "acrylic:fabric");
q("A popular look for women was the suede mini-skirt", { g: "women", y: m60 },
  "suede miniskirt:garment", "square-toed boots:footwear", "newsboy cap:accessory", "beret:accessory");
q("Velvet mini dresses with lace-collars", { g: "women", y: m60 }, "velvet mini dress:garment", "tent dress:garment", "lace collar:accessory");
q("False eyelashes were in vogue", { g: "women", y: m60 }, "false eyelashes:makeup", "pale lipstick:makeup");
q("These were known as \"micro-minis\"", { g: "women", y: [1968, 1969] }, "micro-mini:garment");
q("This was when the \"angel dress\" first made", { g: "women", y: [1968, 1969] }, "angel dress:garment");
q("A micro-mini dress with a flared skirt and long, wide trumpet sleeves", { g: "women", y: [1968, 1969] },
  "trumpet sleeves:silhouette", "patterned tights:accessory", "velvet:fabric", "psychedelic print dress:garment");
q("The cowled-neck \"monk dress\"", { g: "women", y: [1968, 1969] }, "monk dress:garment");
q("skimpy chiffon baby-doll dresses with spaghetti-straps", { g: "women", y: m60 },
  "baby-doll dress:garment", "spaghetti straps:silhouette", "cocktail dress:garment", "lace:fabric");
q("Feather boas were occasionally worn", { g: "women", y: m60 }, "feather boa:accessory");
q("In 1964, Gernreich introduced the \"no-bra\" bra", { g: "women", y: [1964, 1979], r: "US" }, "no-bra bra:garment");
q("so women switched to tights and pantyhose", { g: "women", y: [1964, 1969] }, "tights:accessory", "pantyhose:accessory");
q("Warner's introduced the first bodystocking", { g: "women", y: [1964, 1969], r: "US" }, "bodystocking:garment");
q("Bodystockings and similar full-body leotards or catsuits", { g: "women", y: [1964, 1969] }, "catsuit:garment", "leotard:garment");
q("mid-sixties vogue for flat shoes with round or square toes", { g: "women", y: m60 }, "flat shoes:footwear");
q("icons such as Twiggy popularized the shapeless shift dresses", { g: "women", y: m60, r: "UK" }, "shift dress:garment");
q("The \"Dolly Girl\" was another archetype", { g: "women", y: m60 }, "dolly girl:subculture");
q("also sported long hair, slightly teased", { g: "women", y: m60, s: "dolly girl" }, "teased hair:hair");
q("the look was topped off with light colored tights", { g: "women", y: m60, s: "dolly girl" }, "pale tights:accessory", "frills:pattern", "ribbons:accessory");
q("Crocheted clothing also took off within this specific style", { g: "women", y: m60, s: "dolly girl" }, "crochet:fabric");

q("combined the \"Flower Power\" style of dress", { g: "women", y: l60, s: "hippie" }, "flower power:pattern", "fashion tights:accessory");
q("Ponchos, moccasins, love beads, peace signs", { g: "women", y: l60, s: "hippie" },
  "poncho:garment", "moccasins:footwear", "love beads:accessory", "peace sign:accessory",
  "medallion necklace:accessory", "chain belt:accessory", "polka dots:pattern", "bubble sleeves:silhouette");
q("Both men and women wore frayed bell-bottomed jeans", { y: l60, s: "hippie" },
  "bell-bottoms:garment", "frayed jeans:garment", "tie-dye shirt:garment", "work shirt:garment",
  "jesus sandals:footwear", "headband:accessory");
q("Fringed buck-skin vests, flowing caftans", { g: "women", y: l60, s: "hippie" },
  "fringed buckskin vest:garment", "caftan:garment", "hostess pyjamas:garment");
q("Long maxi coats, often belted and lined in sheepskin", { g: "women", y: [1969, 1969] }, "maxi coat:garment", "sheepskin:fabric");
q("Animal prints were popular for women in the autumn and winter of 1969", { g: "women", y: [1969, 1969] }, "animal print:pattern");
q("these activists wore androgynous and masculine clothing", { g: "women", y: l60, r: "US" }, "work boots:footwear", "androgynous dressing:silhouette");

q("slim fitting single breasted continental style suits and skinny ties", { g: "men", y: e60 },
  "continental suit:garment", "skinny tie:accessory", "slim fit:silhouette");
q("were often made from grey flannel, mohair or sharkskin", { g: "men", y: e60 }, "grey flannel:fabric", "mohair suit:garment", "sharkskin:fabric");
q("Tuxedos were cut in a similar form fitting style", { g: "men", y: e60 }, "shawl-collar tuxedo:garment", ["sky blue:colour", { r: "US" }]);
q("Men's hats, including the pork pie hat and Irish hat", { g: "men", y: e60 }, "pork pie hat:accessory", "irish hat:accessory");
q("Ivy League fashion, the precursor to the modern preppy look", { g: "men", y: [1960, 1966], r: "US", s: "ivy league" }, "ivy league:subculture");
q("Typical outfits included polo shirts, harrington jackets", { g: "men", y: [1960, 1966], r: "US", s: "ivy league" },
  "polo shirt:garment", "harrington jacket:garment", "chinos:garment", "striped t-shirt:garment",
  "argyle socks:accessory", "seersucker:fabric", "houndstooth sportcoat:garment", "sweater vest:garment",
  "cardigan:garment", "nantucket reds:garment", "basketweave loafers:footwear", "madras plaid:pattern", "trilby:accessory");
q("natural-shouldered silhouette that he referred to as a cylinder", { g: "men", y: e60, r: "FR" }, "cylinder silhouette:silhouette");
q("It included foulard shirts, prominent belts", { g: "men", y: e60, r: "FR" }, "foulard shirt:garment", "collarless suit:garment");
q("surf rock went mainstream from 1962 to 1966", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "surfer:subculture");
q("Pendleton jackets were common due to their cheapness", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "pendleton jacket:garment");
q("plaid and striped surf jackets gained relevancy", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "plaid:pattern");
q("This sustained Hawaiian flora and fauna patterns", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "hawaiian print:pattern");
q("many guys improvised their own faded jeans", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "faded jeans:garment");
q("Sneakers such as Converse All Stars made the transition", { g: "men", y: [1962, 1966], r: "US", s: "surfer" }, "converse all stars:footwear", "long hair:hair");
q("In the UK, it was the new fashion for mod women to cut their hair short", { g: "women", y: m60, r: "UK", s: "mod" }, "cropped hair:hair");
q("The rockers liked 1950s rock-and roll", { g: "men", y: [1960, 1966], r: "UK", s: "rocker" },
  "rocker:subculture", "black leather jacket:garment", "pompadour:hair");
q("opting for tailored suits that were topped by parkas", { g: "men", y: m60, r: "UK", s: "mod" }, "parka:garment");
q("The young men incorporated striped boating blazers", { g: "men", y: m60, r: "UK", s: "mod" }, "boating blazer:garment");
q("Shirts were slim, with a necessary button down collar", { g: "men", y: m60, r: "UK", s: "mod" }, "button-down shirt:garment", "slim trousers:garment");
q("Levi's were the only type of jeans worn by Modernists", { g: "men", y: m60, r: "UK", s: "mod" }, "levi's jeans:garment");
q("His innovations included longer suit jackets", { g: "men", y: m60, r: "FR" },
  "fitted suit:garment", "knit suit:garment", "double-breasted suit:garment", "waistcoat:garment",
  "wide lapels:silhouette", "wide tie:accessory", "turtleneck:garment", "flared trousers:garment", "ankle boots:footwear");
q("he introduced a Space Age Cosmonaut or Cosmocorps menswear line", { g: "men", y: [1966, 1969], r: "FR" }, "hip-belted tunic:garment", "space age:silhouette");
q("Middle class youths of both sexes favored a unisex look", { y: l60, s: "hippie" },
  "long hair:hair", "flower power:pattern", "bob dylan cap:accessory", "kurta:garment", "hemp waistcoat:garment",
  "baja jacket:garment", "sheepskin vest:garment", "western shirt:garment", "sandals:footwear", "digger hat:accessory", "patches:accessory");
q("Jimi Hendrix popularized the wearing of old military dress uniforms", { g: "men", y: l60, s: "hippie" }, "military jacket:garment");
q("Early hippies, derisively referred to as freaks", { y: l60, s: "hippie" },
  "cloak:garment", "frock coat:garment", "corduroy:fabric", "cowboy boots:footwear", "vintage clothing:garment");
q("From the late 1960s until the early 1970s Western clothing was popular in America", { y: [1967, 1973], r: "US" }, "western wear:garment");
q("The nudie suits and elaborately embroidered Rockmount shirts", { y: [1967, 1973], r: "US" }, "nudie suit:garment", "embroidered western shirt:garment");
q("Typical apparel included Levi 501 or Lee jeans", { y: [1967, 1973], r: "US" },
  "levi 501:garment", "jean jacket:garment", "duster coat:garment", "black:colour", "pearl-snap shirt:garment");
q("By 1968, the space age mod fashions had been gradually replaced", { g: "men", y: [1968, 1969], r: "UK" },
  "crushed velvet:fabric", "brocade waistcoat:garment", "frilled shirt:garment");
q("Due to the colorful nature of menswear, the time period was described as the Peacock Revolution", { g: "men", y: [1967, 1975], r: "UK", s: "peacock revolution" }, "peacock revolution:subculture");
q("Business suits were replaced by Bohemian Carnaby Street creations", { g: "men", y: l60, r: "UK", s: "peacock revolution" },
  "cravat:accessory", "trouser straps:accessory", "mao jacket:garment", "chintz:fabric", "vivid prints:pattern");
q("replaced with Kipper ties exceeding five inches", { g: "men", y: l60, r: "UK" }, "kipper tie:accessory");
q("Women's hair styles ranged from beehive hairdos", { g: "women" }, ["beehive:hair", { y: e60 }], ["long straight hair:hair", { y: l60, s: "hippie" }]);
q("the chin-length contour cut and the pageboy were also popular", { g: "women", y: d60 }, "contour cut:hair", "pageboy:hair");
q("The pillbox hat was fashionable, due almost entirely", { g: "women", y: d60, r: "US" }, "pillbox hat:accessory");
q("women's hair styles became very big and used a large quantity of hair spray", { g: "women", y: [1964, 1969] }, "big hair:hair");
q("Wigs became fashionable and were often worn to add style and height", { g: "women", y: [1964, 1969] }, "wig:hair");
q("hippie girls favored long, straight natural hair", { g: "women", y: l60, s: "hippie" }, "bandana:accessory");
q("the side parted short back and sides was the norm", { g: "men", y: d60 }, "short back and sides:hair");
q("Black men usually buzzed their hair short", { g: "men", y: d60, r: "US" }, "conk:hair");
q("often wore buzzcuts and flat tops", { g: "men", y: d60, r: "US" }, "buzzcut:hair", "flat top:hair");
q("The mod haircut began as a short version around 1963", { g: "men", y: [1963, 1973], r: "UK", s: "mod" }, "mod haircut:hair");
q("Facial hair, evolving in its extremity", { g: "men", y: [1966, 1969] }, "sideburns:hair", "moustache:hair", "goatee:hair", "beard:hair");
q("replaced by the bandanna, digger hat, Stetson", { g: "men", y: l60 }, "stetson:accessory");
q("the Afro became the hairstyle of choice for African Americans", { y: l60, r: "US" }, "afro:hair");

rv("suede miniskirt", [1964, 1966], [2000, 2003], "This style was also popular in the early 2000s");
rv("victorian and edwardian dandy", [1837, 1914], [1968, 1969], "By 1968, the space age mod fashions had been gradually replaced");
rv("embroidered western shirt", [1940, 1949], [1967, 1973], "The nudie suits and elaborately embroidered Rockmount shirts");

// ---------------------------------------------------------------- 1970s in fashion
art("s70");
const e70 = [1970, 1973], m70 = [1974, 1976], l70 = [1977, 1979], d70 = [1970, 1979], into80 = [1977, 1983];

q("Common items included mini skirts, bell-bottoms popularized by hippies", { y: d70 },
  "vintage clothing:garment", "platform shoes:footwear", "glitter:fabric", "satin:fabric", ["glam rock:subculture", { r: "UK", s: "glam rock" }]);
q("trousers for women outnumbering skirts and dresses on city streets", { g: "women", y: d70 }, "women's trousers:garment");
q("ecological thinking reflected in fashion in the form of more natural fibers", { y: d70 }, "natural fibres:fabric");
q("Generally the most famous silhouette of the mid and late 1970s", { y: [1974, 1979] }, "fitted top and flared bottom:silhouette");
q("anti-conformist casual chic approach to fashion", { y: d70 }, "casual chic:silhouette", "sneakers:footwear");
q("Von Fürstenberg's wrap dress design", { g: "women", y: [1974, 1979], r: "US" }, "wrap dress:garment");
q("popularized, among other things, the jersey", { g: "women", y: [1974, 1979], r: "US" }, "jersey:fabric");

q("The 1970s began with a continuation of the hippie look", { g: "women", y: e70, s: "hippie" }, "ethnic look:pattern");
q("Popular early 1970s fashions for women included Tie dye shirts", { g: "women", y: e70, s: "hippie" },
  "peasant blouse:garment", "embroidered blouse:garment", "poncho:garment", "cape:garment", "military surplus:garment");
q("Bottom attire for women during this time included bell-bottoms", { g: "women", y: e70, s: "hippie" },
  "gauchos:garment", "frayed jeans:garment", "midi skirt:garment", "maxi dress:garment");
q("Hippie clothing during this time was made in extremely bright colors", { y: e70, s: "hippie" },
  "bright colours:colour", "indian prints:pattern", "native american patterns:pattern", "floral print:pattern");
q("Women's hippie accessories of the early 1970s included chokers", { g: "women", y: e70, s: "hippie" },
  "choker:accessory", "dog collar:accessory", "shell jewellery:accessory", "feathers:accessory", "indian beads:accessory");
q("Unisex hippie accessories included headbands, floppy hats, flowing scarves, Birkenstocks", { y: e70, s: "hippie" },
  "headband:accessory", "floppy hat:accessory", "scarf:accessory", "birkenstocks:footwear", "earth shoes:footwear",
  "moccasins:footwear", "huaraches:footwear");
q("Glamorous women's accessories of the early 1970s included cloche hats", { g: "women", y: e70 },
  "cloche hat:accessory", "turban:accessory", "pearl earrings:accessory", "feather boa:accessory", "veiled hat:accessory",
  "clogs:footwear", "wedge heels:footwear", "cork platforms:footwear", "chunky heels:footwear");
q("Golden chains, gold-button earrings and rhinestone clips", { g: "women", y: [1973, 1979] }, "gold-button earrings:accessory", "rhinestones:accessory");
q("From 1970 to 1972, many women continued to wear miniskirts", { g: "women", y: [1970, 1972] }, "miniskirt:garment");
q("including knee-length knickers and gauchos", { g: "women", y: e70 }, "knickers:garment", "flared trousers:garment");
q("came to be known as the \"midi debacle\"", { g: "women", y: [1970, 1970], r: "US" }, "midiskirt:garment");
q("More simple early 1970s trends for women included fitted blazers", { g: "women", y: e70 },
  "fitted blazer:garment", "wide lapels:silhouette", "maxi evening gown:garment", "hot pants:garment",
  "skin-tight t-shirt:garment", "his and hers outfits:garment");
q("Pastel colors were most commonly used for this style of clothing", { g: "women", y: e70 },
  "pastel colours:colour", "mauve:colour", "peach:colour", "apple green:colour", "baby blue:colour", "camel:colour");
q("Rust, tangerine, copper, forest green, and pistachio", { g: "women", y: [1973, 1979] },
  "rust:colour", "tangerine:colour", "copper:colour", "forest green:colour", "pistachio:colour");
q("Sweaters were a huge phenomenon in the early 1970s", { g: "women", y: e70 }, "sweater:garment");
q("This fragmented into more styles, such as turtleneck sweaters", { g: "women", y: e70 },
  "turtleneck:garment", "sweater coat:garment", "sweater dress:garment", "sweater suit:garment");
q("Many of them were trimmed with fur, especially faux", { g: "women", y: e70 }, "faux fur:fabric");
q("Chunky, shawl-collared, belted cardigans", { g: "women", y: e70 }, "shawl-collar cardigan:garment");
q("Jeans were ubiquitous, characteristic of the period", { y: d70 }, "jeans:garment");
q("with cut-off blue-jean shorts extremely popular", { y: e70 }, "cut-off shorts:garment", "tank top:garment");
q("Women frequently paired them with halter tops", { g: "women", y: e70 }, "halter top:garment", "string bikini:garment");
q("The popularity of jeans led to blue denim being used", { y: e70 }, "denim:fabric");
q("called toe socks", { y: e70 }, "striped knee socks:accessory", "toe socks:accessory");
q("Despite the wide variety, the most popular boots were Go-go boots", { g: "women", y: e70 },
  "go-go boots:footwear", "crinkle boots:footwear", "stretch boots:footwear", "granny boots:footwear");

q("By 1974, the T-shirt was no longer considered underwear", { y: m70 }, "slogan t-shirt:garment");
q("the looser, more flowy shirts of the early 1970s had given way to fitted tops", { g: "women", y: m70 }, "fitted tops:silhouette");
q("In the mid-1970s women wore sweaters, T-shirts, cardigans, kimono", { g: "women", y: m70 },
  "kimono:garment", "khakis:garment", "graphic t-shirt:garment", "workwear:garment");
q("A denim emphasis continued from the early seventies", { g: "women", y: [1973, 1975] }, "denim skirt:garment", "double denim:garment");
q("the slim-legged jean style known as the cigarette-leg", { y: [1975, 1979] }, "cigarette jeans:garment");
q("Around 1976, casual fashion adopted a Parisan peasant look", { g: "women", y: [1976, 1976], r: "FR" }, "peasant look:silhouette");
q("This included capes, turbans, puffy skirts", { g: "women", y: [1976, 1976] }, "puffy skirt:garment", "billowing sleeves:silhouette");
q("The most commonly seen form of jewelry was a simple, thin, unobtrusive gold neckchain", { y: d70 }, "gold chain:accessory");
q("White puka shell necklaces were also worn by both sexes", { y: [1974, 1979] }, "puka shell necklace:accessory");
q("Small leather shoulder bags were worn by women everywhere", { g: "women", y: m70 },
  "shoulder bag:accessory", "mary janes:footwear", "knee-high boots:footwear", "frye boots:footwear",
  "espadrilles:footwear", "loafers:footwear");
q("the mood ring was a big fad in the mid-1970s", { y: m70 }, "mood ring:accessory");
q("The biggest phenomenon of this trend was the jumpsuit", { g: "women", y: [1975, 1983], r: "US" }, "jumpsuit:garment");
q("Other sportswear trends included tracksuits, tunic shirts", { g: "women", y: [1975, 1983] },
  "tracksuit:garment", "tube top:garment", "crop top:garment", "sweatshirt:garment", "hip-huggers:garment", "low-rise trousers:garment");
q("two very desirable accessories included sneakers and tennis headbands", { g: "women", y: [1975, 1979] }, "tennis headband:accessory");
q("Other clothes worn in this style include suede coats", { g: "women", y: [1975, 1979] },
  "suede coat:garment", "peacoat:garment", "cowl-neck sweater:garment", "pencil skirt:garment", "backless dress:garment",
  "palazzo pants:garment", "tube dress:garment", "jacket dress:garment", "pinstripe pantsuit:garment");
q("but Asian patterns were also common", { g: "women", y: m70 }, "asian prints:pattern");
q("most notably the wedge heel", { g: "women", y: m70 }, "wedge heel:footwear");
q("Popular boots of the mid-1970s included wedge boots", { g: "women", y: m70 },
  "wedge boots:footwear", "ankle boots:footwear", "platform boots:footwear", "cowboy boots:footwear");
q("The disco music genre spawned its own fashion craze", { y: [1974, 1979], s: "disco" }, "disco:subculture");
q("Disco clothes worn by women included tube tops, sequined halterneck shirts", { g: "women", y: [1974, 1979], s: "disco" },
  "sequined halter top:garment", "spandex shorts:garment", "spandex trousers:garment", "maxi skirt:garment", "thigh-slit dress:garment");
q("the most commonly worn shoes were ones that had thick heels", { g: "women", y: [1974, 1979], s: "disco" }, "clear plastic heels:footwear");
q("Brief disco fads included overalls and coveralls", { s: "disco" }, ["overalls:garment", { y: m70 }], ["hand fan:accessory", { g: "women", y: l70 }]);
q("women adapted dancewear for discos, with maillots and leotards", { g: "women", y: [1974, 1979], s: "disco" }, "leotard:garment");
q("For most of the period, women wore \"disco bags\"", { g: "women", y: [1974, 1979], s: "disco" }, "disco bag:accessory");
q("was known as the Big Look or Soft Look", { g: "women", y: [1973, 1978], r: "FR" }, "big look:silhouette");
q("Essential features of the look were thin fabrics in natural fibers and layering", { g: "women", y: [1973, 1978] },
  "natural fibres:fabric", "layering:silhouette");
q("to achieve what was known as an unconstructed look", { g: "women", y: [1973, 1978] }, "unconstructed look:silhouette");

q("In 1977, mass-market fashion became more baggy", { g: "women", y: l70 }, "baggy silhouette:silhouette");
q("This resulted in shirts being unbuttoned, sleeves being rolled up", { g: "women", y: l70 },
  "strapless top:garment", "sheer top:garment", "rolled-up sleeves:silhouette");
q("Shiny satin and gold colors were also used", { g: "women", y: l70 }, "gold:colour");
q("puffy, quilted, down-filled coats to the calf", { g: "women", y: [1977, 1977], r: "US" }, "puffer coat:garment");
q("By 1977, pants were only flared slightly", { y: l70 }, "straight-leg trousers:garment");
q("Women's fashions in the late 1970s included cowl-neck shirts", { g: "women", y: into80 },
  "pantsuit:garment", "sundress:garment", "velour:fabric", "tunic:garment", "embroidered jeans:garment",
  "knee-length skirt:garment", "satin trousers:garment", "culottes:garment", "daisy dukes:garment", "tennis shorts:garment");
q("Accessories included scarves, gold jewelry, flowers, ankle boots, 1940s style hats", { g: "women", y: l70 },
  "1940s-style hat:accessory", "skinny belt:accessory", "spike-heeled sandals:footwear", "mules:footwear",
  "ankle-strap shoes:footwear", "waist cincher:accessory", "obi belt:accessory");
q("Color had almost completely faded from fashion in the late 1970s", { y: l70 }, "earth tones:colour", "brown:colour", "tan:colour");
q("a common fashion accessory was an off-white, open-weave, sweater-knit muffler", { y: [1977, 1978] }, "knit muffler:accessory", "tweed:fabric");
q("The most popular boots were either knee-high or reached the mid-calf", { g: "women", y: l70 }, "mid-calf boots:footwear", "suede:fabric");
q("popularized the one-piece swimsuit which in turn launched the trend for the maillot", { g: "women", y: into80, r: "US" }, "maillot:garment");
q("By the late 1970s the pantsuit had become acceptable business wear", { g: "women", y: l70 }, "power pantsuit:garment");
q("This was due to the success of Yves Saint Laurent's \"Le smoking\" tuxedo", { g: "women", y: l70, r: "FR" }, "le smoking:garment");
q("Movies like Annie Hall fought gender ideals", { g: "women", y: l70, r: "US" }, "annie hall look:silhouette");
q("In 1978, the first designer jeans were introduced", { y: [1978, 1983], r: "US" }, "designer jeans:garment");
q("to show off the popular Candie's slides", { g: "women", y: [1978, 1978], r: "US" }, "slides:footwear");
q("From 1979 to 1981, a popular style was jeans with a high-ish waist", { g: "women", y: [1979, 1981] }, "baggies:garment");
q("and the shoes worn with them were often high-vamped pumps", { g: "women", y: [1979, 1981] }, "jazz oxfords:footwear", "cone-heel pumps:footwear");
q("Styles became curvier for fall of 1978, with shoulder pads", { g: "women", y: [1978, 1979] }, "shoulder pads:silhouette", "pencil skirt:garment");
q("The silhouette that resulted was an inverted triangle", { g: "women", y: [1978, 1979] }, "inverted triangle:silhouette");
q("giving it the name bustier", { g: "women", y: [1980, 1989], r: "FR" }, "bustier:garment");
q("continued the very bare, high-heeled sandal", { g: "women", y: [1974, 1978] }, "high-heeled sandals:footwear");
q("in more dressed-up materials and colors like black and metallics", { g: "women", y: [1978, 1979] }, "metallics:colour");
q("In 1979, the higher-vamped, vaguely 1950s-looking pump", { g: "women", y: [1979, 1989] }, "pump:footwear");
q("Open-toed pumps were a particular focus in 1979", { g: "women", y: [1979, 1979] }, "open-toe pumps:footwear");
q("resembling the demi-boots of the 1950s", { g: "women", y: [1978, 1979] }, "demi-boots:footwear");
q("For fall 1978, designers showed a plethora", { g: "women", y: [1978, 1979] }, "pillbox hat:accessory", "veil:accessory");

q("In the early 1970s, satin shirts in black, and grey were popular", { g: "men", y: e70 }, "satin shirt:garment", "ruffled shirt:garment");
q("male trendsetters were called \"Dandies\"", { g: "men", y: [1970, 1976], s: "peacock revolution" }, "peacock revolution:subculture");
q("Typical casual wear for this time included Nehru jackets", { g: "men", y: e70, s: "peacock revolution" },
  "nehru jacket:garment", "ethnic tunic:garment", "turtleneck:garment", "candy-stripe blazer:garment",
  "winklepickers:footwear", "cuban heels:footwear", "elephant bell-bottoms:garment");
q("Accessories like color-matching nylon zippers and bright braided belts", { g: "men", y: e70 }, "braided belt:accessory");
q("Suits were available in bright colors and unorthodox styles from 1970 to 1976", { g: "men", y: [1970, 1976] },
  "three-piece suit:garment", "double-breasted suit:garment", "shawl collar:silhouette", "peak lapels:silhouette",
  "corduroy:fabric", "paisley brocade:pattern", "pinstripe:pattern", "crushed velvet:fabric",
  "burgundy:colour", "teal:colour", "bottle green:colour", "peacock blue:colour");
q("Stylish continental suits by designers Lanvin", { g: "men", y: e70, r: "FR" }, "continental suit:garment");
q("For men this particularly meant bell bottom jeans, tie dye shirts, and military surplus clothing", { g: "men", y: e70, s: "hippie" },
  "bell-bottom jeans:garment", "tie-dye shirt:garment", "military surplus:garment");
q("Other early 1970s clothes for men included tweed sports jackets", { g: "men", y: e70 },
  "tweed sports jacket:garment", "chinos:garment", "chunky sweater:garment", "cream:colour", "beige:colour",
  "storm coat:garment", "tartan:pattern", "peacoat:garment", "flannel shirt:garment", "pleated trousers:garment",
  "baseball jacket:garment", "crochet waistcoat:garment", "sweater vest:garment", "belted cardigan:garment", "hip-huggers:garment");
q("Men's footwear in the early 1970s included flip-flops", { g: "men", y: e70 },
  "flip-flops:footwear", "oxfords:footwear", "cowboy boots:footwear");
q("safari jackets similar to the Mao suit became popular among liberal men", { g: "men", y: e70 }, "safari jacket:garment");

q("By 1974, androgynous glam rock fashion had gone mainstream", { y: m70, r: "UK", s: "glam rock" }, "glam rock:subculture", "androgynous look:silhouette");
q("These included embroidered Western shirts, velvet sports coats", { y: m70, r: "UK", s: "glam rock" },
  "embroidered western shirt:garment", "velvet jacket:garment", "royal stewart tartan:pattern", "shawl-collar tuxedo jacket:garment",
  "frilly shirt:garment", "kipper tie:accessory", "leather jacket:garment", "ascot:accessory", "shawl-collar sweater:garment",
  "oversized collar:silhouette", "drainpipe trousers:garment", "platform shoes:footwear");
q("and popular colors included cream, burgundy, brown, and orange", { y: m70, r: "UK", s: "glam rock" }, "orange:colour");
q("Men continued to wear flannel, and the leisure suit", { g: "men", y: [1975, 1979], r: "US" }, "leisure suit:garment", "gold medallion:accessory");
q("all-denim outfits were also desired among young men", { g: "men", y: m70, r: "US" }, "all-denim outfit:garment", "leather coat:garment");
q("Other trends include printed shirts, zip-up cardigans", { g: "men", y: m70, r: "US" },
  "printed shirt:garment", "zip-up cardigan:garment", "western shirt:garment", "raincoat:garment");
q("a silky nylon with a slightly glossy finish called Qiana", { g: "men", y: [1972, 1975], r: "US" }, "qiana:fabric");
q("these Qiana shirts would be referred to as \"disco shirts,\"", { g: "men", y: [1972, 1975], r: "US" }, "disco shirt:garment");
q("named the quasi-European suit", { g: "men", y: [1975, 1979], r: "US" }, "quasi-european suit:garment", "padded shoulders:silhouette");
q("In 1976, it became fashionable for men to wear velvet tuxedo jackets", { g: "men", y: [1976, 1976] }, "velvet tuxedo jacket:garment", "waistcoat:garment");
q("spearheaded by Giorgio Armani in 1976", { g: "men", y: [1976, 1978], r: "IT" }, "unstructured jacket:garment", "soft look:silhouette");
q("Band-collared shirts were often worn with the look", { g: "men", y: [1976, 1978], r: "IT" }, "band-collar shirt:garment");
q("The Soft Look's pushed-up jacket sleeves and turned-up collars", { g: "men", y: [1976, 1983] }, "pushed-up sleeves:silhouette", "turned-up collar:silhouette");
q("most men and women were wearing sports clothing as everyday apparel", { y: into80 }, "sportswear:garment");
q("This was primarily based on tracksuits, jumpsuits, velour or terry cloth shirts", { y: into80 },
  "velour shirt:garment", "terry cloth:fabric", "puffer vest:garment", "flared jeans:garment", "straight-leg jeans:garment");
q("it also became fashionable for men to leave their shirts untucked", { g: "men", y: into80 }, "untucked shirt:silhouette");
q("long and popped collars became a staple", { g: "men", y: l70 }, "popped collar:silhouette");
q("Late 1970s accessories included low-top sneakers", { g: "men", y: l70 }, "low-top sneakers:footwear", "wristband:accessory");
q("Men began to wear three-piece suits (which became available", { g: "men", y: l70, s: "disco" },
  "three-piece suit:garment", "powder blue:colour", "white suit:garment", "brown polyester:fabric", "silver sharkskin:fabric",
  "wide lapels:silhouette", "wide-leg trousers:garment", "high-rise waistcoat:garment");
q("Influenced by the popularity of aviator sunglasses in disco", { g: "men", y: l70, s: "disco" }, "aviator sunglasses:accessory");
q("Neckties became wider and bolder, and shirt collars became long and pointed", { g: "men", y: l70, s: "disco" }, "wide tie:accessory", "pointed collar:silhouette");
q("adopted the big shoulder pads that had debuted in womenswear in 1978", { g: "men", y: [1978, 1979] }, "big shoulders:silhouette", "tapered trousers:garment");

q("During the early 1970s, the Northern soul and suedehead subcultures emerged", { g: "men", y: e70, r: "UK" },
  ["northern soul:subculture", { s: "northern soul" }], ["suedehead:subculture", { s: "suedehead" }]);
q("members of these British subcultures wore Ben Sherman shirts", { g: "men", y: e70, r: "UK", s: "suedehead" },
  "ben sherman shirt:garment", "tank top:garment", "boating blazer:garment", "basket weave brogues:footwear",
  "driving gloves:accessory", "pork pie hat:accessory", "oxford bags:garment");
q("sparked a large scale Mod revival", { g: "men", y: [1978, 1979], r: "UK", s: "mod" }, "mod revival:subculture");
q("the Teddy boy subculture made a comeback in the UK", { g: "men", y: d70, r: "UK", s: "teddy boy" }, "teddy boy:subculture");
q("Brothel creepers, drainpipe trousers, bolo ties and drape jackets were popular", { g: "men", y: d70, r: "UK", s: "teddy boy" },
  "brothel creepers:footwear", "drainpipe trousers:garment", "bolo tie:accessory", "drape jacket:garment", "velvet collar:silhouette");
q("the Teds of the 1970s wore bright colors like electric blue", { g: "men", y: d70, r: "UK", s: "teddy boy" },
  "electric blue:colour", "leopard print:pattern", "brocade waistcoat:garment");
q("One of the most ubiquitous subcultures of the early and mid-1970s were the hippies", { y: [1970, 1976], s: "hippie" }, "hippie:subculture");
q("these practitioners of free love favored a unisex look", { y: [1970, 1976], s: "hippie" },
  "long hair:hair", "tie-dye:pattern", "flower power:pattern", "bob dylan cap:accessory", "kurta:garment", "hemp waistcoat:garment",
  "baja jacket:garment", "bell-bottoms:garment", "sandals:footwear", ["maxi skirt:garment", { g: "women" }]);
q("Old military uniforms and washed off navy bell-bottoms", { y: [1970, 1975], r: "US", s: "hippie" }, "military uniform:garment", "peace patches:accessory");
q("members of the hard rock and heavy metal subculture favored typical hippie fashions", { y: m70, s: "heavy metal" }, "flared trousers:garment");
q("Typical heavy metal fashions in the UK, US and Australia", { y: l70, s: "heavy metal" },
  "heavy metal:subculture", "battle jacket:garment", "combat boots:footwear", "studded belt:accessory", "perfecto jacket:garment", "iron cross:accessory");
q("Beards, moustaches and shoulder length hair were popular among men", { g: "men", y: l70, s: "heavy metal" }, "shoulder-length hair:hair");
q("Urban African American youths frequently imitated the paramilitary uniforms", { y: e70, r: "US", s: "black power" }, "black power:subculture");
q("Typical clothing included black leather jackets, vests, black driving gloves", { y: e70, r: "US", s: "black power" },
  "peaked cap:accessory", "dashiki:garment", "fez:accessory", "ankh:accessory", "african colours:colour",
  ["railroad stripe trousers:garment", { g: "women" }]);
q("In the UK, US and Jamaica Afro hair and dreadlocks became popular from 1972 to 1976", { y: [1972, 1976] }, "dreadlocks:hair");
q("were commonly worn by these cholos and chicanos", { g: "men", y: [1973, 1979], r: "US", s: "cholo" },
  "cholo:subculture", "ringer t-shirt:garment", "dickies:garment", "texan tuxedo:garment", "beanie:accessory", "aviator sunglasses:accessory");
q("Punk rock was a musical genre that greatly influenced fashion in the late 1970s", { y: [1976, 1979], r: "UK", s: "punk" }, "punk:subculture");
q("Street punk fashion generally consisted of ripped clothes", { y: [1976, 1979], r: "UK", s: "punk" },
  "ripped clothes:garment", "black turtleneck:garment", "drainpipe jeans:garment", "leather trousers:garment",
  "studded leather jacket:garment", "slogan shirt:garment", "dog collar:accessory", "safety pins:accessory", "kilt:garment", "doc martens:footwear");
q("A tamer, less threatening version of the Punk style called \"New Wave\"", { y: [1980, 1983], s: "new wave" }, "new wave:subculture", "jagged hems:silhouette");

q("Throughout much of the decade, women and teenage girls wore their hair long", { g: "women", y: d70 }, "centre parting:hair", "long straight hair:hair");
q("Other hairstyles of the early to mid-1970s included the wavy \"gypsy\" cut", { g: "women", y: [1970, 1976] },
  "gypsy cut:hair", "shag:hair", ["wings:hair", { r: "US" }]);
q("Blonde-streaked or \"frosted\" hair was also popular", { g: "women", y: [1970, 1976] }, "frosted hair:hair");
q("In 1977, punk singer Debbie Harry of Blondie sparked a new trend", { g: "women", y: l70, r: "US" }, "platinum blonde:hair", "fringe:hair");
q("the afro was worn by both sexes throughout the decade", { y: d70 }, "afro:hair");
q("Afro-enhancing products and Afro wigs emerged", { y: d70, r: "US" }, "afro wig:hair");
q("Popularized in 1976, the hairstyle was heavily imitated", { g: "women", y: [1976, 1979], r: "US" }, "farrah fawcett hair:hair");
q("the popularity of braided hairstyles for Afro-textured hair, such as cornrows, increased", { y: l70 }, "cornrows:hair");
q("the ducktail and Pompadour hairstyle", { g: "men", y: d70, r: "US" }, "ducktail:hair", "pompadour:hair");
q("The early and mid-1970s generally featured longer hair on men", { g: "men", y: [1970, 1976] }, "long hair:hair");
q("Sideburns were also worn around the same time", { g: "men", y: [1970, 1976] }, "sideburns:hair");
q("Some of the most popular hairstyles for men include", { g: "men", y: d70 }, "mod haircut:hair", "buzzcut:hair");
q("In the late 1970s, men went for the chop", { g: "men", y: l70 }, "crew cut:hair", "shag:hair");
q("The era's two primary visions were the daytime \"natural look\"", { g: "women", y: d70, r: "US" }, "natural look:makeup");

rv("1950s vintage clothing", [1950, 1959], [1970, 1979], "Common items included mini skirts, bell-bottoms popularized by hippies");
rv("1940s movie star glamour", [1940, 1949], [1970, 1973], "inspired by 1940s movie star glamour");
rv("1930s to 1960s vintage clothing", [1930, 1969], [1970, 1973], "combined new garments with carefully chosen secondhand or vintage clothing");
rv("granny boots", [1920, 1929], [1970, 1973], "Despite the wide variety, the most popular boots were Go-go boots");
rv("disco look", [1960, 1963], [1974, 1979], "Disco fashion was generally inspired by clothing from the early 1960s");
rv("1940s-style hat", [1940, 1949], [1977, 1979], "Accessories included scarves, gold jewelry, flowers, ankle boots, 1940s style hats");
rv("shoulder pads", [1940, 1959], [1978, 1989], "resembled too much the man-focused styles of the 1940s and '50s");
rv("structured strapless bodice", [1940, 1959], [1978, 1979], "This revival of 1940s and '50s styles");
rv("pump", [1950, 1959], [1979, 1989], "In 1979, the higher-vamped, vaguely 1950s-looking pump");
rv("demi-boots", [1950, 1959], [1978, 1979], "resembling the demi-boots of the 1950s");
rv("dressy hats and gloves", [1940, 1959], [1978, 1979], "For fall 1978, designers showed a plethora");
rv("western shirt", [1950, 1959], [1974, 1976], "western shirts marketed to capitalise on the nostalgia for 1950s fashion");
rv("1940s-width lapels", [1940, 1949], [1979, 1980], "relatively quickly widened his lapels and ties");
rv("mod", [1964, 1969], [1970, 1973], "Seeking a return to the music and fashions of the mid and late 1960s");
rv("mod", [1960, 1966], [1978, 1979], "sparked a large scale Mod revival");
rv("teddy boy", [1950, 1959], [1970, 1973], "Due to a resurgence in nostalgia for the 1950s");

// ---------------------------------------------------------------- 1980s in fashion
art("s80");
const e80 = [1980, 1983], m80 = [1984, 1986], l80 = [1987, 1989], d80 = [1980, 1989];

q("The women's shoe that typified the decade was the closed pump", { g: "women", y: d80 }, "pointed-toe pump:footwear");
q("Hair in the 1980s was typically big, curly, bouffant and heavily styled", { g: "women", y: d80 }, "big hair:hair", "curly hair:hair");
q("Television shows such as Dynasty helped popularize the high volume bouffant", { g: "women", y: d80, r: "US" }, "bouffant:hair");
q("Women in the 1980s wore bright, heavy makeup", { g: "women", y: d80 }, "bright makeup:makeup");
q("Everyday fashion in the 1980s consisted of light-colored lips", { g: "women", y: d80 },
  "pale lips:makeup", "thick eyelashes:makeup", "blush:makeup");
q("in favor of a minimalist approach to fashion", { g: "women", y: e80 }, "minimalism:silhouette");
q("In the UK and America, clothing colors were subdued", { y: e80 },
  "subdued colours:colour", "brown:colour", "tan:colour", "cream:colour", "orange:colour");
q("Widespread fashions for women in the early 1980s included sweaters", { g: "women", y: e80 },
  "v-neck sweater:garment", "crew-neck sweater:garment", "puffer jacket:garment", "tunic:garment", "faux fur coat:garment",
  "velvet blazer:garment", "trench coat:garment", "crop top:garment", "tube top:garment", "knee-length skirt:garment",
  "knee-length dress:garment", "high-waisted trousers:garment", "embroidered jeans:garment", "leather trousers:garment", "designer jeans:garment");
q("by 1982 the flared jeans of the 70s had gone out of fashion", { g: "women", y: [1982, 1989] }, "straight-leg trousers:garment");
q("cropped pants and revivals of 1950s and early '60s styles", { g: "women", y: e80 }, "cropped trousers:garment", "pedal pushers:garment", "capri pants:garment");
q("1981 saw a brief fall vogue for knickers", { g: "women", y: [1981, 1981] }, "knickers:garment");
q("From 1980 until 1983, popular women's accessories included thin belts", { g: "women", y: e80 },
  "thin belt:accessory", "knee-high boots:footwear", "jelly shoes:footwear", "mules:footwear", "round-toe shoes:footwear",
  ["jelly bracelets:accessory", { y: [1983, 1989] }], "chunky heels:footwear", "thin necklace:accessory", "small watch:accessory");
q("General women's street-wear worn in the early 1980s included ripped sweatshirts", { g: "women", y: e80 },
  "ripped sweatshirt:garment", "tights:accessory", "sweatpants:garment", "velour tracksuit:garment");
q("This included leg warmers, wide belts, elastic headbands", { g: "women", y: e80 },
  "leg warmers:accessory", "wide belt:accessory", "elastic headband:accessory", "sneakers:footwear");
q("the early 1980s also saw a return to pre-sixties ideas of formality", { g: "women", y: e80 },
  "coordinated suit:garment", "cocktail dress:garment", "evening dress:garment", "hats:accessory", "gloves:accessory");
q("Popular clothes for women in the job market include knee-length skirts", { g: "women", y: e80 },
  "wide-leg slacks:garment", "matching blazer:garment", "blouse:garment");
q("Kitten-heeled shoes were often worn", { g: "women", y: e80 }, "kitten heels:footwear");
q("Women's fashion in the early 1980s became more colorful around 1982", { g: "women", y: [1982, 1986] }, "bright colours:colour");
q("This included long wool coats, long flared skirts, slim miniskirts", { g: "women", y: [1982, 1986] },
  "long wool coat:garment", "flared skirt:garment", "miniskirt:garment", "tapered trousers:garment", "stirrup pants:garment",
  "cycling shorts:garment", "high-waisted jeans:garment", "oversized sweater:garment", "jumpsuit:garment", "pastel colours:colour",
  "off-the-shoulder sweatshirt:garment", "leather trench coat:garment", "fur coat:garment", "oversized scarf:accessory",
  "beanie:accessory", "leather gloves:accessory");
q("At the same time, black continued its march toward ubiquity", { y: d80 }, "black:colour");
q("It became more and more common to see not only black clothes", { y: [1984, 1989] },
  "black eyeliner:makeup", "black hair:hair", "black nail polish:makeup", "black lipstick:makeup");
q("there was a consistent dressy look seen of tailored, broad-shouldered suits", { g: "women", y: d80 },
  "broad-shouldered suit:garment", "narrow skirt:garment", "coloured hosiery:accessory", "statement belt:accessory", "statement earrings:accessory");
q("Women's shoes of the mid-1980s included strappy sandals", { g: "women", y: m80 },
  "strappy sandals:footwear", "kitten-heel sandals:footwear", "ballet flats:footwear", "boat shoes:footwear",
  "slouch boots:footwear", ["keds:footwear", { r: "US" }], ["white sperry sneakers:footwear", { r: "US" }]);
q("She first emerged on the dance music scene with her \"street urchin\" look", { g: "women", y: [1983, 1985], r: "US" },
  "street urchin look:silhouette", "skirt over leggings:garment", "rubber bracelets:accessory", "fishnet gloves:accessory",
  "hair bows:accessory", "layered beads:accessory", "bleached hair with dark roots:hair", "lace ribbons:accessory");
q("In her album \"Like a Virgin\" phase", { g: "women", y: [1984, 1985], r: "US" },
  "bra as outerwear:garment", "crucifix jewellery:accessory", "lace gloves:accessory", "tulle skirt:garment", "boy toy belt:accessory");
q("Gloves (sometimes laced or fingerless) were popularized by Madonna", { g: "women", y: m80, r: "US" },
  "fingerless gloves:accessory", "fishnet stockings:accessory", "beaded necklaces:accessory");
q("Short, tight Lycra or leather miniskirts and tubular dresses were also worn", { g: "women", y: m80 },
  "lycra:fabric", "leather miniskirt:garment", "tube dress:garment", "bolero jacket:garment");
q("Black was the preferred color", { g: "women", y: m80 }, "all black:colour");
q("vintage-style bustiers with lacy slips", { g: "women", y: m80 }, "bustier:garment", "lace slip:garment");
q("In 1983–84, London designers like Katharine Hamnett", { y: [1983, 1984], r: "UK" }, "london club style:subculture");
q("Many of the clothes worn by Madonna in 1983-85", { g: "women", y: [1983, 1985], r: "UK" },
  "tube skirt:garment", "oversized top:garment", "head wrap:accessory", "pointy ankle boots:footwear");
q("The most internationally recognizable styles to come out of the London milieu", { y: [1984, 1985], r: "UK" },
  "tapestry floral print:pattern", "message t-shirt:garment");
q("Crolla's giant cabbage rose prints", { y: [1984, 1985] },
  "cabbage rose print:pattern", ["drop-waist dress:garment", { g: "women" }], ["puff sleeves:silhouette", { g: "women" }],
  ["bertha collar:silhouette", { g: "women" }], ["large hair bow:accessory", { g: "women" }]);
q("Montana's shoulder pad style was credited with defining the \"power dressing\" era", { g: "women", y: m80, r: "FR" }, "power dressing:silhouette");
q("Shoulder pads, popularized by Joan Collins and Linda Evans", { g: "women", y: [1984, 1993], r: "US" }, "shoulder pads:silhouette");
q("Dallas, however, promoted displays of wealth", { g: "women", y: m80, r: "US" }, "sparkle:fabric");
q("This would be accomplished with attributes such as wider shoulders", { g: "women", y: m80 }, "large sleeves:silhouette");
q("Other items included dresses worn with skinny or thick belts, pleated or plain skirts", { g: "women", y: m80 },
  "pleated skirt:garment", "pantyhose:accessory", "long sweater:garment");
q("in her power suit quickly became one of the most well-known symbols", { g: "women", y: d80, r: "UK" }, "power suit:garment");
q("A wide shoulder and pearl necklace was also part of her regular attire", { g: "women", y: d80, r: "UK" }, "pearl necklace:accessory");
q("From 1987 until the early 1990s, the mini skirt was the only length", { g: "women", y: [1987, 1992] }, "miniskirt:garment");
q("all attention was given to the short skirt", { g: "women", y: l80 }, "leggings:garment", "slouch socks:accessory");
q("Accessories popular in Britain, France and America included bright-colored shoes", { g: "women", y: l80 },
  "bright thin-heeled shoes:footwear", "multicoloured belt:accessory", "beret:accessory", "plastic bracelets:accessory");
q("Women's apparel in the late 1980s included jackets", { g: "women", y: l80 },
  "cropped jacket:garment", "reversible coat:garment", "rugby sweatshirt:garment", "sweater dress:garment",
  "taffeta:fabric", "pouf dress:garment", "baby doll dress:garment", "capri leggings:garment", "bike shorts:garment",
  "shortalls:garment", "denim pinafore:garment", "oversized t-shirt:garment", "scrunchie:accessory", "ponytail:hair",
  "happy pants:garment", "opaque tights:accessory");
q("Popular colors included neon hues, plum, gold", { g: "women", y: l80 }, "neon colours:colour", "plum:colour", "gold:colour", "pink:colour");
q("started a new school of fashion during the late 1980s called", { y: l80 }, "japanese avant-garde:silhouette");
q("Yamamoto, Kawakubo and Miyake redefined the concepts of deconstruction", { y: l80 },
  "deconstruction:silhouette", "monochrome:colour", "asymmetric cut:silhouette", "baggy silhouette:silhouette");
q("Geometric diamond patterns, horizontal stripes, crinolines", { y: l80 },
  "diamond pattern:pattern", "horizontal stripes:pattern", "crinoline:garment", "kimono blouse:garment",
  "drop-crotch trousers:garment", "laser cut:fabric", "mesh:fabric", "black and white:colour");

q("Athletic clothes were more popular than jeans during this period", { g: "men", y: e80 }, "athletic wear:garment");
q("Popular colors were black, white, indigo, forest green, burgundy", { g: "men", y: e80 },
  "indigo:colour", "forest green:colour", "burgundy:colour");
q("Velour, velvet, and polyester were popular fabrics", { g: "men", y: e80 }, "velour:fabric", "velvet:fabric", "polyester:fabric");
q("Also worn were striped tube socks", { g: "men", y: e80 }, "striped tube socks:accessory");
q("Popular clothing in the early 1980s worn by men included tracksuits", { g: "men", y: e80 },
  "tracksuit:garment", "v-neck sweater:garment", "polo neck:garment", "sports jersey:garment", "straight-leg jeans:garment",
  "cowboy boots:footwear", "beanie:accessory", "hoodie:garment");
q("it became acceptable for men to wear sports coats and slacks", { g: "men", y: e80 }, "sports coat:garment");
q("post-punk and new wave music groups influenced mainstream male and female fashion", { y: [1980, 1986], s: "new wave" }, "new wave:subculture");
q("Commercially made slim-fitting suits, thin neckties in leather", { y: [1980, 1986], s: "new wave" },
  "slim suit:garment", "skinny tie:accessory", "striped t-shirt:garment", ["members only jacket:garment", { r: "US" }],
  "metallic shirt:garment", "cat-eye glasses:accessory", "horn-rimmed glasses:accessory", "neon makeup:makeup", "leather jacket:garment");
q("Common hairstyles included a short quiff", { y: [1980, 1986], s: "new wave" },
  "quiff:hair", "turquoise:colour", "teal:colour", "neon yellow:colour");
q("This revival came to be definitively summarized", { y: e80, r: "US", s: "preppy" }, "preppy:subculture");
q("Popular preppy clothing for men included Oxford shirts", { g: "men", y: e80, r: "US", s: "preppy" },
  "oxford shirt:garment", "popped-collar polo:garment", "khakis:garment", "argyle socks:accessory", "hush puppies:footwear",
  "boat shoes:footwear", "brogues:footwear", "braces:accessory", "seersucker suit:garment", "cable knit sweater:garment",
  "sweater over shoulders:accessory");
q("From the late 70s until the mid 80s, Western clothing made a comeback in America", { y: [1978, 1985], r: "US" }, "western wear:garment");
q("This style, sometimes derisively referred to as drugstore cowboy, urban cowboy", { y: [1978, 1985], r: "US" }, "urban cowboy:subculture");
q("Cowboy boots, elaborately embroidered western shirts with pearl snaps", { y: [1978, 1985], r: "US" },
  "cowboy boots:footwear", "pearl-snap western shirt:garment", "bolo tie:accessory", "stetson:accessory",
  "double denim:garment", "jean jacket:garment");
q("In the mid-1980s, popular trends included wool sport coats, Levi 501s", { g: "men", y: m80 },
  "levi 501:garment", "hawaiian shirt:garment", "shell suit:garment", "hand-knit sweater:garment", "flannel shirt:garment",
  "quilted jacket:garment", "nylon jacket:garment", "gold ring:accessory", "cycling shorts:garment");
q("This resulted in trends such as t-shirts underneath expensive suit jackets", { g: "men", y: m80, r: "US" },
  "t-shirt under suit jacket:garment", "padded shoulders:silhouette");
q("Easy-care micro-suede and corduroy jackets became popular choices", { g: "men", y: m80, r: "US" }, "micro-suede:fabric", "corduroy jacket:garment");
q("Michael Jackson was also a big influence", { g: "men", y: m80, r: "US" },
  "red leather jacket:garment", "white glove:accessory", "sunglasses:accessory", "slouch-shoulder leather jacket:garment");
q("Men's business attire saw a return of pinstripes", { g: "men", y: m80 }, "pinstripes:pattern");
q("lapels on suits became very narrow", { g: "men", y: e80 }, "narrow lapels:silhouette");
q("The thin ties briefly popular in the early '80s", { g: "men", y: m80 }, "striped tie:accessory");
q("Double breasted suits inspired by the 1940s were reintroduced", { g: "men", y: [1984, 1989] }, "double-breasted power suit:garment");
q("They were known as 'power suits'", { g: "men", y: [1984, 1989] }, "navy:colour", "charcoal grey:colour");
q("In Hawaii, Aloha shirts and Bermuda shorts", { g: "men", y: d80, r: "US" }, "aloha shirt:garment", "bermuda shorts:garment");
q("Doc Martens were dark shoes or boots with air-cushioned soles", { y: d80 }, "doc martens:footwear");
q("They were an important feature of the post-punk 1980s Gothic look", { y: d80, r: "UK", s: "goth" },
  "goth:subculture", "backcombed hair:hair", "pale skin:makeup", "dark eyeshadow:makeup", "dark lipstick:makeup",
  "black nail polish:makeup", "spiked bracelet:accessory", "dog collar:accessory", "black clothing:colour",
  "gabardine:fabric", "lace:fabric", "fishnet:fabric");
q("Corsets were often worn by girls", { g: "women", y: d80, r: "UK", s: "goth" }, "corset:garment");
q("Parachute pants became a fad in US culture in the 1980s", { g: "men", y: d80, r: "US", s: "hip hop" }, "parachute pants:garment");
q("In the original tight-fitting, extraneously zippered style", { g: "men", y: [1978, 1983], r: "US" }, "ripstop nylon:fabric");
q("These are also referred to as \"Hammer\" pants", { g: "men", y: l80, r: "US", s: "hip hop" }, "hammer pants:garment");
q("Earrings became a mainstream fashion for male teenagers", { g: "men", y: d80 }, "earrings:accessory");
q("Jelly or thin metal bracelets (also known as bangles)", { g: "women", y: d80 }, "bangles:accessory");
q("Designer jewelry, such as diamonds and pearls", { g: "women", y: d80 }, "diamonds:accessory", "pearls:accessory");
q("At the beginning of the decade, digital watches with metal bands", { y: e80 }, "digital watch:accessory");
q("one ultramodern status symbol was the Movado museum watch", { y: d80 }, "movado museum watch:accessory");
q("Teen culture preferred vibrant plastic Swatch watches", { y: [1984, 1989] }, "swatch:accessory");
q("glasses with large, plastic frames were in fashion", { y: [1980, 1984] }, "large plastic glasses:accessory");
q("Small metal framed glasses made a return to fashion in 1984 and 1985", {}, ["small metal glasses:accessory", { y: [1984, 1985] }], ["tortoiseshell glasses:accessory", { y: l80 }]);
q("Throughout the 1980s, Ray-Ban Wayfarers were extremely popular", { y: d80, r: "US" }, "wayfarers:accessory");
q("In the first half of the 1980s, long hair, leather rocker jackets", { y: [1980, 1984], s: "heavy metal" },
  "heavy metal:subculture", "long hair:hair", "biker jacket:garment", "cut-off denim jacket:garment", "worn-out jeans:garment",
  "high-top trainers:footwear", "band badges:accessory");
q("mainstream heavy metal bands began to dress in more bright, colourful and theatrical clothing", { y: [1984, 1989], s: "glam metal" }, "glam metal:subculture");
q("This included items such as spandex, platform boots, leg warmers", { y: [1984, 1989], s: "glam metal" },
  "spandex:fabric", "platform boots:footwear", "studded leather:accessory");
q("the long hair popular with metal fans was often worn teased", { y: [1984, 1989], s: "glam metal" }, "teased hair:hair");
q("By the late 1980s, acid-washed jeans and denim jackets", { y: l80 }, "acid wash:fabric", "denim jacket:garment");
q("Severely bleached and ripped jeans", { y: l80, s: "glam metal" }, "ripped jeans:garment");
q("Characterized by multi-colored mohawks", { y: d80, s: "punk" }, "mohawk:hair", "stovepipe jeans:garment", "band t-shirt:garment");
q("Throughout the 1980s, the punk style was popular", { y: d80, s: "punk" }, "punk:subculture");
q("Usually the denim jackets (which became an identity of the group)", { y: d80, s: "punk" }, "customised denim jacket:garment", "safety pins:accessory");
q("it is now known as \"pin shirts\"", { g: "women", y: d80, s: "punk" }, "pin shirt:garment");
q("a dressed down look (e.g. buzzed hair", { y: d80, r: "US", s: "hardcore punk" }, "hardcore punk:subculture", "buzzed hair:hair");
q("The origins of the New Romantic fashion and music movement", { y: e80, r: "UK", s: "new romantic" }, "new romantic:subculture");
q("The garments in Pirates had asymmetrical necklines", { y: [1981, 1982], r: "UK", s: "new romantic" },
  "pirate shirt:garment", "breeches:garment", "asymmetric neckline:silhouette");
q("Men often wore dramatic cosmetics and androgynous clothing", { g: "men", y: e80, r: "UK", s: "new romantic" },
  "men's makeup:makeup", "poet shirt:garment", "hussar jacket:garment", "silk sash:accessory", "tight trousers:garment",
  "rayon waistcoat:garment", "tailcoat:garment");
q("Women, too, were very theatrical in terms of makeup and style", { g: "women", y: e80, r: "UK", s: "new romantic" },
  "big hair:hair", "fishnet gloves:accessory", "corset:garment", "crushed velvet:fabric", "gypsy clothing:garment");
q("the Teddy Boy look was popular in the UK among fans of groups like the Stray Cats", { g: "men", y: e80, r: "UK", s: "rockabilly" }, "rockabilly:subculture");
q("Common items of clothing included drape jackets (generally in darker shades", { g: "men", y: e80, r: "UK", s: "rockabilly" },
  "drape jacket:garment", "drainpipe trousers:garment", "brothel creepers:footwear", "bolo tie:accessory", "white t-shirt:garment",
  "baseball jacket:garment", "hawaiian shirt:garment", "perfecto jacket:garment");
q("Common hairstyles included the quiff, pompadour, flat top, and ducktail", { g: "men", y: e80, r: "UK", s: "rockabilly" },
  "quiff:hair", "pompadour:hair", "flat top:hair", "ducktail:hair");
q("the UK witnessed a revival of rude boy and skinhead fashion", { y: e80, r: "UK", s: "two tone" }, "two tone:subculture", "skinhead revival:subculture");
q("In the early 80s, slim fitting mohair, tonic and houndstooth suits were popular", { g: "men", y: e80, r: "UK", s: "two tone" },
  "mohair suit:garment", "tonic suit:garment", "houndstooth suit:garment", "basket weave shoes:footwear", "polo shirt:garment",
  "sta-prest trousers:garment", "doc martens:footwear", "braces:accessory", "harrington jacket:garment", "pork pie hat:accessory");
q("1980s rude boys wore checkerboard motifs", { y: e80, r: "UK", s: "two tone" }, "checkerboard:pattern");
q("Crew cuts and buzzcuts were worn by both sexes", { y: e80, r: "UK", s: "two tone" }, "crew cut:hair", ["chelsea cut:hair", { g: "women" }]);
q("The football casual subculture first appeared in the UK around 1983", { g: "men", y: [1983, 1989], r: "UK", s: "casual" }, "casual:subculture");
q("Popular clothing for English and Scottish casuals included Burberry coats", { g: "men", y: [1983, 1989], r: "UK", s: "casual" },
  "burberry coat:garment", "stone island:garment", "lacoste:garment", "fred perry polo:garment", "tracksuit:garment",
  "bomber jacket:garment", "adidas trainers:footwear", "fila jacket:garment", "ellesse jacket:garment", "flat cap:accessory",
  "baseball cap:accessory", "football shirt:garment", "bobble hat:accessory");
q("some fans also wore undercuts, Caesar cuts", { g: "men", y: [1983, 1989], r: "UK", s: "casual" }, "undercut:hair", "caesar cut:hair", "mullet:hair");
q("the skater subculture reached the height of popularity in the mid-'80s", { y: m80, s: "skater" }, "skater:subculture");
q("the skaters of the 80s overwhelmingly preferred sportswear and punk fashion", { y: m80, s: "skater" },
  "baseball cap:accessory", "plaid shirt:garment", "sleeveless t-shirt:garment", "baggy trousers:garment", "jams shorts:garment",
  "checkered wristband:accessory", "tube socks:accessory", "vans:footwear", "converse all stars:footwear");
q("Brightly colored T-shirts became fashionable by the end of the decade", { y: l80, s: "skater" }, "graphic t-shirt:garment", "skull print:pattern");
q("edgy hardcore punk and street punk inspired styles like the bowl cut", { y: m80, s: "skater" }, "bowl cut:hair");
q("for the first time they became a high-priced fashion item", { y: d80, r: "US", s: "hip hop" }, "designer sneakers:footwear");
q("rap and hip-hop were not one specific style", { y: d80, r: "US", s: "hip hop" }, "hip hop:subculture");
q("Converse shoes were popular in the first half of the 1980s", { y: [1980, 1984], r: "US" }, "converse:footwear");
q("The Air Jordan 1 was released in the royal blue color way", { y: [1985, 1989], r: "US", s: "hip hop" }, "air jordan:footwear");
q("one of the most sought-after shoes of the 1980s", { y: d80, r: "US", s: "hip hop" }, "adidas superstar:footwear");
q("Nike had a similar share of the market", { y: [1982, 1989], r: "US", s: "hip hop" }, "air force 1:footwear", "air max:footwear");
q("High-tops, especially of white or black leather, became popular", { y: d80, r: "US", s: "hip hop" }, "high-tops:footwear");
q("long and white athletic socks, often calf-high or knee-high", { y: e80, r: "US" }, "white athletic socks:accessory");
q("Wearing track suits and large chains necklaces", { y: d80, r: "US", s: "hip hop" }, "tracksuit:garment", "gold chain:accessory");
q("Individuals in the culture also frequently wore bucket hats", { y: d80, r: "US", s: "hip hop" },
  "bucket hat:accessory", "oversized jacket:garment", "oversized t-shirt:garment", "high contrast colours:colour");
q("Dapper Dan was most famous for deconstructing a Louis Vuitton garment", { y: d80, r: "US", s: "hip hop" }, "logo jacket:garment");
q("several designers came out with graffiti-print fabrics", { y: [1980, 1986] }, "graffiti print:pattern");
q("Ensembles featuring the Pan-African colors", { y: d80, r: "US", s: "hip hop" }, "pan-african colours:colour", "kente:fabric");
q("sneakers were usually worn unlaced", { y: d80, r: "US", s: "hip hop" }, "unlaced sneakers:footwear", "head wrap:accessory");
q("Wealthy teenagers, especially in the United States, wore a style", { y: d80, r: "US", s: "preppy" }, "preppy:subculture");
q("An example of preppy attire would be a button-down Oxford cloth shirt", { y: d80, r: "US", s: "preppy" },
  "ascot tie:accessory", "cuffed khakis:garment", "tasselled loafers:footwear");
q("Throughout the 1980s and 1990s, preppy fashions featured a lot of pastels", { y: [1980, 1999], r: "US", s: "preppy" },
  "pastel colours:colour", ["turtleneck:garment", { g: "women" }], "knee socks:accessory", "logo polo shirt:garment");
q("Other outfits considered \"preppy\" included cable knit cardigans", { y: [1984, 1989], r: "US", s: "preppy" },
  "cable knit cardigan:garment", "argyle sweater:garment", "dress shorts:garment", ["leggings with oversized sweater:garment", { g: "women" }]);
q("The European equivalent, known as Sloane Rangers", { y: d80, r: "UK", s: "sloane ranger" },
  "sloane ranger:subculture", "tweed:fabric", "burberry mac:garment", "mustard cords:garment", "wellies:footwear",
  "padded hairband:accessory", "pearl necklace:accessory");
q("the perm had come into fashion by 1980", { g: "women", y: d80 }, "perm:hair");
q("These hairstyles became iconic during the mid-1980s and include big bangs", { g: "women", y: m80 }, "big fringe:hair");
q("There was generally an excessive amount of mousse", { g: "women", y: m80 }, "mousse:hair");
q("Beginning in the late 80s, high ponytails, side ponytails", { g: "women", y: l80 }, "side ponytail:hair", "high ponytail:hair");
q("By 1983, short hair had made a comeback for men", { g: "men", y: [1983, 1989] }, "short hair:hair");
q("but moustaches remained common among blue collar men", { g: "men", y: d80 }, "moustache:hair");
q("From the mid-1980s until the early 1990s, mullets were popular", { g: "men", y: [1984, 1993] }, "mullet:hair");
q("trends in men's facial hair included designer stubble", { g: "men", y: l80 }, "designer stubble:hair");
q("Teenagers and young men with medium length hair often parted it", { g: "men", y: l80 }, "centre parting:hair");

rv("pointed-toe pump", [1955, 1959], [1979, 1989], "These were similar to pumps worn during the second half of the 1950s");
rv("pedal pushers and capri pants", [1950, 1963], [1980, 1983], "cropped pants and revivals of 1950s and early '60s styles");
rv("cocktail dress", [1940, 1959], [1980, 1983], "the early 1980s also saw a return to pre-sixties ideas of formality");
rv("pointed toes and spiked heels", [1950, 1963], [1984, 1986], "revisited the pointed toes and spiked heels");
rv("nehru jacket", [1960, 1969], [1984, 1985], "Crolla's giant cabbage rose prints");
rv("ivy league", [1950, 1959], [1980, 1983], "there was a throwback to the 1950s Ivy League style");
rv("ivy league", [1950, 1959], [1980, 1989], "Wealthy teenagers, especially in the United States, wore a style");
rv("western wear", [1950, 1959], [1978, 1985], "From the late 70s until the mid 80s, Western clothing made a comeback in America");
rv("pinstripes", [1970, 1979], [1984, 1986], "Men's business attire saw a return of pinstripes");
rv("narrow lapels", [1960, 1963], [1980, 1983], "lapels on suits became very narrow");
rv("double-breasted suit", [1940, 1949], [1984, 1989], "Double breasted suits inspired by the 1940s were reintroduced");
rv("goth", [1980, 1989], [1990, 1999], "This trend would return in the 1990s");
rv("glam rock", [1970, 1979], [1984, 1989], "mainstream heavy metal bands began to dress in more bright, colourful and theatrical clothing");
rv("regency tailcoat", [1811, 1820], [1980, 1983], "Men often wore dramatic cosmetics and androgynous clothing");

// ---------------------------------------------------------------- Mod (subculture)
art("mod");
q("Mod, from the word modernist, is a subculture that began in the late 1950s London", { y: [1958, 1966], r: "UK", s: "mod" }, "mod:subculture");
q("Male mods adopted a smooth, sophisticated look", { g: "men", y: [1958, 1966], r: "UK", s: "mod" },
  "tailored suit:garment", "narrow lapels:silhouette", "mohair suit:garment", "skinny tie:accessory", "button-down shirt:garment",
  "cashmere jumper:garment", "chelsea boots:footwear", "beatle boots:footwear", "loafers:footwear", "desert boots:footwear",
  "bowling shoes:footwear", "nouvelle vague haircut:hair");
q("A few male mods went against gender norms by using eye shadow", { g: "men", y: [1958, 1966], r: "UK", s: "mod" }, "men's eyeshadow:makeup");
q("Many mods wore ex-military parkas", { g: "men", y: [1958, 1966], r: "UK", s: "mod" }, "parka:garment");
q("Many female mods dressed androgynously", { g: "women", y: [1958, 1966], r: "UK", s: "mod" },
  "short haircut:hair", "men's trousers:garment", "flat shoes:footwear", "pale foundation:makeup", "brown eyeshadow:makeup",
  "pale lipstick:makeup", "false eyelashes:makeup");
q("Miniskirts became progressively shorter", { g: "women", y: [1960, 1966], r: "UK", s: "mod" }, "miniskirt:garment");
q("customising \"existing styles, symbols and artefacts\"", { y: [1958, 1966], r: "UK", s: "mod" }, "union flag:pattern", "raf roundel:pattern");
q("Many associate this era with fashion model Twiggy", { y: [1965, 1967], r: "UK", s: "mod" },
  "geometric patterns:pattern", "bright colours:colour");
q("London became synonymous with fashion, music, and pop culture in those years", { y: [1965, 1967], r: "UK", s: "mod" }, "swinging london:subculture");
q("By 1966, mod had begun to fade out and the dandy subculture increased", { g: "men", y: [1966, 1969], r: "UK", s: "dandy" }, "dandy:subculture");
q("adopted the look of the dandy which was popular in London", { g: "men", y: [1966, 1966], r: "US", s: "dandy" },
  "peacock revolution:subculture", "long hair:hair", "beatle boots:footwear");
q("more exotic looks had come into vogue, such as Nehru jackets and love beads", { y: [1967, 1969], r: "US" }, "nehru jacket:garment", "love beads:accessory");
q("as styles there became increasingly extravagant", { y: [1967, 1967], r: "UK", s: "peacock mod" },
  "peacock mod:subculture", "ruffles:fabric", "brocade:fabric", "lace:fabric", "day-glo colours:colour");
q("that emulated the rude boy look of Trilby hats and too-short trousers", { g: "men", y: [1966, 1969], r: "UK", s: "hard mod" },
  "hard mod:subculture", "trilby:accessory", "cropped trousers:garment");
q("The early skinheads retained basic elements of mod fashion", { g: "men", y: [1968, 1969], r: "UK", s: "skinhead" },
  "fred perry shirt:garment", "ben sherman shirt:garment", "sta-prest trousers:garment", "levi's jeans:garment",
  "braces:accessory", "doc martens:footwear");
q("A mod revival started in the late 1970s in the United Kingdom", { y: [1977, 1979], r: "UK", s: "mod" }, "mod revival:subculture");
q("The British mod revival was followed by a revival in North America", { y: [1980, 1983], r: "US", s: "mod" }, "mod revival:subculture");

rv("mod", [1960, 1966], [1977, 1979], "In the late 1970s, there was a mod revival in Britain");
rv("mod", [1960, 1966], [1980, 1983], "It was followed by a similar mod revival in North America");
rv("mod", [1960, 1966], [1990, 1999], "The 1990s Britpop scene featured noticeable mod influences");

// ---------------------------------------------------------------- Hippie
art("hip");
const hip = [1965, 1973];
q("A hippie (also spelled hippy in British English) is a subculture", { y: hip, r: "US", s: "hippie" }, "hippie:subculture");
q("both men and women in the hippie movement wore jeans and maintained long hair", { y: hip, s: "hippie" },
  "jeans:garment", "long hair:hair", "sandals:footwear", "moccasins:footwear", "barefoot:footwear");
q("Men often wore beards, while women wore little or no makeup", { y: hip, s: "hippie" },
  ["beard:hair", { g: "men" }], ["no-makeup look:makeup", { g: "women" }]);
q("Hippies often chose brightly colored clothing", { y: hip, s: "hippie" },
  "bright colours:colour", "bell-bottoms:garment", "vest:garment", "tie-dye:pattern", "dashiki:garment",
  ["peasant blouse:garment", { g: "women" }], ["long full skirt:garment", { g: "women" }], "ethnic motifs:pattern");
q("Favored accessories for both men and women included Native American jewelry", { y: hip, s: "hippie" },
  "native american jewellery:accessory", "head scarf:accessory", "headband:accessory", "long beaded necklace:accessory",
  "round glasses:accessory");
q("Much hippie clothing was self-made in defiance of corporate culture", { y: hip, s: "hippie" }, "handmade clothing:garment", "secondhand clothing:garment");
q("The bold colors, hand-made clothing and loose fitting clothes", { y: hip, s: "hippie" }, "loose fit:silhouette");
q("During the 1960s and 1970s, mustaches, beards and long hair became more commonplace", { y: [1960, 1979] },
  ["moustache:hair", { g: "men" }], "multi-ethnic clothing:pattern");
q("particularly the peace symbol", { y: hip, s: "hippie" }, "peace symbol:accessory");

rv("hippie", [1965, 1973], [1987, 1989], "In the UK and Europe, the years 1987 until 1989 were marked by a large-scale revival");

// ---------------------------------------------------------------- Punk fashion
art("punk");
const p70 = [1974, 1979], p80 = [1980, 1989];
q("helped pioneer the look of early British punk", { y: p70, r: "UK", s: "punk" }, "punk:subculture");
q("the first punk-influenced fashion spreads appearing in mainstream fashion magazines", { y: [1976, 1979] }, "punk couture:silhouette");
q("Generally unkempt, often short hairstyles replaced the long-hair hippie look", { y: p70, s: "punk" }, "short messy hair:hair");
q("ranging from the T-shirt/jeans/leather jacket Ramones look", { y: p70, r: "US", s: "punk" },
  "ramones look:silhouette", "leather jacket:garment", "secondhand suit:garment");
q("spiking his hair and wearing t-shirts that were held together with safety pins", { y: p70, r: "US", s: "punk" }, "spiked hair:hair", "safety pins:accessory");
q("Deliberately offensive T-shirts were popular in the early punk scene", { y: p70, r: "UK", s: "punk" }, "offensive t-shirt:garment");
q("These T-shirts, like other punk clothing items, were often torn on purpose", { y: p70, r: "UK", s: "punk" }, "ripped clothing:garment");
q("Other items in early British punk fashion included", { y: p70, r: "UK", s: "punk" },
  "customised blazer:garment", "slogan shirt:garment", "patches:accessory");
q("Westwood's God Save the Queen shirt", { y: [1977, 1977], r: "UK", s: "punk" }, "god save the queen shirt:garment");
q("Other accoutrements worn by some punks included: BDSM fashions", { y: p70, s: "punk" },
  "bondage wear:garment", "ripped fishnet stockings:accessory", "spike bands:accessory", "studded jewellery:accessory",
  "silver bracelets:accessory", "heavy eyeliner:makeup");
q("combining a Ballet tutu with big, clunky boots", { g: "women", y: p70, s: "punk" }, "tutu:garment", "clunky boots:footwear");
q("black bin liners (garbage bags) became dresses", { y: p70, s: "punk" }, "bin liner dress:garment");
q("Mohair, PVC, and other odd, anachronistic elements", { y: p70, s: "punk" }, "mohair:fabric", "pvc:fabric");
q("Other items added to clothing or as jewellery included razor blades and chains", { y: p70, s: "punk" }, "razor blade:accessory", "chains:accessory");
q("Leather, rubber and vinyl clothing have been common", { y: p70, s: "punk" }, "leather:fabric", "rubber:fabric", "vinyl:fabric");
q("Preferred footwear included military boots, motorcycle boots", { y: p70, s: "punk" },
  "military boots:footwear", "motorcycle boots:footwear", "brothel creepers:footwear", "puma clyde:footwear",
  "chuck taylors:footwear", "doc martens:footwear");
q("Tapered jeans, tight leather pants, trousers with leopard patterns", { y: p70, s: "punk" },
  "tapered jeans:garment", "leather trousers:garment", "leopard print:pattern", "bondage trousers:garment");
q("imitated the Droogs from A Clockwork Orange", { y: p70, r: "UK", s: "punk" }, "bowler hat:accessory", "braces:accessory");
q("Hair was cropped and deliberately made to look messy", { y: p70, s: "punk" }, "dyed hair:hair");
q("Zandra Rhodes utilized rips, tears and safety pins", { g: "women", y: [1977, 1977], r: "UK" }, "conceptual chic:silhouette");
q("Claude Montana presented 12 models", { y: [1977, 1977], r: "FR" }, "black leather jacket:garment");
q("Spiky hair, jeans or bondage trousers, leather jackets with slogans", { y: [1977, 1979], s: "punk" }, "studs:accessory");
q("Footwear that was common in the 1980s punk scene included Dr. Martens boots", { y: p80, s: "punk" }, "combat boots:footwear", "doc martens:footwear");
q("Jeans (sometimes dirty, torn or splattered with bleach) and tartan kilts", { y: p80, s: "punk" }, "bleached jeans:garment", "tartan kilt:garment");
q("Leather skirts became a popular item for female punks", { g: "women", y: p80, s: "punk" }, "leather skirt:garment");
q("Bullet belts, and studded belts", { y: p80, s: "punk" }, "bullet belt:accessory", "studded belt:accessory", "chain belt:accessory");
q("wrote political slogans, band names or other punk-related phrases on them", { y: p80, s: "punk" }, "plaid flannel shirt:garment");
q("Silkscreened T-shirts with band logos", { y: p80, s: "punk" }, "band t-shirt:garment");
q("Studded, painted and otherwise customised leather jackets or denim vests", { y: p80, s: "punk" }, "denim vest:garment", "painted leather jacket:garment");
q("Hair was either shaved, spiked or in a crew cut or Mohawk hairstyle", { y: p80, s: "punk" }, "shaved head:hair", "crew cut:hair");
q("Tall mohawks and spiked hair, either bleached or in bright colors", { y: p80, s: "punk" }, "mohawk:hair");
q("Charged hair, in which all of one's hair stands on end", { y: p80, s: "punk" }, "charged hair:hair");
q("A hairstyle similar to the Misfits' devilocks was popular", { y: p80, r: "US", s: "punk" }, "devilock:hair");
q("Body piercings and extensive tattoos became very popular during this era", { y: p80, s: "punk" }, "body piercing:accessory", "studded choker:accessory");
q("Hardcore punk fans adopted a dressed-down style", { y: p80, r: "US", s: "hardcore punk" }, "hardcore punk:subculture", "sneakers:footwear");
q("Women in the hardcore scene typically wore army pants", { g: "women", y: p80, r: "US", s: "hardcore punk" }, "army trousers:garment", "hoodie:garment");
q("Another scholarly source describes the look that was common in the San Francisco hardcore scene", { y: p80, r: "US", s: "hardcore punk" },
  "studded wristband:accessory", "pierced nose:accessory");
q("Contemporary to the garage bands of the early 1970s, glam punk fashion", { y: [1970, 1973], r: "US", s: "glam punk" },
  "glam punk:subculture", "glitter:fabric", "androgynous makeup:makeup", "brightly dyed hair:hair", "electric blue:colour",
  "spandex:fabric", "satin shirt:garment");
q("Leftover baroque pop clothing like ruffled pirate shirts", { y: [1970, 1973], r: "US", s: "glam punk" },
  "ruffled pirate shirt:garment", "platform boots:footwear", "metallic silver jumpsuit:garment");
q("Garage punk bands of the 1970s like MC5", { y: d70, r: "US", s: "garage punk" },
  "garage punk:subculture", "velvet jacket:garment", "slim grey suit:garment", "winklepickers:footwear", "drainpipe jeans:garment");
q("In the late 1970s and early 1980s, Bristol bands like Disorder", { y: [1977, 1983], r: "UK", s: "crust punk" }, "crust punk:subculture");
q("Typical crust punk fashion includes black or camouflage trousers", { y: [1977, 1983], r: "UK", s: "crust punk" },
  "camouflage:pattern", "skin-tight black jeans:garment", "black denim:fabric", "hemp jewellery:accessory", "bum flap:accessory");
q("Clothing tends to be unsanitary by conventional standards, and dreadlocks are popular", { y: [1977, 1983], r: "UK", s: "crust punk" }, "dreadlocks:hair");
q("tonik suits (especially in the early years of the 1980s ska revival)", { g: "men", y: e80, r: "UK", s: "two tone" }, "tonic suit:garment");
q("During the early 1980s, some street punks and Oi! skinheads adopted elements", { g: "men", y: e80, r: "UK", s: "droog" }, "droog:subculture");
q("often wear bowler hats, white shirts, white trousers, braces", { g: "men", y: e80, r: "UK", s: "droog" },
  "bowler hat:accessory", "white trousers:garment", "combat boots:footwear");
q("Some fans also wore fishtail coats", { g: "men", y: e80, r: "UK", s: "droog" }, "fishtail parka:garment", "crombie coat:garment");
q("The scene emerged in the late 1980s on the basis of electro-industrial", { y: l80, s: "rivethead" }, "rivethead:subculture");
q("The associated dress style draws on military fashion and punk aesthetics", { y: l80, s: "rivethead" }, "military fashion:garment", "fetish wear:garment");

rv("mid-late 1960s secondhand clothing", [1964, 1969], [1970, 1979], "Garage punk bands of the 1970s like MC5");

// ---------------------------------------------------------------- Glam rock
art("glam");
const glam = [1971, 1976];
q("Glam rock (also known as glitter rock) is a subgenre", { y: glam, r: "UK", s: "glam rock" },
  "glam rock:subculture", "platform shoes:footwear", "glitter:fabric");
q("wearing glitter and satins, is often cited as the beginning", { y: glam, r: "UK", s: "glam rock" }, "satin:fabric");
q("manifesting itself in outrageous clothes, makeup, hairstyles, and platform-soled boots", { y: glam, r: "UK", s: "glam rock" },
  "platform boots:footwear", ["men's makeup:makeup", { g: "men" }]);
q("Glam rock is most noted for its sexual and gender ambiguity", { y: glam, r: "UK", s: "glam rock" }, "androgyny:silhouette");
q("incorporating elements of professional makeup, mime and performance", { g: "men", y: [1971, 1973], r: "UK", s: "glam rock" }, "ziggy stardust:silhouette");
q("the term glitter rock was most often used to refer to the extreme version", { y: [1972, 1975], r: "UK", s: "glam rock" }, "glitter rock:subculture");
q("Freddie Mercury enlisted Rhodes to design costumes", { g: "men", y: [1974, 1974], r: "UK", s: "glam rock" }, "zandra rhodes costume:garment");

rv("1930s hollywood glamour", [1930, 1939], [1971, 1976], "ranging from 1930s Hollywood glamour");
rv("1950s pin-up", [1950, 1959], [1971, 1976], "ranging from 1930s Hollywood glamour");

// ---------------------------------------------------------------- Disco
art("disco");
const dsc = [1977, 1979];
q("Nightclub-goers often wore expensive, extravagant outfits", { y: dsc, r: "US", s: "disco" }, "loose flowing trousers:garment");
q("Disco fashions were very trendy in the late 1970s", { y: dsc, r: "US", s: "disco" }, "disco:subculture");
q("Some women would wear sheer, flowing dresses", { g: "women", y: dsc, r: "US", s: "disco" }, "halston dress:garment", "flared trousers:garment");
q("Other women wore tight, revealing, sexy clothes", { g: "women", y: dsc, r: "US", s: "disco" },
  "backless halter top:garment", "disco pants:garment", "hot pants:garment", "spandex bodywear:garment", "catsuit:garment");
q("Men would wear shiny polyester Qiana shirts", { g: "men", y: dsc, r: "US", s: "disco" },
  "qiana shirt:garment", "wide collar:silhouette", "open chest shirt:silhouette");
q("Men often wore Pierre Cardin suits, three piece suits with a vest", { g: "men", y: dsc, r: "US", s: "disco" },
  "three-piece suit:garment", "leisure suit:garment", "double-knit polyester:fabric");
q("Men's leisure suits were typically form-fitted", { g: "men", y: dsc, r: "US", s: "disco" }, "bell-bottoms:garment");
q("Women dancers wore glitter makeup, sequins, or gold lamé clothing", { g: "women", y: dsc, r: "US", s: "disco" },
  "glitter makeup:makeup", "sequins:fabric", "gold lamé:fabric");
q("Bold colors were popular for both genders", { y: dsc, r: "US", s: "disco" }, "bold colours:colour");
q("Platform shoes and boots for both genders", { y: dsc, r: "US", s: "disco" },
  "platform shoes:footwear", "platform boots:footwear", ["high heels:footwear", { g: "women" }]);
q("Necklaces and medallions were a common fashion accessory", { y: dsc, r: "US", s: "disco" }, "medallion:accessory");

rv("1970s fashion", [1970, 1979], [1990, 1999], "This was part of a wave of 1970s nostalgia");
rv("disco", [1974, 1979], [2005, 2006], "In addition to Madonna's disco-influenced attire");

// ---------------------------------------------------------------- New Romantic
art("nr");
const nrY = [1978, 1981];
q("The New Romantic movement was characterised by flamboyant, eccentric fashion", { y: nrY, r: "UK", s: "new romantic" }, "new romantic:subculture");
q("Early adherents of the movement were often referred to by the press", { y: nrY, r: "UK", s: "new romantic" }, "blitz kids:subculture");
q("Both sexes often dressed in androgynous clothing and wore cosmetics", { y: nrY, r: "UK", s: "new romantic" },
  "androgynous clothing:silhouette", "eyeliner:makeup", "lipstick:makeup");
q("Fashion was based on varied looks inspired by historical Romantic themes", { y: nrY, r: "UK", s: "new romantic" },
  "frilly fop shirt:garment", "russian constructivism:pattern", "pierrot:garment", "1930s cabaret:silhouette");
q("Common hairstyles included quiffs, mullets and wedges", { y: nrY, r: "UK", s: "new romantic" }, "quiff:hair", "mullet:hair", "wedge haircut:hair");
q("dropped the eclectic clothes and make-up in favour of sharp suits", { g: "men", y: [1982, 1983], r: "UK" }, "sharp suit:garment");
q("unveiling of her \"pirate collection\"", { y: [1981, 1981], r: "UK", s: "new romantic" }, "pirate look:silhouette");
q("whose elaborate and theatrical designs brought together futuristic visual elements", { y: [1975, 1979], r: "UK", s: "new romantic" }, "kahn and bell:silhouette");

rv("glam rock", [1971, 1976], [1978, 1981], "the New Romantics developed fashions inspired by the glam rock era");
rv("romantic period dress", [1780, 1830], [1978, 1981], "the New Romantics developed fashions inspired by the glam rock era");
rv("1930s cabaret", [1930, 1939], [1978, 1981], "Fashion was based on varied looks inspired by historical Romantic themes");
rv("new romantic", [1978, 1981], [1994, 1996], "In the mid-1990s, the New Romantic era was the subject of nostalgia-oriented club nights");

// ---------------------------------------------------------------- Goth subculture
art("goth");
const gY = [1980, 1989];
q("Goth is a music-based subculture that emerged from nightclubs", { y: gY, r: "UK", s: "goth" }, "goth:subculture");
q("The style most often includes dark (usually solid black) attire", { y: gY, s: "goth" },
  "black clothing:colour", "dark makeup:makeup", "black hair:hair");
q("deathrock developed in California", { y: [1978, 1983], r: "US", s: "deathrock" }, "deathrock:subculture");
q("typical gothic fashion includes colored black hair and black period-styled clothing", { y: gY, s: "goth" }, "period-style clothing:garment");
q("Both male and female goths wear dark eyeliner and dark fingernail polish", { y: gY, s: "goth" }, "dark eyeliner:makeup", "black nail polish:makeup");
q("It also frequently expresses pagan, occult or other religious imagery", { y: gY, s: "goth" }, "occult imagery:pattern");
q("Gothic fashion and styling may also feature silver jewelry and piercings", { y: gY, s: "goth" }, "silver jewellery:accessory", "piercings:accessory");
q("profusion of black velvets, lace, fishnets and leather", { y: gY, s: "goth" },
  "black velvet:fabric", "lace:fabric", "fishnet:fabric", "leather:fabric", "scarlet:colour", "purple:colour",
  "corset:garment", "gloves:accessory", "stilettos:footwear");
q("the more Romantic side of 1980s trad-goth", { g: "women", y: gY, r: "UK", s: "goth" },
  "teased hair:hair", "partly shaved hair:hair", "black frill blouse:garment", "midi dress:garment", "tea-length skirt:garment",
  "floral lace tights:accessory", "doc martens:footwear", "spike heels:footwear", "winklepickers:footwear",
  "bracelets:accessory", "choker:accessory", "bib necklace:accessory");
q("This style, retroactively referred to as Ethergoth", { g: "women", y: [1984, 1989], r: "UK", s: "ethergoth" }, "ethergoth:subculture");
q("The 1980s established designers such as Drew Bernstein of Lip Service", { y: gY, r: "US", s: "goth" }, "goth designer labels:garment");

rv("victorian, edwardian and belle époque dress", [1837, 1914], [1980, 1989], "Styles of dress within the subculture draw on glam rock");

// ---------------------------------------------------------------- Skinhead
art("skin");
const sk1 = [1968, 1971], sk2 = [1979, 1989];
q("A skinhead or skin is a member of a subculture that originated among working-class youth in London", { y: sk1, r: "UK", s: "skinhead" }, "skinhead:subculture");
q("skinheads are defined by their close-cropped or shaven heads", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "shaved head:hair", "doc martens:footwear", "steel toe boots:footwear", "braces:accessory", "straight-leg jeans:garment",
  "button-down shirt:garment", "check shirt:pattern");
q("Working class mods chose practical clothing styles", { g: "men", y: [1964, 1966], r: "UK", s: "mod" },
  "work boots:footwear", "army boots:footwear", "sta-prest trousers:garment");
q("Around 1966, a schism developed between the \"peacock mods\"", { g: "men", y: [1966, 1968], r: "UK" },
  ["peacock mod:subculture", { s: "peacock mod" }], ["hard mod:subculture", { s: "hard mod" }]);
q("some of the original skins dropped into new categories", { g: "men", y: [1970, 1973], r: "UK" },
  ["suedehead:subculture", { s: "suedehead" }], ["smoothie:subculture", { s: "smoothie" }], ["bootboy:subculture", { s: "bootboy" }]);
q("Some fashion trends returned to the mod roots", { g: "men", y: [1970, 1973], r: "UK", s: "suedehead" },
  "brogues:footwear", "loafers:footwear", "suit:garment", "slacks and sweater:garment");
q("Most of these revivalist skinheads reacted to the commercialism of punk", { g: "men", y: [1977, 1979], r: "UK", s: "skinhead" }, "skinhead revival:subculture");
q("From 1979 onwards, punk-influenced skinheads with shorter hair, higher boots", { g: "men", y: sk2, r: "UK", s: "oi!" }, "oi!:subculture", "high boots:footwear");
q("Young men and boys generally wore short buzz cuts or shaved their heads entirely", { g: "men", y: [1970, 1973], r: "UK", s: "skinhead" }, "buzzcut:hair");
q("female skinheads began to adopt a style known as the Chelsea cut", { g: "women", y: [1978, 1983], r: "UK", s: "skinhead" }, "chelsea cut:hair");
q("Skinheads wore long-sleeve or short-sleeve button-down shirts or polo shirts", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "fred perry polo:garment", "ben sherman shirt:garment", "lonsdale sweatshirt:garment", "grandfather shirt:garment",
  "v-neck sweater:garment", "tank top:garment", "cardigan:garment");
q("They might wear fitted blazers, Harrington jackets", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "fitted blazer:garment", "harrington jacket:garment", "bomber jacket:garment", "denim jacket:garment", "donkey jacket:garment",
  "crombie coat:garment", "sheepskin coat:garment", "monkey jacket:garment", "parka:garment");
q("Traditional (\"hard mod\") skinheads sometimes wore suits", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "tonic suit:garment", "prince of wales check:pattern", "houndstooth:pattern");
q("Many skinheads wore Sta-Prest flat-fronted slacks", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "sta-prest trousers:garment", "levi's jeans:garment", "combat trousers:garment");
q("Jeans and slacks were worn deliberately short", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "cropped jeans:garment", "bright socks:accessory");
q("were sometimes splattered with bleach to resemble camouflage trousers", { g: "men", y: sk2, r: "UK", s: "oi!" }, "bleached jeans:garment", "turn-ups:silhouette");
q("Many traditionalist skinheads wore braces (suspenders)", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "thin braces:accessory");
q("Hats common among skinheads include", { g: "men", y: sk1, r: "UK", s: "skinhead" },
  "trilby:accessory", "pork pie hat:accessory", "flat cap:accessory", "woolly hat:accessory");
q("Traditionalist skinheads sometimes wore a silk handkerchief", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "pocket square:accessory", "pocket flash:accessory");
q("Also popular were woollen or printed rayon scarves in football club colours", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "football scarf:accessory");
q("Silk or faux-silk scarves (especially Tootal brand)", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "paisley scarf:accessory");
q("Female skinheads, (who are sometimes called skinbyrds", { g: "women", y: sk1, r: "UK", s: "skinhead" }, "skirt suit:garment", "stockings:accessory");
q("Some skingirls wore fishnet stockings and mini-skirts", { g: "women", y: sk2, r: "UK", s: "skinhead" }, "fishnet stockings:accessory", "miniskirt:garment");
q("In 1960s Britain, steel-toe boots worn by skinheads and hooligans were called bovver boots", { g: "men", y: sk1, r: "UK", s: "skinhead" }, "bovver boots:footwear");
q("with the addition of monkey boots", { g: "women", y: sk1, r: "UK", s: "skinhead" }, "monkey boots:footwear");
q("Suedeheads sometimes wore coloured socks", { g: "men", y: [1970, 1973], r: "UK", s: "suedehead" }, "coloured socks:accessory");

rv("skinhead", [1969, 1969], [1977, 1979], "Most of these revivalist skinheads reacted to the commercialism of punk");
rv("skinhead", [1967, 1969], [1980, 1989], "The movement reached a peak at the end of the 1960s");

// ---------------------------------------------------------------- Preppy
art("prep");
const pr80 = [1980, 1989];
q("The book ended up fueling and influencing a resurgence of interest in preppy fashion", { y: pr80, r: "US", s: "preppy" }, "preppy:subculture");
q("By the 1980s, mass marketing of brands such as Ralph Lauren", { y: pr80, r: "US", s: "preppy" }, "ralph lauren:garment", "lacoste:garment", "izod:garment");
q("Distinctly preppy fashions then emerged", { y: pr80, r: "US", s: "preppy" }, "rugby shirt:garment", "boat shoes:footwear");
q("with its eponymous \"Bean Boots\"", { y: pr80, r: "US", s: "preppy" }, "bean boots:footwear");
q("Female preppy-influenced fashion emerged in the 1960s", { g: "women", y: [1960, 1979], r: "US", s: "preppy" }, "lilly pulitzer:garment");
q("These classic ensembles of the 1960s and 1970s include tailored skirt suits", { g: "women", y: [1960, 1979], r: "US", s: "preppy" },
  "skirt suit:garment", "low heels:footwear", "wrap dress:garment", "shift dress:garment", "silk blouse:garment");
q("Such clothing drew on elements of typical preppy styles", { g: "women", y: [1960, 1979], r: "US", s: "preppy" },
  "pastel colours:colour", "equestrian details:accessory", "nautical style:pattern", "breton stripes:pattern");
q("Navy blazers with brass buttons", { g: "men", y: pr80, r: "US", s: "preppy" }, "navy blazer:garment");
q("particularly Oxford Cloth Button Down Shirts", { g: "men", y: pr80, r: "US", s: "preppy" }, "oxford shirt:garment");
q("Repp stripe and silk knit neckties", { g: "men", y: pr80, r: "US", s: "preppy" }, "repp tie:accessory", "knit tie:accessory");
q("particularly those with cable knitting, argyle patterns", { y: pr80, r: "US", s: "preppy" }, "cable knit sweater:garment", "argyle:pattern");
q("Grosgrain (\"ribbon\"), surcingle, and woven leather belts", { y: pr80, r: "US", s: "preppy" }, "ribbon belt:accessory", "woven leather belt:accessory");
q("Seersucker and madras cloth", { y: pr80, r: "US", s: "preppy" }, "seersucker:fabric", "madras:pattern", "bermuda shorts:garment");
q("Gray flannel, chino cloth, and corduroy trousers", { g: "men", y: pr80, r: "US", s: "preppy" }, "chinos:garment", "corduroy trousers:garment", "grey flannel trousers:garment");
q("Nantucket reds and other go-to-hell pants", { g: "men", y: pr80, r: "US", s: "preppy" }, "nantucket reds:garment");
q("Loafers (particularly penny loafers)", { y: pr80, r: "US", s: "preppy" }, "penny loafers:footwear");
q("Derby shoes made of buckskin", { g: "men", y: pr80, r: "US", s: "preppy" }, "buckskin derby:footwear");
q("Polo shirts and rugby shirts", { y: pr80, r: "US", s: "preppy" }, "polo shirt:garment");

rv("ivy and preppy style", [1955, 1959], [1980, 1989], "By the 1980s, mass marketing of brands such as Ralph Lauren");

// ---------------------------------------------------------------- build
const ABBREVIATIONS = /^(?:[A-Z]\.|(?:[A-Z]\.){2,}|Mr\.|Mrs\.|Dr\.|St\.|Jr\.|vs\.|e\.g\.|i\.e\.)$/;

function sentences(text) {
  const out = [];
  let start = 0;
  const push = (end) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const s = raw.trim();
    if (s) out.push({ start: start + lead, end: start + lead + s.length, text: s });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      push(i);
      continue;
    }
    if (c !== "." && c !== "!" && c !== "?") continue;
    let j = i + 1;
    while (j < text.length && "\"')]’”".includes(text[j])) j++;
    if (j >= text.length || !/\s/.test(text[j])) continue;
    let k = j;
    while (k < text.length && text[k] === " ") k++;
    if (k < text.length && text[k] !== "\n" && !/[A-Z0-9"'(\[‘“]/.test(text[k])) continue;
    const token = text.slice(0, i + 1).match(/(\S+)$/)[1].replace(/^[("'\[]+/, "");
    if (ABBREVIATIONS.test(token)) continue;
    push(j);
  }
  push(text.length);
  return out;
}

function locate(text, sents, fragment, where) {
  const at = text.indexOf(fragment);
  if (at < 0) throw new Error(`${where}: fragment not found: ${fragment}`);
  if (text.indexOf(fragment, at + 1) >= 0) throw new Error(`${where}: fragment not unique: ${fragment}`);
  const end = at + fragment.length;
  const hit = sents.filter((s) => s.end > at && s.start < end);
  return text.slice(hit[0].start, hit.at(-1).end);
}

const loaded = {};
for (const [key, title] of Object.entries(ARTICLES)) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const text = await readFile(join(rawDir, `${slug}.txt`), "utf8");
  const meta = JSON.parse(await readFile(join(rawDir, `${slug}.json`), "utf8"));
  loaded[key] = { title: meta.title, url: meta.url, text, sents: sentences(text) };
}

const year = (y, where) => {
  if (!Number.isInteger(y)) throw new Error(`${where}: year ${y} is not an integer`);
  return y;
};

const rows = specs.map((r) => {
  const where = `${r.article} "${r.term}"`;
  if (!CATEGORIES.has(r.category)) throw new Error(`${where}: bad category ${r.category}`);
  if (!GENDERS.has(r.gender)) throw new Error(`${where}: bad gender ${r.gender}`);
  if (!REGIONS.has(r.region)) throw new Error(`${where}: bad region ${r.region}`);
  if (year(r.start, where) > year(r.end, where)) throw new Error(`${where}: start after end`);
  const a = loaded[r.article];
  return {
    term: r.term,
    category: r.category,
    gender: r.gender,
    start: r.start,
    end: r.end,
    region: r.region,
    subculture: r.subculture,
    article: a.title,
    quote: locate(a.text, a.sents, r.fragment, where),
  };
});

const seen = new Set();
for (const r of rows) {
  const key = [r.article, r.term, r.gender, r.start, r.end, r.region].join("|");
  if (seen.has(key)) throw new Error(`duplicate row ${key}`);
  seen.add(key);
}

const revivals = revivalSpecs.map((r) => {
  const where = `${r.article} revival "${r.term}"`;
  const [os, oe] = r.original.map((y) => year(y, where));
  const [rs, re] = r.revival.map((y) => year(y, where));
  if (os > oe || rs > re || oe > rs) throw new Error(`${where}: bad year ranges`);
  const a = loaded[r.article];
  return {
    term: r.term,
    original: { start: os, end: oe },
    revival: { start: rs, end: re },
    article: a.title,
    quote: locate(a.text, a.sents, r.fragment, where),
  };
});

const articles = Object.values(loaded).map(({ title, url }) => ({ title, url }));
await writeFile(outFile, JSON.stringify({ articles, rows, revivals }, null, 2) + "\n");

const counts = {};
for (const r of rows) counts[r.article] = (counts[r.article] ?? 0) + 1;
console.log(`wrote ${rows.length} rows and ${revivals.length} revivals`);
for (const [title, n] of Object.entries(counts)) console.log(`  ${n}\t${title}`);
