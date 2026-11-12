#!/usr/bin/env node
// Merges the three Wikipedia extraction parts into one canonical trend list and one revival list.
// Rows are matched to the hand-curated trend table below by their normalised term; rows that match
// no trend are dropped (too vague, non-Western, or too rare to chart) and listed in
// raw/normalise-trends-unmatched.json for review.
// Run: node scripts/normalise-trends.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The hand-curated trend table.
// Each entry: [id, name, category, patterns, description, ngram, overrides?]
// Patterns are regex fragments matched against a whole normalised term (see norm below). A
// "category:pattern" fragment only matches rows of that category. The first matching entry wins,
// so specific entries come before generic ones. Overrides set gender or subculture by hand.

const table = [
  // Dresses and skirts
  ["little-black-dress", "Little black dress", "garment", ["little black dress"], "A short, simple black dress meant to work for almost any evening.", ["little black dress"]],
  ["tea-gown", "Tea gown", "garment", ["tea gowns?"], "A loose, unstructured dress for receiving guests at home without a corset.", ["tea gown"], { gender: "women" }],
  ["sack-dress", "Sack dress", "garment", ["sack dress", "chemise( dress)?", "trapeze dress", "tent dress"], "A waistless dress that hangs straight or flares from the shoulders.", ["sack dress", "trapeze dress", "chemise dress"], { gender: "women" }],
  ["shift-dress", "Shift dress", "garment", ["(floral |long )?shift dress"], "A short, straight dress with no defined waist.", ["shift dress"], { gender: "women" }],
  ["sheath-dress", "Sheath dress", "garment", ["(sequined )?sheath( dress)?", "column gown", "tube dress"], "A narrow, fitted dress that follows the body in a straight line.", ["sheath dress"], { gender: "women" }],
  ["wrap-dress", "Wrap dress", "garment", ["wrap dress", "wrap skirt", "wrap top"], "A dress that closes by wrapping one side across the other and tying at the waist.", ["wrap dress"], { gender: "women" }],
  ["slip-dress", "Slip dress", "garment", ["slip dress", "slip", "lace slip"], "A bias-cut, thin-strapped dress that looks like an undergarment worn as outerwear.", ["slip dress"], { gender: "women" }],
  ["babydoll-dress", "Babydoll dress", "garment", ["baby ?doll dress"], "A short, high-waisted dress with a loose skirt.", ["babydoll dress", "baby doll dress"], { gender: "women" }],
  ["cocktail-dress", "Cocktail dress", "garment", ["cocktail dress"], "A short evening dress for early evening parties.", ["cocktail dress"], { gender: "women" }],
  ["prairie-dress", "Prairie dress", "garment", ["prairie (dress|clothing|midi dress)", "milkmaid dress", "printed granny dress", "homesteader clothing", "pioneer clothing"], "A long, high-necked, floral dress that borrows from nineteenth-century American settler clothes.", ["prairie dress", "granny dress"], { gender: "women" }],
  ["maxi-dress", "Maxi dress", "garment", ["(floral |belted |hippie |lace )?maxi dress"], "A floor-length casual dress.", ["maxi dress"], { gender: "women" }],
  ["miniskirt", "Miniskirt and minidress", "garment", ["(.+ )?mini ?skirts?", "micro mini", "short skirts", "mini ?dress", "(velvet|gingham) mini ?dress"], "A skirt or dress cut well above the knee, the symbol of Swinging London.", ["miniskirt", "mini skirt", "minidress"], { gender: "women" }],
  ["midi-skirt", "Midi skirt", "garment", ["midi ?skirt", "midi dress", "gothic midi dress"], "A skirt or dress that ends at mid-calf.", ["midi skirt", "midiskirt", "midi dress"], { gender: "women" }],
  ["maxi-skirt", "Maxi skirt", "garment", ["(floral |twill )?maxi skirt", "long( full| droopy)? skirt"], "A floor-length skirt.", ["maxi skirt", "maxiskirt"], { gender: "women" }],
  ["pencil-skirt", "Pencil skirt", "garment", ["pencil skirt", "narrow skirt", "tube skirt", "bandage skirt"], "A slim, straight skirt that narrows at the knee.", ["pencil skirt"], { gender: "women" }],
  ["a-line", "A-line skirt", "silhouette", ["a line( skirt)?"], "A skirt or dress that flares gently from the waist, shaped like the letter A.", ["A-line skirt", "A-line dress"], { gender: "women" }],
  ["full-skirt", "Full skirt", "silhouette", ["full skirt", "circle skirt", "puffy skirt", "sweeping skirt", "flared skirt", "poodle skirt"], "A wide skirt cut from a full circle, like the 1950s poodle skirt, often held out by petticoats.", ["full skirt", "circle skirt", "poodle skirt"], { gender: "women" }],
  ["petticoat", "Crinoline petticoat", "garment", ["petticoats?", "horsehair petticoat", "crinoline", "hoop skirt"], "A stiffened underskirt that holds a skirt out wide.", ["crinoline petticoat", "stiff petticoat", "can-can petticoat"], { gender: "women" }],
  ["pleated-skirt", "Pleated skirt", "garment", ["(box |knife )?pleated skirt", "box pleated skirt", "knife pleated skirt", "tennis skirt"], "A skirt folded into pleats that swing as you move, including the short tennis skirt.", ["pleated skirt", "tennis skirt"], { gender: "women" }],
  ["kilt", "Kilt", "garment", ["kilts?", "tartan kilt", "tartan minikilt", "plaid skirt"], "A pleated tartan skirt, worn by punks, grunge kids and schoolgirl looks.", ["tartan skirt", "kilt", "plaid skirt"]],
  ["culottes", "Culottes", "garment", ["culottes?", "divided skirt", "culotte suit", "gauchos"], "Wide shorts or trousers cut to look like a skirt.", ["culottes", "divided skirt", "gaucho pants"], { gender: "women" }],
  ["bubble-skirt", "Bubble skirt", "silhouette", ["bubble (skirt|dress|hem)", "pouf dress", "puffball skirt"], "A skirt gathered at the hem so it balloons out.", ["bubble skirt", "puffball skirt"], { gender: "women" }],
  ["peplum", "Peplum", "silhouette", ["peplum( dress| jacket)?"], "A short flared frill at the waist of a jacket, top or dress.", ["peplum"], { gender: "women" }],

  // Underwear as fashion
  ["corset", "Corset and girdle", "garment", ["corsets?", "boned corset", "soft corset", "bustier", "corselets?", "corselettes?", "waist cincher", "merry widow", "girdles?", "garter belt", "garters"], "Boned or elastic shapewear that pulls in the waist, later worn on top of clothes.", ["corset", "girdle", "bustier"], { gender: "women" }],
  ["stockings", "Stockings", "garment", ["(silk|nylon|rayon|seamless|rolled|sheer|clocked|dark) stockings", "stockings"], "Sheer stockings, first silk, then rayon, then nylon.", ["nylon stockings", "silk stockings"], { gender: "women" }],
  ["fishnets", "Fishnets", "accessory", ["fishnets?", "fishnet (tights|stockings|gloves)", "ripped fishnet stockings"], "Open-mesh tights or stockings, a burlesque staple that punks took up.", ["fishnet stockings", "fishnet tights"], { gender: "women" }],
  ["tights", "Coloured tights", "accessory", ["tights", "pantyhose", "nude pantyhose", "(coloured|opaque|patterned|ripped|pale|fashion|lace|floral lace|mesh|neon blue|brightly coloured) tights", "coloured hosiery", "black or white tights"], "Opaque or patterned tights worn as part of the look rather than hidden.", ["coloured tights", "colored tights", "opaque tights"], { gender: "women" }],
  ["camisole", "Camisole", "garment", ["camisoles?", "cami knickers", "step in panties", "tap pants"], "A light strappy top that started as lingerie.", ["camisole", "cami-knickers"], { gender: "women" }],

  // Tops
  ["crop-top", "Crop top", "garment", ["crop tops?", "cropped (tank top|sweater|top)", "halterneck crop top", "spaghetti strap crop top", "midriff baring top"], "A top cut short to show the midriff.", ["crop top", "cropped top"], { gender: "women" }],
  ["tube-top", "Tube top", "garment", ["tube tops?", "bandeau( top)?", "strapless top", "boob tube"], "A strapless, elasticated band of fabric worn as a top.", ["tube top", "boob tube"], { gender: "women" }],
  ["halter-top", "Halter top", "garment", ["halter (top|dress)", "backless halter top", "sequined halter top"], "A top or dress held up by a strap around the neck, leaving the back bare.", ["halter top", "halter neck", "halterneck"], { gender: "women" }],
  ["off-the-shoulder", "Off-the-shoulder top", "garment", ["off the shoulder (top|sweatshirt)", "cold shoulder top", "bardot top"], "A top with a wide neckline that sits below the shoulders.", ["off-the-shoulder top", "Bardot top"], { gender: "women" }],
  ["peasant-blouse", "Peasant blouse", "garment", ["peasant (blouse|top)", "gypsy (blouse|top|clothing)", "embroidered blouse"], "A loose, gathered blouse with folk embroidery.", ["peasant blouse"], { gender: "women" }],
  ["sheer-top", "Sheer and mesh top", "garment", ["sheer (top|fabric)", "transparent (top|shirt)", "mesh (top|t shirt)", "mesh", "translucent fabric"], "A see-through top in mesh or chiffon.", ["mesh top", "sheer top", "see-through blouse"]],
  ["tank-top", "Tank top", "garment", ["tank tops?", "a shirt", "muscle (shirt|tank)", "sleeveless t shirt", "athletic tank top", "basketball singlet"], "A sleeveless vest top.", ["tank top", "muscle shirt", "vest top"]],
  ["band-t-shirt", "Band T-shirt", "garment", ["band t shirt", "concert t shirt", "classic rock t shirt"], "A T-shirt printed with a band's name or tour.", ["band T-shirt", "band tee", "concert T-shirt"]],
  ["slogan-t-shirt", "Slogan T-shirt", "garment", ["slogan (t )?shirt", "(ironic )?slogan t shirt", "message t shirt", "offensive t shirt", "god save the queen shirt", "no fear t shirt"], "A T-shirt that wears its message across the chest.", ["slogan T-shirt", "slogan tee"]],
  ["ed-hardy", "Ed Hardy", "garment", ["ed hardy( t shirt)?"], "Rhinestoned T-shirts and caps printed with tattoo art.", ["Ed Hardy"]],
  ["graphic-t-shirt", "Graphic T-shirt", "garment", ["graphic (t shirt|tee)", "vintage graphic t shirt", "cartoon character t shirt", "1980s movie poster t shirt", "smiley t shirt", "printed shirt", "santa cruz t shirt", "low neck graphic t shirt"], "A T-shirt printed with pictures or logos.", ["graphic T-shirt", "graphic tee", "printed T-shirt"]],
  ["white-t-shirt", "T-shirt", "garment", ["(white |skin tight |v neck |oversized )?t shirts?", "oversized t shirt"], "A plain T-shirt worn on its own as outerwear, made cool by Brando and Dean.", ["white T-shirt", "plain T-shirt"]],
  ["hawaiian-shirt", "Hawaiian and camp collar shirt", "garment", ["hawaiian (shirt|print)", "aloha shirt", "tropical print( shirt)?", "palm tree print", "(linen |patterned )?camp (collar )?shirt", "cuban collar", "revere collar", "bowling shirt", "dark bowling shirt", "gas station shirt"], "A boxy short-sleeved shirt with a flat open collar, often in loud tropical prints.", ["Hawaiian shirt", "aloha shirt", "bowling shirt"], { gender: "men" }],
  ["western-shirt", "Western shirt", "garment", ["(embroidered |checked |denim )?western shirt", "pearl snap (western )?shirt"], "A cowboy shirt with a pointed yoke and pearl snap buttons.", ["western shirt", "cowboy shirt"]],
  ["polo-shirt", "Polo shirt", "garment", ["(knit |layered |logo |pink |stripy |striped )?polo shirt", "fred perry (polo|shirt)", "ben sherman polo", "lacoste", "izod", "popped collar polo( shirt)?"], "A short-sleeved knitted shirt with a collar and buttoned placket.", ["polo shirt", "Lacoste shirt", "Fred Perry shirt"]],
  ["button-down-shirt", "Button-down shirt", "garment", ["button down( shirt)?", "oxford shirt", "ben sherman shirt", "plaid button down shirt"], "A cotton shirt whose collar points button to the front, an Ivy League staple.", ["button-down shirt", "button-down collar", "Oxford shirt"], { gender: "men" }],
  ["flannel-shirt", "Flannel shirt", "garment", ["(oversized |plaid |tartan |padded )?flannel shirt", "plaid (flannel|shirt)", "tartan shirt", "checked shirt", "check shirt", "padded (flannel|tartan) overshirt", "waffle plaid shirt", "lumberjack workwear", "flannel tied around waist"], "A soft checked work shirt, the uniform of grunge.", ["flannel shirt", "plaid shirt", "lumberjack shirt"]],
  ["poet-shirt", "Poet shirt", "garment", ["poet shirt", "(ruffled )?pirate shirt", "frill(y|ed)( fop)? shirt", "ruffled shirt", "black frill blouse", "pirate look"], "A billowing shirt with ruffles and full sleeves, pirate style.", ["poet shirt", "pirate shirt", "frilly shirt"]],
  ["sports-jersey", "Sports jersey", "garment", ["football shirt", "striped football shirt", "sports jersey", "throwback (jersey|sports uniform)", "american football shirt", "(pullover )?baseball jersey", "pinstripe baseball jersey", "jersey shirt"], "A replica team shirt worn as streetwear.", ["football shirt", "sports jersey", "basketball jersey"]],
  ["turtleneck", "Turtleneck", "garment", ["(black |dark |ribbed |cashmere )?turtle ?necks?( sweater)?", "polo necks?", "striped mock neck", "high necked sweater"], "A close-fitting knit with a high folded collar.", ["turtleneck", "polo neck", "roll neck"]],
  ["cardigan", "Cardigan", "garment", ["(beige |cable knit |chunky |cashmere |cropped |oversized |oversized striped |shawl collar |zip up |belted |beaded |short sleeved |striped |aran )?cardigans?( sweater)?"], "A knitted jacket that buttons up the front.", ["cardigan"]],
  ["sweater-vest", "Sweater vest", "garment", ["sweater vests?"], "A sleeveless knitted jumper worn over a shirt.", ["sweater vest", "knitted tank top"]],
  ["oversized-sweater", "Oversized sweater", "garment", ["oversized sweater", "baggy sweater", "chunky sweater", "long sweater", "leggings with oversized sweater", "sloppy joe sweater"], "A deliberately big, slouchy jumper, from 1940s Sloppy Joes to 1980s knits.", ["oversized sweater", "sloppy joe sweater", "baggy sweater"]],
  ["hoodie", "Hoodie and sweatshirt", "garment", ["(black |graphic |logo |oversized |zip up |purple |orange |cartoon print |cyrillic lettering )?hoodies?", "sweatshirts?", "(champion |stone island |crewneck |champion crew neck |lonsdale |ripped )sweatshirt"], "Hooded and crew-neck sweatshirts, from sportswear to streetwear staple.", ["hoodie", "hooded sweatshirt", "sweatshirt"]],
  ["kaftan", "Kaftan and tunic", "garment", ["c?kaftan( blouse| dress)?", "caftan", "tunics?( top)?", "(short |sleeveless |ethnic |hip belted )tunic"], "A long, loose robe-like top worn over trousers or on its own.", ["kaftan", "caftan", "tunic top"]],
  ["dashiki", "Dashiki", "garment", ["dashikis?( suit)?"], "A loose, brightly patterned West African tunic worn as a statement of Black pride.", ["dashiki"]],

  // Jackets and coats
  ["nehru-jacket", "Nehru jacket", "garment", ["nehru (jacket|suit)", "mao jacket", "mandarin collar shirt"], "A hip-length tailored jacket with a stand-up mandarin collar.", ["Nehru jacket", "Mao jacket"], { gender: "men" }],
  ["zoot-suit", "Zoot suit", "garment", ["zoot suits?", "zoot suiters", "pachuco"], "A long, wide-shouldered jacket over high-waisted pegged trousers, worn by Black and Mexican American youth.", ["zoot suit", "zoot suiters", "pachuco"], { gender: "men", subculture: "Zoot suiters" }],
  ["drape-jacket", "Drape jacket", "garment", ["drape jacket", "english drape", "velvet collared jacket", "velvet collar"], "A long, loose jacket with a velvet collar, the Teddy Boy signature.", ["drape jacket", "drape suit"], { gender: "men" }],
  ["power-suit", "Power suit", "garment", ["(double breasted )?power (suit|pantsuit)", "power dressing", "broad shouldered suit"], "A sharp, broad-shouldered suit for women at work.", ["power suit", "power dressing"], { gender: "women" }],
  ["trouser-suit", "Trouser suit", "garment", ["pant ?suit", "pinstripe pantsuit", "trouser suit", "bootcut trouser suit", "le smoking"], "A matching jacket and trousers for women.", ["trouser suit", "pantsuit", "pant suit"], { gender: "women" }],
  ["skirt-suit", "Skirt suit", "garment", ["skirt suit", "chanel suit", "chanel style cardigan suit", "tailored skirt", "day suit"], "A matching jacket and skirt, from Chanel boucle to office wear.", ["skirt suit", "Chanel suit"], { gender: "women" }],
  ["double-breasted-suit", "Double-breasted suit", "garment", ["double breasted (suit|blazer|sport ?coat|coat)"], "A suit jacket with overlapping fronts and two columns of buttons.", ["double-breasted suit", "double-breasted jacket"], { gender: "men" }],
  ["leisure-suit", "Leisure and safari suit", "garment", ["leisure suit", "safari (jacket|suit)"], "A casual suit with a shirt-style or belted safari jacket.", ["leisure suit", "safari suit", "safari jacket"], { gender: "men" }],
  ["tonic-suit", "Tonic suit", "garment", ["tonic suit", "mohair suit"], "A sharp suit in two-tone mohair that shimmers between colours.", ["tonic suit", "mohair suit"], { gender: "men" }],
  ["slim-suit", "Slim-cut suit", "garment", ["slim( grey)? suit", "two button suit", "mad men suit", "continental suit", "fitted suit", "straight cut suit", "sharp suit", "quasi european suit"], "A narrow, short, close-cut suit with slim trousers.", ["slim suit", "slim-fit suit", "Italian suit"], { gender: "men" }],
  ["velvet-blazer", "Velvet blazer", "garment", ["velvet (tuxedo|tuxedo jacket|blazer|jacket|sport ?coat|shawl collar suit)"], "A tailored jacket in velvet, often for evening.", ["velvet blazer", "velvet jacket", "velvet smoking jacket"], { gender: "men" }],
  ["unstructured-blazer", "Unstructured blazer", "garment", ["unstructured (blazer|jacket|suit)", "miami vice suit", "t shirt under suit jacket"], "A soft, unlined jacket worn loose, often over a T-shirt.", ["unstructured jacket", "unstructured suit"], { gender: "men" }],
  ["tweed-jacket", "Tweed jacket", "garment", ["(harris )?tweed (jacket|sport ?coat|sports jacket|suit)", "long tweed coat"], "A jacket in rough country wool.", ["tweed jacket", "tweed sports jacket"]],
  ["trench-coat", "Trench coat", "garment", ["(belted |gabardine |leather |black leather |studded )?trench ?coats?", "burberry (coat|mac)"], "A belted, double-breasted gabardine raincoat from the First World War.", ["trench coat", "trenchcoat"]],
  ["parka", "Parka", "garment", ["(fishtail |military |green )?parka"], "A long hooded military coat, the mod's scooter coat.", ["fishtail parka", "parka"]],
  ["puffer-jacket", "Puffer jacket", "garment", ["puffer (jacket|coat|vest)", "puffy (jacket|vest)", "down jacket", "quilted (nylon vest|jacket)", "fur lined puffer jacket", "body warmer"], "A quilted jacket stuffed with down or synthetic fill.", ["puffer jacket", "down jacket", "puffa jacket"]],
  ["bomber-jacket", "Bomber jacket", "garment", ["bomber jacket", "flying jacket", "aviator jacket", "leather pilot jacket", "shearling flight jacket"], "A short, zipped flight jacket with ribbed cuffs.", ["bomber jacket", "flight jacket"]],
  ["harrington-jacket", "Harrington jacket", "garment", ["harrington jacket"], "A short cotton zip jacket with a tartan lining.", ["Harrington jacket"], { gender: "men" }],
  ["varsity-jacket", "Varsity jacket", "garment", ["varsity jacket", "letterman jacket", "(wool |oversized )?baseball jacket"], "A wool and leather college jacket with a big letter.", ["varsity jacket", "letterman jacket", "baseball jacket"]],
  ["leather-jacket", "Leather jacket", "garment", ["(black |brown |red |oversized |cropped |studded |painted |slouch shoulder |boxy )?leather (jacket|reefer jacket|blazer)", "(studded )?perfecto( leather)?( jacket)?", "(leather )?biker jacket", "motorcycle jacket", "leather jacket with shoulder pads"], "A short black leather jacket, from bikers to punks.", ["leather jacket", "biker jacket", "motorcycle jacket"]],
  ["denim-jacket", "Denim jacket", "garment", ["(dark |cut off |customised |stonewashed )?denim jacket", "jean jacket", "battle jacket"], "A jean jacket, often customised with patches.", ["denim jacket", "jean jacket"]],
  ["windbreaker", "Windbreaker", "garment", ["(neon |red )?windbreaker", "windcheater", "(oversized )?anorak", "coach jacket", "nylon jacket", "ski jacket"], "A light nylon jacket that keeps the wind out.", ["windbreaker", "windcheater", "anorak"]],
  ["fleece", "Fleece jacket", "fabric", ["(polar )?fleece"], "A soft synthetic pile jacket from outdoor gear.", ["fleece jacket", "polar fleece"]],
  ["fur-coat", "Fur coat", "garment", ["fur (coat|jacket|stole|capelet|collar)", "fox (fur|stole)", "mink", "sable", "persian lamb", "astrakhan", "fur", "sealskin"], "A coat, stole or trim of real fur.", ["fur coat", "mink coat", "fur stole"]],
  ["faux-fur", "Faux fur", "fabric", ["(faux|fake) fur( coat| collar| trim)?", "flokati fur"], "Synthetic fur, often in bright colours or animal prints.", ["faux fur", "fake fur"]],
  ["cape", "Cape and poncho", "garment", ["capes?", "cloak", "fur lined cloak", "ponchos?"], "A sleeveless outer layer that hangs from the shoulders.", ["cape coat", "poncho"]],
  ["waistcoat", "Waistcoat", "garment", ["waistcoats?", "(double breasted |leather |hemp |crochet |brocade |linen |rayon |high rise |fringed denim )waistcoat", "vest", "(denim |gingham |fringed buckskin )vest"], "A sleeveless buttoned layer worn over a shirt.", ["waistcoat"]],
  ["utility-clothing", "Utility clothing", "garment", ["utility (clothing|suit)", "victory suit"], "Wartime clothes cut to strict rules that saved cloth.", ["utility clothing"]],
  ["military-surplus", "Military surplus", "garment", ["military (surplus|jacket|clothing|fashion|details|inspired clothing|uniform)", "army surplus", "flak jacket", "combat jacket", "eisenhower jacket", "1980s military details"], "Army clothes and military details worn as street fashion.", ["army surplus", "military surplus", "military jacket"]],
  ["workwear", "Workwear", "garment", ["workwear", "work shirt", "canvas work jacket", "dickies", "carpenter jeans"], "Tough work clothes like chore jackets and carpenter trousers worn as fashion.", ["workwear", "chore jacket", "carpenter jeans"]],

  // Trousers and shorts
  ["sportswear", "Sportswear", "garment", ["sportswear", "athletic (clothing|fashion|wear)", "retro sportswear", "sports logo clothing"], "Sports clothes worn as everyday fashion.", ["sportswear"]],
  ["athleisure", "Athleisure", "subculture", ["athleisure", "next gen athleisure", "activewear", "exercise wear"], "Gym clothes styled for the rest of the day.", ["athleisure"]],
  ["tracksuit", "Tracksuit", "garment", ["track ?suits?", "(adidas |nylon )tracksuit", "tracksuit top", "track (jacket|pants)", "sports suit", "shell suit", "velour tracksuit", "juicy couture"], "A matching zip jacket and trousers from sport, in nylon, velour or shiny shell.", ["tracksuit", "shell suit", "velour tracksuit"]],
  ["sweatpants", "Sweatpants", "garment", ["sweatpants", "(dark grey|grey|marl|tapered) sweatpants", "joggers", "(slim |twill )?jogger pants", "jogging trousers", "sweats", "sweatsuit"], "Soft cotton jersey trousers with elastic cuffs.", ["sweatpants", "jogging bottoms", "joggers"]],
  ["leggings", "Leggings", "garment", ["(lycra |lame |metallic spandex |capri )?leggings", "footless tights", "stirrup pants", "stretch pants", "jeggings"], "Skin-tight stretch trousers, including stirrup pants and denim-look jeggings.", ["leggings", "stirrup pants", "jeggings"], { gender: "women" }],
  ["yoga-pants", "Yoga pants", "garment", ["yoga pants", "lululemon"], "Stretchy flared or fitted workout trousers worn everywhere.", ["yoga pants"], { gender: "women" }],
  ["bike-shorts", "Cycling shorts", "garment", ["bike shorts", "cycling shorts", "spandex shorts"], "Tight Lycra shorts from cycling, worn as streetwear.", ["cycling shorts", "bike shorts"]],
  ["hot-pants", "Hot pants", "garment", ["hot pants", "short shorts", "daisy dukes", "hoochie daddy shorts"], "Very short, tight shorts.", ["hot pants", "short shorts"], { gender: "women" }],
  ["bermuda-shorts", "Bermuda shorts", "garment", ["bermuda shorts"], "Knee-length tailored shorts.", ["Bermuda shorts"]],
  ["denim-shorts", "Denim cut-offs", "garment", ["(acid wash )?jean shorts", "denim shorts", "cut off shorts", "jorts"], "Jeans cut off above the knee.", ["denim shorts", "cut-off jeans", "cutoffs"]],
  ["cargo-pants", "Cargo pants", "garment", ["(baggy |camouflage |high waisted )?cargo (pants|shorts)", "combat trousers", "utility pants", "tactical (pants|vest)", "army trousers"], "Loose trousers with big patch pockets on the thighs.", ["cargo pants", "cargo trousers", "combat trousers"]],
  ["harem-pants", "Harem pants", "garment", ["harem pants", "hammer pants", "drop crotch (pants|trousers)", "happy pants"], "Baggy trousers with a dropped crotch that narrow at the ankle.", ["harem pants", "harem trousers", "Hammer pants"]],
  ["capri-pants", "Capri pants", "garment", ["capri pants", "pedal pushers", "pedal pushers and capri pants", "clam diggers", "cropped trousers", "toreador (pants|trousers)", "cropped( slim)? jeans"], "Slim trousers that end at mid-calf.", ["capri pants", "pedal pushers", "cropped trousers"], { gender: "women" }],
  ["palazzo-pants", "Palazzo pants", "garment", ["palazzo pants", "beach pyjamas", "hostess pyjamas", "loose flowing trousers"], "Very wide, flowing trousers that move like a skirt.", ["palazzo pants", "beach pyjamas", "beach pajamas"], { gender: "women" }],
  ["wide-leg-trousers", "Wide-leg trousers", "garment", ["wide ?leg (trousers|slacks|jeans)", "wide pleated pants", "baggy trousers", "baggy white pants", "oxford bags"], "Trousers cut straight and wide from hip to hem, from Oxford bags on.", ["wide-leg trousers", "wide leg pants", "Oxford bags"]],
  ["high-waisted-trousers", "High-waisted jeans and trousers", "garment", ["high waist", "high waisted (jeans|shorts)", "mid rise jeans", "high waisted (trousers|pants|bottoms)"], "Trousers and jeans that sit at the natural waist or above.", ["high-waisted trousers", "high-waisted jeans", "high-waisted pants"]],
  ["womens-trousers", "Trousers for women", "garment", ["slacks", "women s trousers", "womens trousers", "wide leg slacks", "boot cut slacks"], "Women wearing trousers in public, once daring and then normal.", ["women in trousers", "slacks for women", "women in slacks"], { gender: "women" }],
  ["leather-trousers", "Leather trousers", "garment", ["(tight )?leather (trousers|pants)", "leather look trousers", "pleather trousers"], "Tight trousers in leather or leather-look plastic.", ["leather trousers", "leather pants"]],
  ["plus-fours", "Plus fours", "garment", ["plus fours", "knickerbockers", "knickers"], "Baggy trousers gathered just below the knee, from golf.", ["plus fours", "knickerbockers"], { gender: "men" }],
  ["chinos", "Chinos", "garment", ["chinos", "khakis", "(khaki|charcoal|flat front|skinny|tapered) chinos", "(baggy )?khaki slacks", "cuffed khakis", "nantucket reds"], "Cotton twill trousers in khaki or faded Nantucket red, a preppy and Ivy staple.", ["chinos", "khakis", "Nantucket Reds"], { gender: "men" }],
  ["overalls", "Dungarees", "garment", ["overalls", "(cropped )?dungarees", "shortalls", "denim pinafore", "pinafore dress"], "Bib-and-brace trousers or shorts.", ["dungarees", "overalls"]],

  // Jeans
  ["levis-501", "Levi's 501", "garment", ["levis? 501", "levis jeans", "levis"], "Levi Strauss's original button-fly jeans.", ["Levi 501", "501 jeans", "Levi jeans"]],
  ["designer-jeans", "Designer jeans", "garment", ["designer jeans", "evisu jeans"], "Expensive jeans with a famous name on the back pocket.", ["designer jeans"]],
  ["bell-bottoms", "Bell-bottoms and flares", "garment", ["bell ?bottoms?( jeans)?", "elephant bell bottoms", "hip hugger bell bottoms", "low waisted bell bottoms", "flared (trousers|jeans)", "flares"], "Trousers that widen dramatically from the knee down.", ["bell-bottoms", "bell bottoms", "flared trousers"]],
  ["bootcut-jeans", "Bootcut jeans", "garment", ["(light wash )?boot ?cut (jeans|trousers)"], "Jeans with a slight flare to fit over boots.", ["bootcut jeans", "boot-cut jeans"]],
  ["skinny-jeans", "Skinny jeans", "garment", ["(low rise |acid wash )?skinny jeans", "drainpipe (jeans|trousers)", "stovepipe jeans", "cigarette jeans", "skin tight black jeans", "(dark |dark wash )?slim( fit)? jeans", "tight (jeans|trousers|pants)", "narrow (trousers|pants)", "slim (trousers|pants)", "tapered (jeans|trousers)", "stretch jeans"], "Jeans or trousers cut tight all the way down, from 1950s drainpipes to 2000s skinnies.", ["skinny jeans", "drainpipe jeans", "drainpipe trousers"]],
  ["low-rise-jeans", "Low-rise jeans", "garment", ["low rise (jeans|trousers|miniskirt)", "hip huggers?", "hip hugger pants", "hipster belt", "low cut waist"], "Jeans that sit well below the waist, on the hips.", ["low-rise jeans", "hip-huggers"]],
  ["mom-jeans", "Mom jeans", "garment", ["mom jeans", "barrel jeans"], "High-waisted, loose, tapered jeans from the late 1980s.", ["mom jeans"], { gender: "women" }],
  ["baggy-jeans", "Baggy jeans", "garment", ["baggy (jeans|pants)", "phat pants", "jnco jeans", "baggies", "tripp pants"], "Very wide, loose jeans, from skate parks to raves.", ["baggy jeans", "JNCO jeans"]],
  ["straight-leg-jeans", "Straight-leg jeans", "garment", ["straight ?leg (jeans|trousers)"], "Jeans cut the same width from knee to hem.", ["straight leg jeans", "straight-leg jeans"]],
  ["ripped-jeans", "Ripped jeans", "garment", ["(ripped|distressed|frayed|worn out|patched|holey) (jeans|clothes|clothing|sweater|t shirt)", "distressed denim", "ripped sweatshirt"], "Jeans that are torn, frayed or distressed on purpose.", ["ripped jeans", "distressed jeans", "torn jeans"]],
  ["acid-wash", "Acid wash denim", "fabric", ["acid wash( jeans)?", "stonewashed (jeans|denim jacket)", "dark stonewash jeans", "sandblasted jeans"], "Denim bleached or stonewashed into a mottled pale finish.", ["acid wash", "stonewashed jeans", "acid-wash jeans"]],
  ["double-denim", "Double denim", "garment", ["double denim", "all denim outfit"], "Denim on top and bottom at once.", ["double denim", "Canadian tuxedo"]],
  ["jeans", "Blue jeans", "garment", ["(blue |dark |smart |coloured |white |embroidered |rhinestone |glitter |waxed |lace up |turn up |rolled up |wrangler )?jeans"], "Blue denim jeans moving from workwear to everyday fashion.", ["blue jeans", "denim jeans"]],

  // Footwear
  ["doc-martens", "Doc Martens", "footwear", ["(red )?doc martens", "dr martens", "bovver boots"], "Air-cushioned leather work boots taken up by skinheads, punks and grunge.", ["Doc Martens", "Dr. Martens", "Dr Martens"]],
  ["combat-boots", "Combat boots", "footwear", ["(clunky |army surplus )?combat boots", "army boots", "military boots", "demonia (boots|shoes)", "chunky boots", "clunky boots"], "Heavy lace-up military boots.", ["combat boots", "army boots"]],
  ["platform-boots", "Platform boots", "footwear", ["platform boots"], "Boots on thick soles and heels.", ["platform boots"]],
  ["platform-shoes", "Platform shoes", "footwear", ["platform (shoes|heels|sandals)", "cork platforms", "platforms"], "Shoes raised on a thick sole.", ["platform shoes", "platform heels"]],
  ["go-go-boots", "Go-go boots", "footwear", ["go go boots"], "White, low-heeled, mid-calf boots from the space age.", ["go-go boots"], { gender: "women" }],
  ["knee-high-boots", "Knee-high and thigh-high boots", "footwear", ["knee ?high boots", "knee boots", "(flat|pointed|block heel) knee high boots", "high boots", "stretch boots", "mid calf boots", "calf high boots", "thigh high boots"], "Tall boots that reach the knee or above.", ["knee-high boots", "thigh-high boots", "knee high boots"], { gender: "women" }],
  ["ugg-boots", "Ugg boots", "footwear", ["uggs?( boots)?", "fluffy boots"], "Sheepskin boots from Australia.", ["Ugg boots", "Uggs"], { gender: "women" }],
  ["cowboy-boots", "Cowboy boots", "footwear", ["(rhinestone |suede )?cowboy boots"], "Pointed, heeled boots from the American West.", ["cowboy boots"]],
  ["chelsea-boots", "Chelsea boots", "footwear", ["(western )?chelsea boots"], "Ankle boots with elastic side panels.", ["Chelsea boots"]],
  ["beatle-boots", "Beatle boots", "footwear", ["(pointed )?beatle boots", "cuban heel boots", "cuban heels"], "Pointed Chelsea boots with a Cuban heel, made famous by the Beatles.", ["Beatle boots", "Cuban heels"], { gender: "men" }],
  ["desert-boots", "Desert boots", "footwear", ["desert boots", "suede chukka boots"], "Suede ankle boots on a crepe sole.", ["desert boots", "chukka boots"]],
  ["work-boots", "Work boots", "footwear", ["timberlands", "work(er)? boots", "steel toe boots", "red wing boots", "rockport boots", "engineer boots", "(chunky )?hiking boots"], "Heavy workmen's boots like Timberlands worn as streetwear.", ["Timberland boots", "work boots"]],
  ["wellies", "Wellies", "footwear", ["wellies", "(hunter|novelty wellington|red rain|hunter rain|bean|duck) boots"], "Rubber rain boots worn as country and festival fashion.", ["Hunter wellies", "wellington boots"]],
  ["granny-boots", "Granny boots", "footwear", ["granny boots"], "Lace-up, heeled ankle boots in a Victorian style.", ["granny boots"], { gender: "women" }],
  ["winklepickers", "Winklepickers", "footwear", ["winklepickers", "pointed (shoes|boots|toes)", "pointy (boots|ankle boots)", "pointy toed ankle boots"], "Shoes and boots with a long, sharply pointed toe.", ["winklepickers", "winkle-pickers"]],
  ["brothel-creepers", "Brothel creepers", "footwear", ["brothel creepers", "creeper sole loafers"], "Suede shoes on a thick crepe sole, worn by Teddy Boys and punks.", ["brothel creepers"]],
  ["court-shoes", "Court shoes", "footwear", ["pumps?", "court shoes", "pointy court shoes", "pointed toe pump", "(stiletto|open toe|opera|cone heel) pumps"], "Plain, low-cut heeled shoes, called pumps in the US.", ["court shoes", "high-heeled pumps"], { gender: "women" }],
  ["stiletto-heels", "Stiletto heels", "footwear", ["stilettos?", "stiletto heels", "spike heels", "spike heeled sandals", "pointed toes and spiked heels"], "Shoes on a very thin, high heel.", ["stiletto heels", "stilettos"], { gender: "women" }],
  ["kitten-heels", "Kitten heels", "footwear", ["kitten heels?( sandals)?"], "A short, slim heel.", ["kitten heels"], { gender: "women" }],
  ["wedge-sneakers", "Wedge sneakers", "footwear", ["wedge sneakers"], "Trainers with a hidden wedge heel.", ["wedge sneakers"], { gender: "women" }],
  ["wedge-heels", "Wedge heels", "footwear", ["wedge (heels?|sandals|boots|flip flops)"], "Shoes whose heel runs the full length of the sole.", ["wedge heels", "wedge shoes"], { gender: "women" }],
  ["mary-janes", "Mary Janes", "footwear", ["(block heeled |pink )?mary janes", "bar shoes", "t strap shoes", "ankle strap shoes"], "Rounded shoes with a strap across the instep.", ["Mary Jane shoes", "Mary Janes", "T-bar shoes"]],
  ["ballet-flats", "Ballet flats", "footwear", ["(bow |minimalist )?ballet flats", "flats", "flat shoes"], "Soft, flat slip-on shoes like ballet slippers.", ["ballet flats", "ballet pumps"], { gender: "women" }],
  ["saddle-shoes", "Saddle shoes", "footwear", ["saddle shoes", "white bucks"], "Oxfords with a contrasting leather saddle across the middle.", ["saddle shoes", "white bucks"]],
  ["two-tone-shoes", "Two-tone shoes", "footwear", ["two tone shoes", "spectator shoes", "co respondent shoes"], "Brogues in two contrasting colours.", ["spectator shoes", "two-tone shoes", "co-respondent shoes"], { gender: "men" }],
  ["loafers", "Loafers", "footwear", ["(penny |gucci |tasselled |basketweave |moccasin )?loafers"], "Laceless slip-on leather shoes.", ["penny loafers", "tasselled loafers"]],
  ["boat-shoes", "Boat shoes", "footwear", ["boat shoes", "sperry top siders", "white sperry sneakers"], "Leather deck shoes with siped soles, a preppy staple.", ["boat shoes", "deck shoes", "Top-Siders"]],
  ["brogues", "Brogues and Oxfords", "footwear", ["(chunky |grenson |basket weave )?brogues", "wingtips", "(black |brown |patent leather |jazz )?oxfords?( shoes)?", "basket weave shoes"], "Laced leather shoes, often with punched brogue detail.", ["brogues", "wingtip shoes", "Oxford shoes"]],
  ["moccasins", "Moccasins", "footwear", ["moccasins?( sneakers)?"], "Soft, stitched leather slip-ons from Native American footwear.", ["moccasins"]],
  ["birkenstocks", "Birkenstocks", "footwear", ["birkenstocks", "jesus sandals", "hippie sandals"], "Contoured cork sandals.", ["Birkenstocks", "Birkenstock sandals"]],
  ["jelly-shoes", "Jelly shoes", "footwear", ["jelly shoes", "clear plastic (shoes|heels)"], "Moulded plastic sandals in candy colours.", ["jelly shoes", "jelly sandals"]],
  ["gladiator-sandals", "Gladiator sandals", "footwear", ["gladiator sandals"], "Flat sandals with many straps up the ankle.", ["gladiator sandals"], { gender: "women" }],
  ["crocs", "Crocs", "footwear", ["crocs"], "Chunky foam clogs with holes.", ["Crocs shoes"]],
  ["converse", "Converse All Stars", "footwear", ["converse( all stars)?", "chuck taylors", "chucks", "(high top |white )converse"], "Canvas basketball sneakers with a rubber toe.", ["Converse All Stars", "Chuck Taylors"]],
  ["vans", "Vans", "footwear", ["vans", "check(ered|erboard) vans", "skate shoes"], "Canvas skate shoes, often checkerboard.", ["Vans sneakers", "skate shoes"]],
  ["air-jordans", "Air Jordans", "footwear", ["air jordans?"], "Nike basketball sneakers named after Michael Jordan.", ["Air Jordans", "Air Jordan"]],
  ["high-top-sneakers", "High-top sneakers", "footwear", ["hi(gh)? ?top (sneakers|trainers|nikes)", "high ?tops", "(reebok|leather) hi tops"], "Sneakers that come up over the ankle.", ["high-top sneakers", "high-tops"]],
  ["chunky-sneakers", "Chunky sneakers", "footwear", ["chunky (trainers|sneakers)", "ugly sneakers", "dad shoes"], "Big, thick-soled trainers, the ugly sneaker trend.", ["chunky sneakers", "ugly sneakers", "chunky trainers"]],
  ["white-sneakers", "White sneakers", "footwear", ["white (sneakers|trainers|tennis shoes|adidas sneakers)"], "Plain white trainers worn with everything.", ["white sneakers", "white trainers"]],
  ["sneakers", "Sneakers", "footwear", ["sneakers", "trainers", "canvas sneakers", "(designer|prada|suede|monotone|feiyue|unlaced) sneakers", "pump trainers", "air max", "air force 1s?", "keds", "adidas (sneakers|superstar|trainers)"], "Athletic shoes like Keds, Superstars and Air Max worn as everyday fashion.", ["sneakers", "Air Max"]],

  // Hats and headwear
  ["cloche-hat", "Cloche hat", "accessory", ["(veiled )?cloche( hat)?"], "A bell-shaped hat pulled down low over a bob.", ["cloche hat"], { gender: "women" }],
  ["pillbox-hat", "Pillbox hat", "accessory", ["pillbox hat"], "A small round brimless hat, Jackie Kennedy's signature.", ["pillbox hat"], { gender: "women" }],
  ["fedora", "Fedora", "accessory", ["fedoras?"], "A soft felt hat with a pinched crown.", ["fedora hat", "fedora"], { gender: "men" }],
  ["trilby", "Trilby", "accessory", ["(straw )?trilby"], "A narrow-brimmed felt hat, smaller than a fedora.", ["trilby"]],
  ["homburg", "Homburg", "accessory", ["homburg"], "A stiff felt hat with a dent down the crown.", ["Homburg hat", "homburg"], { gender: "men" }],
  ["pork-pie-hat", "Pork pie hat", "accessory", ["pork pie hat"], "A short-brimmed hat with a flat, round crown.", ["pork pie hat", "porkpie hat"], { gender: "men" }],
  ["bowler-hat", "Bowler hat", "accessory", ["bowler hat"], "A hard felt hat with a rounded crown.", ["bowler hat"], { gender: "men" }],
  ["flat-cap", "Flat cap", "accessory", ["flat cap", "peaky blinders flat cap"], "A rounded cloth cap with a small stiff brim.", ["flat cap"], { gender: "men" }],
  ["newsboy-cap", "Newsboy cap", "accessory", ["newsboy cap", "bob dylan cap", "greek fishermans cap", "mad cap"], "A baggy cloth cap with a button on top.", ["newsboy cap", "baker boy hat", "newsboy hat"]],
  ["beret", "Beret", "accessory", ["berets?"], "A soft, round, flat wool cap.", ["beret"]],
  ["bucket-hat", "Bucket hat", "accessory", ["bucket hat"], "A soft cotton hat with a downward sloping brim.", ["bucket hat"]],
  ["snapback", "Snapback", "accessory", ["(backwards )?snapback", "flat brim cap", "strapback cap"], "A flat-peaked baseball cap with an adjustable back.", ["snapback cap", "snapback hat"]],
  ["trucker-hat", "Trucker hat", "accessory", ["(von dutch )?trucker hat", "von dutch"], "A mesh-backed foam cap, the Von Dutch hat.", ["trucker hat", "trucker cap"]],
  ["baseball-cap", "Baseball cap", "accessory", ["(backwards |team logo |new york yankees )?baseball cap", "billed cap", "dad hat", "burberry cap"], "A curved-peak cap worn far from the ballpark.", ["baseball cap"]],
  ["beanie", "Beanie", "accessory", ["beanies?", "tuque", "knit cap", "woolly hat", "stocking cap", "bobble hat", "knitted skullcap"], "A close-fitting knitted hat.", ["beanie hat", "woolly hat"]],
  ["stetson", "Cowboy hat", "accessory", ["stetson", "cowboy hat"], "A wide-brimmed Western hat.", ["cowboy hat", "Stetson hat"]],
  ["headband", "Headband", "accessory", ["(elastic |thin |tennis |patterned |forehead |mod |feather |padded )?head ?band", "hairband", "padded hairband", "alice band", "brain binder"], "A band worn around the head, from flapper bandeaus to Alice bands.", ["headband", "Alice band"]],
  ["headscarf", "Headscarf and turban", "accessory", ["head ?scarf", "head ?wrap", "headwrap", "turbans?"], "A scarf tied over or wrapped around the hair.", ["headscarf", "head scarf", "turban hat"], { gender: "women" }],

  // Accessories
  ["scrunchie", "Scrunchie", "accessory", ["scrunchies?"], "A fabric-covered elastic hair tie.", ["scrunchie"], { gender: "women" }],
  ["hair-bow", "Hair bows and clips", "accessory", ["(large )?hair bows?", "bows", "ribbons", "lace ribbons", "hair clips", "butterfly clips", "barrettes", "claw clip"], "Ribbons, bows, slides and butterfly clips worn in the hair.", ["hair bow", "butterfly clips", "claw clip"], { gender: "women" }],
  ["choker", "Choker", "accessory", ["(velvet |plastic |ribbon |studded |tattoo )?chokers?"], "A necklace worn tight around the throat.", ["choker necklace"]],
  ["dog-collar", "Dog collar", "accessory", ["dog collar( necklace)?", "bdsm collar", "o ring collar"], "A studded leather collar worn as a punk necklace.", ["dog collar necklace", "studded collar"]],
  ["pearls", "Pearls", "accessory", ["pearls", "(long )?pearl (necklace|earrings|jewellery|bracelet)"], "Strings of pearls, ladylike and preppy.", ["pearl necklace", "string of pearls"], { gender: "women" }],
  ["hoop-earrings", "Hoop earrings", "accessory", ["(large |gold )?hoop earrings"], "Large circular earrings.", ["hoop earrings"], { gender: "women" }],
  ["gold-chain", "Gold chains", "accessory", ["gold (chain|medallion|jewellery|accessories)", "chunky gold jewellery", "medallion( necklace)?", "bling", "silver chain"], "Chunky gold chains and medallions.", ["gold chains", "gold chain"]],
  ["statement-jewellery", "Statement jewellery", "accessory", ["(chunky|statement|bold) (jewellery|necklace|earrings)", "bib necklace", "chunky bracelets", "costume jewellery", "plastic jewellery", "bakelite jewellery", "rhinestone accessories"], "Big, bold costume jewellery meant to be seen.", ["costume jewellery", "costume jewelry", "statement necklace"], { gender: "women" }],
  ["art-deco-jewellery", "Art Deco jewellery", "accessory", ["art deco jewellery", "geometric jewellery"], "Geometric jewellery in platinum, diamonds and enamel.", ["Art Deco jewellery", "Art Deco jewelry"], { gender: "women" }],
  ["love-beads", "Love beads", "accessory", ["love beads", "beaded (necklaces?|bracelet|wristband)", "indian beads", "wooden beads", "long beaded necklace", "hemp jewellery", "kandi"], "Strings of beads worn by hippies as a sign of peace.", ["love beads", "beaded necklace"]],
  ["puka-shell-necklace", "Puka shell necklace", "accessory", ["puka shell necklace", "shell (necklace|jewellery|bracelet|details)", "conch shell necklace", "shark tooth necklace"], "A short necklace of small white shells, surfer style.", ["puka shell necklace", "puka shells"]],
  ["jelly-bracelets", "Jelly bracelets", "accessory", ["jelly bracelets", "rubber bracelets?", "plastic bracelets", "silly bandz"], "Thin plastic bangles worn by the armful.", ["jelly bracelets", "rubber bracelets"]],
  ["studs-and-spikes", "Studs and chains", "accessory", ["studs", "studded (leather|jewellery|wristband|boots)", "spike bands", "spiked bracelet", "studded belt", "bullet belt", "pyramid belt", "chains"], "Metal studs, spikes and chains on leather, punk and metal armour.", ["studded belt", "studded leather", "spiked bracelet"]],
  ["wide-belt", "Wide belt", "accessory", ["wide (belt|waistband)", "big belt", "statement belt", "obi belt", "(big|large|oversized) belt buckle", "oversized buckle belt", "belted waist"], "A broad belt cinched over clothes.", ["wide belt", "cinch belt", "obi belt"]],
  ["safety-pins", "Safety pins", "accessory", ["safety pins"], "Safety pins worn as punk jewellery or holding clothes together.", ["safety pin earrings"]],
  ["patches", "Patches and badges", "accessory", ["patches", "peace patches", "morale patches", "band badges", "novelty buttons"], "Sewn patches and pin badges covering jackets and bags.", ["sew-on patches"]],
  ["aviator-sunglasses", "Aviator sunglasses", "accessory", ["aviator sunglasses"], "Teardrop-shaped metal-framed sunglasses.", ["aviator sunglasses", "aviators"]],
  ["wayfarers", "Wayfarers", "accessory", ["wayfarers"], "Ray-Ban's chunky plastic trapezoid sunglasses.", ["Wayfarer sunglasses", "Ray-Ban Wayfarer"]],
  ["oversized-sunglasses", "Oversized sunglasses", "accessory", ["(oversized|large) sunglasses"], "Huge sunglasses that cover half the face.", ["oversized sunglasses"], { gender: "women" }],
  ["shutter-shades", "Shutter shades", "accessory", ["shutter shades"], "Sunglasses with horizontal slats instead of lenses.", ["shutter shades"]],
  ["cat-eye-glasses", "Cat-eye glasses", "accessory", ["cat ?eye glasses"], "Frames that sweep up into points at the outer corners.", ["cat eye glasses", "cat-eye glasses", "cat-eye sunglasses"], { gender: "women" }],
  ["round-glasses", "Round glasses", "accessory", ["round glasses", "teashade glasses", "small metal glasses"], "Small round wire-framed glasses, John Lennon style.", ["round glasses", "granny glasses", "wire-rimmed glasses"]],
  ["horn-rimmed-glasses", "Horn-rimmed glasses", "accessory", ["horn rimmed glasses", "nerd glasses", "large plastic glasses", "lensless glasses", "clear frame glasses"], "Thick plastic-framed glasses.", ["horn-rimmed glasses", "horn rimmed glasses"]],
  ["fanny-pack", "Bum bag", "accessory", ["fanny pack", "bum bag"], "A small zipped pouch worn on a belt around the waist.", ["fanny pack", "bum bag"]],
  ["it-bag", "It bag", "accessory", ["designer handbag", "logo (handbag|purse)", "it items", "kelly bag", "quilted handbag", "small (handbag|leather handbag|shoulder bag)", "baguette bag", "mini bag"], "An expensive, small branded handbag everyone wants at once, like the baguette.", ["designer handbag", "baguette bag", "It bag"], { gender: "women" }],
  ["gloves", "Gloves", "accessory", ["gloves", "white gloves?", "(evening|opera|elbow length|leather|driving) gloves", "dressy hats and gloves"], "Formal gloves as a finishing touch.", ["white gloves", "evening gloves"], { gender: "women" }],
  ["fingerless-gloves", "Fingerless gloves", "accessory", ["fingerless gloves", "lace gloves"], "Gloves with the fingertips cut off, often lace.", ["fingerless gloves", "lace gloves"], { gender: "women" }],
  ["leg-warmers", "Leg warmers", "accessory", ["(neon )?leg warmers"], "Knitted footless socks from dance class.", ["leg warmers", "legwarmers"], { gender: "women" }],
  ["knee-socks", "Knee socks", "accessory", ["(striped |patterned )?knee socks", "knee highs", "thigh highs"], "Socks pulled up to the knee or higher.", ["knee socks", "knee-high socks"], { gender: "women" }],
  ["tube-socks", "Tube socks", "accessory", ["(striped )?tube socks", "slouch socks", "white athletic socks", "crew socks"], "Long sports socks, worn pulled up or slouched.", ["tube socks", "slouch socks"]],
  ["bobby-socks", "Bobby socks", "accessory", ["bobby socks", "ankle socks"], "Thick white ankle socks folded down.", ["bobby socks", "bobby sox"], { gender: "women" }],
  ["skinny-tie", "Skinny tie", "accessory", ["(skinny|slim|thin|knit|slim jim) tie"], "A very narrow necktie.", ["skinny tie", "slim tie", "knitted tie"], { gender: "men" }],
  ["kipper-tie", "Kipper tie", "accessory", ["kipper tie", "wide ties?", "wide neckties?"], "A very wide, loud necktie.", ["kipper tie", "wide tie"], { gender: "men" }],
  ["braces", "Braces", "accessory", ["(thin )?braces", "trouser straps"], "Straps over the shoulders that hold trousers up, called suspenders in the US.", ["trouser braces"], { gender: "men" }],
  ["cigarette-holder", "Cigarette holder", "accessory", ["cigarette holder"], "A long holder for a cigarette, the flapper's prop.", ["cigarette holder"], { gender: "women" }],
  ["feather-boa", "Feather boa", "accessory", ["feather boa"], "A long fluffy scarf of feathers.", ["feather boa"]],
  ["bandana", "Bandana", "accessory", ["(black )?bandanas?"], "A printed square scarf tied on the head, neck or wrist.", ["bandana", "bandanna"]],
  ["tramp-stamp", "Lower-back tattoo", "accessory", ["tramp stamp"], "A tattoo across the lower back, shown off by low-rise jeans.", ["lower back tattoo", "tramp stamp"], { gender: "women" }],
  ["tattoos", "Tattoos", "accessory", ["tattoos", "(tribal|sleeve|face|japanese|fine line) tattoo", "old school tattoos"], "Tattoos moving from sailors and bikers into the mainstream, including old-school flash.", ["traditional tattoos", "tribal tattoo", "sleeve tattoo"]],
  ["body-piercing", "Body piercing", "accessory", ["(body |navel |eyebrow |labret |lip |nostril |snakebite |stretched )?piercings?", "pierced nose", "tongue ring", "stretched earlobes"], "Piercings beyond the earlobe: navel, eyebrow, lip and nose.", ["body piercing", "navel piercing", "nose ring"]],

  // Hair
  ["eton-crop", "Eton crop", "hair", ["eton crop", "cropped hair", "crop"], "A very short, slicked boyish cut for women.", ["Eton crop"], { gender: "women" }],
  ["bob", "Bob", "hair", ["bob( cut)?", "bobbed hair", "(shingle|chin length|stacked|italian|long) bob", "lob", "blunt haircut"], "A straight cut at jaw or chin length.", ["bobbed hair", "bob haircut", "bob cut"], { gender: "women" }],
  ["finger-waves", "Finger waves", "hair", ["finger waves", "marcel wave", "soft waves"], "Short hair set in S-shaped waves close to the head.", ["finger waves", "Marcel wave"], { gender: "women" }],
  ["victory-rolls", "Victory rolls", "hair", ["victory rolls"], "Hair rolled up and pinned in tubes at the front.", ["victory rolls"], { gender: "women" }],
  ["platinum-blonde", "Platinum blonde", "hair", ["platinum blonde", "bleached hair", "lacquered blonde hair"], "Hair bleached almost white, Jean Harlow style.", ["platinum blonde"], { gender: "women" }],
  ["pompadour", "Pompadour", "hair", ["pompadour", "high front roll"], "Hair swept up high and back off the forehead.", ["pompadour hairstyle", "pompadour"]],
  ["quiff", "Quiff and ducktail", "hair", ["quiffs?", "ducks arse", "ducktail", "da"], "A greased wave brushed up at the front and combed into a duck's tail at the back.", ["quiff", "ducktail haircut", "DA haircut"], { gender: "men" }],
  ["slicked-back-hair", "Slicked-back hair", "hair", ["slicked ?back hair", "greased back hair", "combed back hair", "pomade"], "Hair combed straight back with oil or gel.", ["slicked back hair", "slicked-back hair"], { gender: "men" }],
  ["crew-cut", "Crew cut", "hair", ["crew cut", "flat ?top", "high and tight", "harvard clip", "ivy league haircut", "short back and sides", "boston haircut"], "A short, neat cut, flat or brushed up on top.", ["crew cut", "flat top haircut", "short back and sides"], { gender: "men" }],
  ["buzz-cut", "Buzz cut", "hair", ["buzz ?cut", "buzzed hair", "shaved head"], "Hair clipped very short all over.", ["buzz cut", "shaved head"]],
  ["beehive", "Beehive", "hair", ["beehive"], "Hair backcombed and piled high into a cone.", ["beehive hairdo", "beehive hairstyle"], { gender: "women" }],
  ["bouffant", "Bouffant", "hair", ["bouffant", "teased hair", "backcombed hair"], "Hair teased into a puffy, rounded shape.", ["bouffant hairstyle", "bouffant hair"], { gender: "women" }],
  ["big-hair", "Big hair", "hair", ["big (hair|curly hair)", "hairspray", "mousse", "fuller hair", "80s hairstyles"], "Volume, volume, volume, held with hairspray.", ["big hair", "teased hair"], { gender: "women" }],
  ["pixie-cut", "Pixie cut", "hair", ["pixie cut", "gamine look"], "A very short, feathery cut for women.", ["pixie cut"], { gender: "women" }],
  ["mod-haircut", "Mod haircut", "hair", ["mod haircut", "beatles haircut", "shaggy mod hair", "mop ?top", "nouvelle vague haircut", "edgar cut"], "A mop-top fringe brushed forward, Beatles style.", ["mop top", "Beatle haircut", "mod haircut"], { gender: "men" }],
  ["curtains", "Curtains haircut", "hair", ["curtains", "curtained hair", "centre part", "centre parting", "middle part"], "Hair parted in the middle and falling either side of the face.", ["curtains haircut", "centre parting", "middle part"]],
  ["curtain-bangs", "Curtain bangs", "hair", ["curtain bangs"], "A fringe parted in the middle and swept to each side.", ["curtain bangs", "curtain fringe"], { gender: "women" }],
  ["afro", "Afro", "hair", ["afro( wig)?"], "Natural textured hair grown out into a full round shape.", ["Afro hairstyle", "Afro hair"]],
  ["cornrows", "Braids and cornrows", "hair", ["cornrows", "box braids", "fulani braids"], "Hair braided close to the scalp in rows or in long box braids.", ["cornrows", "box braids"]],
  ["dreadlocks", "Dreadlocks", "hair", ["dreadlocks", "synthetic neon dreadlocks", "locs"], "Hair matted and twisted into ropes.", ["dreadlocks"]],
  ["long-hair", "Long hair", "hair", ["long (hair|straight hair|black hair)", "ultra long hair", "flat straight hair", "straightened hair", "flat ironed hair", "bone straight hair"], "Long, straight hair, especially on men in the counterculture.", ["long hair on men", "long straight hair"]],
  ["shag", "Shag", "hair", ["shag", "shaggy hair", "wolf cut", "gypsy cut"], "A choppy, layered cut with lots of texture.", ["shag haircut", "wolf cut"]],
  ["mullet", "Mullet", "hair", ["mullet"], "Short at the front and sides, long at the back.", ["mullet haircut"]],
  ["feathered-hair", "Feathered hair", "hair", ["farrah fawcett hair", "feathered bangs", "wings( haircut)?"], "Hair cut in layers and blow-dried back like wings, Farrah Fawcett style.", ["feathered hair", "Farrah Fawcett hair"]],
  ["perm", "Perm", "hair", ["perm", "jheri curl", "curly weave", "felicity curls"], "Hair chemically set into curls.", ["permed hair", "Jheri curl"]],
  ["rachel-haircut", "The Rachel", "hair", ["rachel haircut"], "Jennifer Aniston's bouncy, layered shoulder-length cut from Friends.", ["Rachel haircut", "Rachel cut"], { gender: "women" }],
  ["mohawk", "Mohawk", "hair", ["mohawk", "mohican", "psychobilly mohican", "fauxhawk", "devilock"], "A strip of hair standing up down the middle of a shaved head.", ["mohawk hairstyle", "mohican hairstyle"]],
  ["spiked-hair", "Spiked hair", "hair", ["spik(ed|y) hair", "(blond tipped |neon )spiky hair", "blonde spikes", "charged hair"], "Hair gelled into stiff spikes.", ["spiked hair", "spiky hair"]],
  ["frosted-tips", "Frosted tips", "hair", ["frosted (tips|hair)"], "Spiky hair with the ends bleached blond.", ["frosted tips"], { gender: "men" }],
  ["dyed-hair", "Brightly dyed hair", "hair", ["(brightly )?dyed hair", "colou?r(ed|ful) hair", "coloured extensions", "e girl streaks", "raccoon stripes", "hair tint", "red hair", "black dyed hair", "jet black hair", "black hair"], "Hair dyed vivid, unnatural colours.", ["dyed hair", "pink hair", "blue hair"]],
  ["highlights", "Highlights", "hair", ["(chunky |blonde )?highlights", "blonde streaks", "lowlights", "balayage", "ombre", "bleached hair with dark roots", "grown out bleached roots"], "Streaks of lighter colour painted through the hair.", ["hair highlights", "balayage", "chunky highlights"]],
  ["crimped-hair", "Crimped hair", "hair", ["crimped hair"], "Hair pressed into tight zigzag waves.", ["crimped hair"], { gender: "women" }],
  ["ponytail", "Ponytail", "hair", ["(high )?ponytail", "side ponytail"], "Hair pulled back and tied high, or off to one side.", ["high ponytail", "ponytail", "side ponytail"], { gender: "women" }],
  ["side-swept-bangs", "Side-swept bangs", "hair", ["side swept bangs", "side fringe", "big fringe", "bangs", "blunt (bangs|fringe)", "mall bangs", "emo fringe", "scene hair", "peek a boo hair", "hair:fringe"], "A long fringe swept across the forehead, down to the emo fringe over one eye.", ["side-swept bangs", "side fringe", "emo fringe"]],
  ["undercut", "Undercut", "hair", ["undercut", "side shave", "partially shaved head", "partly shaved hair", "skin fade", "taper", "zig zag part(ing)?"], "Short or shaved sides under longer hair on top.", ["skin fade", "shaved sides"]],
  ["high-top-fade", "High-top fade", "hair", ["hi(gh)? top fade"], "Short sides with hair standing tall and flat on top.", ["high-top fade", "hi-top fade"]],
  ["man-bun", "Man bun", "hair", ["man bun", "top knot"], "Long hair tied into a bun on top of the head.", ["man bun"], { gender: "men" }],
  ["beard", "Beard and stubble", "hair", ["(full |short |dyed )?beard", "(designer |heavy )?stubble"], "A full beard or carefully kept stubble as a style statement.", ["full beard", "designer stubble", "hipster beard"], { gender: "men" }],
  ["moustache", "Moustache", "hair", ["(pencil |trimmed )?moustache"], "A moustache, from pencil-thin to handlebar.", ["pencil moustache", "handlebar moustache"], { gender: "men" }],
  ["sideburns", "Sideburns", "hair", ["(long )?sideburns"], "Hair grown down the sides of the face in front of the ears.", ["sideburns"], { gender: "men" }],
  ["braids", "Braids", "hair", ["(french|dutch|fishtail|crown|halo|side) braids?", "braids", "long plaits", "fishtail half up"], "Hair plaited in French, Dutch or fishtail braids.", ["French braid", "Dutch braid", "fishtail braid"], { gender: "women" }],
  ["natural-hair", "Natural hair", "hair", ["natural hair", "twist out", "textured hair", "hair twists"], "Afro-textured hair worn without straightening.", ["natural hair movement"]],

  // Makeup
  ["red-lipstick", "Red lipstick", "makeup", ["(matte |dark )?red lipstick", "bright red lips", "matte red lipstick", "bold lip", "bright lipstick"], "Bold red lips.", ["red lipstick"], { gender: "women" }],
  ["dark-lipstick", "Dark lipstick", "makeup", ["(black|vamp|wine|brown|dark|mauve) lipstick"], "Lipstick in black, brown, plum or deep wine.", ["dark lipstick", "black lipstick", "brown lipstick"], { gender: "women" }],
  ["pale-lipstick", "Pale lipstick", "makeup", ["(pale|pale pink|nude) lipstick", "pale (lips|shiny lips)"], "Lips painted pale pink or nude.", ["pale lipstick", "nude lipstick", "white lipstick"], { gender: "women" }],
  ["lip-gloss", "Lip gloss", "makeup", ["lip gloss", "glossy lips"], "Shiny, sticky gloss on the lips.", ["lip gloss"], { gender: "women" }],
  ["bee-stung-lips", "Bee-stung lips", "makeup", ["bee stung lips", "cupids bow", "rosebud lips", "natural lip shape"], "Lips painted small and pouting with a pronounced Cupid's bow.", ["bee-stung lips", "rosebud lips"], { gender: "women" }],
  ["thin-eyebrows", "Pencil-thin eyebrows", "makeup", ["pencil thin eyebrows", "arched brows"], "Eyebrows plucked to a thin arched line.", ["plucked eyebrows", "pencil-thin eyebrows"], { gender: "women" }],
  ["smoky-eye", "Smoky eye", "makeup", ["smoky eye", "kohl(eyeliner| rimmed eyes)", "kohl eyeliner", "(dark|heavy|black|smudged) eyeliner", "dark eyeshadow", "dramatic eye makeup", "bold eye makeup"], "Dark, smudged eyeliner and shadow around the eyes.", ["smoky eye", "kohl eyeliner"], { gender: "women" }],
  ["winged-eyeliner", "Winged eyeliner", "makeup", ["winged eyeliner", "cat eye", "graphic eyeliner"], "Eyeliner flicked out at the corner into a wing.", ["winged eyeliner", "cat-eye makeup", "flicked eyeliner"], { gender: "women" }],
  ["false-eyelashes", "False eyelashes", "makeup", ["(false|fake) eyelashes", "long lashes", "thick eyelashes", "lash extensions", "cake mascara"], "Long, thick lashes, glued on or extended.", ["false eyelashes", "fake eyelashes", "lash extensions"], { gender: "women" }],
  ["coloured-eyeshadow", "Coloured eyeshadow", "makeup", ["coloured eyeshadow", "(blue frosted|purple|shimmer) eyeshadow"], "Bright blue, green or purple shadow on the lids.", ["blue eyeshadow", "colored eyeshadow"], { gender: "women" }],
  ["glitter-makeup", "Glitter makeup", "makeup", ["(glitter|neon) makeup", "facial glitter", "bronze specks"], "Glitter on the face and body.", ["glitter makeup", "face glitter"]],
  ["pale-skin", "Pale skin", "makeup", ["pale (skin|complexion|foundation)", "matte foundation", "pressed powder"], "A pale, powdered complexion.", ["pale complexion", "porcelain skin"], { gender: "women" }],
  ["natural-makeup", "Natural makeup", "makeup", ["natural (makeup|look)", "no makeup look", "nude makeup", "neutral eyes", "nude eyeshadow", "mineral makeup"], "Makeup designed to look like none at all.", ["natural makeup", "no-makeup look"], { gender: "women" }],
  ["dewy-skin", "Dewy skin", "makeup", ["dewy skin", "illuminator", "strobing", "slugging"], "Glowing, glassy, hydrated-looking skin.", ["dewy skin", "glass skin"], { gender: "women" }],
  ["blush", "Blush", "makeup", ["blush", "(circular|soft) rouge", "rosy cheeks", "(pink|liquid) blush", "rouged knees"], "Rouged cheeks, from flapper circles to draped blush.", ["blusher", "rouged cheeks"], { gender: "women" }],
  ["mens-makeup", "Makeup for men", "makeup", ["mens makeup", "makeup for men", "mens eyeshadow", "androgynous makeup"], "Men wearing eyeliner, shadow and foundation.", ["guyliner", "makeup for men", "male makeup"], { gender: "men" }],
  ["goth-makeup", "Goth makeup", "makeup", ["(gothic|dark|messy) makeup", "corpse paint", "heavy makeup", "black nail polish"], "White face, black eyes, dark lips and black nails.", ["goth makeup", "gothic makeup", "black nail polish"]],

  // Fabrics
  ["denim", "Denim", "fabric", ["denim", "black denim", "embroidered denim", "stacked denim"], "Indigo cotton twill, from workwear to everything.", ["denim"]],
  ["velvet", "Velvet and velour", "fabric", ["(crushed |panne |black |cisele )?velvet( dress| mini dress)?", "velour( shirt)?"], "Soft, plush pile fabrics, woven or knitted.", ["crushed velvet", "velvet dress", "velour"]],
  ["corduroy", "Corduroy", "fabric", ["corduroy( jacket| trousers| pants| suit| sport ?coat| sports coat)?", "mustard cords"], "Ribbed cotton cloth.", ["corduroy"]],
  ["tweed", "Tweed", "fabric", ["tweed( eveningwear)?"], "Rough woollen cloth from Scotland and Ireland.", ["tweed"]],
  ["seersucker", "Seersucker", "fabric", ["seersucker( suit| blazer)?"], "Puckered, striped summer cotton.", ["seersucker"]],
  ["fringe", "Fringe", "fabric", ["fringe( jacket)?", "fringed (handbag|pullover)", "suede fringe jacket"], "Hanging tassels of fabric or leather.", ["fringed jacket", "fringe jacket"]],
  ["lace", "Lace", "fabric", ["lace", "chantilly lace", "lace (trim|dress|blouse|collar)"], "Openwork fabric, delicate or gothic.", ["lace dress", "lace blouse"], { gender: "women" }],
  ["sequins", "Sequins", "fabric", ["sequins", "sequined (jacket|pants|tuxedo jacket)", "sparkle", "beading", "embellished top"], "Small shiny discs sewn all over clothes.", ["sequins", "sequined dress"]],
  ["rhinestones", "Rhinestones", "fabric", ["rhinestones", "rhinestone (tank top|hip belt|embellished clothing)", "diamante buckles"], "Glass crystals that sparkle like diamonds.", ["rhinestones", "diamante"]],
  ["metallics", "Metallic and glitter fabrics", "fabric", ["metallics?", "metallic (fabrics|clothing|materials|colours|silver|shirt|jacket|pattern jacket|handkerchief top|shoes|open toed shoes)", "(gold )?lame", "gold lame suit", "lurex", "silver", "chrome", "chromecore", "silver (trousers|sharkskin)", "iridescent fabric", "glossy textiles", "glamour wear", "glitter"], "Shiny gold, silver and glittery fabrics like lame and Lurex.", ["metallic fabric", "gold lame", "Lurex"]],
  ["polyester", "Polyester", "fabric", ["(brown |double knit )?polyester", "qiana( shirt)?", "terylene", "synthetic (fabrics|materials)", "triacetate", "orlon", "acrylic"], "Cheap, wrinkle-free synthetic fabric.", ["polyester", "double knit polyester"]],
  ["spandex", "Spandex", "fabric", ["spandex( bodywear| trousers)?", "lycra", "elastane", "lastex", "branded spandex", "stretch fabric"], "Stretchy synthetic fibre that made clothes skin-tight.", ["spandex", "Lycra"]],
  ["pvc", "PVC and vinyl", "fabric", ["pvc( skirt)?", "vinyl( raincoat| outerwear)?", "plastic( dress| aesthetic)?", "transparent plastic jacket", "rubber"], "Glossy plastic clothing.", ["PVC clothing", "vinyl dress"]],
  ["satin", "Satin", "fabric", ["satin( shirt| blouse| skirt| trousers)?", "black satin dress", "charmeuse"], "A glossy, fluid fabric.", ["satin"]],
  ["sustainable-fabrics", "Sustainable fashion", "fabric", ["organic cotton", "recycled (polyester|textiles|clothing|plastic earrings)", "ethical fashion", "slow fashion", "cruelty free", "deadstock fabric", "tencel", "khadi"], "Clothes made from organic, recycled or low-impact materials.", ["sustainable fashion", "ethical fashion"]],

  // Colours
  ["neon-colours", "Neon colours", "colour", ["neon (colours|accents|pink|yellow|socks|streetwear)", "day glo colours", "fluorescent pink", "signal colours", "1980s neon streetwear"], "Fluorescent brights.", ["neon colors", "neon colours", "fluorescent colors"]],
  ["pastel-colours", "Pastel colours", "colour", ["pastel colours", "(icy|muted) pastels", "mint blue", "peach", "pistachio"], "Soft, chalky light colours.", ["pastel colors", "pastel colours"]],
  ["earth-tones", "Earth tones", "colour", ["earth tones", "brown", "rust", "mustard", "tan", "camel", "chocolate", "marigold yellow", "copper"], "Browns, rusts and mustards.", ["earth tones", "earth colors"]],
  ["all-black", "All black", "colour", ["all black", "black( clothing| clothes)?", "black and grey", "black shirt", "black skirt", "black suit"], "Head-to-toe black.", ["dressed all in black", "black clothing"]],
  ["millennial-pink", "Millennial pink", "colour", ["millennial pink", "blush pink", "whisper pink"], "A dusty, muted pink.", ["millennial pink"]],
  ["hot-pink", "Hot pink", "colour", ["hot pink", "barbie pink", "fuchsia", "pink"], "Bright, loud pink.", ["hot pink", "shocking pink"]],
  ["jewel-tones", "Jewel tones", "colour", ["jewel tones", "burgundy", "plum", "wine", "teal", "aquamarine", "scarlet", "peacock blue"], "Deep, rich colours like burgundy, plum and teal.", ["jewel tones"]],
  ["neutral-colours", "Neutral colours", "colour", ["neutral colours", "beige", "cream", "ecru", "taupe", "sand", "ivory", "off white", "muted colours", "subdued colours", "dusty colours"], "Beige, cream and stone shades.", ["neutral colors", "neutral colours", "beige"]],

  // Patterns
  ["animal-print", "Animal print", "pattern", ["animal print", "leopard( print| trim)?", "zebra( print)?", "cow print"], "Leopard, zebra and other animal skins printed on fabric.", ["leopard print", "animal print"]],
  ["polka-dots", "Polka dots", "pattern", ["polka dots?( dress)?", "dotted swiss"], "Evenly spaced round dots.", ["polka dots", "polka dot dress"]],
  ["paisley", "Paisley", "pattern", ["paisley( shirt| brocade)?"], "A curved teardrop motif from Persian and Indian textiles.", ["paisley"]],
  ["madras", "Madras", "pattern", ["madras( plaid)?"], "Lightweight Indian cotton in bright, bleeding checks.", ["madras plaid", "madras shorts"]],
  ["tartan", "Tartan", "pattern", ["tartan", "plaid( pants| suit)?", "royal stewart tartan", "glen plaid", "prince of wales check", "mini plaid skirt"], "Woven checks from Scotland, worn by punks, grunge and preppies.", ["tartan trousers", "plaid pants", "Prince of Wales check"]],
  ["gingham", "Gingham", "pattern", ["gingham( shorts)?"], "Small, even two-colour checks.", ["gingham dress", "gingham"]],
  ["houndstooth", "Houndstooth", "pattern", ["houndstooth( sport ?coat| suit)?", "dogtooth( check jacket)?"], "A broken check of jagged four-pointed shapes.", ["houndstooth", "dogtooth check"]],
  ["pinstripe", "Pinstripe", "pattern", ["(narrow |navy )?pinstripes?( suit)?", "chalk stripe", "striped suit"], "Fine vertical stripes on tailoring.", ["pinstripe suit", "chalk stripe"]],
  ["breton-stripes", "Breton stripes", "pattern", ["breton stripes", "nautical (stripes|motifs|style)", "striped (t shirt|sweater)", "sailor t shirt", "horizontal stripes"], "Navy and white horizontal stripes from French sailors.", ["Breton stripes", "Breton shirt", "striped sailor shirt"]],
  ["psychedelic-print", "Psychedelic print", "pattern", ["psychedelic( prints?| floral shirt| print dress)?", "op art print", "cosmic print"], "Swirling, saturated, trippy prints.", ["psychedelic print", "psychedelic patterns"]],
  ["flower-power", "Flower power", "pattern", ["flower power", "flower crown", "fabric flower"], "Flowers as hippie symbols, painted, printed and worn in the hair.", ["flower power"]],
  ["floral-print", "Floral print", "pattern", ["floral (print|dress|embroidery)", "florals", "small floral print", "(cabbage rose|tapestry floral) print", "floral hijab", "lily of the valley motif"], "Printed flowers, from ditsy to oversized.", ["floral print", "floral dress"], { gender: "women" }],
  ["tie-dye", "Tie-dye", "pattern", ["tie ?dye( shirt)?", "dip dye swimshorts"], "Fabric knotted and dyed into swirling patterns.", ["tie-dye", "tie dye"]],
  ["camouflage", "Camouflage", "pattern", ["camouflage( print| trousers| jacket| pants)?", "camo", "woodland camo cap"], "Military camo prints worn as fashion.", ["camouflage pants", "camo pants", "camouflage print"]],
  ["geometric-print", "Geometric print", "pattern", ["geometric (prints?|patterns|tie)", "art deco", "triangle print", "diamond (pattern|print|motif)", "chevron", "zigzag print", "honeycomb print", "grid print", "checkerboard", "checkered print"], "Bold shapes, grids and zigzags.", ["geometric print", "geometric pattern"]],
  ["union-jack", "Union Jack", "pattern", ["union (jack|flag)( dress)?", "raf roundel( t shirt)?", "red white and blue"], "The British flag and the RAF target worn as pop symbols.", ["Union Jack dress", "Union Jack jacket"]],
  ["skull-print", "Skull print", "pattern", ["skull (print|pattern|jewellery|mask)", "ribcage print"], "Skulls and bones printed on clothes and jewellery.", ["skull print", "skull scarf"]],
  ["logomania", "Logomania", "pattern", ["designer logos", "logo (sweater|jacket|polo shirt)"], "Big brand logos printed all over clothes.", ["logomania", "designer logos"]],
  ["argyle", "Argyle", "pattern", ["argyle( socks| sweater)?"], "A diamond pattern from Scottish knitwear.", ["argyle socks", "argyle sweater"]],
  ["fair-isle", "Fair Isle", "pattern", ["fair isle( sweater)?", "nordic pattern", "alpine sweater"], "Bands of colourful knitted motifs from Shetland.", ["Fair Isle sweater", "Fair Isle jumper"]],

  // Silhouettes and cuts
  ["dropped-waist", "Dropped waist", "silhouette", ["drop(ped)? waist( dress)?", "drop waist dress", "low waistline"], "A waistline that sits at the hips.", ["dropped waist", "drop waist"], { gender: "women" }],
  ["garconne", "Garconne look", "silhouette", ["garconne look", "flat chest", "boyish look", "bust bodice", "straight waist", "unmarked waist", "tubular dress", "flapper look"], "A flat-chested, straight, boyish line.", ["garconne", "boyish figure"], { gender: "women" }],
  ["knee-length-hemline", "Knee-length hemline", "silhouette", ["knee length (skirt|dress)", "rising hemlines", "short hemline", "thigh length hemline"], "Hemlines rising to the knee.", ["knee-length skirt", "knee length skirt"], { gender: "women" }],
  ["mid-calf-hemline", "Mid-calf hemline", "silhouette", ["longer hemlines", "mid calf hemline", "below the knee hemline", "tea length skirt", "ankle length skirt"], "Hemlines dropping back down below the knee.", ["mid-calf length", "longer hemlines"], { gender: "women" }],
  ["bias-cut", "Bias cut", "silhouette", ["bias cut( satin gown)?"], "Fabric cut diagonally so it clings and drapes.", ["bias cut", "bias-cut"], { gender: "women" }],
  ["new-look", "New Look", "silhouette", ["new look", "corolle line", "bar suit"], "Dior's 1947 line: soft shoulders, tiny waist, full long skirt.", ["Dior New Look", "New Look of 1947", "Dior look"], { gender: "women" }],
  ["hourglass", "Hourglass silhouette", "silhouette", ["hourglass silhouette", "cinched waist", "(small|tiny|defined|fitted|corseted) waist", "corseted silhouette", "full hips", "padded hips", "fit and flare"], "A cinched waist between full bust and hips.", ["hourglass figure", "wasp waist", "cinched waist"], { gender: "women" }],
  ["empire-line", "Empire line", "silhouette", ["empire (line|waist)"], "A waistline raised to just under the bust.", ["empire waist", "empire line"], { gender: "women" }],
  ["shoulder-pads", "Shoulder pads", "silhouette", ["shoulder pads", "padded shoulders", "(broad|big|wide|square|bold) shoulders", "sharp shouldered suit", "wide shouldered jacket", "inverted triangle", "bold look"], "Padding that builds the shoulders out wide.", ["shoulder pads"]],
  ["puff-sleeves", "Puff sleeves", "silhouette", ["puff(ed|y)? sleeves", "bubble sleeves", "large sleeves", "trumpet sleeves", "billowing sleeves"], "Sleeves gathered into a big puff.", ["puff sleeves", "puffed sleeves"], { gender: "women" }],
  ["oversized-fit", "Oversized fit", "silhouette", ["oversized( outerwear| top| jacket| shirt| denim shirt| collar)?", "baggy (clothes|silhouette)", "loose( fitting)?( clothing)?", "loose fit", "big look", "boxy (silhouette|outerwear|coat)"], "Clothes cut deliberately big and loose.", ["oversized clothing", "baggy clothes"]],
  ["layering", "Layering", "silhouette", ["layering", "layered (look|shirts|tees)", "shorts over leggings", "skirt over (trousers|leggings)"], "Several garments worn on top of each other on purpose.", ["layered look", "layering clothes"]],
  ["minimalism", "Minimalism", "silhouette", ["minimalism", "clean lines", "conceptual chic"], "Plain, pared-back clothes with no decoration.", ["minimalist fashion"]],
  ["deconstruction", "Deconstruction", "silhouette", ["deconstruction", "japanese avant garde", "asymmetric(al)? (cut|hem|dress|neckline)", "jagged hems", "handkerchief hem", "unconstructed look"], "Clothes shown unfinished, asymmetric or inside out.", ["deconstructed garments"]],
  ["androgyny", "Androgynous dressing", "silhouette", ["androgyn(ous|y)( clothing| dressing| look)?", "genderless fashion", "mannish look", "annie hall look"], "Clothes that blur men's and women's dress.", ["androgynous fashion", "unisex clothing"]],
  ["heroin-chic", "Heroin chic", "silhouette", ["heroin chic", "waif thin", "size zero"], "A gaunt, pale, wasted look from 1990s modelling.", ["heroin chic", "waif look"], { gender: "women" }],
  ["popped-collar", "Popped collar", "silhouette", ["popped collar", "turned up collar"], "A shirt collar flipped up.", ["popped collar"]],
  ["wide-lapels", "Wide lapels", "silhouette", ["wide (lapels|collar)", "1940s width lapels", "high lapels", "long roll lapels"], "Broad jacket lapels.", ["wide lapels"], { gender: "men" }],
  ["narrow-lapels", "Narrow lapels", "silhouette", ["narrow lapels"], "Slim jacket lapels.", ["narrow lapels"], { gender: "men" }],
  ["pointed-collar", "Pointed collar", "silhouette", ["pointed collar", "oversized collar", "mr b collar"], "Long, pointed shirt collars spread over the jacket.", ["pointed collar", "long pointed collars"], { gender: "men" }],
  ["sagging", "Sagging", "silhouette", ["sagging"], "Trousers worn low enough to show the underwear.", ["sagging pants", "saggy pants"], { gender: "men" }],
  ["space-age", "Space age look", "silhouette", ["space age", "moon girl", "futuristic sunglasses", "retrofuturism"], "Geometric white and silver clothes inspired by the space race.", ["space-age fashion", "space-age look", "space age look"]],

  // Subcultures and named looks
  ["flappers", "Flappers", "subculture", ["flappers?", "flapper dress"], "Young 1920s women who cut their hair, raised their hems, wore loose dresses and partied.", ["flappers", "flapper dress"], { gender: "women" }],
  ["zazou", "Zazous", "subculture", ["zazous?"], "Swing-loving Paris youth in oversized jackets during the occupation.", ["zazous"]],
  ["spiv", "Spivs", "subculture", ["spivs?"], "Flashy wartime black-market dealers in loud suits.", ["spivs"], { gender: "men" }],
  ["neo-edwardian", "Neo-Edwardian", "subculture", ["neo edwardian", "edwardian (styles?|formality|dandy style|piping)"], "Savile Row's postwar revival of Edwardian dandy tailoring.", ["Neo-Edwardian", "Edwardian revival"], { gender: "men" }],
  ["teddy-boys", "Teddy Boys", "subculture", ["teddy (boys?|girls)", "teddy boy collar", "cosh boys", "teds"], "British youth in drape jackets, drainpipes and creepers.", ["Teddy Boys", "Teddy Boy"]],
  ["greasers", "Greasers", "subculture", ["greasers", "rocker", "ton up boys"], "Working-class rock'n'roll youth in leather jackets and greased hair.", ["greasers", "rockers"], { gender: "men" }],
  ["rockabilly", "Rockabilly", "subculture", ["rockabilly", "psychobilly"], "1950s rock'n'roll style kept alive by later revivalists, and its horror-punk cousin psychobilly.", ["rockabilly style", "psychobilly"]],
  ["beatniks", "Beatniks", "subculture", ["beatniks", "existentialists"], "Bohemian intellectuals in black polo necks and berets.", ["beatniks"]],
  ["ivy-league", "Ivy League", "subculture", ["ivy league( style)?", "ivy and preppy style"], "The American college look of button-downs, chinos and loafers.", ["Ivy League style", "Ivy League look"], { gender: "men" }],
  ["preppy", "Preppy", "subculture", ["preppy", "light academia preppy"], "The rich-kid American look of polos, boat shoes and blazers.", ["preppy style", "preppy look"]],
  ["sloane-ranger", "Sloane Rangers", "subculture", ["sloane rangers?"], "Posh west London girls in pearls, Barbours and pie-crust collars.", ["Sloane Ranger"]],
  ["mod", "Mods", "subculture", ["mods?", "hard mod", "peacock mod", "mod revival", "1960s mod", "mod and british invasion", "smoothie"], "Sharp-dressed British scooter youth in slim suits and parkas.", ["mods and rockers", "mod fashion"]],
  ["swinging-london", "Swinging London", "subculture", ["swinging london", "youthquake", "chelsea girl", "dolly girl", "british invasion"], "London's mid-1960s youth fashion boom.", ["Swinging London", "Swinging Sixties"]],
  ["peacock-revolution", "Peacock revolution", "subculture", ["peacock revolution", "dandy"], "Men returning to colour, velvet and frills in the late 1960s.", ["Peacock Revolution"], { gender: "men" }],
  ["hippie", "Hippies", "subculture", ["hippies?"], "The counterculture look of long hair, beads, flares and flowers.", ["hippie fashion", "hippie style"]],
  ["boho", "Boho", "subculture", ["boho( chic)?", "bohemian( clothing)?", "boho skirt", "1970s boho", "festival fashion", "ethnic chic"], "Loose, layered, folk-inspired bohemian dressing.", ["boho chic", "bohemian style"], { gender: "women" }],
  ["skinhead", "Skinheads", "subculture", ["skinheads?", "skinhead revival", "bootboy", "oi", "suedeheads?"], "Working-class youth in cropped hair, braces, Ben Shermans and boots, and the longer-haired suedeheads.", ["skinheads", "suedeheads"]],
  ["two-tone", "Two Tone", "subculture", ["two tone"], "The ska revival look of tonic suits, pork pie hats and black and white checks.", ["ska revival", "2 Tone label"]],
  ["glam-rock", "Glam rock", "subculture", ["glam (rock|punk)", "glitter rock", "ziggy stardust"], "Glitter, platforms and androgyny from Bowie and Bolan.", ["glam rock"]],
  ["disco", "Disco", "subculture", ["disco( look| pants| shirt| bag)?"], "Shiny, stretchy clubwear for the dance floor.", ["disco fashion", "disco clothes"]],
  ["punk", "Punk", "subculture", ["punks?", "(hardcore|crust|garage|afro) punk", "punk couture", "ramones look", "anarcho punk", "deathrock"], "DIY rebellion in ripped clothes, safety pins and tartan.", ["punk fashion", "punk style"]],
  ["pop-punk", "Pop punk", "subculture", ["pop ?punk"], "The skate-punk look of chains, studded belts and band tees.", ["pop punk"]],
  ["heavy-metal", "Heavy metal", "subculture", ["heavy metal", "glam metal", "mosher", "nu metal", "battle vest"], "Denim, leather, band patches and long hair.", ["metalheads", "headbangers"]],
  ["new-romantic", "New Romantics", "subculture", ["new romantics?", "blitz kids"], "Ruffled shirts, makeup and costume from London's Blitz club.", ["New Romantics", "New Romantic"]],
  ["new-wave", "New wave", "subculture", ["new wave"], "Skinny ties, angular cuts and bright colours after punk.", ["new wave fashion"]],
  ["goth", "Goth", "subculture", ["goths?", "cybergoth", "ethergoth", "gothic"], "Black clothes, pale skin and Victorian gloom.", ["goth fashion", "goth subculture"]],
  ["football-casuals", "Football casuals", "subculture", ["casuals?"], "Football fans in expensive sportswear labels instead of team colours.", ["football casuals"], { gender: "men" }],
  ["rave", "Rave", "subculture", ["raves?", "acid house", "candy raver", "gabber", "superclub", "techno", "psytrance", "madchester", "clubwear", "london club style"], "Baggy clothes, smileys and day-glo for dancing all night.", ["rave culture", "ravers"]],
  ["hip-hop", "Hip-hop style", "subculture", ["hip ?hop", "gangsta rap", "1990s hip hop", "swag"], "Sportswear, gold, baggy denim and sneakers from hip-hop culture.", ["hip hop fashion", "hip-hop fashion"]],
  ["grunge", "Grunge", "subculture", ["grunge", "1990s grunge", "designer grunge", "grebo"], "Seattle's flannel, ripped jeans and Doc Martens.", ["grunge fashion", "grunge look"]],
  ["soft-grunge", "Soft grunge", "subculture", ["soft grunge", "fairy grunge"], "A pastel, Tumblr-era take on 1990s grunge.", ["soft grunge"]],
  ["kinderwhore", "Kinderwhore", "subculture", ["kinderwhore", "sexy school girl"], "Torn babydoll dresses and smeared lipstick, Courtney Love style.", ["kinderwhore"], { gender: "women" }],
  ["britpop", "Britpop", "subculture", ["britpop", "cool britannia", "post britpop"], "Adidas tops, parkas and Union Jacks from mid-1990s British guitar bands.", ["Britpop", "Cool Britannia"]],
  ["skater", "Skater", "subculture", ["skaters?", "skate (culture|brands)"], "Baggy clothes and Vans from skateboarding.", ["skate fashion", "skater style", "skate shoes"]],
  ["streetwear", "Streetwear", "subculture", ["streetwear", "2000s streetwear", "supreme", "bape", "stone island", "obey", "sneakerheads?"], "Limited-run sneakers, hoodies and logo tees from skate and hip-hop brands, and the collectors who chase them.", ["streetwear", "sneakerhead"]],
  ["chav", "Chav", "subculture", ["chavs?"], "British working-class youth in tracksuits, Burberry caps and bling.", ["chav"]],
  ["y2k", "Y2K", "subculture", ["y2k( fashion| aesthetic)?", "y3k", "cybercore", "mcbling"], "Shiny, futuristic, pink and rhinestoned pop-star style from around the year 2000.", ["Y2K fashion", "Y2K aesthetic", "McBling"]],
  ["emo", "Emo", "subculture", ["emo"], "Black skinny jeans, band tees and side fringes.", ["emo style", "emo kids"]],
  ["scene", "Scene", "subculture", ["scene"], "Neon emo with backcombed hair and bright extensions.", ["scene kids", "scene hair"]],
  ["hipster", "Hipster", "subculture", ["hipsters?", "hipster vintage", "lumbersexual"], "Beards, thick glasses, vintage and irony.", ["hipster fashion", "hipster style"]],
  ["indie-sleaze", "Indie and indie sleaze", "subculture", ["indie sleaze", "bloghouse", "electroclash", "new rave", "indie rock revival", "landfill indie", "garage rock revival", "indie( pop)?"], "Guitar-band and party style of skinny jeans, vintage and messy flash photos.", ["indie sleaze", "indie fashion"]],
  ["geek-chic", "Geek chic", "subculture", ["geek chic"], "Thick glasses and nerdy clothes worn as fashion.", ["geek chic"]],
  ["normcore", "Normcore", "subculture", ["normcore", "seinfeld", "acting basic", "dad style"], "Deliberately plain, unbranded clothes, Seinfeld style.", ["normcore"]],
  ["vintage", "Vintage and thrift", "subculture", ["vintage (clothing|styles)", "thrift(ing| store clothing)", "secondhand (clothing|fashion|suit)", "period style clothing", "vintage 1970s clothing"], "Wearing old and secondhand clothes on purpose.", ["vintage clothing", "thrift store clothes"]],
  ["pin-up", "Pin-up", "subculture", ["pin up", "1950s pin up"], "1940s and 1950s glamour with victory rolls and red lips.", ["pin-up style"], { gender: "women" }],
  ["western-wear", "Western wear", "subculture", ["western wear", "urban cowboy", "americana"], "Cowboy boots, hats and Western shirts beyond the ranch.", ["Western wear", "urban cowboy"]],
  ["business-casual", "Business casual", "subculture", ["(smart|business|dressy) casual", "1990s business casual", "dressing down"], "Office dress without a tie.", ["business casual", "smart casual"]],
  ["cottagecore", "Cottagecore", "subculture", ["cottagecore", "allotment chic", "farmcore", "grandmacore", "coastal grandmother"], "Floral dresses, puff sleeves and an idealised country life.", ["cottagecore"], { gender: "women" }],
  ["dark-academia", "Dark academia", "subculture", ["(dark|light) academia"], "Tweed, knitwear and old-university gloom.", ["dark academia"]],
  ["grandpacore", "Grandpacore", "subculture", ["grandpacore"], "Cardigans, loafers and pleated trousers like a cool granddad.", ["grandpacore"]],
  ["gorpcore", "Gorpcore", "subculture", ["gorpcore"], "Technical hiking gear worn in the city.", ["gorpcore"]],
  ["e-girl", "E-girls and e-boys", "subculture", ["e (boy|girl|kids)", "egirl makeup"], "TikTok-era emo revival with chains, striped tops and painted hearts.", ["e-girl", "e-boy"]],
  ["quiet-luxury", "Quiet luxury", "subculture", ["quiet luxury", "old money", "conservative chic"], "Expensive, logo-free basics for people who don't need to show off.", ["quiet luxury", "stealth wealth"]],
  ["barbiecore", "Barbiecore", "subculture", ["barbiecore"], "Head-to-toe hot pink.", ["Barbiecore"], { gender: "women" }],
  ["balletcore", "Balletcore", "subculture", ["balletcore"], "Wrap tops, leg warmers and ballet flats off the stage.", ["balletcore"], { gender: "women" }],
  ["coquette", "Coquette", "subculture", ["coquette"], "Bows, lace and pink, very girly.", ["coquette aesthetic"], { gender: "women" }],
  ["dopamine-dressing", "Dopamine dressing", "subculture", ["dopamine dressing", "kidcore", "maximalism", "retro maximalism"], "Bright, joyful colour to lift the mood.", ["dopamine dressing"]],
  ["brat", "Brat", "subculture", ["brat"], "Lime green, messy, party-girl summer of 2024.", ["brat summer"], { gender: "women" }],
  ["neo-medieval", "Neo-medieval", "subculture", ["neo medieval", "modern medieval", "bardcore"], "Chain mail, corsets and tabards inspired by the Middle Ages.", ["medieval fashion"]],
];

