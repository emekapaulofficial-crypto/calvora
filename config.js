/* CALVORA PROPERTY SOLUTIONS: business details shown on the website.
   Edit ONLY this file to change contact details, the footer and the bank details.
   A line left empty ("") is simply not shown, so nothing unconfirmed is ever published. */
window.SITE = {
  name: "Calvora Property Solutions",
  brand: "CALVORA",
  tagline: "Property. Trust. Opportunity.",
  domain: "www.calvora.com.ng",
  rcNumber: "",               // add after CAC approves, for example "RC 1234567". Then the footer shows "Ltd" and the RC number
  pilot: { city: "Ado-Ekiti", state: "Ekiti State" },
  office: {
    address: "",              // street address, add when there is an office
    phone: "+234 904 747 0202",
    whatsapp: "2349047470202",   // international format, no plus sign
    email: "",                // company email, add when it exists
    hours: ""                 // for example "Monday to Saturday, 8am to 5pm"
  },
  social: { facebook: "", instagram: "", tiktok: "" },   // full page links, shown only when filled in
  // Bank transfer details. Leave empty until the company account exists.
  bank: { bankName: "", accountName: "", accountNumber: "" },
  // Public (publishable) key only. NEVER put a service_role key here or anywhere in GitHub.
  supabase: {
    url: "https://holnihsidzrezgoiwerc.supabase.co",
    key: "sb_publishable_3mm4oBhqP9Dmu13sUcgjMw_CHMETNJE"
  },
  availabilityDays: 30        // a listing not re-confirmed for this many days shows "Availability Confirmation Pending"
};
