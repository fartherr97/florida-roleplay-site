/**
 * Seed data for the Civilian Hub, mirroring client/src/data/civilianHubData.js so
 * the API serves realistic responses before Postgres is populated. Every civilian
 * route falls back to these shapes.
 *
 * NOTE: this file is intentionally a copy of the client's civilian mock data. If
 * you change a shape in one, change it in the other.
 */

/* ------------------------------------------------------------------ *
 * Characters
 * ------------------------------------------------------------------ */

export const characters = [
  {
    id: "ch-1",
    name: "Elena Marquez",
    dob: "1996-04-12",
    occupation: "Paramedic — HCFR",
    residence: "Bayshore Apartments, Unit 12B",
    phone: "(813) 555-0147",
    bank: 42850,
    cash: 1240,
    status: "Active",
    joinedAt: "2025-11-03",
    primary: true,
  },
  {
    id: "ch-2",
    name: "Deshawn Carter",
    dob: "1991-09-30",
    occupation: "Mechanic — Gulf Coast Customs",
    residence: "Ybor Row House 4",
    phone: "(813) 555-0192",
    bank: 18300,
    cash: 620,
    status: "Active",
    joinedAt: "2026-02-18",
    primary: false,
  },
];

/* ------------------------------------------------------------------ *
 * Vehicles
 * ------------------------------------------------------------------ */

export const vehicles = [
  { id: "v-1", plate: "FLRP 114", make: "Chevrolet", model: "Corvette C7", year: 2019, colour: "Torch Red", owner: "Elena Marquez", garage: "Bayshore Parking", status: "Stored", insured: true, registeredUntil: "2027-04-01" },
  { id: "v-2", plate: "GULF 09", make: "Ford", model: "F-150 Lightning", year: 2023, colour: "Antimatter Blue", owner: "Elena Marquez", garage: "Impounded — Tampa PD", status: "Impounded", insured: true, registeredUntil: "2026-12-14" },
  { id: "v-3", plate: "YBOR 77", make: "Nissan", model: "Silvia S15", year: 2000, colour: "Matte Grey", owner: "Deshawn Carter", garage: "Gulf Coast Customs", status: "Out", insured: false, registeredUntil: "2026-09-30" },
  { id: "v-4", plate: "BAY 2210", make: "Harley-Davidson", model: "Road King", year: 2021, colour: "Vivid Black", owner: "Deshawn Carter", garage: "Ybor Row House 4", status: "Stored", insured: true, registeredUntil: "2027-01-22" },
];

/* ------------------------------------------------------------------ *
 * Properties
 * ------------------------------------------------------------------ */

export const properties = [
  { id: "p-1", address: "Bayshore Apartments, Unit 12B", type: "Apartment", owner: "Elena Marquez", district: "Bayshore", purchasedAt: "2025-12-02", value: 185000, garageSlots: 2, status: "Owned" },
  { id: "p-2", address: "Ybor Row House 4", type: "Row house", owner: "Deshawn Carter", district: "Ybor City", purchasedAt: "2026-03-11", value: 240000, garageSlots: 3, status: "Owned" },
  { id: "p-3", address: "Causeway Storage Unit 31", type: "Storage", owner: "Elena Marquez", district: "Courtney Campbell", purchasedAt: "2026-05-27", value: 32000, garageSlots: 0, status: "Rented" },
];

/* ------------------------------------------------------------------ *
 * Licences
 * ------------------------------------------------------------------ */

export const licences = [
  { id: "l-1", type: "Driver Licence", holder: "Elena Marquez", number: "D-4471-882", issuedAt: "2025-11-05", expiresAt: "2027-11-05", status: "Valid", points: 2 },
  { id: "l-2", type: "Commercial Licence", holder: "Elena Marquez", number: "C-1180-334", issuedAt: "2026-01-19", expiresAt: "2027-01-19", status: "Valid", points: 0 },
  { id: "l-3", type: "Firearms Permit", holder: "Elena Marquez", number: "F-9902-118", issuedAt: "2026-04-02", expiresAt: "2026-10-02", status: "Expiring", points: 0 },
  { id: "l-4", type: "Driver Licence", holder: "Deshawn Carter", number: "D-7719-045", issuedAt: "2026-02-20", expiresAt: "2028-02-20", status: "Valid", points: 6 },
  { id: "l-5", type: "Pilot Licence", holder: "Deshawn Carter", number: "P-3341-770", issuedAt: "2026-06-08", expiresAt: "2026-08-08", status: "Suspended", points: 0 },
  { id: "l-6", type: "Fishing Permit", holder: "Deshawn Carter", number: "H-2204-651", issuedAt: "2026-07-14", expiresAt: "2027-07-14", status: "Valid", points: 0 },
];