// Revival terms that name the trend in other words. Anything not listed here falls back to the
// trend patterns above; revivals that still don't match keep their subject with "trend": null.
const revivalAliases = {
  "1990s grunge": "grunge",
  "1960s mod": "mod",
  "mod and british invasion": "mod",
  "1970s boho": "boho",
  "1990s hip hop": "hip-hop",
  "1980s power dressing": "power-suit",
  "pin up": "pin-up",
  "1950s pin up": "pin-up",
  "edwardian styles": "neo-edwardian",
  "edwardian style": "neo-edwardian",
  "edwardian formality": "neo-edwardian",
  "edwardian dandy style": "neo-edwardian",
  "two button suit": "slim-suit",
  "mad men suit": "slim-suit",
  "seinfeld": "normcore",
  "hipster vintage": "hipster",
  "light academia preppy": "dark-academia",
  "y2k menswear": "y2k",
  "1980s neon streetwear": "neon-colours",
  "1980s military details": "military-surplus",
  "teddy boy collar": "teddy-boys",
  "1940s width lapels": "wide-lapels",
  "beatles haircut": "mod-haircut",
  "wings haircut": "feathered-hair",
  "forehead headband": "headband",
  "mod headband": "headband",
  "costume jewelry": "statement-jewellery",
  "costume jewellery": "statement-jewellery",
  "dogtooth check jacket": "houndstooth",
  "psychedelic": "psychedelic-print",
  "hippie maxi dress": "maxi-dress",
  "pearl snap western shirt": "western-shirt",
  "double breasted blazer": "double-breasted-suit",
  "miami vice suit": "unstructured-blazer",
  "peaky blinders flat cap": "flat-cap",
  "pointed toes and spiked heels": "stiletto-heels",
  "pointed toe pump": "court-shoes",
  "pump": "court-shoes",
  "pedal pushers and capri pants": "capri-pants",
  "suede miniskirt": "miniskirt",
  "embroidered western shirt": "western-shirt",
  "nylon stockings": "stockings",
  "corseted silhouette": "hourglass",
  "black or white tights": "tights",
  "disco look": "disco",
  "british invasion": "swinging-london",
  
  "clear frame glasses": "horn-rimmed-glasses",
  "brightly dyed hair": "dyed-hair",
  "brown lipstick": "dark-lipstick",
  "high top fade": "high-top-fade",
  "revere collar": "hawaiian-shirt",
  "1920s gatsby": "flappers",
  "1960s british pop": "swinging-london",
  "mid late 1960s secondhand clothing": null,
  "vintage 1970s clothing": null,
};


