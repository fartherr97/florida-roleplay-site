/**
 * The 2024 donator personals — the LEO and civilian personal vehicles imported
 * into flrp-vehicles under [Donator]/ — as vehicle-library rows a member can
 * claim.
 *
 * Year, make and model come from the packs themselves (mod-kit names, part
 * files, engine audio and the metas' make field), so each row carries how sure
 * that identification is: `high` is a named kit or explicit label, `medium` a
 * strong hint, `low` a guess a manager should confirm from the in-game model.
 * Rows are inserted once and never overwritten — the library editor is the
 * source of truth after that, so a corrected name survives every redeploy.
 *
 * LIVERIES is what is actually painted on each LEO car, read off the livery
 * textures in its .ytd. REVISIONS re-identifies rows whose first guess was
 * wrong, but only while the row still carries that first guess — an entry a
 * manager has since edited is never touched.
 */
import { query } from "./db.js";

/* [spawn, year, make, model, confidence, hint, resource (escrowed singles only)] */
const LEO = [
  ["hcco98", 2023, "Chevrolet", "Suburban (unmarked)", "high", "uc23suburban modkit, Tahoe 5.3 audio"],
  ["leopersonal101", 2018, "Dodge", "Charger (GSP livery)", "medium", "18DODGE, gspcharger"],
  ["leopersonal102", 2018, "Dodge", "Charger", "medium", "18DODGE. Two metas in the pack share this spawn name (same car, different handling)"],
  ["leopersonal103", 2023, "Chevrolet", "Camaro", "high", "23camb modkit"],
  ["leopersonal105", 2024, "Ford", "F-150 Raptor R (slicktop)", "high", "24raptorrslick modkit"],
  ["leopersonal106", 2024, "Ford", "F-150 Raptor R", "high", "24raptorr modkit"],
  ["leopersonal1", null, "Unknown", "Ambulance", "low", "ambulance livery in its own ytd (the pack's Escalade metas for this spawn name are a stray second definition)"],
  ["leopersonal10", 2022, "Ford", "Expedition", "medium", "22exp livery texture"],
  ["leopersonal11", null, "Ford", "F-Series brush truck", "low", "fd7, Vapid, 6.0 Powerstroke audio, brush-truck interior"],
  ["leopersonal12", 2011, "Ford", "Crown Victoria Police Interceptor", "medium", "legcvpi"],
  ["leopersonal13", null, "Ford", "LTD Crown Victoria (retro)", "medium", "ltd livery texture, CVPI V8 audio"],
  ["leopersonal14", 2025, "Dodge", "Durango Pursuit", "high", "hab25durango modkit"],
  ["leopersonal15", null, "Dodge", "Charger", "low", "TTPD, Windsor audio only"],
  ["leopersonal16", null, "Chevrolet", "Tahoe Z71", "medium", "CHEVROLETz71, Granger audio"],
  ["leopersonal17", 2020, "Ford", "F-250 Super Duty", "medium", "20FORD, diesel audio"],
  ["leopersonal18", null, "Dodge", "Charger SRT Hellcat Redeye", "medium", "Hellcat Redeye audio"],
  ["leopersonal19", null, "Unknown", "", "low", "No model hints (stream folder also holds leopersonal18 files)"],
  ["leopersonal20", 2020, "Dodge", "Durango (slicktop)", "high", "slick20durango modkit"],
  ["leopersonal21", 2019, "Dodge", "Durango", "medium", "19DODGE, dur livery texture"],
  ["leopersonal22", null, "Dodge", "Viper SRT", "medium", "SRT, Viper audio"],
  ["leopersonal23", 2023, "Ford", "F-150", "medium", "23f150 livery texture"],
  ["leopersonal24", null, "Ford", "F-150", "medium", "f150 livery texture, F-150 Coyote audio"],
  ["leopersonal25", 2021, "Dodge", "Durango", "medium", "21durango livery texture"],
  ["leopersonal26", 2020, "Dodge", "Charger", "high", "2020charger modkit"],
  ["leopersonal27", null, "Dodge", "Charger", "medium", "charger livery texture, Demon V8 audio"],
  ["leopersonal29", null, "GMC", "Sierra 3500 AT4", "high", "make field"],
  ["leopersonal2", null, "Dodge", "Challenger", "medium", "challenger livery texture"],
  ["leopersonal30", 2021, "Dodge", "Durango Pursuit", "high", "livery template labelled 2021-2024 Dodge Durango Pursuit"],
  ["leopersonal31", null, "BMW", "i4 Gran Coupe", "high", "bmwi4gc modkit, electric audio"],
  ["leopersonal32", null, "Chevrolet", "Caprice (retro)", "medium", "caprice livery texture"],
  ["leopersonal33", 2021, "Dodge", "Durango", "medium", "21DODGE, dur livery texture"],
  ["leopersonal34", 2023, "Chevrolet", "Tahoe (slicktop)", "high", "slick23tahoe modkit"],
  ["leopersonal35", null, "Ford", "Police Interceptor Utility", "medium", "fpiu livery texture"],
  ["leopersonal36", 2021, "GMC", "Yukon (unmarked)", "medium", "21yuk texture, no livery painted"],
  ["leopersonal37", null, "Dodge", "Charger", "low", "chgr livery texture"],
  ["leopersonal38", 1992, "Ford", "Mustang (Fox body)", "medium", "92fox livery texture"],
  ["leopersonal39", 2020, "Ford", "F-550 Ambulance (Black Diamond box)", "high", "f550ambow modkit"],
  ["leopersonal3", 2025, "Ford", "Police Interceptor Utility (slicktop)", "high", "25legfpiustbb modkit"],
  ["leopersonal40", 2023, "Dodge", "Charger", "high", "hab23chargerb modkit"],
  ["leopersonal41", 2025, "Ford", "Police Interceptor Utility", "high", "25fpiubb modkit"],
  ["leopersonal43", 2014, "Chevrolet", "Tahoe", "medium", "14tahoe livery texture"],
  ["leopersonal44", 2021, "Dodge", "Durango", "high", "21DODGE, Durango animations"],
  ["leopersonal45", 2025, "Ford", "Police Interceptor Utility", "high", "25legfpiubb modkit"],
  ["leopersonal46", null, "Chevrolet", "Caprice (retro)", "medium", "caprice livery texture"],
  ["comptonpolice2", null, "Chevrolet", "Caprice (classic)", "low", "Buccaneer audio"],
  ["comptonpolice3", null, "Chevrolet", "Caprice (classic)", "low", "Buccaneer audio"],
  ["leopersonal48", null, "Dodge", "Charger", "low", "Buffalo2 audio, make c3vcat"],
  ["leopersonal49", 2021, "Chevrolet", "Tahoe PPV", "high", "sosst21tahoe modkit"],
  ["leopersonal4", 2023, "Chevrolet", "Silverado", "medium", "23silver livery texture"],
  ["leopersonal50", null, "Dodge", "Charger (unmarked)", "medium", "uc_chargerb modkit"],
  ["leopersonal52", null, "Ford", "F-450 (fire rescue)", "medium", "f450d livery texture, diesel audio"],
  ["leopersonal53", 2023, "Dodge", "Charger", "low", "hard23charger modkit, but 2018 F-150 parts in the stream folder"],
  ["leopersonal54", 2025, "Chevrolet", "Tahoe", "medium", "25tahoe livery texture"],
  ["leopersonal56", 2020, "Ford", "F-350 Super Duty", "high", "20FORD, 350eod modkit"],
  ["leopersonal59", null, "Chevrolet", "Tahoe Z71", "high", "gameName TAHOE, CHEVROLETz71"],
  ["leopersonal5", null, "GMC", "Sierra 3500 AT4", "high", "make field"],
  ["leopersonal60", null, "Ford", "Crown Victoria", "medium", "cvpi livery texture"],
  ["leopersonal69", null, "Nissan", "GT-R", "low", "tc_gtr livery texture, Urus audio"],
  ["leopersonal6", null, "Chevrolet", "Tahoe Z71", "medium", "CHEVROLETz71, Granger audio"],
  ["leopersonal74", null, "Ford", "Crown Victoria", "medium", "cvpi livery texture"],
  ["leopersonal77", null, "Chevrolet", "Tahoe", "low", "Granger audio"],
  ["leopersonal7", 2022, "Chevrolet", "Silverado LT", "medium", "22silvlt livery texture"],
  ["leopersonal80", null, "Dodge", "Charger", "low", "Charger-shaped livery template"],
  ["leopersonal81", 2018, "Dodge", "Charger", "medium", "18DODGE"],
  ["leopersonal82", 2023, "Chevrolet", "Camaro (Heat)", "high", "23heatcambb modkit, Camaro animations"],
  ["leopersonal83", null, "Subaru", "BRZ", "medium", "brz livery texture"],
  ["leopersonal84", 2022, "Ford", "Expedition", "high", "gameName Expedition, 22exp livery texture"],
  ["leopersonal85", 2019, "Chevrolet", "Corvette ZR1", "high", "19corvette modkit, ZR1 livery texture"],
  ["leopersonal86", null, "Chevrolet", "Camaro", "medium", "cam livery texture"],
  ["leopersonal87", 2023, "Dodge", "Charger", "high", "hab23charger modkit"],
  ["leopersonal88", 2020, "Dodge", "Charger", "high", "2020charger modkit"],
  ["leopersonal89", null, "Porsche", "911", "medium", "PORSCHE, Comet audio"],
  ["leopersonal8", 2013, "Ford", "Mustang GT", "medium", "13gt livery texture, Dominator audio"],
  ["leopersonal90", 2023, "Chevrolet", "Silverado Custom", "high", "SilveradoCustom, 23silvmethod animations"],
  ["leopersonal91", null, "Ford", "Crown Victoria (retro)", "medium", "retrodono, CVPI V8 audio"],
  ["leopersonal92", 2020, "Ford", "Police Interceptor Utility", "medium", "fed20suv / fed21suv modkits"],
  ["leopersonal93", 2021, "Dodge", "Durango", "medium", "21durango livery texture"],
  ["leopersonal94", null, "Ford", "Crown Victoria", "medium", "cvpi livery texture"],
  ["leopersonal95", 2025, "Chevrolet", "Silverado SS (slicktop)", "low", "c3 25ss slick modkit, F-150 audio"],
  ["leopersonal97", 2006, "Chevrolet", "Tahoe", "medium", "06taho texture, Tahoe 5.3 V8 audio"],
  ["leopersonal96", 2025, "Dodge", "Durango", "high", "hard25durango modkit"],
  ["leopersonal98", null, "Dodge", "Charger", "low", "Charger-shaped livery template, Sentinel audio"],
  ["leopersonal99", 2024, "Ford", "Mustang GT", "high", "24mustgt modkit"],
  ["leopersonal9", 2025, "Ford", "Police Interceptor Utility", "high", "nn25fpiu modkit"],
  ["leopersonal47", null, "Unknown", "Ambulance", "low", "escrowed single, ambulance audio", "leopersonal47"],
  ["jacksontow112", null, "Unknown", "Heavy wrecker (tow truck)", "low", "escrowed single, Chernobog audio", "jacksontow112"],
  ["jacksontow389", null, "Peterbilt", "389 wrecker", "medium", "escrowed single, 389 modkit and parts", "jacksontow389"],
];