/* ------------------------------------------------------------------ *
 * Business directory
 * ------------------------------------------------------------------ */

export const businesses = [
  { id: "b-1", name: "Gulf Coast Customs", category: "Automotive", owner: "Deshawn Carter", district: "Ybor City", phone: "(813) 555-0192", hiring: true, blurb: "Full performance and cosmetic shop — engine swaps, liveries and dyno tuning, walk-ins welcome." },
  { id: "b-2", name: "Bayshore Coffee House", category: "Hospitality", owner: "Marisol Vega", district: "Bayshore", phone: "(813) 555-0231", hiring: true, blurb: "Independent roastery on the waterfront. Open from 6am, and the only place in town doing a proper cortado." },
  { id: "b-3", name: "Causeway Marina", category: "Marine", owner: "Hal Brennan", district: "Courtney Campbell", phone: "(813) 555-0388", hiring: false, blurb: "Slip rental, fuel and charter bookings across Tampa Bay. Dive charters run at weekends." },
  { id: "b-4", name: "Ybor Ink", category: "Retail", owner: "Priya Sandoval", district: "Ybor City", phone: "(813) 555-0410", hiring: false, blurb: "Tattoo and piercing studio. Custom flash by appointment, walk-ins after 8pm." },
  { id: "b-5", name: "Sunshine Realty", category: "Property", owner: "Ted Okafor", district: "Downtown", phone: "(813) 555-0455", hiring: true, blurb: "Residential and commercial listings across the county, plus rental management." },
  { id: "b-6", name: "Palm & Pine Legal", category: "Professional", owner: "Rosalind Achebe", district: "Downtown", phone: "(813) 555-0502", hiring: true, blurb: "Criminal defence and civil representation. Duty solicitor on call for arraignments." },
];

/* ------------------------------------------------------------------ *
 * Job board
 * ------------------------------------------------------------------ */

export const jobs = [
  { id: "j-1", title: "Tow Truck Operator", business: "Gulf Coast Customs", category: "Automotive", pay: "$180 / recovery", type: "Casual", postedAt: "2026-08-20", blurb: "Recover breakdowns and impounds across the county. Own transport to the shop required; truck provided on shift." },
  { id: "j-2", title: "Barista — Morning Shift", business: "Bayshore Coffee House", category: "Hospitality", pay: "$1,450 / week", type: "Part time", postedAt: "2026-08-18", blurb: "5:30am starts, four days a week. Training provided, but a friendly presence at that hour is not teachable." },
  { id: "j-3", title: "Paralegal", business: "Palm & Pine Legal", category: "Professional", pay: "$3,200 / week", type: "Full time", postedAt: "2026-08-15", blurb: "Case prep, filings and client intake. Comfortable reading the penal code and keeping a straight face in arraignment." },
  { id: "j-4", title: "Letting Agent", business: "Sunshine Realty", category: "Property", pay: "Commission", type: "Full time", postedAt: "2026-08-11", blurb: "Show listings, run viewings and close rentals. Commission-only, uncapped, driver licence required." },
  { id: "j-5", title: "Dive Charter Deckhand", business: "Causeway Marina", category: "Marine", pay: "$2,100 / week", type: "Seasonal", postedAt: "2026-08-04", blurb: "Weekend charters through to October. Boating licence preferred; sea legs mandatory." },
];

/* ------------------------------------------------------------------ *
 * Classifieds
 * ------------------------------------------------------------------ */

