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
 * `previous` is who the car was built for on the old server. It is kept as an
 * internal note for the people activating claims and is never shown to members.
 */
import { query } from "./db.js";

/* [spawn, year, make, model, confidence, hint, previous owner, resource] */
const LEO = [
  ["hcco98", 2023, "Chevrolet", "Suburban (unmarked)", "high", "uc23suburban modkit, Tahoe 5.3 audio", "Jackson"],
  ["leopersonal101", 2018, "Dodge", "Charger (GSP livery)", "medium", "18DODGE, gspcharger", "Walker"],
  ["leopersonal102", 2018, "Dodge", "Charger", "medium", "18DODGE. Two owners' metas share this spawn name in the pack (Hanson, Sartor)", "Hanson / Sartor"],
  ["leopersonal103", 2023, "Chevrolet", "Camaro", "high", "23camb modkit", "Jamison"],
  ["leopersonal105", 2024, "Ford", "F-150 Raptor R (slicktop)", "high", "24raptorrslick modkit", "Bradley"],
  ["leopersonal106", 2024, "Ford", "F-150 Raptor R", "high", "24raptorr modkit", "Joe"],
  ["leopersonal1", null, "Cadillac", "Escalade-V (Mansory)", "low", "Two conflicting metas in the pack: Valentino (Cadillac, Mansory Escalade kit) and Travus (TTPD, ambulance audio). Confirm in game", "Valentino / Travus"],
  ["leopersonal10", null, "Ford", "Expedition", "medium", "FORD, Landstalker audio", "Beck"],
  ["leopersonal11", null, "Ford", "F-Series brush truck", "low", "fd7, Vapid, 6.0 Powerstroke audio, brush-truck interior", "ASmith"],
  ["leopersonal12", 2011, "Ford", "Crown Victoria Police Interceptor", "medium", "legcvpi", "Ford"],
  ["leopersonal13", null, "Ford", "Crown Victoria (retro)", "medium", "retrodono, CVPI V8 audio", "Gray"],
  ["leopersonal14", 2025, "Dodge", "Durango Pursuit", "high", "hab25durango modkit", "Rogue"],
  ["leopersonal15", null, "Dodge", "Charger", "low", "TTPD, Windsor audio only", "Littleton"],
  ["leopersonal16", null, "Chevrolet", "Tahoe Z71", "medium", "CHEVROLETz71, Granger audio", "Lean"],
  ["leopersonal17", 2020, "Ford", "F-250 Super Duty", "medium", "20FORD, diesel audio", "Tompkins"],
  ["leopersonal18", null, "Dodge", "Charger SRT Hellcat Redeye", "medium", "Hellcat Redeye audio", "Fiddle"],
  ["leopersonal19", null, "Unknown", "", "low", "No model hints (stream folder also holds leopersonal18 files)", "hardee"],
  ["leopersonal20", 2020, "Dodge", "Durango (slicktop)", "high", "slick20durango modkit", "Morgan"],
  ["leopersonal21", 2019, "Dodge", "Charger", "medium", "19DODGE", "Love"],
  ["leopersonal22", null, "Dodge", "Viper SRT", "medium", "SRT, Viper audio", "Maverick"],
  ["leopersonal23", null, "Ford", "F-150", "low", "Ford, Sadler audio", "Greg"],
  ["leopersonal24", 2018, "Chevrolet", "Silverado 1500", "low", "slr181500 modkit (RedSaint), F-150 Coyote audio", "Sartor"],
  ["leopersonal25", null, "Dodge", "Challenger SRT Demon", "medium", "Dodge, Demon V8 audio", "Velis"],
  ["leopersonal26", 2020, "Dodge", "Charger", "high", "2020charger modkit", "Dewster"],
  ["leopersonal27", null, "Dodge", "Challenger SRT Demon", "medium", "Dodge, Demon V8 audio", "Rider"],
  ["leopersonal29", null, "GMC", "Sierra 3500 AT4", "high", "make field", "Dahmer"],
  ["leopersonal2", null, "Dodge", "Charger", "low", "Charger V8 audio only", "Sloane"],
  ["leopersonal30", 2021, "Dodge", "Charger", "medium", "21DODGE", "Dawson"],
  ["leopersonal31", null, "BMW", "i4 Gran Coupe", "high", "bmwi4gc modkit, electric audio", "Donahue"],
  ["leopersonal32", null, "Ford", "Crown Victoria (retro)", "medium", "retrodono, CVPI V8 audio", "Mitcham"],
  ["leopersonal33", 2021, "Dodge", "Charger", "medium", "21DODGE", "Hanson"],
  ["leopersonal34", 2023, "Chevrolet", "Tahoe (slicktop)", "high", "slick23tahoe modkit", "Mike"],
  ["leopersonal35", null, "Ford", "", "low", "FORD, Sentinel audio", "Diesel"],
  ["leopersonal36", null, "GMC", "", "low", "GMC, Chiron audio", "Benji"],
  ["leopersonal37", null, "Unknown", "", "low", "Windsor audio only", "Conway"],
  ["leopersonal38", null, "Ford", "Mustang (classic)", "low", "retrodono, Ellie audio", "Workman"],
  ["leopersonal39", 2020, "Ford", "F-550 Ambulance (Black Diamond box)", "high", "f550ambow modkit", "Winter"],
  ["leopersonal3", 2025, "Ford", "Police Interceptor Utility (slicktop)", "high", "25legfpiustbb modkit", "SJackson"],
  ["leopersonal40", 2023, "Dodge", "Charger", "high", "hab23chargerb modkit", "Boomhaurr"],
  ["leopersonal41", 2025, "Ford", "Police Interceptor Utility", "high", "25fpiubb modkit", "Terk"],
  ["leopersonal43", 2019, "Chevrolet", "Tahoe", "low", "19CHEVY, m14tahoe modkit", "Mag"],
  ["leopersonal44", 2021, "Dodge", "Durango", "high", "21DODGE, Durango animations", "BMan"],
  ["leopersonal45", 2025, "Ford", "Police Interceptor Utility", "high", "25legfpiubb modkit", "Young"],
  ["leopersonal46", null, "Unknown", "", "low", "retrodono, no model hints", "Houge"],
  ["comptonpolice2", null, "Chevrolet", "Caprice (classic)", "low", "Buccaneer audio", "Houge"],
  ["comptonpolice3", null, "Chevrolet", "Caprice (classic)", "low", "Buccaneer audio", "Houge"],
  ["leopersonal48", null, "Dodge", "Charger", "low", "Buffalo2 audio, make c3vcat", "Blake"],
  ["leopersonal49", 2021, "Chevrolet", "Tahoe PPV", "high", "sosst21tahoe modkit", "Hern"],
  ["leopersonal4", null, "Chevrolet", "Camaro", "medium", "Chevy, Gauntlet audio", "Douglas"],
  ["leopersonal50", null, "Dodge", "Charger (unmarked)", "medium", "uc_chargerb modkit", "Patterson"],
  ["leopersonal52", null, "Unknown", "", "low", "fd7, diesel audio", "ASmith"],
  ["leopersonal53", 2023, "Dodge", "Charger", "low", "hard23charger modkit, but 2018 F-150 parts in the stream folder", "Black"],
  ["leopersonal54", null, "Chevrolet", "Tahoe", "low", "Granger audio", "Prim"],
  ["leopersonal56", 2020, "Ford", "F-350 Super Duty", "high", "20FORD, 350eod modkit", "LiamOwner"],
  ["leopersonal59", null, "Chevrolet", "Tahoe Z71", "high", "gameName TAHOE, CHEVROLETz71", "LiamTahoe"],
  ["leopersonal5", null, "GMC", "Sierra 3500 AT4", "high", "make field", "DJackson"],
  ["leopersonal60", null, "Unknown", "Ambulance (Black Diamond box)", "low", "box and bumper parts, fbi2 audio", "Conway2"],
  ["leopersonal69", null, "Lamborghini", "Urus", "medium", "Urus V8 audio", "Joe"],
  ["leopersonal6", null, "Chevrolet", "Tahoe Z71", "medium", "CHEVROLETz71, Granger audio", "McClane"],
  ["leopersonal74", null, "Unknown", "", "low", "no model hints", "Young"],
  ["leopersonal77", null, "Chevrolet", "Tahoe", "low", "Granger audio", "Streets"],
  ["leopersonal7", null, "Chevrolet", "Tahoe Z71", "medium", "CHEVROLETz71, Granger audio", "FLean"],
  ["leopersonal80", null, "Unknown", "", "low", "no model hints", "Dewster"],
  ["leopersonal81", 2018, "Dodge", "Charger", "medium", "18DODGE", "McClane"],
  ["leopersonal82", 2023, "Chevrolet", "Camaro (Heat)", "high", "23heatcambb modkit, Camaro animations", "Cooper"],
  ["leopersonal83", null, "Subaru", "WRX", "low", "Sultan audio", "Broker"],
  ["leopersonal84", null, "Ford", "Expedition", "high", "gameName Expedition", "Workman"],
  ["leopersonal85", 2019, "Chevrolet", "Corvette", "high", "19corvette modkit", "HJackson"],
  ["leopersonal86", null, "Unknown", "", "low", "Windsor audio only", "Holmes"],
  ["leopersonal87", 2023, "Dodge", "Charger", "high", "hab23charger modkit", "Bobby"],
  ["leopersonal88", 2020, "Dodge", "Charger", "high", "2020charger modkit", "HJackson"],
  ["leopersonal89", null, "Porsche", "911", "medium", "PORSCHE, Comet audio", "Williams"],
  ["leopersonal8", null, "Ford", "Mustang", "medium", "FORD, Dominator audio", "Hitchcock"],
  ["leopersonal90", 2023, "Chevrolet", "Silverado Custom", "high", "SilveradoCustom, 23silvmethod animations", "Roberts"],
  ["leopersonal91", null, "Ford", "Crown Victoria (retro)", "medium", "retrodono, CVPI V8 audio", "King"],
  ["leopersonal92", 2020, "Ford", "Police Interceptor Utility", "medium", "fed20suv / fed21suv modkits", "Ford"],
  ["leopersonal93", null, "Dodge", "Challenger SRT Demon", "medium", "Dodge, Demon V8 audio", "JMorgan"],
  ["leopersonal94", null, "Unknown", "", "low", "no model hints", "Hardee"],
  ["leopersonal95", 2025, "Ford", "F-150 (slicktop)", "low", "c325ssslick, F-150 Coyote audio", "T. Smith"],
  ["leopersonal97", null, "Chevrolet", "Tahoe (2000s)", "medium", "retrodono, Tahoe 5.3 V8 audio", "Beck"],
  ["leopersonal96", 2025, "Dodge", "Durango", "high", "hard25durango modkit", "Streets"],
  ["leopersonal98", null, "Unknown", "", "low", "Sentinel audio only", "Gregory"],
  ["leopersonal99", 2024, "Ford", "Mustang GT", "high", "24mustgt modkit", "Morgan"],
  ["leopersonal9", 2025, "Ford", "Police Interceptor Utility", "high", "nn25fpiu modkit", "Xavier"],
  ["leopersonal47", null, "Unknown", "Ambulance", "low", "escrowed single, ambulance audio", "", "leopersonal47"],
  ["jacksontow112", null, "Unknown", "Heavy wrecker (tow truck)", "low", "escrowed single, Chernobog audio", "Jackson", "jacksontow112"],
  ["jacksontow389", null, "Peterbilt", "389 wrecker", "medium", "escrowed single, 389 modkit and parts", "Jackson", "jacksontow389"],
];

