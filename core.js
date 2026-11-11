/* CALVORA shared helpers: data access, formatting, badges, header, footer, listing cards.
   Public pages talk to Supabase through its plain web API (no library needed, so pages stay light). */
(function () {
  "use strict";
  var S = window.SITE || {};
  var CV = (window.CV = {});
  var API = (S.supabase && S.supabase.url ? S.supabase.url.replace(/\/$/, "") : "") + "/rest/v1/";
  var KEY = S.supabase && S.supabase.key;

  /* ---------- data access ---------- */
  function headers(extra) {
    var h = { apikey: KEY, "Content-Type": "application/json" };
    for (var k in extra || {}) h[k] = extra[k];
    return h;
  }
  async function readError(r) {
    var msg = "Something went wrong (" + r.status + ")";
    try { var j = await r.json(); if (j && j.message) msg = j.message; } catch (e) {}
    var err = new Error(msg); err.status = r.status; return err;
  }
  /** GET a table or view. Returns {rows, total}. */
  CV.get = async function (path, countAll) {
    var r = await fetch(API + path, { headers: headers(countAll ? { Prefer: "count=exact" } : {}) });
    if (!r.ok) throw await readError(r);
    var rows = await r.json(), total = rows.length;
    var cr = r.headers.get("content-range");
    if (cr && /\/(\d+)$/.test(cr)) total = parseInt(RegExp.$1, 10);
    return { rows: rows, total: total };
  };
  /** Call a database function (RPC). */
  CV.rpc = async function (name, args) {
    var r = await fetch(API + "rpc/" + name, { method: "POST", headers: headers(), body: JSON.stringify(args || {}) });
    if (!r.ok) throw await readError(r);
    var t = await r.text();
    try { return t ? JSON.parse(t) : null; } catch (e) { return t; }
  };

  /* ---------- small helpers ---------- */
  CV.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var esc = CV.esc;
  CV.naira = function (n) {
    n = Number(n);
    if (!isFinite(n)) return "";
    return "₦" + Math.round(n).toLocaleString("en-NG");
  };
  CV.date = function (d) {
    if (!d) return "";
    var x = new Date(d); if (isNaN(x)) return "";
    return x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  CV.initials = function (name) {
    var p = String(name || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  };
  CV.qs = function () { return new URLSearchParams(location.search); };
  CV.waLink = function (text) {
    var n = (S.office && S.office.whatsapp) || "";
    return n ? "https://wa.me/" + n + "?text=" + encodeURIComponent(text || "") : "";
  };
  CV.telLink = function () {
    var p = (S.office && S.office.phone) || "";
    return p ? "tel:" + p.replace(/[^0-9+]/g, "") : "";
  };
  CV.isUuid = function (s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || ""); };

  /* ---------- option lists ---------- */
  CV.HOUSE_TYPES = ["Self-contained", "Room or studio", "Mini flat", "Flat or apartment", "Terrace", "Semi-detached", "Duplex", "Bungalow", "Detached house"];
  CV.LAND_USE = ["Residential", "Commercial", "Agricultural", "Mixed-use", "Industrial"];
  CV.LAND_TITLES = ["Certificate of Occupancy (C of O)", "Governor's consent", "Registered deed", "Deed of assignment", "Survey plan only", "Family land receipt", "Gazette or excision"];
  CV.CATALOGUES = {
    rent: { page: "rent.html", listing_type: "rent", category: "house", label: "Houses for rent", short: "Rent" },
    buy: { page: "buy.html", listing_type: "sale", category: "house", label: "Houses for sale", short: "Buy" },
    land: { page: "lands.html", listing_type: "sale", category: "land", label: "Lands for sale", short: "Land" }
  };

  /* ---------- badges (four tiers, each a different design) ---------- */
  CV.BADGES = {
    Bronze: { meaning: "Newly registered, building track record", need: "Identity and registration checks completed, onboarding done" },
    Silver: { meaning: "Consistent verified activity", need: "5 approved listings, 1 completed transaction" },
    Gold: { meaning: "Strong performance and completed transactions", need: "15 approved listings, 3 completed transactions, rating 4.5 or more" },
    Diamond: { meaning: "Exceptional performance and reliability", need: "30 approved listings, 10 completed transactions, rating 4.7 or more" }
  };
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="cvBrz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D79A5B"/><stop offset="1" stop-color="#9A5A26"/></linearGradient>' +
    '<linearGradient id="cvBrzD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4219"/><stop offset="1" stop-color="#4E2A10"/></linearGradient>' +
    '<linearGradient id="cvSlvL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F6F8"/><stop offset="1" stop-color="#C9D0D8"/></linearGradient>' +
    '<linearGradient id="cvSlvD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AA4AF"/><stop offset="1" stop-color="#5F6A76"/></linearGradient>' +
    '<linearGradient id="cvSlvR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#8E99A5"/></linearGradient>' +
    '<linearGradient id="cvGld" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE27A"/><stop offset="1" stop-color="#C9961A"/></linearGradient>' +
    '<linearGradient id="cvGldD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E5B73B"/><stop offset="1" stop-color="#A57810"/></linearGradient>' +
    '<linearGradient id="cvDia" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F4B94"/><stop offset="1" stop-color="#0A2455"/></linearGradient>' +
    '<symbol id="cv-bg-bronze" viewBox="0 0 64 72">' +
    '<path d="M32 3 58 11v23c0 18-12 29-26 35C18 63 6 52 6 34V11z" fill="url(#cvBrzD)"/>' +
    '<path d="M32 9 52 15.5V34c0 14-9.5 23-20 28C21.500 57 12 48 12 34V15.500z" fill="url(#cvBrz)"/>' +
    '<polygon points="24,29 25.7,33.7 30.7,33.8 26.8,36.9 28.1,41.7 24,38.9 19.9,41.7 21.2,36.9 17.3,33.8 22.3,33.7" fill="#FBE6C4"/>' +
    '<polygon points="40,29 41.7,33.7 46.7,33.8 42.8,36.9 44.1,41.7 40,38.9 35.9,41.7 37.2,36.9 33.3,33.8 38.3,33.7" fill="#FBE6C4"/></symbol>' +
    '<symbol id="cv-bg-silver" viewBox="0 0 64 72">' +
    '<path d="M32 2 58 9.500V36L32 70 6 36V9.500z" fill="url(#cvSlvR)" stroke="#6E7884" stroke-width="1.200"/>' +
    '<path d="M32 8.500 52.500 14.500V34.500L32 63 11.500 34.500V14.500z" fill="url(#cvSlvD)"/>' +
    '<path d="M32 8.500 11.500 14.500V34.500L32 63z" fill="url(#cvSlvL)"/>' +
    '<path d="M32 8.500v54.500" stroke="#EEF1F4" stroke-width="1.500" opacity=".8"/>' +
    '<path d="M32 22l3.600 7.400 8.100 1.100-5.900 5.700 1.500 8.100L32 40.300l-7.300 3.900 1.500-8.100-5.900-5.700 8.100-1.100z" fill="#FFFFFF" opacity=".92"/></symbol>' +
    '<symbol id="cv-bg-gold" viewBox="0 0 64 72">' +
    '<path d="M18 46 11 69l9-4 5 6 6-22z" fill="url(#cvGldD)"/><path d="M46 46 53 69l-9-4-5 6-6-22z" fill="#C9961A"/>' +
    '<circle cx="32" cy="29" r="26" fill="none" stroke="url(#cvGld)" stroke-width="4.500" stroke-dasharray="3.200 2.400"/>' +
    '<circle cx="32" cy="29" r="22" fill="#FFF7D6" stroke="url(#cvGld)" stroke-width="3.500"/>' +
    '<path d="M32 15.500 44 20v9.500c0 7.500-5.500 12.500-12 15-6.500-2.500-12-7.500-12-15V20z" fill="url(#cvGld)" stroke="#B88512" stroke-width="1"/>' +
    '<path d="M25.500 29.500l5 5 9-10.500" fill="none" stroke="#FFFFFF" stroke-width="3.600" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="cv-bg-diamond" viewBox="0 0 64 72">' +
    '<g fill="url(#cvGld)"><ellipse cx="10" cy="26" rx="3" ry="6.500" transform="rotate(-28 10 26)"/><ellipse cx="7.500" cy="38" rx="3" ry="6.500" transform="rotate(-8 7.500 38)"/><ellipse cx="11.500" cy="50" rx="3" ry="6.500" transform="rotate(18 11.500 50)"/><ellipse cx="20" cy="60" rx="3" ry="6.500" transform="rotate(42 20 60)"/>' +
    '<ellipse cx="54" cy="26" rx="3" ry="6.500" transform="rotate(28 54 26)"/><ellipse cx="56.500" cy="38" rx="3" ry="6.500" transform="rotate(8 56.500 38)"/><ellipse cx="52.500" cy="50" rx="3" ry="6.500" transform="rotate(-18 52.500 50)"/><ellipse cx="44" cy="60" rx="3" ry="6.500" transform="rotate(-42 44 60)"/></g>' +
    '<path d="M32 4 52 11v22c0 15-9 24-20 29C21 57 12 48 12 33V11z" fill="url(#cvDia)" stroke="url(#cvGld)" stroke-width="3.500" stroke-linejoin="round"/>' +
    '<path d="M32 19 44 29 32 47 20 29z" fill="url(#cvGld)" stroke="#8E6A0E" stroke-width=".8"/><path d="M20 29h24M26 29l6-10 6 10-6 18z" fill="none" stroke="#FFF3B8" stroke-width=".9" stroke-linejoin="round"/></symbol>' +
    "</defs></svg>";
  CV.badge = function (name, w) {
    if (!CV.BADGES[name]) return "";
    w = w || 28;
    return '<svg class="bd-ic" width="' + w + '" height="' + Math.round(w * 72 / 64) + '" viewBox="0 0 64 72" role="img" aria-label="' + name + ' agent badge"><use href="#cv-bg-' + name.toLowerCase() + '"/></svg>';
  };
  CV.badgeChip = function (name, w) {
    return name ? '<span class="bdg-chip">' + CV.badge(name, w || 22) + "<b>" + esc(name) + "</b></span>" : "";
  };

  /* ---------- property status labels ----------
     Only what the database records is shown. "Verification Completed" needs all four checks. */
  CV.propLabel = function (p) {
    if (p.status === "rented" || p.status === "sold") return { text: "Closed or Unavailable", cls: "o", closed: true };
    var days = p.last_confirmed_at ? (Date.now() - new Date(p.last_confirmed_at).getTime()) / 864e5 : 999;
    if (days > (S.availabilityDays || 30)) return { text: "Availability Confirmation Pending", cls: "o" };
    if (p.checks_recorded >= 4) return { text: "Verification Completed", cls: "ok" };
    return { text: "CALVORA Checked", cls: "ok" };
  };
  CV.priceNote = function (p) { return p.listing_type === "rent" ? "per year" : ""; };

  /* ---------- icons ---------- */
  var IC = {
    bed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.500"/></svg>',
    bath: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 3.500-1.300M7 19l-1 2M17 19l1 2"/></svg>',
    area: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4zM4 9h4M4 14h3M9 4v4M14 4v3"/></svg>',
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.200 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/></svg>',
    doc: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/></svg>',
    wa: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm0 18.200a8.200 8.200 0 0 1-4.200-1.200l-.3-.2-3 .8.800-2.900-.2-.3A8.200 8.200 0 1 1 12 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8-.2-.1-.4-.1-.6.100l-.8 1c-.1.200-.3.200-.5.100a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.200-.4.700-1.300.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.300 3 3 0 0 0-.9 2.200 5.300 5.300 0 0 0 1.100 2.800 12 12 0 0 0 4.600 4.100c1.700.7 2.400.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.3-.2-.5-.3z"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7"/></svg>',
    warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20zM12 10v5M12 18v.5"/></svg>'
  };
  CV.icon = function (n) { return IC[n] || ""; };

  /* ---------- messages (no red: problems are navy-outlined, success is green) ---------- */
  CV.problem = function (msg) { return '<div class="note bad" role="alert">' + IC.warn + "<div><b>Problem:</b> " + esc(msg) + "</div></div>"; };
  CV.success = function (msg) { return '<div class="note ok" role="status">' + IC.check + "<div>" + msg + "</div></div>"; };
  CV.toast = function (msg, bad) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.className = bad ? "bad" : ""; t.innerHTML = "<div>" + esc(msg) + "</div>"; t.style.display = "block";
    clearTimeout(CV._tt); CV._tt = setTimeout(function () { t.style.display = "none"; }, 4200);
  };

  /* ---------- listing card ---------- */
  CV.card = function (p) {
    var lab = CV.propLabel(p), isLand = p.category === "land";
    var photo = p.photo_urls && p.photo_urls[0];
    var facts = [];
    if (isLand) {
      if (p.land_size_sqm) facts.push("<li>" + IC.area + " " + Number(p.land_size_sqm).toLocaleString("en-NG") + " sqm</li>");
      if (p.land_title) facts.push("<li>" + IC.doc + " " + esc(p.land_title) + "</li>");
    } else {
      if (p.bedrooms != null) facts.push("<li>" + IC.bed + " " + p.bedrooms + " bed</li>");
      if (p.bathrooms != null) facts.push("<li>" + IC.bath + " " + p.bathrooms + " bath</li>");
    }
    facts.push("<li>" + esc(p.property_type) + "</li>");
    var av = p.agent_photo ? '<img class="av" src="' + esc(p.agent_photo) + '" alt="" loading="lazy">' : '<span class="av av-i" aria-hidden="true">' + esc(CV.initials(p.agent_name)) + "</span>";
    return '<article class="card' + (lab.closed ? " closed" : "") + '">' +
      '<a class="ph" href="property.html?id=' + esc(p.id) + '" aria-label="' + esc(p.title) + '">' +
      (photo ? '<img src="' + esc(photo) + '" alt="' + esc(p.title) + '" loading="lazy" decoding="async">' : '<div class="noph">' + (isLand ? "Land" : "Home") + " photo coming</div>") +
      '<span class="tag ' + lab.cls + '">' + esc(lab.text) + "</span></a>" +
      '<div class="bd"><div class="price">' + CV.naira(p.price) + ' <small>' + CV.priceNote(p) + "</small></div>" +
      '<h3><a href="property.html?id=' + esc(p.id) + '">' + esc(p.title) + "</a></h3>" +
      '<p class="loc">' + IC.pin + " " + esc(p.area) + ", " + esc(p.state) + "</p>" +
      '<ul class="facts">' + facts.join("") + "</ul>" +
      '<div class="ag">' + av + '<div class="nm">' + esc(p.agent_name) + "<small>" + esc(p.agent_code) + "</small></div>" +
      '<span class="bdg">' + CV.badge(p.agent_badge, 30) + "</span></div></div></article>";
  };

  CV.agentCard = function (a, rank) {
    var av = a.photo_url ? '<img class="av" src="' + esc(a.photo_url) + '" alt="" loading="lazy">' : '<span class="av av-i" aria-hidden="true">' + esc(CV.initials(a.name)) + "</span>";
    return '<a class="agent-card" href="agent-profile.html?code=' + encodeURIComponent(a.agent_code) + '">' + (rank ? '<span class="rk">' + rank + "</span>" : "") + av +
      '<div><b>' + esc(a.name) + '</b><div class="muted small">' + esc(a.agent_code) + (a.location ? " · " + esc(a.location) : "") + "</div>" +
      '<div class="stats"><span><b>' + a.approved_listings + "</b> listings</span><span><b>" + a.completed_transactions + "</b> deals</span>" +
      (a.review_count ? '<span><b>' + Number(a.avg_rating).toFixed(1) + "</b>/5 rating</span>" : "<span>No reviews yet</span>") + "</div></div>" +
      '<span class="bdg">' + CV.badge(a.badge, 38) + "</span></a>";
  };

  /* ---------- header and footer ---------- */
  var NAV = [["rent", "rent.html", "Rent"], ["buy", "buy.html", "Buy"], ["land", "lands.html", "Land"], ["agents", "agents.html", "Agents"], ["safety", "safety.html", "Stay safe"], ["about", "about.html", "About"], ["contact", "contact.html", "Contact"]];
  CV.mount = function (active) {
    /* An email link (confirm account, reset password) that lands on a public page: pass it on to the agent portal, which signs the person in. */
    if (/[#&](access_token|error_code)=/.test(location.hash) && !/\/(agent|admin)\.html$/.test(location.pathname)) { location.replace("agent.html" + location.hash); return; }
    var sp = document.createElement("div"); sp.innerHTML = SPRITE; document.body.insertBefore(sp.firstChild, document.body.firstChild);
    var hd = document.getElementById("hd");
    if (hd) {
      hd.outerHTML = '<a class="skip" href="#main">Skip to content</a><header class="hd"><div class="wrap">' +
        '<a class="brand" href="index.html" aria-label="' + esc(S.name) + ' home"><img src="img/mark-wide.png" alt="" width="93" height="34"><span class="bt"><b>CALVORA</b><small>Property Solutions</small></span></a>' +
        '<button class="burger" aria-expanded="false" aria-controls="nav">Menu</button><nav class="nav" id="nav" aria-label="Main">' +
        NAV.map(function (n) { return '<a href="' + n[1] + '"' + (n[0] === active ? ' class="on" aria-current="page"' : "") + ">" + n[2] + "</a>"; }).join("") +
        '<a class="cta" href="list-property.html">List a property</a></nav></div></header>';
      var b = document.querySelector(".burger"), nav = document.getElementById("nav");
      b.addEventListener("click", function () { var o = nav.classList.toggle("open"); b.setAttribute("aria-expanded", o); b.textContent = o ? "Close" : "Menu"; });
    }
    var ft = document.getElementById("ft");
    if (ft) {
      var o = S.office || {}, soc = S.social || {}, y = new Date().getFullYear();
      var contact = "";
      if (o.phone) contact += '<a href="' + CV.telLink() + '">' + esc(o.phone) + "</a>";
      if (o.whatsapp) contact += '<a href="' + CV.waLink("Hello CALVORA") + '" rel="noopener">WhatsApp us</a>';
      if (o.email) contact += '<a href="mailto:' + esc(o.email) + '">' + esc(o.email) + "</a>";
      if (o.address) contact += '<span class="line">' + esc(o.address) + "</span>";
      if (o.hours) contact += '<span class="line">' + esc(o.hours) + "</span>";
      var socials = [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"]].filter(function (s) { return soc[s[0]]; })
        .map(function (s) { return '<a href="' + esc(soc[s[0]]) + '" rel="noopener">' + s[1] + "</a>"; }).join("");
      var legal = S.rcNumber ? esc(S.name) + " Ltd · " + esc(S.rcNumber) : esc(S.name);
      ft.outerHTML = '<footer class="ft"><div class="wrap"><div><span class="logo-chip"><img src="img/logo.png" alt="' + esc(S.name) + ' logo" width="68" height="42"></span>' +
        '<p class="ft-p">Verified homes and land in ' + esc((S.pilot || {}).city || "Nigeria") + ", with accountable agents and clear fees.</p></div>" +
        "<div><h4>Browse</h4><a href=\"rent.html\">Houses for rent</a><a href=\"buy.html\">Houses for sale</a><a href=\"lands.html\">Lands for sale</a><a href=\"agents.html\">Our agents</a><a href=\"verify.html\">Verify an ID</a></div>" +
        "<div><h4>Company</h4><a href=\"about.html\">About us</a><a href=\"safety.html\">Stay safe</a><a href=\"complaints.html\">Make a complaint</a><a href=\"legal.html\">Terms and privacy</a><a href=\"contact.html\">Contact</a></div>" +
        "<div><h4>Work with us</h4><a href=\"list-property.html\">List your property</a><a href=\"agent.html\">Become an agent partner</a>" + contact + socials + "</div></div>" +
        '<div class="legal"><p>© ' + y + " " + legal + ". " + esc(S.tagline) + '</p><p class="small">A property is only called verified when the Verification Completed label is shown, which means all four CALVORA checks are on record. An agent badge is a separate measure of the agent’s track record.</p></div></footer>';
    }
    var yr = document.querySelectorAll("[data-year]"); yr.forEach(function (e) { e.textContent = new Date().getFullYear(); });
    document.querySelectorAll("[data-site]").forEach(function (e) {
      var v = (S[e.dataset.site] || (S.office || {})[e.dataset.site] || ""); if (v) e.textContent = v;
    });
    document.querySelectorAll("[data-wa]").forEach(function (e) { e.href = CV.waLink(e.dataset.wa); if (!e.href) e.classList.add("hidden"); });
    document.querySelectorAll("[data-tel]").forEach(function (e) { e.href = CV.telLink(); e.textContent = (S.office || {}).phone || ""; });
  };

  /* shared submit helper: disables the button, shows success or a problem panel */
  CV.submitForm = function (form, boxId, fn, okHtml) {
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var box = document.getElementById(boxId), btn = form.querySelector("button[type=submit]");
      if (form.elements.website && form.elements.website.value) { box.innerHTML = CV.success(okHtml); return; } // spam trap
      btn.disabled = true; var old = btn.textContent; btn.textContent = "Sending…"; box.innerHTML = "";
      try { var res = await fn(new FormData(form)); box.innerHTML = CV.success(typeof okHtml === "function" ? okHtml(res) : okHtml); form.reset(); if (form.dataset.hideOnOk) form.classList.add("hidden"); box.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
      catch (e) { box.innerHTML = CV.problem(e.message || "Please try again."); }
      btn.disabled = false; btn.textContent = old;
    });
  };
})();
