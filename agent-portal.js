/* CALVORA agent portal (agent.html): sign in, apply, then the dashboard. */
(function () {
  "use strict";
  var CV = window.CV, PT = window.PT, sb = PT.sb, esc = CV.esc, $ = PT.$, $$ = PT.$$;
  var root = document.getElementById("app"), info = document.getElementById("info");
  var user, profile, app, stats, tab = "overview", MAX_PHOTOS = 30;

  function must(r) { if (r.error) throw r.error; return r.data; }
  function setPane(html) { var p = $("#pane"); p.innerHTML = html; return p; }
  function fail(e) { return CV.problem(PT.msg(e)); }
  function showInfo(on) { if (info) info.classList.toggle("hidden", !on); }
  async function signOut() { await sb.auth.signOut(); user = profile = app = null; boot(); }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      if (PT.isRecovery()) { showInfo(false); return PT.resetCard(root, boot); }
      var s = (await sb.auth.getSession()).data.session;
      if (!s) { showInfo(true); return PT.authCard(root, { title: "Agent sign in", onSignedIn: boot }); }
      user = s.user; showInfo(false);
      profile = must(await sb.from("profiles").select("*").eq("id", user.id).single());
      if (profile.role === "admin" || profile.role === "staff") return staffView();
      if (profile.role === "agent") return profile.status === "active" ? dashboard() : suspendedView();
      app = (await sb.from("agent_applications").select("*").eq("user_id", user.id).maybeSingle()).data;
      applyView();
    } catch (e) { root.innerHTML = fail(e) + '<p><button class="btn line" onclick="location.reload()">Try again</button></p>'; }
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { showInfo(false); PT.resetCard(root, boot); } });

  function bar(who) {
    return '<div class="whoami"><span>Signed in as <b>' + esc(who) + '</b></span><button class="btn line sm" id="signout" type="button">Sign out</button></div>';
  }
  function simple(html) { root.innerHTML = bar(profile.full_name || user.email) + html; $("#signout").onclick = signOut; }

  function staffView() {
    simple('<div class="panel"><h2>You are signed in as Calvora staff</h2><p>Staff use the admin panel, not the agent dashboard.</p><a class="btn" href="admin.html">Open the admin panel</a></div>');
  }
  function suspendedView() {
    simple('<div class="panel"><h2>Your agent account is not active</h2><p>Your account has been suspended, so your listings are hidden and your ID shows as not valid. Please contact the Calvora team to talk about it.</p>' +
      (CV.waLink("Hello CALVORA, my agent account " + (profile.agent_code || "") + " is suspended.") ? '<a class="btn green" href="' + CV.waLink("Hello CALVORA, my agent account " + (profile.agent_code || "") + " is suspended.") + '" rel="noopener">' + CV.icon("wa") + " Message Calvora</a>" : "") + "</div>");
  }

  /* ---------- application ---------- */
  function applyView() {
    var st = app && app.status;
    if (st === "submitted" || st === "under_review") {
      return simple('<div class="panel"><h2>Application received</h2><p><span class="chip ' + (st === "under_review" ? "g" : "n") + '">' + (st === "under_review" ? "Under review" : "Submitted") + "</span></p>" +
        "<p>Our operations team is checking your details and identity document. We will let you know when a decision is made, and your dashboard opens as soon as you are approved.</p>" +
        '<p class="fine">Submitted ' + PT.dt(app.created_at) + ".</p></div>");
    }
    if (st === "rejected") {
      return simple('<div class="panel"><h2>Application not approved</h2><div class="note bad">' + CV.icon("warn") + "<div><b>Decision note:</b> " + esc(app.reviewer_note || "No note was left.") + "</div></div><p style=\"margin-top:14px\">If you think this is a mistake, please contact the Calvora team.</p></div>");
    }
    var again = st === "needs_information";
    simple('<div class="two"><div class="panel"><h2>' + (again ? "We need a little more information" : "Apply to become an agent partner") + "</h2>" +
      (again ? '<div class="note bad">' + CV.icon("warn") + "<div><b>From our team:</b> " + esc(app.reviewer_note || "") + "</div></div>" : "<p class=\"muted\">Tell us about yourself. We check every application and keep your documents private.</p>") +
      '<form id="apf" novalidate>' +
      '<label for="p_name">Full name (as on your ID)</label><input id="p_name" required maxlength="100" value="' + esc((app && app.full_name) || profile.full_name || "") + '">' +
      '<div class="grid2"><div><label for="p_phone">Phone number</label><input id="p_phone" type="tel" required value="' + esc((app && app.phone) || "") + '"></div><div><label for="p_wa">WhatsApp number</label><input id="p_wa" type="tel" required value="' + esc((app && app.whatsapp) || "") + '"></div></div>' +
      '<div class="grid2"><div><label for="p_state">State you work in</label><select id="p_state">' + PT.opts(PT.STATES, (app && app.operating_state) || "Ekiti") + '</select></div><div><label for="p_areas">Areas you cover</label><input id="p_areas" required placeholder="e.g. Ado-Ekiti, Ijigbo" value="' + esc((app && app.operating_areas) || "") + '"></div></div>' +
      '<label for="p_exp">Your experience in property</label><textarea id="p_exp" maxlength="1500">' + esc((app && app.experience) || "") + "</textarea>" +
      '<label for="p_ref">References <span class="fine">(names and phone numbers of people who can vouch for you)</span></label><textarea id="p_ref" maxlength="1500">' + esc((app && app.references_text) || "") + "</textarea>" +
      '<label for="p_doc">Identity document <span class="fine">(NIN slip, driver’s licence, voter’s card or passport; photo or PDF, under 5MB)</span></label><input id="p_doc" type="file" accept="image/jpeg,image/png,application/pdf">' +
      (app && app.id_document_path ? '<p class="fine">A document is already attached. Choose a file only to replace it.</p>' : "") +
      '<label class="check"><input id="p_agree" type="checkbox"> I have read and agree to the <a href="safety.html#conduct" target="_blank" rel="noopener">Calvora code of conduct</a>.</label>' +
      '<div id="apbox" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:14px">' + (again ? "Send updated application" : "Send application") + "</button></form></div>" +
      '<div class="panel"><h3>What happens next</h3><ul class="ticks"><li>We review your application and check your ID</li><li>We may ask you for more information</li><li>If approved you get an agent ID number and your dashboard opens</li><li>Every property you add is checked by our team before it goes live</li></ul></div></div>');
    $("#apf").onsubmit = submitApplication;
  }
  async function submitApplication(ev) {
    ev.preventDefault();
    var v = function (id) { return $(id).value.trim(); }, box = $("#apbox"), btn = ev.target.querySelector("button[type=submit]"), file = $("#p_doc").files[0];
    box.innerHTML = "";
    if (v("#p_name").length < 2 || !v("#p_phone") || !v("#p_wa") || !v("#p_areas")) { box.innerHTML = CV.problem("Please fill in your name, phone, WhatsApp and the areas you cover."); return; }
    if (!$("#p_agree").checked) { box.innerHTML = CV.problem("You must agree to the code of conduct to apply."); return; }
    if (!file && !(app && app.id_document_path)) { box.innerHTML = CV.problem("Please attach your identity document."); return; }
    if (file && file.size > 5242880) { box.innerHTML = CV.problem("The identity document must be under 5MB."); return; }
    btn.disabled = true;
    try {
      var path = app && app.id_document_path;
      if (file) {
        path = user.id + "/id-" + Date.now() + "-" + PT.safeName(file.name);
        var up = await sb.storage.from("agent-docs").upload(path, file); if (up.error) throw up.error;
      }
      var row = { full_name: v("#p_name"), phone: v("#p_phone"), whatsapp: v("#p_wa"), operating_state: $("#p_state").value, operating_areas: v("#p_areas"), experience: v("#p_exp"), references_text: v("#p_ref"), id_document_path: path, agreed_conduct: true, status: "submitted" };
      var r = app ? await sb.from("agent_applications").update(row).eq("id", app.id) : await sb.from("agent_applications").insert(Object.assign({ user_id: user.id }, row));
      if (r.error) throw r.error;
      boot();
    } catch (e) { box.innerHTML = fail(e); btn.disabled = false; }
  }

  /* ---------- dashboard shell ---------- */
  async function dashboard() {
    stats = (must(await sb.rpc("my_agent_stats")) || [])[0] || { approved_listings: 0, completed_transactions: 0, avg_rating: 0, review_count: 0, badge: "Bronze" };
    var cnt = await sb.from("property_inquiries").select("id", { count: "exact", head: true }).eq("status", "new");
    var tabs = [["overview", "Overview"], ["listings", "My listings"], ["add", "Add listing"], ["enquiries", "Enquiries", cnt.count || ""], ["inspections", "Inspections"], ["money", "Money"], ["weekly", "Weekly report"], ["idcard", "My ID card"], ["profile", "Profile"]];
    PT.shell(root, tabs, tab, profile.full_name || user.email, go, signOut);
    go(tab);
  }
  var VIEWS = { overview: overview, listings: listings, add: function () { return listingForm(null); }, enquiries: enquiries, inspections: inspections, money: money, weekly: weekly, idcard: idcard, profile: profileTab };
  async function go(t, arg) {
    tab = t; PT.mark(t); setPane('<div class="loading"><span class="pulse"></span>Loading…</div>');
    try { await VIEWS[t](arg); } catch (e) { setPane(fail(e)); }
    var p = $("#pane"); if (p && window.innerWidth < 860) p.scrollIntoView({ block: "start" });
  }

  /* ---------- overview ---------- */
  var NEXT = { Bronze: ["Silver", 5, 1, 0], Silver: ["Gold", 15, 3, 4.5], Gold: ["Diamond", 30, 10, 4.7] };
  function progress(label, have, need, dec) {
    var pct = need ? Math.min(100, Math.round((have / need) * 100)) : 100;
    return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:.92rem"><span>' + label + "</span><b>" + (dec ? Number(have).toFixed(1) : have) + " / " + need + '</b></div><div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + esc(label) + '"><i style="width:' + pct + '%"></i></div></div>';
  }
  async function overview() {
    var n = NEXT[stats.badge], b = CV.BADGES[stats.badge];
    var exp = profile.id_expires_at ? (new Date(profile.id_expires_at) - Date.now()) / 864e5 : null;
    var av = profile.photo_url ? '<img class="av" style="width:84px;height:84px;border-radius:50%;object-fit:cover" src="' + esc(profile.photo_url) + '" alt="">' : '<span class="av av-i" style="width:84px;height:84px;font-size:1.6rem">' + esc(CV.initials(profile.full_name)) + "</span>";
    var cnt = await sb.from("property_inquiries").select("id", { count: "exact", head: true }).eq("status", "new");
    var needs = await sb.from("properties").select("id", { count: "exact", head: true }).eq("agent_id", user.id).eq("status", "needs_changes");
    var aw = (await sb.from("agent_awards").select("award,period,note").order("awarded_at", { ascending: false })).data || [];
    setPane('<h2>Welcome, ' + esc((profile.full_name || "").split(" ")[0] || "agent") + "</h2>" +
      (exp !== null && exp < 30 ? '<div class="note bad">' + CV.icon("warn") + "<div><b>Your ID " + (exp < 0 ? "has expired" : "expires on " + CV.date(profile.id_expires_at)) + ".</b> " + (exp < 0 ? "Your listings are hidden until it is renewed. " : "") + "Ask the Calvora team to renew it.</div></div>" : "") +
      (needs.count ? '<div class="note bad">' + CV.icon("warn") + "<div><b>" + needs.count + " listing" + (needs.count > 1 ? "s need" : " needs") + " changes.</b> <button class=\"linkbtn\" data-go=\"listings\">See what to fix</button></div></div>" : "") +
      '<div class="panel" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' + av + '<div style="flex:1;min-width:200px"><b style="font-size:1.25rem;color:var(--navy)">' + esc(profile.full_name) + '</b><div class="muted">Agent ID <b>' + esc(profile.agent_code) + '</b></div><div class="small muted">' + esc(b.meaning) + "</div></div>" +
      '<div style="text-align:center">' + CV.badge(stats.badge, 64) + '<div style="font-weight:800;color:var(--navy)">' + esc(stats.badge) + "</div></div></div>" +
      '<div class="stats4"><div class="stat"><b>' + stats.approved_listings + "</b><span>Approved listings</span></div><div class=\"stat\"><b>" + stats.completed_transactions + "</b><span>Completed deals</span></div>" +
      '<div class="stat"><b>' + (stats.review_count ? Number(stats.avg_rating).toFixed(1) : "–") + "</b><span>" + (stats.review_count ? stats.review_count + " verified review" + (stats.review_count > 1 ? "s" : "") : "No reviews yet") + '</span></div><div class="stat"><b>' + (cnt.count || 0) + "</b><span>New enquiries</span></div></div>" +
      (aw.length ? '<div class="panel"><h3>Your special awards</h3>' + aw.map(function (w) { return '<div class="chk"><div><b>\u2605 ' + esc(w.award) + (w.period ? " " + esc(w.period) : "") + '</b><div class="small muted">' + esc(w.note) + "</div></div></div>"; }).join("") + "</div>" : "") +
      '<div class="panel"><h3>' + (n ? "Progress to " + n[0] : "You have the top badge") + "</h3>" +
      (n ? progress("Approved listings", stats.approved_listings, n[1]) + progress("Completed deals", stats.completed_transactions, n[2]) + (n[3] ? progress("Average rating", Number(stats.avg_rating), n[3], true) : "") + '<p class="fine">Badges come from our records, not from how many listings you upload. Accurate listings, real deals and good reviews are what count.</p>' : "<p>Thank you for your honest work. Keep your listings accurate and your customers happy.</p>") + "</div>");
    $$("[data-go]").forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
  }

  /* ---------- my listings ---------- */
  var LBL = { draft: ["Draft", "o"], pending_review: ["Submitted, waiting for review", "n"], under_review: ["Under review", "n"], needs_changes: ["Needs changes", "o"], approved: ["Live", "g"], rejected: ["Not approved", "o"], hidden: ["Hidden by Calvora", "o"], rented: ["Rented", "n"], sold: ["Sold", "n"] };
  var KIND = { "rent|house": "House for rent", "sale|house": "House for sale", "sale|land": "Land for sale" };
  async function listings() {
    var rows = must(await sb.from("properties").select("*").eq("agent_id", user.id).order("created_at", { ascending: false }));
    if (!rows.length) { setPane('<h2>My listings</h2><div class="empty"><h3>No listings yet</h3><p>Add your first property. Our team checks it before it goes live.</p><button class="btn" data-go="add">Add a listing</button></div>'); $$("[data-go]")[0].onclick = function () { go("add"); }; return; }
    var vr = must(await sb.from("verification_records").select("property_id,label").in("property_id", rows.map(function (r) { return r.id; })));
    var chk = {}; vr.forEach(function (v) { (chk[v.property_id] = chk[v.property_id] || {})[v.label] = 1; });
    var html = '<h2>My listings</h2><div class="scroll"><table class="tbl"><thead><tr><th>Property</th><th>Type</th><th>Price</th><th>Status</th><th>Checks</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (p) {
      var l = LBL[p.status] || [p.status, "o"], n = Object.keys(chk[p.id] || {}).length, live = p.status === "approved", ed = ["draft", "pending_review", "needs_changes", "approved"].indexOf(p.status) >= 0, del = ["draft", "needs_changes", "rejected", "pending_review"].indexOf(p.status) >= 0;
      var stale = live && p.last_confirmed_at && (Date.now() - new Date(p.last_confirmed_at)) / 864e5 > (window.SITE.availabilityDays || 30);
      return "<tr><td><b>" + esc(p.title) + '</b><div class="small muted">' + esc(p.listing_code) + " · " + esc(p.area) + ", " + esc(p.state) + "</div>" + (p.reviewer_note && (p.status === "needs_changes" || p.status === "rejected" || p.status === "hidden") ? '<div class="note bad" style="margin-top:8px">' + CV.icon("warn") + "<div><b>From our team:</b> " + esc(p.reviewer_note) + "</div></div>" : "") + "</td><td>" + (KIND[p.listing_type + "|" + p.category] || "") + "</td><td>" + CV.naira(p.price) + (p.listing_type === "rent" ? '<div class="small muted">per year</div>' : "") + '</td><td><span class="chip ' + l[1] + '">' + l[0] + "</span>" + (stale ? '<div class="small" style="margin-top:4px"><b>Needs availability confirmation</b></div>' : "") + "</td><td>" + n + " of 4</td><td><div class=\"acts-row\">" +
        (ed ? '<button class="btn line sm" data-edit="' + p.id + '">Edit</button>' : "") +
        (live ? '<a class="btn line sm" href="property.html?id=' + p.id + '" target="_blank" rel="noopener">View</a><button class="btn line sm" data-conf="' + p.id + '">Still available</button><button class="btn line sm" data-close="' + p.id + '" data-kind="' + p.listing_type + '">Mark ' + (p.listing_type === "rent" ? "rented" : "sold") + "</button>" : "") +
        (del ? '<button class="btn line sm" data-del="' + p.id + '">Delete</button>' : "") + "</div></td></tr>";
    }).join("") + "</tbody></table></div>";
    setPane(html);
    $$("[data-edit]").forEach(function (b) { b.onclick = function () { go("add", rows.find(function (r) { return r.id === b.dataset.edit; })); }; });
    $$("[data-conf]").forEach(function (b) { b.onclick = async function () { var r = await sb.rpc("confirm_availability", { p_id: b.dataset.conf }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Availability confirmed"), listings()); }; });
    $$("[data-close]").forEach(function (b) { b.onclick = async function () { if (!confirm("Mark this property as " + (b.dataset.kind === "rent" ? "rented" : "sold") + "? It will leave the live catalogue.")) return; var r = await sb.rpc("mark_closed", { p_id: b.dataset.close }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Listing closed"), listings()); }; });
    $$("[data-del]").forEach(function (b) { b.onclick = async function () { if (!confirm("Delete this listing? This cannot be undone.")) return; var r = await sb.rpc("delete_my_listing", { p_id: b.dataset.del }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Listing deleted"), listings()); }; });
  }

  /* ---------- add / edit listing ---------- */
  var F; // form state
  async function listingForm(p) {
    var owner = null;
    if (p) owner = (await sb.from("property_owner_details").select("*").eq("property_id", p.id).maybeSingle()).data;
    F = { id: p && p.id, status: p && p.status, cat: p ? (p.category === "land" ? "land" : p.listing_type === "rent" ? "rent" : "buy") : null, photos: ((p && p.photo_urls) || []).map(function (u) { return { url: u }; }), proofs: (owner && owner.proof_paths) || [], newProofs: [] };
    if (!F.cat) {
      setPane('<h2>Add a listing</h2><p class="muted">First choose where this property belongs. Each property appears in one catalogue only.</p><div class="three">' +
        [["rent", "House for rent", "Rooms, flats and houses. Rent is per year."], ["buy", "House for sale", "Bungalows, duplexes and apartments for sale."], ["land", "Land for sale", "Plots and land, with size and title document."]].map(function (c) { return '<button type="button" class="door pick" data-cat="' + c[0] + '"><h3>' + c[1] + '</h3><p class="muted">' + c[2] + "</p><span>Choose &rarr;</span></button>"; }).join("") + "</div>");
      $$("[data-cat]").forEach(function (b) { b.onclick = function () { F.cat = b.dataset.cat; drawForm(null, null); }; });
      return;
    }
    drawForm(p, owner);
  }
  function drawForm(p, owner) {
    var cat = F.cat, land = cat === "land", rent = cat === "rent", C = CV.CATALOGUES[cat], v = function (k, d) { return p && p[k] != null ? esc(p[k]) : d || ""; };
    var feats = (p && p.features) || [], list = PT.FEATURES[land ? "land" : "house"];
    var live = p && p.status === "approved";
    setPane('<h2>' + (p ? "Edit listing" : "Add a listing") + ' <span class="chip g">' + C.label.replace(/^\w/, function (c) { return c.toUpperCase(); }) + "</span></h2>" +
      (live ? '<div class="note bad">' + CV.icon("warn") + "<div><b>This listing is live.</b> Saving your changes takes it offline and sends it back to our team to check again.</div></div>" : "") +
      (p && p.status === "needs_changes" && p.reviewer_note ? '<div class="note bad">' + CV.icon("warn") + "<div><b>From our team:</b> " + esc(p.reviewer_note) + "</div></div>" : "") +
      '<form id="lf" novalidate><div class="panel"><h3>About the property</h3>' +
      '<label for="f_title">Title</label><input id="f_title" required maxlength="120" placeholder="' + (land ? "e.g. Residential plot, Afao road" : "e.g. Two bedroom flat, Ajilosun") + '" value="' + v("title") + '">' +
      '<div class="grid2"><div><label for="f_state">State</label><select id="f_state">' + PT.opts(PT.STATES, (p && p.state) || "Ekiti") + '</select></div><div><label for="f_area">Area or town</label><input id="f_area" required maxlength="80" value="' + v("area") + '"></div></div>' +
      '<div class="grid2"><div><label for="f_type">' + (land ? "Land use" : "Property type") + '</label><select id="f_type">' + PT.opts(land ? CV.LAND_USE : CV.HOUSE_TYPES, p && p.property_type) + "</select></div>" +
      (land ? '<div><label for="f_size">Land size (sqm)</label><input id="f_size" type="number" min="1" step="any" inputmode="decimal" value="' + v("land_size_sqm") + '"></div>' : '<div class="grid2" style="gap:0 12px"><div><label for="f_beds">Bedrooms</label><input id="f_beds" type="number" min="0" max="30" value="' + v("bedrooms") + '"></div><div><label for="f_baths">Bathrooms</label><input id="f_baths" type="number" min="0" max="30" value="' + v("bathrooms") + '"></div></div>') + "</div>" +
      (land ? '<label for="f_title2">Title document</label><select id="f_title2">' + PT.opts(CV.LAND_TITLES, p && p.land_title, "Choose one") + "</select>" : "") +
      '<label for="f_desc">Description</label><textarea id="f_desc" maxlength="3000" style="min-height:130px" placeholder="Describe the property honestly: condition, surroundings, anything a customer should know.">' + v("description") + "</textarea>" +
      '<fieldset class="feats"><legend>Features</legend>' + list.map(function (f) { return '<label class="check"><input type="checkbox" name="feat" value="' + esc(f) + '"' + (feats.indexOf(f) >= 0 ? " checked" : "") + "> " + esc(f) + "</label>"; }).join("") + "</fieldset></div>" +
      '<div class="panel"><h3>Price and fees</h3><p class="fine" style="margin-top:0">Be exact. Customers see these figures, and Calvora staff check them with the owner. Never hide a fee.</p>' +
      '<div class="grid2"><div><label for="f_price">' + (rent ? "Rent per year (₦)" : "Price (₦)") + '</label><input id="f_price" type="number" min="1" step="1" inputmode="numeric" required value="' + v("price") + '"></div><div><label for="f_agency">Agency fee (₦)</label><input id="f_agency" type="number" min="0" step="1" inputmode="numeric" value="' + v("agency_fee", "0") + '"></div></div>' +
      '<div class="grid2"><div><label for="f_legal">Legal fee (₦)</label><input id="f_legal" type="number" min="0" step="1" inputmode="numeric" value="' + v("legal_fee", "0") + '"></div>' + (rent ? '<div><label for="f_caution">Caution (security) fee (₦)</label><input id="f_caution" type="number" min="0" step="1" inputmode="numeric" value="' + v("caution_fee", "0") + '"></div>' : "<div></div>") + "</div></div>" +
      '<div class="panel"><h3>Photos</h3><p class="fine" style="margin-top:0">Up to ' + MAX_PHOTOS + ' real photos of this property. The first photo is the cover. Photos are shrunk automatically.</p><label class="drop" id="drop" for="f_files"><b>Tap to choose photos</b> or drop them here<input id="f_files" type="file" accept="image/*" multiple class="vh"></label><div class="photos" id="ph"></div></div>' +
      '<div class="panel"><h3>Private owner details</h3><p class="fine" style="margin-top:0">Only you and Calvora staff can see this. It is never shown to customers.</p>' +
      '<div class="grid2"><div><label for="o_rel">Who is the owner to you?</label><select id="o_rel">' + PT.opts(["Landlord or owner", "Family member of the owner", "Caretaker or manager", "Other authorised person"], owner && owner.relationship) + '</select></div><div><label for="o_name">Owner’s full name</label><input id="o_name" maxlength="100" value="' + esc((owner && owner.owner_name) || "") + '"></div></div>' +
      '<div class="grid2"><div><label for="o_phone">Owner’s phone</label><input id="o_phone" type="tel" value="' + esc((owner && owner.owner_phone) || "") + '"></div><div><label for="o_email">Owner’s email <span class="fine">(optional)</span></label><input id="o_email" type="email" value="' + esc((owner && owner.owner_email) || "") + '"></div></div>' +
      '<label for="o_addr">Owner’s address</label><input id="o_addr" maxlength="200" value="' + esc((owner && owner.owner_address) || "") + '">' +
      '<label class="check"><input id="o_auth" type="checkbox"' + (owner && owner.authorised ? " checked" : "") + '> The owner has given me permission to advertise this property with Calvora.</label>' +
      '<label for="o_docs">Proof of ownership or authority <span class="fine">(photo or PDF: allocation letter, receipt, written permission; under 5MB each)</span></label><input id="o_docs" type="file" multiple accept="image/jpeg,image/png,application/pdf"><div id="proofs" class="small"></div></div>' +
      '<div id="lfbox" aria-live="polite"></div><div class="acts-row"><button class="btn" type="submit" data-mode="pending_review">Submit for review</button>' + (live ? "" : '<button class="btn line" type="submit" data-mode="draft">Save as draft</button>') + '<button class="btn line" type="button" id="lfcancel">Cancel</button></div></form>');
    drawPhotos(); drawProofs();
    $("#f_files").onchange = function (e) { addPhotos(e.target.files); e.target.value = ""; };
    var drop = $("#drop"); ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); }); ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { addPhotos(e.dataTransfer.files); });
    $("#o_docs").onchange = function (e) { Array.prototype.forEach.call(e.target.files, function (f) { if (f.size > 5242880) CV.toast(f.name + " is over 5MB", 1); else F.newProofs.push(f); }); e.target.value = ""; drawProofs(); };
    $("#lfcancel").onclick = function () { go("listings"); };
    $("#lf").onsubmit = function (e) { e.preventDefault(); saveListing((e.submitter && e.submitter.dataset.mode) || "pending_review"); };
  }
  function addPhotos(files) {
    Array.prototype.forEach.call(files, function (f) {
      if (F.photos.length >= MAX_PHOTOS) return;
      if (/^image\//.test(f.type)) F.photos.push({ file: f, url: URL.createObjectURL(f) });
    });
    drawPhotos();
  }
  function drawPhotos() {
    var el = $("#ph"); if (!el) return;
    el.innerHTML = F.photos.map(function (p, i) { return '<div class="ph1"><img src="' + esc(p.url) + '" alt="Photo ' + (i + 1) + '">' + (i === 0 ? '<span class="cover">Cover</span>' : '<button type="button" data-cov="' + i + '">Make cover</button>') + '<button type="button" class="x" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">&times;</button></div>'; }).join("");
    $$("[data-cov]", el).forEach(function (b) { b.onclick = function () { var x = F.photos.splice(+b.dataset.cov, 1)[0]; F.photos.unshift(x); drawPhotos(); }; });
    $$("[data-rm]", el).forEach(function (b) { b.onclick = function () { F.photos.splice(+b.dataset.rm, 1); drawPhotos(); }; });
  }
  function drawProofs() {
    var el = $("#proofs"); if (!el) return;
    el.innerHTML = F.proofs.map(function (p, i) { return '<div>• Uploaded: ' + esc(p.split("/").pop()) + ' <button type="button" class="linkbtn" data-rp="' + i + '">remove</button></div>'; }).join("") + F.newProofs.map(function (f, i) { return "<div>• " + esc(f.name) + ' <button type="button" class="linkbtn" data-rn="' + i + '">remove</button></div>'; }).join("");
    $$("[data-rp]", el).forEach(function (b) { b.onclick = function () { F.proofs.splice(+b.dataset.rp, 1); drawProofs(); }; });
    $$("[data-rn]", el).forEach(function (b) { b.onclick = function () { F.newProofs.splice(+b.dataset.rn, 1); drawProofs(); }; });
  }
  async function saveListing(mode) {
    var box = $("#lfbox"), btns = $$("#lf button"), cat = F.cat, land = cat === "land", rent = cat === "rent", g = function (id) { return ($(id) ? $(id).value : "").trim(); };
    box.innerHTML = "";
    function bad(m) { box.innerHTML = CV.problem(m); box.scrollIntoView({ block: "center", behavior: "smooth" }); }
    var price = Number(g("#f_price"));
    if (g("#f_title").length < 5) return bad("Please give the property a title (at least 5 characters).");
    if (!g("#f_area")) return bad("Please enter the area or town.");
    if (!g("#f_type")) return bad("Please choose the " + (land ? "land use" : "property type") + ".");
    if (!(price > 0)) return bad("Please enter the " + (rent ? "rent per year" : "price") + ". A price is required.");
    var submit = mode === "pending_review";
    if (land && submit && (!(Number(g("#f_size")) > 0) || !g("#f_title2"))) return bad("For land, please enter the size in sqm and choose the title document.");
    if (!land && submit && (g("#f_beds") === "" || g("#f_baths") === "")) return bad("Please enter the number of bedrooms and bathrooms.");
    if (submit) {
      if (!F.photos.length) return bad("Please add at least one photo before you submit.");
      if (g("#o_name").length < 2 || !g("#o_phone")) return bad("Please enter the owner’s name and phone number.");
      if (!$("#o_auth").checked) return bad("Please confirm that the owner has given permission to advertise this property.");
      if (!F.proofs.length && !F.newProofs.length) return bad("Please upload a proof of ownership or authority.");
    }
    btns.forEach(function (b) { b.disabled = true; });
    try {
      var urls = [], n = 0, total = F.photos.filter(function (p) { return p.file; }).length;
      for (var i = 0; i < F.photos.length; i++) {
        var ph = F.photos[i];
        if (ph.file) { n++; box.innerHTML = '<p class="muted"><span class="pulse"></span>Uploading photo ' + n + " of " + total + "…</p>"; urls.push(await PT.uploadPublic(user.id, await PT.compress(ph.file), "p")); }
        else urls.push(ph.url);
      }
      var proofs = F.proofs.slice();
      for (var j = 0; j < F.newProofs.length; j++) {
        var f = F.newProofs[j], path = user.id + "/proof-" + Date.now() + "-" + j + "-" + PT.safeName(f.name);
        var up = await sb.storage.from("owner-docs").upload(path, f); if (up.error) throw up.error; proofs.push(path);
      }
      var row = {
        title: g("#f_title"), state: $("#f_state").value, area: g("#f_area"), property_type: g("#f_type"),
        listing_type: rent ? "rent" : "sale", category: land ? "land" : "house", price: price,
        agency_fee: Number(g("#f_agency")) || 0, legal_fee: Number(g("#f_legal")) || 0, caution_fee: rent ? Number(g("#f_caution")) || 0 : 0,
        description: g("#f_desc"), photo_urls: urls, status: mode,
        features: $$("input[name=feat]:checked").map(function (c) { return c.value; })
      };
      if (land) { row.land_size_sqm = Number(g("#f_size")) || null; row.land_title = g("#f_title2") || null; row.bedrooms = null; row.bathrooms = null; }
      else { row.bedrooms = g("#f_beds") === "" ? null : Number(g("#f_beds")); row.bathrooms = g("#f_baths") === "" ? null : Number(g("#f_baths")); row.land_size_sqm = null; row.land_title = null; }
      var id = F.id;
      if (id) must(await sb.from("properties").update(row).eq("id", id));
      else { var ins = must(await sb.from("properties").insert(Object.assign({ agent_id: user.id }, row)).select("id").single()); id = ins.id; }
      if (g("#o_name").length >= 2) {
        must(await PT.saveRow(sb, "property_owner_details", { property_id: id }, { relationship: g("#o_rel"), owner_name: g("#o_name"), owner_phone: g("#o_phone"), owner_email: g("#o_email") || null, owner_address: g("#o_addr"), authorised: $("#o_auth").checked, proof_paths: proofs }));
      }
      CV.toast(submit ? "Submitted. Our team will check it." : "Draft saved");
      go("listings");
    } catch (e) { bad(PT.msg(e)); btns.forEach(function (b) { b.disabled = false; }); }
  }

  /* ---------- enquiries ---------- */
  async function enquiries() {
    var rows = must(await sb.from("property_inquiries").select("*, properties(title,listing_code)").order("created_at", { ascending: false }).limit(100));
    if (!rows.length) return setPane('<h2>Enquiries</h2><div class="empty">No enquiries yet. They appear here as soon as a customer asks about one of your listings.</div>');
    setPane('<h2>Enquiries</h2><div class="scroll"><table class="tbl"><thead><tr><th>Customer</th><th>Property</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>' + rows.map(function (q) {
      return "<tr><td><b>" + esc(q.customer_name) + "</b><div class=\"small\">" + PT.contactLinks(q.customer_phone, "Hello " + q.customer_name + ", this is " + profile.full_name + " from Calvora about " + ((q.properties && q.properties.title) || "your enquiry") + ".") + "</div>" + (q.customer_email ? '<div class="small">' + esc(q.customer_email) + "</div>" : "") + "</td><td>" + (q.properties ? esc(q.properties.title) + '<div class="small muted">' + esc(q.properties.listing_code) + "</div>" : '<span class="muted">General</span>') + '</td><td style="min-width:220px;white-space:pre-line">' + esc(q.message) + '</td><td class="small">' + PT.dt(q.created_at) + '</td><td><select data-q="' + q.id + '" aria-label="Status">' + ["new", "contacted", "closed", "spam"].map(function (s) { return '<option value="' + s + '"' + (q.status === s ? " selected" : "") + ">" + s.replace(/^\w/, function (c) { return c.toUpperCase(); }) + "</option>"; }).join("") + "</select></td></tr>";
    }).join("") + "</tbody></table></div>");
    $$("[data-q]").forEach(function (s) { s.onchange = async function () { var r = await sb.from("property_inquiries").update({ status: s.value }).eq("id", s.dataset.q); r.error ? CV.toast(PT.msg(r.error), 1) : CV.toast("Updated"); }; });
  }

  /* ---------- inspections ---------- */
  async function inspections() {
    var rows = must(await sb.from("inspection_bookings").select("*, properties(title,listing_code,area)").order("requested_at", { ascending: true }).limit(100));
    if (!rows.length) return setPane('<h2>Inspections</h2><div class="empty">No inspection requests yet.</div>');
    var NEXTS = { requested: [["confirmed", "Confirm"], ["cancelled", "Cancel"]], confirmed: [["completed", "Mark completed"], ["no_show", "No-show"], ["cancelled", "Cancel"]] };
    setPane('<h2>Inspections</h2><p class="fine">Always confirm the time with the customer. A request is not a booking until you have.</p><div class="scroll"><table class="tbl"><thead><tr><th>When</th><th>Customer</th><th>Property</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows.map(function (b) {
      return "<tr><td><b>" + PT.dt(b.requested_at) + "</b>" + (b.notes ? '<div class="small muted">' + esc(b.notes) + "</div>" : "") + "</td><td><b>" + esc(b.customer_name) + '</b><div class="small">' + PT.contactLinks(b.customer_phone, "Hello " + b.customer_name + ", this is " + profile.full_name + " from Calvora about your inspection request.") + "</div></td><td>" + (b.properties ? esc(b.properties.title) + '<div class="small muted">' + esc(b.properties.area) + "</div>" : "") + '</td><td><span class="chip ' + (b.status === "confirmed" ? "g" : b.status === "requested" ? "n" : "o") + '">' + b.status.replace("_", "-") + '</span></td><td><div class="acts-row">' + (NEXTS[b.status] || []).map(function (n) { return '<button class="btn line sm" data-b="' + b.id + '" data-s="' + n[0] + '">' + n[1] + "</button>"; }).join("") + "</div></td></tr>";
    }).join("") + "</tbody></table></div>");
    $$("[data-b]").forEach(function (b) { b.onclick = async function () { var r = await sb.from("inspection_bookings").update({ status: b.dataset.s }).eq("id", b.dataset.b); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Updated"), inspections()); }; });
  }

  /* ---------- money ---------- */
  async function money() {
    var com = must(await sb.from("commissions").select("*, properties(title,listing_code)").order("created_at", { ascending: false }));
    var tx = must(await sb.from("transactions").select("*, properties(title,listing_code)").order("completed_at", { ascending: false }));
    var sub = (await sb.from("agent_subscriptions").select("*, subscription_plans(name,price_monthly)").order("created_at", { ascending: false })).data || [];
    var sp = (await sb.from("subscription_payments").select("*").order("paid_on", { ascending: false }).limit(12)).data || [];
    var due = 0, paid = 0; com.forEach(function (c) { if (c.status === "due" || c.status === "pending") due += Number(c.amount); if (c.status === "paid") paid += Number(c.amount); });
    setPane('<h2>Money</h2><div class="stats4"><div class="stat"><b>' + CV.naira(due) + "</b><span>Commission due to you</span></div><div class=\"stat\"><b>" + CV.naira(paid) + "</b><span>Commission paid</span></div><div class=\"stat\"><b>" + tx.length + "</b><span>Completed deals</span></div></div>" +
      "<h3>Your commission</h3>" + (com.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Property</th><th>Amount</th><th>Status</th><th>Paid</th><th>Reference</th></tr></thead><tbody>' + com.map(function (c) { return "<tr><td>" + (c.properties ? esc(c.properties.title) : "") + "</td><td><b>" + CV.naira(c.amount) + '</b></td><td><span class="chip ' + (c.status === "paid" ? "g" : "n") + '">' + c.status + "</span></td><td>" + (c.paid_at ? CV.date(c.paid_at) : "") + "</td><td>" + esc(c.reference || "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">No commission yet. It appears here when Calvora records a completed deal on one of your listings.</div>') +
      '<h3 style="margin-top:22px">Completed deals</h3>' + (tx.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Property</th><th>Customer</th><th>Deal value</th><th>Your share</th><th>Date</th></tr></thead><tbody>' + tx.map(function (t) { return "<tr><td>" + (t.properties ? esc(t.properties.title) : "") + "</td><td>" + esc(t.customer_name) + "</td><td>" + CV.naira(t.deal_value) + "</td><td><b>" + CV.naira(t.agent_share) + "</b></td><td>" + CV.date(t.completed_at) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="empty">No completed deals yet.</div>') +
      (sub.length ? '<h3 style="margin-top:22px">Your subscription</h3>' + sub.slice(0, 1).map(function (s) { return '<div class="panel"><b>' + esc(s.subscription_plans ? s.subscription_plans.name : "Plan") + "</b> · " + CV.naira(s.subscription_plans ? s.subscription_plans.price_monthly : 0) + " per month · " + esc(s.status) + (s.status === "active" ? "<br>Next payment due " + CV.date(s.renews_on) : "") + '<p class="fine">Pay by bank transfer to the official Calvora account only, and keep the receipt. Calvora staff record each payment with a reference.</p></div>'; }).join("") + (sp.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Paid</th><th>Period</th><th>Amount</th><th>Reference</th></tr></thead><tbody>' + sp.map(function (p) { return "<tr><td>" + CV.date(p.paid_on) + "</td><td class=\"small\">" + CV.date(p.period_start) + " to " + CV.date(p.period_end) + "</td><td>" + CV.naira(p.amount) + "</td><td>" + esc(p.reference) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") : "") +
      '<p class="fine">Deals and commission are recorded by Calvora staff, and the CEO marks each payment with a reference, so every payment can be traced.</p>');
  }

  /* ---------- weekly report ---------- */
  var WF = [["new_properties_sourced", "New properties sourced"], ["owner_contacts", "Property owner contacts"], ["authorisations_obtained", "Authorisations obtained"], ["listings_submitted", "Listings submitted"], ["inspections_attended", "Inspections attended"], ["enquiries_handled", "Customer enquiries handled"], ["transactions_completed", "Transactions completed"]];
  async function weekly() {
    var wk = PT.monday(), rows = must(await sb.from("agent_weekly_reports").select("*").eq("agent_id", user.id).order("week_start", { ascending: false }).limit(12));
    var cur = rows.find(function (r) { return r.week_start === wk; }) || {};
    setPane('<h2>Weekly report</h2><p class="muted">Week starting <b>' + CV.date(wk) + "</b>. Report honestly. Operations staff check every report against the system.</p>" +
      '<form id="wf" class="panel" novalidate><div class="grid2">' + WF.map(function (f) { return "<div><label for=\"w_" + f[0] + '">' + f[1] + '</label><input id="w_' + f[0] + '" type="number" min="0" step="1" inputmode="numeric" value="' + (cur[f[0]] || 0) + '"></div>'; }).join("") + '</div><label for="w_problems">Problems encountered</label><textarea id="w_problems" maxlength="1500">' + esc(cur.problems || "") + '</textarea><div id="wbox" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:14px">' + (cur.id ? "Update this week’s report" : "Save this week’s report") + "</button></form>" +
      (rows.length ? '<h3>Past reports</h3><div class="scroll"><table class="tbl"><thead><tr><th>Week</th><th>Sourced</th><th>Owners</th><th>Auth.</th><th>Listed</th><th>Inspections</th><th>Enquiries</th><th>Deals</th></tr></thead><tbody>' + rows.map(function (r) { return "<tr><td>" + CV.date(r.week_start) + "</td>" + WF.map(function (f) { return "<td>" + r[f[0]] + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>" : ""));
    $("#wf").onsubmit = async function (e) {
      e.preventDefault(); var row = { problems: $("#w_problems").value.trim() };
      WF.forEach(function (f) { row[f[0]] = Math.max(0, parseInt($("#w_" + f[0]).value, 10) || 0); });
      var r = await PT.saveRow(sb, "agent_weekly_reports", { agent_id: user.id, week_start: wk }, row);
      if (r.error) $("#wbox").innerHTML = fail(r.error); else { CV.toast("Weekly report saved"); weekly(); }
    };
  }

  /* ---------- ID card ---------- */
  function idcard() { setPane(PT.idBlock(profile, { badge: stats.badge })); PT.bindId(); }

  /* ---------- profile ---------- */
  function profileTab() {
    var av = profile.photo_url ? '<img src="' + esc(profile.photo_url) + '" alt="Your photo" style="width:96px;height:96px;border-radius:50%;object-fit:cover">' : '<span class="av av-i" style="width:96px;height:96px;font-size:1.8rem">' + esc(CV.initials(profile.full_name)) + "</span>";
    setPane('<h2>Profile</h2><form class="panel" id="pf" novalidate><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' + av + '<div><label for="pf_photo" style="margin-top:0">Your photo <span class="fine">(a clear face photo; it appears on your ID and public profile)</span></label><input id="pf_photo" type="file" accept="image/*"></div></div>' +
      '<div class="grid2"><div><label for="pf_phone">Phone</label><input id="pf_phone" type="tel" value="' + esc(profile.phone || "") + '"></div><div><label for="pf_loc">Location</label><input id="pf_loc" placeholder="e.g. Ado-Ekiti" value="' + esc(profile.location || "") + '"></div></div>' +
      '<p class="fine">Your name (' + esc(profile.full_name) + ") and ID number (" + esc(profile.agent_code) + ') can only be changed by the Calvora team.</p><div id="pfbox" aria-live="polite"></div><button class="btn" type="submit">Save profile</button></form>');
    $("#pf").onsubmit = async function (e) {
      e.preventDefault(); var box = $("#pfbox"), btn = e.target.querySelector("button[type=submit]"), f = $("#pf_photo").files[0], url = profile.photo_url;
      btn.disabled = true; box.innerHTML = "";
      try {
        if (f) url = await PT.uploadPublic(user.id, await PT.compress(f, 900, 0.85), "profile");
        must(await sb.rpc("update_my_profile", { p_phone: $("#pf_phone").value, p_location: $("#pf_loc").value, p_photo_url: url || "" }));
        profile = must(await sb.from("profiles").select("*").eq("id", user.id).single()); CV.toast("Profile saved"); profileTab();
      } catch (er) { box.innerHTML = fail(er); btn.disabled = false; }
    };
  }

  boot();
})();
