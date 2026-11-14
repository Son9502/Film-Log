// Generated from 35mm_Film_Developing_Reference.xlsx — starting points only; confirm against the datasheet that ships with your kit/film.
import type { DevRecipe, KitDef, ColorFilm } from "@/utils/devCalc";

export const BW_DEVELOPERS: { id: string; name: string; character: string }[] = [
 {
  "id": "kodak-d-76-ilford-id-11",
  "name": "Kodak D-76 / Ilford ID-11",
  "character": "Powder, classic all-rounder; balanced grain/sharpness"
 },
 {
  "id": "kodak-hc-110",
  "name": "Kodak HC-110",
  "character": "Syrup concentrate, lasts years; flexible dilutions"
 },
 {
  "id": "rodinal-adox-adonal-r09",
  "name": "Rodinal / Adox Adonal / R09",
  "character": "High acutance, visible grain; near-infinite shelf life"
 },
 {
  "id": "rodinal-stand-development",
  "name": "Rodinal (stand development)",
  "character": "Ultra-dilute, edge effects, compensating"
 },
 {
  "id": "kodak-xtol-adox-xt-3",
  "name": "Kodak XTOL / Adox XT-3",
  "character": "Powder, fine grain at full box speed"
 },
 {
  "id": "ilford-dd-x",
  "name": "Ilford DD-X",
  "character": "Liquid, fine grain, made for pushing"
 },
 {
  "id": "kodak-t-max-developer",
  "name": "Kodak T-Max developer",
  "character": "Liquid; made for T-grain films; runs at 24°C"
 },
 {
  "id": "ilford-ilfosol-3",
  "name": "Ilford Ilfosol 3",
  "character": "Liquid one-shot, fine grain"
 },
 {
  "id": "ilford-perceptol",
  "name": "Ilford Perceptol",
  "character": "Powder, extra-fine grain (costs ~½–1 stop speed)"
 },
 {
  "id": "cinestill-df96-monobath",
  "name": "CineStill Df96 monobath",
  "character": "Develop + fix in one bath, reusable"
 }
];

export const BW_STOCKS: { id: string; name: string; boxIso: number }[] = [
 {
  "id": "kodak-tri-x-400",
  "name": "Kodak Tri-X 400",
  "boxIso": 400
 },
 {
  "id": "ilford-hp5-plus",
  "name": "Ilford HP5 Plus",
  "boxIso": 400
 },
 {
  "id": "ilford-fp4-plus",
  "name": "Ilford FP4 Plus",
  "boxIso": 125
 },
 {
  "id": "kodak-t-max-400",
  "name": "Kodak T-Max 400",
  "boxIso": 400
 },
 {
  "id": "kodak-t-max-100",
  "name": "Kodak T-Max 100",
  "boxIso": 100
 },
 {
  "id": "ilford-delta-100",
  "name": "Ilford Delta 100",
  "boxIso": 100
 },
 {
  "id": "ilford-delta-400",
  "name": "Ilford Delta 400",
  "boxIso": 400
 },
 {
  "id": "fomapan-100",
  "name": "Fomapan 100",
  "boxIso": 100
 },
 {
  "id": "ilford-delta-3200",
  "name": "Ilford Delta 3200",
  "boxIso": 3200
 },
 {
  "id": "kodak-t-max-p3200",
  "name": "Kodak T-Max P3200",
  "boxIso": 3200
 },
 {
  "id": "kentmere-pan-100",
  "name": "Kentmere Pan 100",
  "boxIso": 100
 },
 {
  "id": "ilford-pan-f-plus",
  "name": "Ilford Pan F Plus",
  "boxIso": 32
 }
];