const here = dirname(fileURLToPath(import.meta.url));
const partsDir = join(here, "..", "parts");
const rawDir = join(here, "..", "raw");
const inputs = ["wiki-1920s-1950s.json", "wiki-1960s-1980s.json", "wiki-1990s-2020s.json"];
const regionOrder = ["UK", "US", "FR", "IT", "global"];
const categories = new Set(["garment", "silhouette", "colour", "pattern", "fabric", "accessory", "footwear", "hair", "makeup", "subculture"]);

export const norm = (term) =>
  term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'.!]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/\bcolor/g, "colour")
    .replace(/\bjewelry/g, "jewellery")
    .replace(/\bgray\b/g, "grey")
    .replace(/\bcenter\b/g, "centre")
    .replace(/\s+/g, " ")
    .trim();

const entries = table.map(([id, name, category, patterns, description, ngram, overrides = {}]) => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new Error(`bad id ${id}`);
  if (!categories.has(category)) throw new Error(`${id}: bad category ${category}`);
  if (!ngram.length || ngram.length > 3) throw new Error(`${id}: needs 1 to 3 ngram phrases`);
  const plain = patterns.filter((p) => !p.includes(":"));
  const gated = patterns.filter((p) => p.includes(":")).map((p) => p.split(":")).map(([cat, p]) => [cat, new RegExp(`^(?:${p})$`)]);
  const re = new RegExp(`^(?:${plain.join("|")})$`);
  const test = (key, rowCategory) => re.test(key) || gated.some(([cat, g]) => cat === rowCategory && g.test(key));
  return { id, name, category, test, description, ngram, overrides };
});
const ids = new Set();
for (const e of entries) {
  if (ids.has(e.id)) throw new Error(`duplicate id ${e.id}`);
  ids.add(e.id);
}
for (const [alias, id] of Object.entries(revivalAliases)) if (id !== null && !ids.has(id)) throw new Error(`revival alias ${alias} -> unknown ${id}`);