const CIV = [
  ["civpersonal11", null, "Jeep", "Grand Cherokee Trackhawk", "medium", "JEEP, Hellcat Redeye audio"],
  ["civpersonal12", null, "Nissan", "GT-R (R35)", "high", "r35 modkit"],
  ["civpersonal13", null, "Unknown", "(iKX3 build)", "low", "iKX3, Jugular audio"],
  ["civpersonal14", null, "BMW", "", "low", "BMW, Comet audio"],
  ["civpersonal15", null, "Jeep", "Wrangler", "medium", "Jeep, Kamacho audio"],
  ["civpersonal16", null, "Subaru", "WRX STI (GD)", "high", "GDWRXSTI"],
  ["civpersonal17", null, "Dodge", "(custom, sjdodge)", "low", "sjdodge modkit"],
  ["civpersonal19", 2023, "Ford", "F-150 Shelby", "high", "dill23shelbyf150 modkit"],
  ["civpersonal1", null, "Honda", "Civic EG6 (Spoon)", "high", "eg6 modkit, SPOON"],
  ["civpersonal20", null, "Unknown", "Motorcycle (custom)", "low", "Bikermods, Cliffhanger audio"],
  ["civpersonal21", null, "Shelby", "Cobra (twin turbo)", "low", "gtwinturbocobra modkit"],
  ["civpersonal22", null, "Ford", "F-150 (boosted)", "medium", "boostf150v2 modkit"],
  ["civpersonal23", null, "Harley-Davidson", "Bagger", "high", "HARLEY, bagger audio"],
  ["civpersonal24", 2022, "Dodge", "Charger (Demon)", "high", "gameName '2022 Dodge Charger Demon'"],
  ["civpersonal25", null, "Subaru", "WRX", "high", "subwrx modkit"],
  ["civpersonal26", 2016, "Dodge", "Challenger", "high", "16challenger modkit"],
  ["civpersonal28", null, "Dodge", "Charger SRT Hellcat", "low", "hellcatom modkit"],
  ["civpersonal29", null, "Unknown", "SUV", "low", "Astron audio"],
  ["civpersonal2", null, "Ford", "F-450 Platinum", "high", "f450plat modkit"],
  ["civpersonal30", 2019, "Subaru", "WRX", "high", "wrx19 modkit"],
  ["civpersonal31", null, "BMW", "M3 (E92)", "high", "e92 liveries"],
  ["civpersonal32", null, "Chevrolet", "Corvette", "medium", "CHEVY, Coquette audio"],
  ["civpersonal33", null, "BMW", "M4 (Liberty Walk)", "high", "m4lb parts"],
  ["civpersonal34", null, "Honda", "Civic Ferio", "high", "ferio modkit"],
  ["civpersonal35", null, "Unknown", "Supercar", "low", "Turismo R audio"],
  ["civpersonal36", null, "Chevrolet", "(LT4)", "low", "serpeg8, LT4 audio"],
  ["civpersonal37", null, "Dodge", "Charger SRT Hellcat (custom)", "medium", "playanorrischar, Hellcat Redeye audio"],
  ["civpersonal38", null, "Subaru", "WRX STI", "high", "gameName WRX STI"],
  ["civpersonal39", 2023, "Dodge", "Durango (Hennessey)", "high", "23HennesseyDurango modkit"],
  ["civpersonal3", null, "BMW", "S1000RR", "high", "jcm1000rr modkit"],
  ["civpersonal40", null, "Mazda", "MX-5 Miata (NA6)", "high", "na6 modkit"],
  ["civpersonal41", 2020, "Dodge", "Charger", "high", "gameName Charger2020"],
  ["civpersonal42", null, "Lexus", "IS350", "high", "gameName IS350"],
  ["civpersonal43", 2023, "BMW", "M2", "high", "gameName '2023 BMW M2'"],
  ["civpersonal44", null, "BMW", "M5", "medium", "m5ikx3, S58 audio"],
  ["civpersonal45", null, "Nissan", "GT-R (R35)", "high", "r35 modkit, VR38DETT audio"],
  ["civpersonal46", 2016, "Cadillac", "CTS-V", "high", "ctsv16 modkit"],
  ["civpersonal47", null, "Ford", "GT", "medium", "fgt modkit, Voodoo audio"],
  ["civpersonal48", 2016, "Dodge", "Charger", "high", "gameName 16charger"],
  ["civpersonal49", null, "Cadillac", "Escalade", "medium", "CADILLAC, Cavalcade audio"],
  ["civpersonal4", null, "Audi", "RS6 Avant", "medium", "avant, Tailgater audio"],
  ["civpersonal50", null, "Chevrolet", "Corvette C7", "high", "c7 modkit, LT4 audio"],
  ["civpersonal52", 2023, "Mercedes-AMG", "C63 S E Performance", "high", "c63seperfor23 modkit"],
  ["civpersonal53", null, "Jeep", "Grand Cherokee Trackhawk", "high", "trhawk modkit"],
  ["civpersonal54", null, "Ferrari", "Purosangue", "high", "Purosangue animations"],
  ["civpersonal55", 2022, "Cadillac", "CT5-V Blackwing", "high", "ct5vbw22 animations"],
  ["civpersonal57", null, "Dodge", "Challenger SRT Demon", "medium", "Dodge, Demon V8 audio"],
  ["civpersonal59", null, "BMW", "M3 CSL (iKX3)", "low", "cslikx3"],
  ["civpersonal5", null, "Kawasaki", "Ninja H2", "medium", "KAWASAKI, jet audio"],
  ["civpersonal60", null, "Lamborghini", "Urus", "low", "Urus V8 audio"],
  ["civpersonal61", null, "Mercedes-Benz", "G63 AMG", "medium", "Dubsta audio"],
  ["civpersonal63", null, "Porsche", "911", "low", "Comet audio"],
  ["civpersonal64", null, "Kawasaki", "Ninja H2", "medium", "KAWASAKI, jet audio"],
  ["civpersonal65", null, "Dodge", "Charger SXT", "high", "dchargersxt"],
  ["civpersonal66", null, "BMW", "M4 (G82)", "low", "iKX3, S58 audio"],
  ["civpersonal6", null, "GMC", "Canyon AT4X", "high", "gameName Canyon AT4X"],
  ["civpersonal7", 2021, "Chevrolet", "Flatbed truck", "low", "21C, Flatbed audio"],
  ["civpersonal8", null, "Chevrolet", "Silverado 2500", "high", "Silv2500"],
  ["civpersonal9", null, "Unknown", "Supercar", "low", "VERSUS, XA-21 audio"],
  ["marcobuck", 2012, "Chrysler", "300 SRT8", "high", "make field"],
  ["civpersonal10", null, "Unknown", "Heavy truck", "low", "escrowed single, Chernobog audio", "civpersonal10"],
  ["civpersonal51", null, "Peterbilt", "389", "medium", "escrowed single, 389 parts", "civpersonal51"],
  ["civpersonal56", null, "Unknown", "Heavy truck", "low", "escrowed single, Chernobog audio", "civpersonal56"],
];