const CIV = [
  ["civpersonal11", null, "Jeep", "Grand Cherokee Trackhawk", "medium", "JEEP, Hellcat Redeye audio", "Aaron"],
  ["civpersonal12", null, "Nissan", "GT-R (R35)", "high", "r35 modkit", "Vzbez"],
  ["civpersonal13", null, "Unknown", "(iKX3 build)", "low", "iKX3, Jugular audio", "mikey"],
  ["civpersonal14", null, "BMW", "", "low", "BMW, Comet audio", "Audi"],
  ["civpersonal15", null, "Jeep", "Wrangler", "medium", "Jeep, Kamacho audio", "Morris"],
  ["civpersonal16", null, "Subaru", "WRX STI (GD)", "high", "GDWRXSTI", "tcorc"],
  ["civpersonal17", null, "Dodge", "(custom, sjdodge)", "low", "sjdodge modkit", "Gio"],
  ["civpersonal19", 2023, "Ford", "F-150 Shelby", "high", "dill23shelbyf150 modkit", "Johnson"],
  ["civpersonal1", null, "Honda", "Civic EG6 (Spoon)", "high", "eg6 modkit, SPOON", "Toliver"],
  ["civpersonal20", null, "Unknown", "Motorcycle (custom)", "low", "Bikermods, Cliffhanger audio", "Workman"],
  ["civpersonal21", null, "Shelby", "Cobra (twin turbo)", "low", "gtwinturbocobra modkit", "Kad"],
  ["civpersonal22", null, "Ford", "F-150 (boosted)", "medium", "boostf150v2 modkit", "Toxic"],
  ["civpersonal23", null, "Harley-Davidson", "Bagger", "high", "HARLEY, bagger audio", "Jacob"],
  ["civpersonal24", 2022, "Dodge", "Charger (Demon)", "high", "gameName '2022 Dodge Charger Demon'", "Will"],
  ["civpersonal25", null, "Subaru", "WRX", "high", "subwrx modkit", "JWalsh"],
  ["civpersonal26", 2016, "Dodge", "Challenger", "high", "16challenger modkit", "JAdams"],
  ["civpersonal28", null, "Dodge", "Charger SRT Hellcat", "low", "hellcatom modkit", "Brown"],
  ["civpersonal29", null, "Unknown", "SUV", "low", "Astron audio", "Raj"],
  ["civpersonal2", null, "Ford", "F-450 Platinum", "high", "f450plat modkit", "Colten"],
  ["civpersonal30", 2019, "Subaru", "WRX", "high", "wrx19 modkit", "Rocco (Gio)"],
  ["civpersonal31", null, "BMW", "M3 (E92)", "high", "e92 liveries", "Winters"],
  ["civpersonal32", null, "Chevrolet", "Corvette", "medium", "CHEVY, Coquette audio", "Benza"],
  ["civpersonal33", null, "BMW", "M4 (Liberty Walk)", "high", "m4lb parts", "Monkey"],
  ["civpersonal34", null, "Honda", "Civic Ferio", "high", "ferio modkit", "Price"],
  ["civpersonal35", null, "Unknown", "Supercar", "low", "Turismo R audio", "Mossiswashed"],
  ["civpersonal36", null, "Chevrolet", "(LT4)", "low", "serpeg8, LT4 audio", "Mitcham"],
  ["civpersonal37", null, "Dodge", "Charger SRT Hellcat (custom)", "medium", "playanorrischar, Hellcat Redeye audio", "Aaron"],
  ["civpersonal38", null, "Subaru", "WRX STI", "high", "gameName WRX STI", "Mitcham"],
  ["civpersonal39", 2023, "Dodge", "Durango (Hennessey)", "high", "23HennesseyDurango modkit", "Winters"],
  ["civpersonal3", null, "BMW", "S1000RR", "high", "jcm1000rr modkit", "Cactzz"],
  ["civpersonal40", null, "Mazda", "MX-5 Miata (NA6)", "high", "na6 modkit", "Jeff"],
  ["civpersonal41", 2020, "Dodge", "Charger", "high", "gameName Charger2020", "PS4"],
  ["civpersonal42", null, "Lexus", "IS350", "high", "gameName IS350", "twist"],
  ["civpersonal43", 2023, "BMW", "M2", "high", "gameName '2023 BMW M2'", "hardworktt"],
  ["civpersonal44", null, "BMW", "M5", "medium", "m5ikx3, S58 audio", "Schizo"],
  ["civpersonal45", null, "Nissan", "GT-R (R35)", "high", "r35 modkit, VR38DETT audio", "J. Goods"],
  ["civpersonal46", 2016, "Cadillac", "CTS-V", "high", "ctsv16 modkit", "audi"],
  ["civpersonal47", null, "Ford", "GT", "medium", "fgt modkit, Voodoo audio", "Gage"],
  ["civpersonal48", 2016, "Dodge", "Charger", "high", "gameName 16charger", "Audi"],
  ["civpersonal49", null, "Cadillac", "Escalade", "medium", "CADILLAC, Cavalcade audio", "Diesel"],
  ["civpersonal4", null, "Audi", "RS6 Avant", "medium", "avant, Tailgater audio", "Comrade"],
  ["civpersonal50", null, "Chevrolet", "Corvette C7", "high", "c7 modkit, LT4 audio", "Gage"],
  ["civpersonal52", 2023, "Mercedes-AMG", "C63 S E Performance", "high", "c63seperfor23 modkit", "Will"],
  ["civpersonal53", null, "Jeep", "Grand Cherokee Trackhawk", "high", "trhawk modkit", "Price"],
  ["civpersonal54", null, "Ferrari", "Purosangue", "high", "Purosangue animations", "Cedar"],
  ["civpersonal55", 2022, "Cadillac", "CT5-V Blackwing", "high", "ct5vbw22 animations", "Toliver"],
  ["civpersonal57", null, "Dodge", "Challenger SRT Demon", "medium", "Dodge, Demon V8 audio", "FC ACE"],
  ["civpersonal59", null, "BMW", "M3 CSL (iKX3)", "low", "cslikx3", "Mikey"],
  ["civpersonal5", null, "Kawasaki", "Ninja H2", "medium", "KAWASAKI, jet audio", "Cross"],
  ["civpersonal60", null, "Lamborghini", "Urus", "low", "Urus V8 audio", "Silva"],
  ["civpersonal61", null, "Mercedes-Benz", "G63 AMG", "medium", "Dubsta audio", "Workman"],
  ["civpersonal63", null, "Porsche", "911", "low", "Comet audio", "Raj"],
  ["civpersonal64", null, "Kawasaki", "Ninja H2", "medium", "KAWASAKI, jet audio", "Colten"],
  ["civpersonal65", null, "Dodge", "Charger SXT", "high", "dchargersxt", "Winters"],
  ["civpersonal66", null, "BMW", "M4 (G82)", "low", "iKX3, S58 audio", "Schizo"],
  ["civpersonal6", null, "GMC", "Canyon AT4X", "high", "gameName Canyon AT4X", "Silva"],
  ["civpersonal7", 2021, "Chevrolet", "Flatbed truck", "low", "21C, Flatbed audio", "Liam"],
  ["civpersonal8", null, "Chevrolet", "Silverado 2500", "high", "Silv2500", "Cooper"],
  ["civpersonal9", null, "Unknown", "Supercar", "low", "VERSUS, XA-21 audio", "Kompo"],
  ["marcobuck", 2012, "Chrysler", "300 SRT8", "high", "make field", "Marco"],
  ["civpersonal10", null, "Unknown", "Heavy truck", "low", "escrowed single, Chernobog audio", "", "civpersonal10"],
  ["civpersonal51", null, "Peterbilt", "389", "medium", "escrowed single, 389 parts", "", "civpersonal51"],
  ["civpersonal56", null, "Unknown", "Heavy truck", "low", "escrowed single, Chernobog audio", "", "civpersonal56"],
];