const match = (term, rowCategory) => entries.find((e) => e.test(norm(term), rowCategory));

const parts = await Promise.all(inputs.map(async (f) => JSON.parse(await readFile(join(partsDir, f), "utf8"))));
const urls = new Map(parts.flatMap((p) => p.articles.map((a) => [a.title, a.url])));
const rows = parts.flatMap((p) => p.rows);
const extractedRevivals = parts.flatMap((p) => p.revivals);

const byTrend = new Map(entries.map((e) => [e.id, []]));
const unmatched = new Map();
for (const row of rows) {
  const e = match(row.term, row.category);
  if (e) byTrend.get(e.id).push(row);
  else unmatched.set(row.term, (unmatched.get(row.term) ?? 0) + 1);
}

const subcultureName = (raw) => {
  const e = match(raw);
  return e && e.category === "subculture" ? e.name : raw;
};

function mergePeriods(rs) {
  const out = [];
  for (const region of regionOrder) {
    const spans = rs.filter((r) => r.region === region).map((r) => [r.start, r.end]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = null;
    for (const [s, e] of spans) {
      if (cur && s <= cur.end + 1) cur.end = Math.max(cur.end, e);
      else out.push((cur = { start: s, end: e, region }));
    }
  }
  return out.sort((a, b) => a.start - b.start || regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region));
}