/* Department liveries painted on each LEO personal (from its livery textures). */
const LIVERIES = {
  "hcco98": "FHP, FHP ghost, HCSO Communications",
  "leopersonal101": "FHP",
  "leopersonal102": "HCSO, HCSO ghost",
  "leopersonal103": "FHP, FHP CIU ghost",
  "leopersonal105": "HCSO, HCSO ghost",
  "leopersonal106": "FHP, FHP CVE, FWC",
  "leopersonal1": "HCFR Paramedics",
  "leopersonal10": "HCSO",
  "leopersonal11": "HCFR",
  "leopersonal12": "Temple Terrace PD",
  "leopersonal13": "Tampa PD, Temple Terrace PD",
  "leopersonal14": "FHP, FHP CIU ghost",
  "leopersonal15": "Temple Terrace PD",
  "leopersonal16": "FHP, FHP ghost, FHP CIU ghost",
  "leopersonal17": "HCSO, HCSO Traffic Unit",
  "leopersonal18": "Temple Terrace PD",
  "leopersonal20": "HCSO, HCSO ghost",
  "leopersonal21": "FHP, FHP ghost",
  "leopersonal22": "FHP",
  "leopersonal23": "Tampa PD",
  "leopersonal24": "HCSO patrol, supervisor, traffic, K-9, ghost",
  "leopersonal25": "FHP, FHP CVE",
  "leopersonal26": "FHP ghost",
  "leopersonal27": "HCSO K-9, HCSO ghost",
  "leopersonal29": "HCSO",
  "leopersonal2": "HCSO Supervisor",
  "leopersonal30": "FHP",
  "leopersonal31": "HCSO, HCSO Traffic Unit, HCSO ghost",
  "leopersonal32": "HCSO (retro)",
  "leopersonal33": "FHP, FHP ghost",
  "leopersonal34": "HCSO Command, HCSO ghost",
  "leopersonal35": "Temple Terrace PD, TTPD SEU ghost",
  "leopersonal36": "Unmarked",
  "leopersonal37": "Temple Terrace PD",
  "leopersonal38": "HCSO (retro)",
  "leopersonal39": "HCFR Paramedics",
  "leopersonal3": "FHP, FHP CIU ghost, FWC",
  "leopersonal40": "Temple Terrace PD",
  "leopersonal41": "Tampa PD, Temple Terrace PD, Federal Protective Service, Border Patrol",
  "leopersonal43": "FHP",
  "leopersonal44": "FHP, FHP CVE",
  "leopersonal45": "FHP, FHP CIU ghost, FWC",
  "leopersonal46": "HCSO (retro)",
  "leopersonal48": "HCSO",
  "leopersonal49": "FHP, FHP CVE, FHP ghost, FHP CIU ghost",
  "leopersonal4": "FHP",
  "leopersonal50": "Temple Terrace PD, TTPD SEU ghost",
  "leopersonal52": "HCFR Paramedics",
  "leopersonal53": "FHP",
  "leopersonal54": "HCSO",
  "leopersonal56": "HCFR Squad 79, USAR Task Force 3, Special Ops Chief, Fire Investigator",
  "leopersonal59": "HCSO",
  "leopersonal5": "FHP, FHP CIU ghost",
  "leopersonal60": "Temple Terrace PD",
  "leopersonal69": "FHP",
  "leopersonal6": "FHP, FHP ghost",
  "leopersonal74": "FHP, FHP CIU ghost, FWC",
  "leopersonal77": "FHP, FHP ghost, FHP CIU ghost",
  "leopersonal7": "HCSO",
  "leopersonal80": "FHP, FHP K-9, FHP CIU ghost",
  "leopersonal81": "FHP, FHP ghost",
  "leopersonal82": "Tampa PD, Temple Terrace PD",
  "leopersonal83": "HCSO",
  "leopersonal84": "HCSO, HCSO Supervisor",
  "leopersonal85": "HCSO, HCSO Command, HCSO ghost",
  "leopersonal86": "FHP",
  "leopersonal87": "Tampa PD, Temple Terrace PD",
  "leopersonal88": "HCSO, HCSO Command, HCSO ghost",
  "leopersonal89": "FHP",
  "leopersonal8": "HCSO, HCSO Traffic, HCSO ghost",
  "leopersonal90": "HCSO Command, HCSO ghost",
  "leopersonal91": "HCSO (two retro styles)",
  "leopersonal92": "FHP",
  "leopersonal93": "HCSO Supervisor, HCSO Traffic, HCSO ghost",
  "leopersonal94": "Tampa PD",
  "leopersonal95": "HCSO Command, HCSO ghost",
  "leopersonal97": "HCSO (retro)",
  "leopersonal96": "FHP",
  "leopersonal98": "HCSO, HCSO Traffic, HCSO ghost",
  "leopersonal99": "Temple Terrace PD, TTPD SEU",
  "leopersonal9": "FHP",
  "leopersonal47": "HCFR Paramedics",
  "jacksontow112": "FDOT Road Ranger",
  "jacksontow389": "FDOT Road Ranger",
};