export const BW_RECIPES: DevRecipe[] = [
  {"id": "bw0", "filmStockId": "kodak-tri-x-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 405, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw1", "filmStockId": "ilford-hp5-plus", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 450, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw2", "filmStockId": "ilford-fp4-plus", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 125, "tempC": 20.0, "timeSeconds": 510, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw3", "filmStockId": "kodak-t-max-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 480, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw4", "filmStockId": "kodak-t-max-100", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 100, "tempC": 20.0, "timeSeconds": 480, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw5", "filmStockId": "ilford-delta-100", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 100, "tempC": 20.0, "timeSeconds": 510, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw6", "filmStockId": "ilford-delta-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 570, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw7", "filmStockId": "kodak-tri-x-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 585, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw8", "filmStockId": "ilford-hp5-plus", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 780, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw9", "filmStockId": "ilford-fp4-plus", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 125, "tempC": 20.0, "timeSeconds": 660, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw10", "filmStockId": "kodak-t-max-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 750, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw11", "filmStockId": "ilford-delta-100", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 100, "tempC": 20.0, "timeSeconds": 660, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw12", "filmStockId": "ilford-delta-400", "developerId": "kodak-d-76-ilford-id-11", "dilution": "1+1", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 840, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw13", "filmStockId": "kodak-tri-x-400", "developerId": "kodak-hc-110", "dilution": "Dil. B (1+31)", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 225, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw14", "filmStockId": "ilford-hp5-plus", "developerId": "kodak-hc-110", "dilution": "Dil. B (1+31)", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 300, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw15", "filmStockId": "ilford-fp4-plus", "developerId": "kodak-hc-110", "dilution": "Dil. B (1+31)", "exposureIso": 125, "tempC": 20.0, "timeSeconds": 360, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw16", "filmStockId": "kodak-t-max-400", "developerId": "kodak-hc-110", "dilution": "Dil. B (1+31)", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 360, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw17", "filmStockId": "kodak-tri-x-400", "developerId": "rodinal-adox-adonal-r09", "dilution": "1+50", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 660, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw18", "filmStockId": "ilford-hp5-plus", "developerId": "rodinal-adox-adonal-r09", "dilution": "1+50", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 660, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw19", "filmStockId": "ilford-fp4-plus", "developerId": "rodinal-adox-adonal-r09", "dilution": "1+50", "exposureIso": 125, "tempC": 20.0, "timeSeconds": 660, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw20", "filmStockId": "fomapan-100", "developerId": "rodinal-adox-adonal-r09", "dilution": "1+50", "exposureIso": 100, "tempC": 20.0, "timeSeconds": 540, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw21", "filmStockId": "*", "developerId": "rodinal-stand-development", "dilution": "1+100", "exposureIso": 0, "tempC": 20.0, "timeSeconds": 3600, "agitation": "Agitate 30–60 s at start, (optional) 4 gentle inversions at 30 min, then stand", "push": false, "pull": false, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw22", "filmStockId": "kodak-tri-x-400", "developerId": "kodak-xtol-adox-xt-3", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 375, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw23", "filmStockId": "kodak-t-max-400", "developerId": "kodak-xtol-adox-xt-3", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 420, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw24", "filmStockId": "ilford-hp5-plus", "developerId": "kodak-xtol-adox-xt-3", "dilution": "Stock", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 450, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw25", "filmStockId": "ilford-hp5-plus", "developerId": "ilford-dd-x", "dilution": "1+4", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 540, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw26", "filmStockId": "ilford-delta-400", "developerId": "ilford-dd-x", "dilution": "1+4", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 480, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw27", "filmStockId": "ilford-delta-3200", "developerId": "ilford-dd-x", "dilution": "1+4", "exposureIso": 3200, "tempC": 20.0, "timeSeconds": 570, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw28", "filmStockId": "kodak-tri-x-400", "developerId": "ilford-dd-x", "dilution": "1+4", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 450, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw29", "filmStockId": "kodak-t-max-400", "developerId": "kodak-t-max-developer", "dilution": "1+4", "exposureIso": 400, "tempC": 24.0, "timeSeconds": 390, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw30", "filmStockId": "kodak-tri-x-400", "developerId": "kodak-t-max-developer", "dilution": "1+4", "exposureIso": 400, "tempC": 24.0, "timeSeconds": 360, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw31", "filmStockId": "kodak-t-max-p3200", "developerId": "kodak-t-max-developer", "dilution": "1+4", "exposureIso": 3200, "tempC": 24.0, "timeSeconds": 570, "agitation": "Kodak: 5–7 inversions every 30 s", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw32", "filmStockId": "ilford-hp5-plus", "developerId": "ilford-ilfosol-3", "dilution": "1+9", "exposureIso": 400, "tempC": 20.0, "timeSeconds": 390, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw33", "filmStockId": "ilford-fp4-plus", "developerId": "ilford-ilfosol-3", "dilution": "1+9", "exposureIso": 125, "tempC": 20.0, "timeSeconds": 270, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw34", "filmStockId": "kentmere-pan-100", "developerId": "ilford-ilfosol-3", "dilution": "1+9", "exposureIso": 100, "tempC": 20.0, "timeSeconds": 300, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": true, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw35", "filmStockId": "ilford-fp4-plus", "developerId": "ilford-perceptol", "dilution": "Stock", "exposureIso": 64, "tempC": 20.0, "timeSeconds": 420, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": false, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw36", "filmStockId": "ilford-pan-f-plus", "developerId": "ilford-perceptol", "dilution": "Stock", "exposureIso": 32, "tempC": 20.0, "timeSeconds": 660, "agitation": "Ilford: 4 inversions in first 10 s, then 4 every minute", "push": false, "pull": true, "source": "35mm_Film_Developing_Reference.xlsx"},
  {"id": "bw37", "filmStockId": "*", "developerId": "cinestill-df96-monobath", "dilution": "Stock", "exposureIso": 0, "tempC": 26.7, "timeSeconds": 180, "agitation": "Agitate continuously first 30 s, then 5 s every 30 s", "push": false, "pull": false, "source": "35mm_Film_Developing_Reference.xlsx"}
];

export const COLOR_KITS: KitDef[] = [
 {
  "id": "c-41-cinestill-cs41-2-bath-liquid",
  "process": "C-41",
  "name": "CineStill Cs41 (2-bath liquid)",
  "exhaustionPctPerRoll": 0.02,
  "steps": [
   {
    "order": 1,
    "name": "Developer",
    "tempC": 39.0,
    "timeSeconds": 210,
    "instructions": "Continuous first 10 s, then 4 inversions every 30 s · 102°F. Add time per reuse batch per CineStill chart. Lower-temp options listed on kit sheet.",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 2,
    "name": "Blix",
    "tempC": 39.0,
    "timeSeconds": 480,
    "instructions": "Continuous first 10 s, then 4 inversions every 30 s · Range 80–102°F; extend if under temp",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 3,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 180,
    "instructions": "Running water or fill/dump x6",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Stabilizer / wetting rinse",
    "tempC": null,
    "timeSeconds": 60,
    "instructions": "Gentle, none at end · Optional with Cs41; recommended for archival",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 },
 {
  "id": "c-41-unicolor-c-41-powder",
  "process": "C-41",
  "name": "Unicolor C-41 (powder)",
  "exhaustionPctPerRoll": 0.02,
  "steps": [
   {
    "order": 1,
    "name": "Developer",
    "tempC": 39.0,
    "timeSeconds": 210,
    "instructions": "Continuous first 10 s, then 4 inversions every 30 s · 102°F. +2% time per roll previously processed",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 2,
    "name": "Blix",
    "tempC": 39.0,
    "timeSeconds": 390,
    "instructions": "Continuous first 10 s, then 4 inversions every 30 s",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 3,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 180,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Stabilizer",
    "tempC": null,
    "timeSeconds": 60,
    "instructions": "None · Room temp OK",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 },
 {
  "id": "c-41-kodak-flexicolor-lab-grade-4-bath",
  "process": "C-41",
  "name": "Kodak Flexicolor (lab-grade, 4-bath)",
  "exhaustionPctPerRoll": 0,
  "steps": [
   {
    "order": 1,
    "name": "Developer",
    "tempC": 37.8,
    "timeSeconds": 195,
    "instructions": "Continuous 15 s, then 2 s every 15 s (Kodak small-tank) · ±0.15°C tolerance",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 2,
    "name": "Bleach",
    "tempC": 38.0,
    "timeSeconds": 390,
    "instructions": "Same as dev · 24–40.5°C range",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 3,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 195,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Fixer",
    "tempC": 38.0,
    "timeSeconds": 390,
    "instructions": "Same as dev",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 5,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 195,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 6,
    "name": "Final rinse / stabilizer",
    "tempC": null,
    "timeSeconds": 65,
    "instructions": "None",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 },
 {
  "id": "e-6-home-3-bath-kit-tetenal-colortec-adox-c-tec-arista-rapid-cinestill-cs6",
  "process": "E-6",
  "name": "Home 3-bath kit (Tetenal Colortec / Adox C-Tec / Arista Rapid / CineStill Cs6)",
  "exhaustionPctPerRoll": 0.02,
  "steps": [
   {
    "order": 1,
    "name": "Pre-warm (water)",
    "tempC": 38.0,
    "timeSeconds": 300,
    "instructions": "Continuous · Brings tank to temp",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 2,
    "name": "First developer",
    "tempC": 38.0,
    "timeSeconds": 375,
    "instructions": "Continuous first 15 s, then 4 inversions every 30 s · Most critical step: ±0.3°C",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 3,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 150,
    "instructions": "Fill/dump",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Color developer",
    "tempC": 38.0,
    "timeSeconds": 360,
    "instructions": "Continuous first 15 s, then 4 inversions every 30 s · Chemically fogs (reverses) film — no light step needed",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 5,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 60,
    "instructions": "Fill/dump",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 6,
    "name": "Blix",
    "tempC": 38.0,
    "timeSeconds": 360,
    "instructions": "Continuous first 15 s, then 4 inversions every 30 s",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 7,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 240,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 8,
    "name": "Stabilizer / final rinse",
    "tempC": null,
    "timeSeconds": 60,
    "instructions": "None",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 },
 {
  "id": "e-6-kodak-fujihunt-e-6-lab-grade-6-bath",
  "process": "E-6",
  "name": "Kodak / Fujihunt E-6 (lab-grade, 6-bath)",
  "exhaustionPctPerRoll": 0,
  "steps": [
   {
    "order": 1,
    "name": "First developer",
    "tempC": 38.0,
    "timeSeconds": 360,
    "instructions": "Kodak small-tank: continuous 15 s, then 2 s every 15 s · ±0.3°C",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 2,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 120,
    "instructions": "",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 3,
    "name": "Reversal bath",
    "tempC": 38.0,
    "timeSeconds": 120,
    "instructions": "Initial only",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Color developer",
    "tempC": 38.0,
    "timeSeconds": 360,
    "instructions": "As first dev",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 5,
    "name": "Pre-bleach",
    "tempC": 38.0,
    "timeSeconds": 120,
    "instructions": "Initial only",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 6,
    "name": "Bleach",
    "tempC": 38.0,
    "timeSeconds": 360,
    "instructions": "As first dev",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 7,
    "name": "Fixer",
    "tempC": 38.0,
    "timeSeconds": 240,
    "instructions": "As first dev",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 8,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 240,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 9,
    "name": "Final rinse",
    "tempC": null,
    "timeSeconds": 60,
    "instructions": "None",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 },
 {
  "id": "ecn-2-home-ecn-2-kit",
  "process": "ECN-2",
  "name": "Home ECN-2 kit",
  "exhaustionPctPerRoll": 0.02,
  "steps": [
   {
    "order": 1,
    "name": "Pre-bath / remjet softener",
    "tempC": 41.0,
    "timeSeconds": 30,
    "instructions": "Continuous · Alkaline bath (borax/soda) to loosen remjet",
    "isDevelop": false,
    "onlyIfRemjet": true
   },
   {
    "order": 2,
    "name": "Remjet removal",
    "tempC": 27.0,
    "timeSeconds": 120,
    "instructions": "Rub with sponge/fingers under warm water · Repeat after fix if traces remain",
    "isDevelop": false,
    "onlyIfRemjet": true
   },
   {
    "order": 3,
    "name": "Developer",
    "tempC": 41.0,
    "timeSeconds": 180,
    "instructions": "Continuous first 10 s, then 4 inversions every 30 s · 106°F",
    "isDevelop": true,
    "onlyIfRemjet": false
   },
   {
    "order": 4,
    "name": "Stop bath",
    "tempC": 41.0,
    "timeSeconds": 30,
    "instructions": "Continuous",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 5,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 60,
    "instructions": "",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 6,
    "name": "Bleach",
    "tempC": 38.0,
    "timeSeconds": 180,
    "instructions": "As developer",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 7,
    "name": "Wash",
    "tempC": 38.0,
    "timeSeconds": 60,
    "instructions": "",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 8,
    "name": "Fixer",
    "tempC": 38.0,
    "timeSeconds": 120,
    "instructions": "As developer",
    "isDevelop": false,
    "onlyIfRemjet": false
   },
   {
    "order": 9,
    "name": "Wash + final rinse",
    "tempC": 38.0,
    "timeSeconds": 180,
    "instructions": "Running water",
    "isDevelop": false,
    "onlyIfRemjet": false
   }
  ]
 }
];

export const COLOR_FILMS: ColorFilm[] = [
 {
  "id": "c-41-kodak-portra-160-400-800",
  "name": "Kodak Portra 160 / 400 / 800",
  "process": "C-41",
  "boxIso": 160,
  "hasRemjet": false
 },
 {
  "id": "c-41-kodak-ektar-100",
  "name": "Kodak Ektar 100",
  "process": "C-41",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "c-41-kodak-gold-200-ultramax-400-colorplus-200",
  "name": "Kodak Gold 200 / Ultramax 400 / ColorPlus 200",
  "process": "C-41",
  "boxIso": 200,
  "hasRemjet": false
 },
 {
  "id": "c-41-fujifilm-200-400",
  "name": "Fujifilm 200 / 400",
  "process": "C-41",
  "boxIso": 200,
  "hasRemjet": false
 },
 {
  "id": "c-41-cinestill-400d-800t",
  "name": "CineStill 400D / 800T",
  "process": "C-41",
  "boxIso": 400,
  "hasRemjet": false
 },
 {
  "id": "c-41-lomography-color-negative-100-400-800",
  "name": "Lomography Color Negative 100/400/800",
  "process": "C-41",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "c-41-harman-phoenix-200",
  "name": "Harman Phoenix 200",
  "process": "C-41",
  "boxIso": 200,
  "hasRemjet": false
 },
 {
  "id": "c-41-ilford-xp2-super-b-w",
  "name": "Ilford XP2 Super (B&W)",
  "process": "C-41",
  "boxIso": 400,
  "hasRemjet": false
 },
 {
  "id": "e-6-kodak-ektachrome-e100",
  "name": "Kodak Ektachrome E100",
  "process": "E-6",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "e-6-fujifilm-velvia-50",
  "name": "Fujifilm Velvia 50",
  "process": "E-6",
  "boxIso": 50,
  "hasRemjet": false
 },
 {
  "id": "e-6-fujifilm-velvia-100",
  "name": "Fujifilm Velvia 100",
  "process": "E-6",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "e-6-fujifilm-provia-100f",
  "name": "Fujifilm Provia 100F",
  "process": "E-6",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "e-6-any-slide-film-cross-process",
  "name": "Any slide film (cross-process)",
  "process": "E-6",
  "boxIso": 100,
  "hasRemjet": false
 },
 {
  "id": "ecn-2-kodak-vision3-50d-250d",
  "name": "Kodak Vision3 50D / 250D",
  "process": "ECN-2",
  "boxIso": 50,
  "hasRemjet": true
 },
 {
  "id": "ecn-2-kodak-vision3-200t-500t",
  "name": "Kodak Vision3 200T / 500T",
  "process": "ECN-2",
  "boxIso": 200,
  "hasRemjet": true
 },
 {
  "id": "ecn-2-cinestill-800t-400d",
  "name": "CineStill 800T / 400D",
  "process": "ECN-2",
  "boxIso": 800,
  "hasRemjet": false
 }
];