function pickGender(rs) {
  const n = { women: 0, men: 0, unisex: 0 };
  for (const r of rs) n[r.gender]++;
  if (n.women / rs.length >= 0.7) return "women";
  if (n.men / rs.length >= 0.7) return "men";
  return "unisex";
}

function pickSubculture(e, rs) {
  if (e.category === "subculture") return e.name;
  const counts = new Map();
  for (const r of rs) if (r.subculture) counts.set(r.subculture, (counts.get(r.subculture) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return top && n / rs.length >= 0.6 ? subcultureName(top) : null;
}

const loose = (s) => norm(s).replace(/s\b/g, "");
function pickSources(e, rs) {
  const headline = [e.name, ...e.ngram].map(loose);
  const terms = [...new Set(rs.map((r) => loose(r.term)))];
  const seen = new Set();
  const candidates = [];
  for (const r of rs) {
    if (seen.has(r.quote)) continue;
    seen.add(r.quote);
    const q = loose(r.quote);
    const named = terms.some((t) => q.includes(t));
    const commas = (r.quote.match(/[,;]/g) ?? []).length;
    const len = r.quote.length;
    candidates.push({ r, score: (named ? 0 : 100) + (headline.some((t) => q.includes(t)) ? 0 : 20) + commas * 3 + (len < 60 ? 15 : 0) + len / 100 });
  }
  candidates.sort((a, b) => a.score - b.score);
  const picked = [];
  const articles = new Set();
  for (const c of candidates) if (picked.length < 3 && !articles.has(c.r.article)) picked.push(c), articles.add(c.r.article);
  for (const c of candidates) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
  return picked.map(({ r }) => ({ article: r.article, url: urls.get(r.article), quote: r.quote }));
}

const trends = [];
for (const e of entries) {
  const rs = byTrend.get(e.id);
  if (!rs.length) continue;
  const termCounts = new Map();
  for (const r of rs) termCounts.set(r.term, (termCounts.get(r.term) ?? 0) + 1);
  const aliases = [...termCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t).filter((t) => norm(t) !== norm(e.name));
  const periods = mergePeriods(rs);
  trends.push({
    id: e.id,
    name: e.name,
    aliases,
    category: e.category,
    gender: e.overrides.gender ?? pickGender(rs),
    regions: regionOrder.filter((g) => rs.some((r) => r.region === g)),
    periods,
    subculture: "subculture" in e.overrides ? e.overrides.subculture : pickSubculture(e, rs),
    description: e.description,
    sources: pickSources(e, rs),
    ngram: e.ngram,
  });
}

const kept = new Set(trends.map((t) => t.id));
const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;
const revivals = [];
const unmatchedRevivals = [];
for (const v of extractedRevivals) {
  const key = norm(v.term);
  const trend = key in revivalAliases ? revivalAliases[key] : (match(v.term)?.id ?? null);
  const item = { trend: trend && kept.has(trend) ? trend : null, subject: v.term, original: v.original, revival: v.revival, article: v.article, quote: v.quote };
  if (!item.trend) unmatchedRevivals.push(v.term);
  const dupe = revivals.find((o) =>
    item.trend
      ? o.trend === item.trend && overlaps(o.original, item.original) && overlaps(o.revival, item.revival)
      : !o.trend && o.original.start === item.original.start && o.original.end === item.original.end && overlaps(o.revival, item.revival),
  );
  if (!dupe) revivals.push(item);
}
revivals.sort((a, b) => (a.trend ?? "~" + a.subject).localeCompare(b.trend ?? "~" + b.subject) || a.revival.start - b.revival.start);

await writeFile(join(partsDir, "trends.json"), JSON.stringify({ trends }, null, 2) + "\n");
await writeFile(join(partsDir, "revivals.json"), JSON.stringify({ revivals }, null, 2) + "\n");
await mkdir(rawDir, { recursive: true });
await writeFile(
  join(rawDir, "normalise-trends-unmatched.json"),
  JSON.stringify({ trendRows: Object.fromEntries([...byTrend].map(([id, rs]) => [id, rs.length])), rows: Object.fromEntries([...unmatched].sort((a, b) => b[1] - a[1])), revivals: unmatchedRevivals }, null, 2),
);

const matchedRows = rows.length - [...unmatched.values()].reduce((a, b) => a + b, 0);
const countBy = (f) => trends.reduce((m, t) => (f(t).forEach((k) => (m[k] = (m[k] ?? 0) + 1)), m), {});
const decades = (t) => [...new Set(t.periods.flatMap((p) => Array.from({ length: Math.floor(p.end / 10) - Math.floor(p.start / 10) + 1 }, (_, i) => `${(Math.floor(p.start / 10) + i) * 10}s`)))];
console.log(JSON.stringify({
  rowsIn: rows.length,
  rowsMatched: matchedRows,
  distinctTermsIn: new Set(rows.map((r) => r.term)).size,
  trendsOut: trends.length,
  emptyTableEntries: entries.filter((e) => !kept.has(e.id)).map((e) => e.id),
  byCategory: countBy((t) => [t.category]),
  byDecade: Object.fromEntries(Object.entries(countBy(decades)).sort()),
  revivalsIn: extractedRevivals.length,
  revivalsOut: revivals.length,
  revivalsWithTrend: revivals.filter((r) => r.trend).length,
}, null, 2));