/* Rows re-identified after the first import: [spawn, first name] -> the corrected row wins
 * only while the stored name still equals that first name. */
const REVISIONS = [
  ["comptonpolice2", "Chevrolet Caprice (classic)"],
  ["comptonpolice3", "Chevrolet Caprice (classic)"],
  ["leopersonal1", "Cadillac Escalade-V (Mansory)"],
  ["leopersonal10", "Ford Expedition"],
  ["leopersonal13", "Ford Crown Victoria (retro)"],
  ["leopersonal21", "2019 Dodge Charger"],
  ["leopersonal23", "Ford F-150"],
  ["leopersonal24", "2018 Chevrolet Silverado 1500"],
  ["leopersonal25", "Dodge Challenger SRT Demon"],
  ["leopersonal27", "Dodge Challenger SRT Demon"],
  ["leopersonal2", "Dodge Charger"],
  ["leopersonal30", "2021 Dodge Charger"],
  ["leopersonal32", "Ford Crown Victoria (retro)"],
  ["leopersonal33", "2021 Dodge Charger"],
  ["leopersonal35", "Ford"],
  ["leopersonal36", "GMC"],
  ["leopersonal37", "Unidentified vehicle"],
  ["leopersonal38", "Ford Mustang (classic)"],
  ["leopersonal43", "2019 Chevrolet Tahoe"],
  ["leopersonal46", "Unidentified vehicle"],
  ["leopersonal4", "Chevrolet Camaro"],
  ["leopersonal52", "Unidentified vehicle"],
  ["leopersonal54", "Chevrolet Tahoe"],
  ["leopersonal60", "Unidentified ambulance (black diamond box)"],
  ["leopersonal69", "Lamborghini Urus"],
  ["leopersonal74", "Unidentified vehicle"],
  ["leopersonal7", "Chevrolet Tahoe Z71"],
  ["leopersonal80", "Unidentified vehicle"],
  ["leopersonal83", "Subaru WRX"],
  ["leopersonal84", "Ford Expedition"],
  ["leopersonal85", "2019 Chevrolet Corvette"],
  ["leopersonal86", "Unidentified vehicle"],
  ["leopersonal8", "Ford Mustang"],
  ["leopersonal93", "Dodge Challenger SRT Demon"],
  ["leopersonal94", "Unidentified vehicle"],
  ["leopersonal95", "2025 Ford F-150 (slicktop)"],
  ["leopersonal97", "Chevrolet Tahoe (2000s)"],
  ["leopersonal98", "Unidentified vehicle"],
];