function toRow(library, defaultResource, [spawn, year, make, model, confidence, hint, previous, resource]) {
  const parts = [year, make, model].filter((p) => p != null && String(p).trim() !== "");
  const known = make && make.toLowerCase() !== "unknown";
  const name = known ? parts.join(" ") : model ? `Unidentified ${model.toLowerCase()}` : "Unidentified vehicle";
  const notes = [
    previous ? `Built for ${previous} on the old server.` : "",
    hint ? `Identified from ${hint}.` : "",
    confidence !== "high" ? "Confirm the year, make and model in game." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    id: spawn,
    name,
    year: year == null ? "" : String(year),
    make: make ?? "",
    model: model ?? "",
    spawnCode: spawn,
    category: library === "leo" ? "Law enforcement" : "Civilian",
    library,
    claimable: true,
    resource: resource ?? defaultResource,
    confidence,
    notes,
  };
}

export const DONATOR_PERSONALS = [
  ...LEO.map((row) => toRow("leo", "leopersonaldono", row)),
  ...CIV.map((row) => toRow("civ", "civpersonaldono", row)),
];

/**
 * Inserts any personal that is not in the library yet. Idempotent and
 * insert-only: a row that exists — edited or not — is left exactly as it is.
 * Returns how many rows were added, or null when there is no database.
 */
export async function ensureDonatorPersonals() {
  const cols = ["id", "name", "year", "make", "model", "spawn_code", "category", "library", "claimable", "resource", "confidence", "notes"];
  const values = [];
  const params = [];
  DONATOR_PERSONALS.forEach((v, i) => {
    const base = i * cols.length;
    values.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`);
    params.push(v.id, v.name, v.year, v.make, v.model, v.spawnCode, v.category, v.library, v.claimable, v.resource, v.confidence, v.notes);
  });
  try {
    const rows = await query(
      `INSERT INTO dev_vehicles (${cols.join(", ")}) VALUES ${values.join(",\n")}
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      params,
    );
    return rows.length;
  } catch {
    return null;
  }
}