export const classifieds = [
  { id: "c-1", title: "2019 Corvette C7 — low mileage", category: "Vehicles", price: "$74,000", seller: "Elena Marquez", phone: "(813) 555-0147", postedAt: "2026-08-22", blurb: "Torch Red, garage kept, full service history. Selling only because the insurance is eating me alive." },
  { id: "c-2", title: "Garage space for rent — Ybor", category: "Property", price: "$450 / month", seller: "Deshawn Carter", phone: "(813) 555-0192", postedAt: "2026-08-21", blurb: "Single covered slot behind the row house. Secure gate, 24-hour access, no commercial storage." },
  { id: "c-3", title: "Fishing gear — full set", category: "Goods", price: "$620", seller: "Hal Brennan", phone: "(813) 555-0388", postedAt: "2026-08-19", blurb: "Two rods, tackle box, cooler and a licence-transfer receipt. Collection from the marina only." },
  { id: "c-4", title: "Wanted: bodywork on an S15", category: "Wanted", price: "Negotiable", seller: "Ivy Sørensen", phone: "(813) 555-0526", postedAt: "2026-08-17", blurb: "Rear quarter needs straightening after a causeway incident I would rather not detail. Cash waiting." },
  { id: "c-5", title: "Bayshore apartment — short let", category: "Property", price: "$1,800 / month", seller: "Ted Okafor", phone: "(813) 555-0455", postedAt: "2026-08-13", blurb: "Furnished one-bed with water views. Three-month minimum, references required." },
];

/* ------------------------------------------------------------------ *
 * Penal code
 * ------------------------------------------------------------------ */

export const penalCode = [
  { code: "P-101", title: "Petty theft", degree: "Misdemeanour", fine: "$500", jail: "5 minutes", points: 0, notes: "Property valued under $1,000 taken without consent." },
  { code: "P-114", title: "Grand theft auto", degree: "Felony", fine: "$4,000", jail: "25 minutes", points: 0, notes: "Taking a vehicle without the owner's consent. Recovery fees are charged separately." },
  { code: "P-203", title: "Reckless driving", degree: "Misdemeanour", fine: "$900", jail: "10 minutes", points: 4, notes: "Wilful disregard for the safety of persons or property on a public road." },
  { code: "P-207", title: "Failure to stop for law enforcement", degree: "Felony", fine: "$2,500", jail: "20 minutes", points: 6, notes: "Continuing after lights and siren. Charged per pursuit, not per unit involved." },
  { code: "P-215", title: "Driving without a valid licence", degree: "Infraction", fine: "$450", jail: "—", points: 2, notes: "Includes suspended and expired licences." },
  { code: "P-302", title: "Assault", degree: "Misdemeanour", fine: "$1,200", jail: "15 minutes", points: 0, notes: "Unlawful threat or attempt to injure another person." },
  { code: "P-311", title: "Aggravated assault with a firearm", degree: "Felony", fine: "$6,000", jail: "40 minutes", points: 0, notes: "Assault committed with a deadly weapon. Firearms permit is revoked on conviction." },
  { code: "P-404", title: "Possession of an unregistered firearm", degree: "Felony", fine: "$3,500", jail: "25 minutes", points: 0, notes: "Weapon not recorded against a valid permit." },
  { code: "P-512", title: "Trespassing", degree: "Infraction", fine: "$350", jail: "—", points: 0, notes: "Remaining on private or restricted property after being asked to leave." },
  { code: "P-620", title: "Obstruction of justice", degree: "Misdemeanour", fine: "$1,500", jail: "15 minutes", points: 0, notes: "Interfering with an officer carrying out their duties, including a scene cordon." },
];

/* ------------------------------------------------------------------ *
 * Civilian guides
 * ------------------------------------------------------------------ */

export const guides = [
  { slug: "first-day", title: "Your first day as a civilian", category: "Getting Started", readingTime: "4 min", summary: "Spawn at the DMV, pass the practical test, get a licence and pick up your first vehicle." },
  { slug: "buying-a-vehicle", title: "Buying, insuring and registering a vehicle", category: "Vehicles", readingTime: "5 min", summary: "Dealership vs private sale, what insurance actually covers, and how impound fees are calculated." },
  { slug: "renting-and-buying", title: "Renting and buying property", category: "Property", readingTime: "4 min", summary: "How listings work, what garage slots mean, and the difference between owning and renting." },
  { slug: "getting-a-job", title: "Finding work", category: "Employment", readingTime: "3 min", summary: "Applying through the job board, what employers look for, and starting your own business." },
  { slug: "traffic-stops", title: "What to do in a traffic stop", category: "Law", readingTime: "3 min", summary: "Your rights, what officers expect, and how points against your licence accumulate." },
  { slug: "licences-explained", title: "Every licence and permit explained", category: "Law", readingTime: "4 min", summary: "Driver, commercial, firearms, pilot and hunting permits — what each allows and how to renew." },
];