function identify(year, make, model) {
  const parts = [year, make, model].filter((p) => p != null && String(p).trim() !== "");
  const known = make && make.toLowerCase() !== "unknown";
  return known ? parts.join(" ") : model ? `Unidentified ${model.toLowerCase()}` : "Unidentified vehicle";
}

function toRow(library, defaultResource, [spawn, year, make, model, confidence, hint, resource]) {
  const notes = [hint ? `Identified from ${hint}.` : "", confidence !== "high" ? "Confirm the year, make and model in game." : ""]
    .filter(Boolean)
    .join(" ");
  return {
    id: spawn,
    name: identify(year, make, model),
    year: year == null ? "" : String(year),
    make: make ?? "",
    model: model ?? "",
    spawnCode: spawn,
    category: library === "leo" ? "Law enforcement" : "Civilian",
    library,
    claimable: true,
    available: true,
    resource: resource ?? defaultResource,
    confidence,
    notes,
    liveries: LIVERIES[spawn] ?? "",
  };
}

export const DONATOR_PERSONALS = [
  ...LEO.map((row) => toRow("leo", "leopersonaldono", row)),
  ...CIV.map((row) => toRow("civ", "civpersonaldono", row)),
];
const BY_ID = Object.fromEntries(DONATOR_PERSONALS.map((v) => [v.id, v]));
// The two Compton cars ship metas but no stream files, so there is nothing to spawn.
for (const id of ["comptonpolice2", "comptonpolice3"]) {
  BY_ID[id].available = false;
  BY_ID[id].notes = `${BY_ID[id].notes} No stream files ship for this model, so it cannot spawn.`.trim();
}

/**
 * Brings the library up to date without ever overwriting an edit:
 *  1. inserts any personal that is not there yet (ON CONFLICT DO NOTHING);
 *  2. strips the "Built for <owner>" sentence the first import wrote into notes;
 *  3. fills in liveries where none are recorded;
 *  4. applies REVISIONS to rows still carrying their first-import name.
 * Returns how many rows were inserted, or null when there is no database.
 */
export async function ensureDonatorPersonals() {
  const cols = ["id", "name", "year", "make", "model", "spawn_code", "category", "library", "claimable", "available", "resource", "confidence", "notes", "liveries"];
  const values = [];
  const params = [];
  DONATOR_PERSONALS.forEach((v, i) => {
    const base = i * cols.length;
    values.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`);
    params.push(v.id, v.name, v.year, v.make, v.model, v.spawnCode, v.category, v.library, v.claimable, v.available, v.resource, v.confidence, v.notes, v.liveries);
  });
  let added;
  try {
    const rows = await query(
      `INSERT INTO dev_vehicles (${cols.join(", ")}) VALUES ${values.join(", ")}
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      params,
    );
    added = rows.length;
  } catch {
    return null;
  }

  try {
    await query(
      `UPDATE dev_vehicles SET notes = btrim(regexp_replace(notes, '^Built for .*? on the old server\\.', ''))
        WHERE notes LIKE 'Built for %'`,
    );
    const withLiveries = DONATOR_PERSONALS.filter((v) => v.liveries);
    if (withLiveries.length) {
      const list = withLiveries.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(", ");
      await query(
        `UPDATE dev_vehicles v SET liveries = s.liveries
           FROM (VALUES ${list}) AS s(id, liveries)
          WHERE v.id = s.id AND (v.liveries IS NULL OR v.liveries = '')`,
        withLiveries.flatMap((v) => [v.id, v.liveries]),
      );
    }
    for (const [id, firstName] of REVISIONS) {
      const v = BY_ID[id];
      if (!v) continue;
      await query(
        `UPDATE dev_vehicles SET name = $3, year = $4, make = $5, model = $6, confidence = $7, notes = $8, available = $9, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND name = $2`,
        [id, firstName, v.name, v.year, v.make, v.model, v.confidence, v.notes, v.available],
      );
    }
  } catch {
    // Best effort: the rows exist, the touch-ups can run again on the next boot.
  }
  return added;
}
