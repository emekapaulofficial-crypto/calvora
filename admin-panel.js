/* CALVORA staff admin panel (admin.html). Tabs follow the role; the database enforces the same rules. */
(function () {
  "use strict";
  var CV = window.CV, PT = window.PT, sb = PT.sb, esc = CV.esc, $ = PT.$, $$ = PT.$$;
  var root = document.getElementById("app");
  var user, profile, ROLE, OPS, ADM, tab = (location.hash === "#chat" ? "chat" : "overview"), chatTimer = null;

  function must(r) { if (r.error) throw r.error; return r.data; }
  function setPane(html) { var p = $("#pane"); p.innerHTML = html; return p; }
  function fail(e) { return CV.problem(PT.msg(e)); }
  async function signOut() { await sb.auth.signOut(); user = profile = null; boot(); }
  function cap(s) { return String(s || "").replace(/_/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); }); }
  var CHIP = { submitted: "n", under_review: "n", pending_review: "n", approved: "g", needs_information: "o", needs_changes: "o", rejected: "o", suspended: "o", hidden: "o", draft: "o", rented: "n", sold: "n", new: "n", contacted: "g", closed: "o", spam: "o", requested: "n", confirmed: "g", completed: "g", cancelled: "o", no_show: "o", received: "n", investigating: "n", resolved: "g", dismissed: "o", due: "n", paid: "g", pending: "n", active: "g" };
  function chip(s) { return '<span class="chip ' + (CHIP[s] || "o") + '">' + esc(cap(s)) + "</span>"; }

  /** small question box (replaces prompt()) */
  function ask(title, label, okText, cb, opts) {
    opts = opts || {};
    var d = document.createElement("dialog"); d.className = "dlg";
    d.innerHTML = '<form method="dialog"><h3 style="margin-top:0">' + esc(title) + "</h3><label for=\"dq\">" + esc(label) + "</label>" + (opts.long ? '<textarea id="dq" rows="3" maxlength="500"></textarea>' : '<input id="dq" maxlength="120" autocomplete="off">') + '<div id="dbox" aria-live="polite"></div><div class="acts-row" style="margin-top:14px"><button class="btn" id="dok" type="button">' + esc(okText) + '</button><button class="btn line" value="cancel">Cancel</button></div></form>';
    document.body.appendChild(d); d.showModal();
    d.addEventListener("close", function () { d.remove(); });
    $("#dok", d).onclick = async function () {
      var v = $("#dq", d).value.trim(); if (opts.min && v.length < opts.min) { $("#dbox", d).innerHTML = CV.problem(opts.hint || "Please fill this in."); return; }
      $("#dok", d).disabled = true; try { await cb(v); d.close(); } catch (e) { $("#dbox", d).innerHTML = fail(e); $("#dok", d).disabled = false; }
    };
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      if (PT.isRecovery()) return PT.resetCard(root, boot);
      var s = (await sb.auth.getSession()).data.session;
      if (!s) return PT.authCard(root, { title: "Staff sign in", onSignedIn: boot });
      user = s.user;
      profile = must(await sb.from("profiles").select("*").eq("id", user.id).single());
      ROLE = profile.status !== "active" ? null : profile.role === "admin" ? "admin" : profile.role === "staff" ? profile.staff_role : null;
      if (!ROLE) return noAccess();
      OPS = ROLE === "admin" || ROLE === "operations"; ADM = ROLE === "admin";
      panel();
    } catch (e) { root.innerHTML = fail(e) + '<p><button class="btn line" onclick="location.reload()">Try again</button></p>'; }
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") PT.resetCard(root, boot); });
  function noAccess() {
    root.innerHTML = '<div class="whoami"><span>Signed in as <b>' + esc(profile.full_name || user.email) + '</b></span><button class="btn line sm" id="signout" type="button">Sign out</button></div><div class="panel"><h2>No staff access</h2><p>This account is not set up as Calvora staff' + (profile.status !== "active" ? " (the account is not active)" : "") + ". Ask the CEO to add your email under Staff. If you are an agent, use the " + '<a href="agent.html">agent portal</a>.</p></div>';
    $("#signout").onclick = signOut;
  }

  async function counts() {
    function c(q) { return q.then(function (r) { return r.count || 0; }); }
    var h = { count: "exact", head: true };
    var r = await Promise.all([
      OPS ? c(sb.from("agent_applications").select("id", h).in("status", ["submitted", "under_review"])) : 0,
      c(sb.from("properties").select("id", h).in("status", ["pending_review", "under_review"])),
      c(sb.from("property_inquiries").select("id", h).eq("status", "new")),
      c(sb.from("agent_reviews").select("id", h).eq("verified", false)),
      c(sb.from("complaints").select("id", h).eq("status", "received")),
      OPS ? c(sb.from("commissions").select("id", h).in("status", ["due", "pending"])) : 0,
      sb.rpc("crm_due_count").then(function (x) { return x.data || 0; }),
      ADM ? c(sb.from("agent_subscriptions").select("id", h).eq("status", "active").lt("renews_on", new Date().toISOString().slice(0, 10))) : 0
    ]);
    return { apps: r[0], props: r[1], enq: r[2], revs: r[3], comp: r[4], due: r[5], crm: r[6], subsDue: r[7] };
  }

  var VIEWS;
  async function panel(noGo) {
    var n = await counts();
    var tabs = [["overview", "Overview"]];
    if (OPS) tabs.push(["applications", "Agent applications", n.apps || ""]);
    tabs.push(["properties", OPS ? "Properties" : "Properties (view)", n.props || ""], ["enquiries", "Enquiries and visits", n.enq || ""], ["reviews", "Reviews", n.revs || ""], ["complaints", "Complaints", n.comp || ""]);
    if (OPS) tabs.push(["deals", "Deals and commission", n.due || ""]);
    tabs.push(["agents", "Agents"]);
    if (OPS) tabs.push(["reports", "Agent reports"]);
    if (ADM) tabs.push(["scorecard", "Weekly scorecard"], ["staff", "Staff"], ["audit", "Audit log"]);
    tabs.push(["myreport", "My weekly report"], ["chat", "Staff chat"], ["idcard", "My ID card"]);
    window._counts = n;
    if (window.AdminR2) window.AdminR2.tabs(tabs, { OPS: OPS, ADM: ADM }, n);
    PT.shell(root, tabs, tab, (profile.full_name || user.email) + " (" + (ROLE === "admin" ? "CEO / Admin" : cap(ROLE)) + ")", go, signOut);
    if (!noGo) go(tab === "property" ? "properties" : tab);
  }
  async function go(t, arg) {
    if (t !== "chat" && chatTimer) { clearInterval(chatTimer); chatTimer = null; }
    tab = t; PT.mark({ property: "properties", lead: "crm", landlord: "landlords" }[t] || t); setPane('<div class="loading"><span class="pulse"></span>Loading…</div>');
    try { await VIEWS[t](arg); } catch (e) { setPane(fail(e)); }
    var p = $("#pane"); if (p && window.innerWidth < 860) p.scrollIntoView({ block: "start" });
  }
  function bindGo() { $$("[data-go]").forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); }
  async function names(ids) {
    ids = ids.filter(function (x, i, a) { return x && a.indexOf(x) === i; }); if (!ids.length) return {};
    var rows = must(await sb.from("profiles").select("id,full_name,agent_code,staff_code").in("id", ids)), m = {};
    rows.forEach(function (r) { m[r.id] = r; }); return m;
  }
  function nm(m, id) { var p = m[id]; return p ? esc(p.full_name || "(no name)") + ' <span class="small muted">' + esc(p.agent_code || p.staff_code || "") + "</span>" : '<span class="muted">Unknown</span>'; }
  function statusOpts(list, cur) { return list.map(function (s) { return '<option value="' + s + '"' + (s === cur ? " selected" : "") + ">" + cap(s) + "</option>"; }).join(""); }
  function empty(t) { return '<div class="empty">' + t + "</div>"; }

  /* ---------- overview ---------- */
  function overview() {
    var n = window._counts, cards = [];
    if (OPS) cards.push(["applications", n.apps, "Agent applications to review"]);
    cards.push(["properties", n.props, OPS ? "Properties waiting for review" : "Properties waiting for review (view only)"], ["enquiries", n.enq, "New customer enquiries"], ["reviews", n.revs, "Reviews to verify"], ["complaints", n.comp, "New complaints"]);
    if (OPS) cards.push(["deals", n.due, "Commissions due"]);
    setPane("<h2>Overview</h2><p class=\"muted\">Welcome, " + esc((profile.full_name || "").split(" ")[0] || "team") + ". Here is what needs attention.</p><div class=\"stats4\">" + cards.map(function (c) { return '<button type="button" class="stat statbtn" data-go="' + c[0] + '"><b>' + c[1] + "</b><span>" + c[2] + "</span></button>"; }).join("") + "</div>" +
      '<div class="panel"><h3>Your access</h3><p>' + (ADM ? "You have full access, including staff, the audit log and the weekly scorecard." : ROLE === "operations" ? "Operations: agent applications, property checks, deals and commission, agent reports, enquiries, reviews and complaints." : "Marketing: enquiries and inspection requests, reviews and complaints. You can see properties but cannot approve them.") + "</p></div>");
    bindGo();
  }

  /* ---------- applications ---------- */
  async function applications() {
    var all = must(await sb.from("agent_applications").select("*").order("created_at", { ascending: false }));
    var mode = (applications.mode = applications.mode || "todo");
    var rows = all.filter(function (a) { return mode === "all" || ["submitted", "under_review", "needs_information"].indexOf(a.status) >= 0; });
    setPane('<h2>Agent applications</h2><div class="seg"><button data-m="todo" class="' + (mode === "todo" ? "on" : "") + '">To review</button><button data-m="all" class="' + (mode === "all" ? "on" : "") + '">All applications</button></div>' +
      (rows.length ? rows.map(function (a) {
        return '<div class="panel appcard"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b style="font-size:1.1rem">' + esc(a.full_name) + "</b> " + chip(a.status) + '<div class="small muted">Applied ' + PT.dt(a.created_at) + "</div></div></div>" +
          '<table class="kv" style="margin-top:8px"><tr><td>Phone</td><td>' + PT.contactLinks(a.phone, "Hello " + a.full_name + ", this is Calvora about your agent application.") + "</td></tr><tr><td>WhatsApp</td><td>" + esc(a.whatsapp) + "</td></tr><tr><td>Works in</td><td>" + esc(a.operating_state) + " · " + esc(a.operating_areas) + "</td></tr></table>" +
          (a.experience ? "<p><b>Experience.</b> " + esc(a.experience) + "</p>" : "") + (a.references_text ? "<p><b>References.</b> " + esc(a.references_text) + "</p>" : "") +
          '<div class="acts-row">' + (a.id_document_path ? '<button class="btn line sm" data-doc="' + esc(a.id_document_path) + '">View ID document</button>' : '<span class="muted small">No ID document</span>') + "</div>" +
          (a.reviewer_note ? '<p class="small"><b>Last note:</b> ' + esc(a.reviewer_note) + "</p>" : "") +
          '<label for="n_' + a.id + '">Decision note <span class="fine">(required for needs information, reject and suspend)</span></label><textarea id="n_' + a.id + '" rows="2" maxlength="500"></textarea>' +
          '<div class="acts-row" style="margin-top:10px">' + [["under_review", "Mark under review"], ["approved", a.status === "suspended" ? "Reinstate" : "Approve"], ["needs_information", "Needs information"], ["rejected", "Reject"]].concat(a.status === "approved" ? [["suspended", "Suspend"]] : []).map(function (b) { return '<button class="btn ' + (b[0] === "approved" ? "green" : "line") + ' sm" data-app="' + a.id + '" data-s="' + b[0] + '">' + b[1] + "</button>"; }).join("") + "</div></div>";
      }).join("") : empty("Nothing waiting. New applications show up here.")));
    $$("[data-m]").forEach(function (b) { b.onclick = function () { applications.mode = b.dataset.m; go("applications"); }; });
    $$("[data-doc]").forEach(function (b) { b.onclick = async function () { try { window.open(await PT.signed("agent-docs", b.dataset.doc), "_blank", "noopener"); } catch (e) { CV.toast(PT.msg(e), 1); } }; });
    $$("[data-app]").forEach(function (b) {
      b.onclick = async function () {
        var note = $("#n_" + b.dataset.app).value.trim(), s = b.dataset.s;
        if (["needs_information", "rejected", "suspended"].indexOf(s) >= 0 && !note) { CV.toast("Please write a decision note first.", 1); return; }
        if (s === "approved" && !confirm("Approve this person as a Calvora agent? They will get an agent ID number and a one-year ID card.")) return;
        b.disabled = true; var r = await sb.rpc("review_application", { p_id: b.dataset.app, p_status: s, p_note: note });
        if (r.error) { CV.toast(PT.msg(r.error), 1); b.disabled = false; } else { CV.toast("Application updated"); panel(); }
      };
    });
  }

  /* ---------- properties ---------- */
  var LABELS = [["agent_identity_checked", "Agent identity checked"], ["property_viewed", "Property viewed by our team"], ["owner_authority_checked", "Owner authority checked"], ["details_recently_confirmed", "Details recently confirmed"]];
  var KIND = { "rent|house": "House for rent", "sale|house": "House for sale", "sale|land": "Land for sale" };
  var PSEG = { todo: ["To review", ["pending_review", "under_review"]], changes: ["Needs changes", ["needs_changes"]], live: ["Live", ["approved"]], closed: ["Closed", ["rented", "sold"]], other: ["Rejected or hidden", ["rejected", "hidden"]], all: ["All", null] };
  async function properties() {
    var seg = (properties.seg = properties.seg || "todo");
    var q = sb.from("properties").select("*").order("created_at", { ascending: false }).limit(200);
    if (PSEG[seg][1]) q = q.in("status", PSEG[seg][1]);
    var rows = must(await q), m = await names(rows.map(function (r) { return r.agent_id; }));
    var vr = rows.length ? must(await sb.from("verification_records").select("property_id,label").in("property_id", rows.map(function (r) { return r.id; }))) : [], chk = {};
    vr.forEach(function (v) { (chk[v.property_id] = chk[v.property_id] || {})[v.label] = 1; });
    setPane("<h2>Properties</h2>" + (OPS ? "" : '<p class="fine">You can see properties but only Operations and the CEO can check and approve them.</p>') + '<div class="seg">' + Object.keys(PSEG).map(function (k) { return '<button data-seg="' + k + '" class="' + (seg === k ? "on" : "") + '">' + PSEG[k][0] + "</button>"; }).join("") + "</div>" +
      (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Property</th><th>Agent</th><th>Type</th><th>Price</th><th>Status</th>' + (OPS ? "<th>Checks</th>" : "") + "<th></th></tr></thead><tbody>" + rows.map(function (p) {
        return "<tr><td><b>" + esc(p.title) + '</b><div class="small muted">' + esc(p.listing_code) + " · " + esc(p.area) + ", " + esc(p.state) + "</div></td><td>" + nm(m, p.agent_id) + "</td><td>" + (KIND[p.listing_type + "|" + p.category] || "") + "</td><td>" + CV.naira(p.price) + "</td><td>" + chip(p.status) + "</td>" + (OPS ? "<td>" + Object.keys(chk[p.id] || {}).length + " of 4</td>" : "") + '<td><button class="btn line sm" data-open="' + p.id + '">Open</button></td></tr>';
      }).join("") + "</tbody></table></div>" : empty("No properties here.")));
    $$("[data-seg]").forEach(function (b) { b.onclick = function () { properties.seg = b.dataset.seg; go("properties"); }; });
    $$("[data-open]").forEach(function (b) { b.onclick = function () { go("property", b.dataset.open); }; });
  }
  async function property(id) {
    var p = must(await sb.from("properties").select("*").eq("id", id).single()), m = await names([p.agent_id]);
    var owner = null, recs = [];
    if (OPS) { owner = (await sb.from("property_owner_details").select("*").eq("property_id", id).maybeSingle()).data; recs = must(await sb.from("verification_records").select("*").eq("property_id", id).order("verified_at", { ascending: false })); }
    var done = {}; recs.forEach(function (r) { if (!done[r.label]) done[r.label] = r; });
    var nDone = Object.keys(done).length, land = p.category === "land";
    var vm = recs.length ? await names(recs.map(function (r) { return r.verified_by; })) : {};
    setPane('<p><button class="linkbtn" data-go="properties">&larr; Back to properties</button></p><h2 style="margin-bottom:4px">' + esc(p.title) + "</h2><p>" + chip(p.status) + ' <span class="muted small">' + esc(p.listing_code) + " · " + (KIND[p.listing_type + "|" + p.category] || "") + "</span></p>" +
      (p.reviewer_note ? '<div class="note bad">' + CV.icon("warn") + "<div><b>Last note:</b> " + esc(p.reviewer_note) + "</div></div>" : "") +
      '<div class="two"><div class="panel"><h3>Details</h3><table class="kv"><tr><td>Agent</td><td>' + nm(m, p.agent_id) + "</td></tr><tr><td>Location</td><td>" + esc(p.area) + ", " + esc(p.state) + "</td></tr><tr><td>" + (land ? "Land use" : "Type") + "</td><td>" + esc(p.property_type) + "</td></tr>" +
      (land ? "<tr><td>Size</td><td>" + (p.land_size_sqm || "") + " sqm</td></tr><tr><td>Title</td><td>" + esc(p.land_title || "") + "</td></tr>" : "<tr><td>Bedrooms / bathrooms</td><td>" + (p.bedrooms == null ? "-" : p.bedrooms) + " / " + (p.bathrooms == null ? "-" : p.bathrooms) + "</td></tr>") +
      "<tr><td>" + (p.listing_type === "rent" ? "Rent per year" : "Price") + "</td><td>" + CV.naira(p.price) + "</td></tr><tr><td>Agency fee</td><td>" + CV.naira(p.agency_fee || 0) + "</td></tr><tr><td>Legal fee</td><td>" + CV.naira(p.legal_fee || 0) + "</td></tr>" + (p.listing_type === "rent" ? "<tr><td>Caution fee</td><td>" + CV.naira(p.caution_fee || 0) + "</td></tr>" : "") + "</table>" +
      (p.description ? '<p style="white-space:pre-line">' + esc(p.description) + "</p>" : "") + ((p.features || []).length ? '<ul class="feat">' + p.features.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" : "") +
      (p.video_url ? '<p><a class="btn line sm" href="' + esc(p.video_url) + '" target="_blank" rel="noopener noreferrer">Open the video link</a></p>' : "") +
      '<div class="photos">' + (p.photo_urls || []).map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="" loading="lazy"></a>'; }).join("") + "</div>" +
      (["approved", "rented", "sold"].indexOf(p.status) >= 0 ? '<p><a href="property.html?id=' + p.id + '" target="_blank" rel="noopener">See the public page</a></p>' : "") + "</div>" +
      (OPS ? '<div><div class="panel"><h3>Private owner details</h3>' + (owner ? '<table class="kv"><tr><td>Relationship</td><td>' + esc(owner.relationship) + "</td></tr><tr><td>Owner</td><td>" + esc(owner.owner_name) + "</td></tr><tr><td>Phone</td><td>" + esc(owner.owner_phone) + "</td></tr>" + (owner.owner_email ? "<tr><td>Email</td><td>" + esc(owner.owner_email) + "</td></tr>" : "") + "<tr><td>Address</td><td>" + esc(owner.owner_address) + "</td></tr><tr><td>Agent says owner permits listing</td><td>" + (owner.authorised ? "Yes" : "<b>No</b>") + "</td></tr></table>" + (owner.proof_paths || []).map(function (pp, i) { return '<button class="btn line sm" style="margin:4px 6px 0 0" data-proof="' + esc(pp) + '">View proof ' + (i + 1) + "</button>"; }).join("") : '<p class="muted">The agent has not entered owner details yet.</p>') + "</div>" +
        '<div class="panel"><h3>The four checks (' + nDone + " of 4 recorded)</h3>" + LABELS.map(function (l) {
          var r = done[l[0]];
          return '<div class="chk"><div><b>' + l[1] + "</b> " + (r ? '<span class="chip g">Recorded</span>' : '<span class="chip o">Not yet</span>') + (r ? '<div class="small muted">' + PT.dt(r.verified_at) + " by " + ((vm[r.verified_by] && esc(vm[r.verified_by].full_name)) || "staff") + ": " + esc(r.evidence_note) + (r.recheck_by ? " · recheck by " + CV.date(r.recheck_by) : "") + "</div>" : "") + '</div><button class="btn line sm" data-chk="' + l[0] + '">' + (r ? "Record again" : "Record") + "</button></div>";
        }).join("") + '<p class="fine">A check is recorded only after you have really done it. The note is the evidence: what you saw and who you spoke to.</p></div>' +
        '<div class="panel"><h3>Decision</h3><label for="pn">Note <span class="fine">(required for needs changes, reject and hide; the agent sees it)</span></label><textarea id="pn" rows="3" maxlength="500"></textarea><div class="acts-row" style="margin-top:10px">' +
        [["under_review", "Mark under review", "line"], ["approved", "Approve and publish", "green"], ["needs_changes", "Needs changes", "line"], ["rejected", "Reject", "line"], ["hidden", "Hide", "line"]].map(function (b) { return '<button class="btn ' + b[2] + ' sm" data-rv="' + b[0] + '">' + b[1] + "</button>"; }).join("") + '</div><p class="fine">Approval needs all four checks on record. The database refuses it otherwise.</p></div></div>' : '<div class="panel"><h3>Status</h3><p>' + chip(p.status) + '</p><p class="muted">Only Operations and the CEO can see owner details and decide on properties.</p></div>') + "</div>");
    bindGo();
    if (OPS && window.AdminR2) window.AdminR2.landlordPanel(p).catch(function () {});
    $$("[data-proof]").forEach(function (b) { b.onclick = async function () { try { window.open(await PT.signed("owner-docs", b.dataset.proof), "_blank", "noopener"); } catch (e) { CV.toast(PT.msg(e), 1); } }; });
    $$("[data-chk]").forEach(function (b) {
      b.onclick = function () {
        var lab = LABELS.find(function (l) { return l[0] === b.dataset.chk; });
        ask("Record: " + lab[1], "What did you see or confirm? (this is the evidence)", "Record check", async function (note) {
          var r = await sb.rpc("add_verification", { p_property: id, p_label: lab[0], p_note: note }); if (r.error) throw r.error; CV.toast("Check recorded"); go("property", id);
        }, { long: true, min: 3, hint: "Please write what you saw or confirmed." });
      };
    });
    $$("[data-rv]").forEach(function (b) {
      b.onclick = async function () {
        var s = b.dataset.rv, note = $("#pn").value.trim();
        if (["needs_changes", "rejected", "hidden"].indexOf(s) >= 0 && !note) { CV.toast("Please write a note first.", 1); return; }
        if (s === "approved" && !confirm("Publish this property? It will appear on the public website.")) return;
        b.disabled = true; var r = await sb.rpc("review_property", { p_id: id, p_status: s, p_note: note });
        if (r.error) { CV.toast(PT.msg(r.error), 1); b.disabled = false; } else { CV.toast("Property updated"); panel(true); go("property", id); }
      };
    });
  }

  /* ---------- enquiries and inspections ---------- */
  async function enquiries() {
    var seg = (enquiries.seg = enquiries.seg || "enq"), html;
    if (seg === "enq") {
      var rows = must(await sb.from("property_inquiries").select("*, properties(title,listing_code,agent_id)").order("created_at", { ascending: false }).limit(150)), m = await names(rows.map(function (r) { return r.properties && r.properties.agent_id; }));
      html = rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Customer</th><th>Property</th><th>Message</th><th>Received</th><th>Status</th></tr></thead><tbody>' + rows.map(function (q) {
        return "<tr><td><b>" + esc(q.customer_name) + '</b><div class="small">' + PT.contactLinks(q.customer_phone, "Hello " + q.customer_name + ", this is Calvora about your enquiry.") + "</div>" + (q.customer_email ? '<div class="small">' + esc(q.customer_email) + "</div>" : "") + "</td><td>" + (q.properties ? esc(q.properties.title) + '<div class="small muted">' + esc(q.properties.listing_code) + " · " + nm(m, q.properties.agent_id) + "</div>" : '<span class="muted">General (contact page)</span>') + '</td><td style="min-width:220px;white-space:pre-line">' + esc(q.message) + '</td><td class="small">' + PT.dt(q.created_at) + '</td><td><select data-q="' + q.id + '" aria-label="Status">' + statusOpts(["new", "contacted", "closed", "spam"], q.status) + "</select></td></tr>";
      }).join("") + "</tbody></table></div>" : empty("No enquiries yet.");
    } else {
      var ib = must(await sb.from("inspection_bookings").select("*, properties(title,listing_code)").order("requested_at", { ascending: true }).limit(150)), m2 = await names(ib.map(function (r) { return r.agent_id; }));
      html = ib.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>When</th><th>Customer</th><th>Property</th><th>Agent</th><th>Status</th></tr></thead><tbody>' + ib.map(function (b) {
        return "<tr><td><b>" + PT.dt(b.requested_at) + "</b>" + (b.notes ? '<div class="small muted">' + esc(b.notes) + "</div>" : "") + "</td><td><b>" + esc(b.customer_name) + '</b><div class="small">' + PT.contactLinks(b.customer_phone, "Hello " + b.customer_name + ", this is Calvora about your inspection request.") + "</div></td><td>" + (b.properties ? esc(b.properties.title) : "") + "</td><td>" + nm(m2, b.agent_id) + '</td><td><select data-b="' + b.id + '" aria-label="Status">' + statusOpts(["requested", "confirmed", "completed", "cancelled", "no_show"], b.status) + "</select></td></tr>";
      }).join("") + "</tbody></table></div>" : empty("No inspection requests yet.");
    }
    setPane('<h2>Enquiries and visits</h2><div class="seg"><button data-s="enq" class="' + (seg === "enq" ? "on" : "") + '">Enquiries</button><button data-s="insp" class="' + (seg === "insp" ? "on" : "") + '">Inspection requests</button></div>' + html);
    $$("[data-s]").forEach(function (b) { b.onclick = function () { enquiries.seg = b.dataset.s; go("enquiries"); }; });
    $$("[data-q]").forEach(function (s) { s.onchange = async function () { var r = await sb.from("property_inquiries").update({ status: s.value }).eq("id", s.dataset.q); r.error ? CV.toast(PT.msg(r.error), 1) : CV.toast("Updated"); }; });
    $$("[data-q]").forEach(function (s) {
      s.insertAdjacentHTML("afterend", '<div style="margin-top:6px"><button class="btn line sm" type="button">Add to CRM</button></div>');
      s.nextElementSibling.firstChild.onclick = async function () { var r = await sb.rpc("convert_enquiry_to_lead", { p_enquiry: s.dataset.q }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Added to Customers (CRM)"), panel(true), go("lead", r.data)); };
    });
    $$("[data-b]").forEach(function (s) { s.onchange = async function () { var r = await sb.from("inspection_bookings").update({ status: s.value }).eq("id", s.dataset.b); r.error ? CV.toast(PT.msg(r.error), 1) : CV.toast("Updated"); }; });
  }

  /* ---------- reviews ---------- */
  async function reviews() {
    var rows = must(await sb.from("agent_reviews").select("*").order("created_at", { ascending: false }).limit(150)), m = await names(rows.map(function (r) { return r.agent_id; }));
    setPane('<h2>Reviews</h2><p class="fine">A review counts and shows publicly only after you verify it. Check the reviewer really dealt with the agent (call the number they gave) before you verify.</p>' + (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Agent</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Status</th><th></th></tr></thead><tbody>' + rows.map(function (r) {
      return "<tr><td>" + nm(m, r.agent_id) + "</td><td><b>" + esc(r.reviewer_name) + '</b><div class="small">' + PT.contactLinks(r.reviewer_phone, "Hello " + r.reviewer_name + ", this is Calvora. You left a review for one of our agents and we would like to confirm it.") + "</div></td><td>" + r.rating + ' ★</td><td style="min-width:200px">' + esc(r.comment) + "</td><td>" + (r.verified ? '<span class="chip g">Verified</span>' : '<span class="chip o">Waiting</span>') + '</td><td><div class="acts-row"><button class="btn line sm" data-ver="' + r.id + '" data-v="' + (r.verified ? "0" : "1") + '">' + (r.verified ? "Unverify" : "Verify") + '</button><button class="btn line sm" data-delr="' + r.id + '">Delete</button></div></td></tr>';
    }).join("") + "</tbody></table></div>" : empty("No reviews yet.")));
    $$("[data-ver]").forEach(function (b) { b.onclick = async function () { var r = await sb.from("agent_reviews").update({ verified: b.dataset.v === "1" }).eq("id", b.dataset.ver); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Updated"), panel(true), go("reviews")); }; });
    $$("[data-delr]").forEach(function (b) { b.onclick = async function () { if (!confirm("Delete this review?")) return; var r = await sb.from("agent_reviews").delete().eq("id", b.dataset.delr); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Deleted"), panel(true), go("reviews")); }; });
  }

  /* ---------- complaints ---------- */
  async function complaints() {
    var rows = must(await sb.from("complaints").select("*, properties(title,listing_code)").order("created_at", { ascending: false }).limit(150));
    setPane('<h2>Complaints</h2>' + (rows.length ? rows.map(function (c) {
      return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>' + esc(c.ref_code) + "</b> " + chip(c.status) + '<div class="small muted">' + esc(c.category) + " · " + PT.dt(c.created_at) + "</div></div></div>" +
        '<p style="white-space:pre-line">' + esc(c.description) + "</p>" + (c.properties ? '<p class="small">Property: ' + esc(c.properties.title) + " (" + esc(c.properties.listing_code) + ")</p>" : "") +
        '<p class="small">From: ' + (c.reporter_name ? esc(c.reporter_name) : "Anonymous") + (c.reporter_phone ? " · " + PT.contactLinks(c.reporter_phone, "Hello, this is Calvora about your complaint " + c.ref_code + ".") : "") + "</p>" +
        '<div class="grid2"><div><label for="cs_' + c.id + '">Status</label><select id="cs_' + c.id + '">' + statusOpts(["received", "investigating", "resolved", "dismissed"], c.status) + '</select></div><div><label for="cn_' + c.id + '">Outcome / note</label><textarea id="cn_' + c.id + '" rows="2" maxlength="1000">' + esc(c.resolution_note || "") + '</textarea></div></div><button class="btn sm" data-c="' + c.id + '" style="margin-top:10px">Save</button></div>';
    }).join("") : empty("No complaints. Good.")));
    $$("[data-c]").forEach(function (b) { b.onclick = async function () { var id = b.dataset.c, st = $("#cs_" + id).value, note = $("#cn_" + id).value.trim(); if ((st === "resolved" || st === "dismissed") && !note) { CV.toast("Please write the outcome before you close a complaint.", 1); return; } var r = await sb.from("complaints").update({ status: st, resolution_note: note }).eq("id", id); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Saved"), panel(true), go("complaints")); }; });
  }

  /* ---------- deals and commission ---------- */
  async function deals() {
    var tx = must(await sb.from("transactions").select("*, properties(title,listing_code)").order("completed_at", { ascending: false }).limit(100));
    var com = must(await sb.from("commissions").select("*, properties(title,listing_code)").order("created_at", { ascending: false }).limit(100));
    var done = tx.filter(function (t) { return t.status === "completed"; }).map(function (t) { return t.property_id; });
    var cand = must(await sb.from("properties").select("id,title,listing_code,listing_type,price,agent_id,status").in("status", ["approved", "rented", "sold"]).order("created_at", { ascending: false }).limit(200)).filter(function (p) { return done.indexOf(p.id) < 0; });
    var m = await names(tx.map(function (t) { return t.agent_id; }).concat(com.map(function (c) { return c.agent_id; })).concat(cand.map(function (p) { return p.agent_id; })));
    setPane('<h2>Deals and commission</h2><form class="panel" id="df" novalidate><h3>Record a completed deal</h3><p class="fine" style="margin-top:0">This closes the property, counts towards the agent’s badge, and creates the commission due to the agent. Only record a deal that has really completed.</p>' +
      '<label for="d_prop">Property</label><select id="d_prop"><option value="">Choose a property</option>' + cand.map(function (p) { return '<option value="' + p.id + '" data-price="' + p.price + '">' + esc(p.title) + " (" + esc(p.listing_code) + ") – " + esc((m[p.agent_id] || {}).full_name || "") + "</option>"; }).join("") + "</select>" +
      '<div class="grid2"><div><label for="d_cust">Customer name</label><input id="d_cust" maxlength="100"></div><div><label for="d_phone">Customer phone</label><input id="d_phone" type="tel"></div></div>' +
      '<div class="grid2"><div><label for="d_val">Deal value (₦)</label><input id="d_val" type="number" min="1" step="1" inputmode="numeric"></div><div><label for="d_com">Calvora commission earned (₦)</label><input id="d_com" type="number" min="0" step="1" inputmode="numeric"></div></div>' +
      '<div class="grid2"><div><label for="d_share">Agent’s share of the commission (₦)</label><input id="d_share" type="number" min="0" step="1" inputmode="numeric"></div><div><label for="d_notes">Notes</label><input id="d_notes" maxlength="300"></div></div><div id="dfbox" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:14px">Record deal</button></form>' +
      "<h3>Commissions</h3>" + (com.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Agent</th><th>Property</th><th>Amount</th><th>Status</th><th>Paid</th><th></th></tr></thead><tbody>' + com.map(function (c) { return "<tr><td>" + nm(m, c.agent_id) + "</td><td>" + (c.properties ? esc(c.properties.title) : "") + "</td><td><b>" + CV.naira(c.amount) + "</b></td><td>" + chip(c.status) + "</td><td>" + (c.paid_at ? CV.date(c.paid_at) + '<div class="small muted">' + esc(c.reference || "") + "</div>" : "") + "</td><td>" + (ADM && (c.status === "due" || c.status === "pending") ? '<button class="btn line sm" data-pay="' + c.id + '">Mark paid</button>' : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" + (ADM ? "" : '<p class="fine">Only the CEO can mark a commission as paid.</p>') : empty("No commissions yet.")) +
      '<h3 style="margin-top:22px">Completed deals</h3>' + (tx.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Date</th><th>Property</th><th>Agent</th><th>Customer</th><th>Deal value</th><th>Commission</th><th>Agent share</th></tr></thead><tbody>' + tx.map(function (t) { return "<tr><td>" + CV.date(t.completed_at) + "</td><td>" + (t.properties ? esc(t.properties.title) : "") + "</td><td>" + nm(m, t.agent_id) + "</td><td>" + esc(t.customer_name) + "</td><td>" + CV.naira(t.deal_value) + "</td><td>" + CV.naira(t.commission_amount) + "</td><td>" + CV.naira(t.agent_share) + "</td></tr>"; }).join("") + "</tbody></table></div>" : empty("No completed deals yet.")));
    $("#d_prop").onchange = function () { var o = this.selectedOptions[0]; if (o && o.dataset.price && !$("#d_val").value) $("#d_val").value = o.dataset.price; };
    $("#df").onsubmit = async function (e) {
      e.preventDefault(); var box = $("#dfbox"), n = function (id) { return Number($(id).value); };
      if (!$("#d_prop").value) { box.innerHTML = CV.problem("Please choose the property."); return; }
      if ($("#d_cust").value.trim().length < 2) { box.innerHTML = CV.problem("Please enter the customer’s name."); return; }
      if (!(n("#d_val") > 0)) { box.innerHTML = CV.problem("Please enter the deal value."); return; }
      if ($("#d_com").value === "" || $("#d_share").value === "") { box.innerHTML = CV.problem("Please enter the commission and the agent’s share (use 0 if there is none)."); return; }
      if (n("#d_share") > n("#d_com")) { box.innerHTML = CV.problem("The agent’s share cannot be more than the commission."); return; }
      if (!confirm("Record this deal? The property will be closed and the commission recorded.")) return;
      var r = await sb.rpc("complete_transaction", { p_property: $("#d_prop").value, p_customer: $("#d_cust").value.trim(), p_phone: $("#d_phone").value.trim(), p_deal_value: n("#d_val"), p_commission: n("#d_com"), p_agent_share: n("#d_share"), p_notes: $("#d_notes").value.trim() });
      if (r.error) box.innerHTML = fail(r.error); else { CV.toast("Deal recorded"); go("deals"); }
    };
    $$("[data-pay]").forEach(function (b) { b.onclick = function () { ask("Mark commission as paid", "Payment reference (bank transfer reference or receipt number)", "Mark as paid", async function (ref) { var r = await sb.rpc("mark_commission_paid", { p_id: b.dataset.pay, p_reference: ref }); if (r.error) throw r.error; CV.toast("Marked as paid"); panel(true); go("deals"); }, { min: 3, hint: "A payment reference is required so every payment can be traced." }); }; });
  }

  /* ---------- agents ---------- */
  async function agents() {
    var rows = must(await sb.rpc("staff_agent_stats")), apps = OPS ? must(await sb.from("agent_applications").select("id,user_id,status")) : [], am = {};
    apps.forEach(function (a) { am[a.user_id] = a; });
    setPane('<h2>Agents</h2>' + (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Agent</th><th>Status</th><th>Badge</th><th>Listings</th><th>Deals</th><th>Rating</th><th>ID expires</th>' + (OPS ? "<th></th>" : "") + "</tr></thead><tbody>" + rows.map(function (a) {
      var exp = a.id_expires_at && new Date(a.id_expires_at) < new Date();
      return "<tr><td><b>" + esc(a.full_name) + '</b><div class="small muted">' + esc(a.agent_code) + (a.location ? " · " + esc(a.location) : "") + "</div></td><td>" + chip(a.status) + "</td><td>" + CV.badgeChip(a.badge, 20) + "</td><td>" + a.approved_listings + "</td><td>" + a.completed_transactions + "</td><td>" + (a.review_count ? Number(a.avg_rating).toFixed(1) + " (" + a.review_count + ")" : "–") + "</td><td>" + (a.id_expires_at ? CV.date(a.id_expires_at) : "") + (exp ? ' <span class="chip o">Expired</span>' : "") + "</td>" +
        (OPS ? '<td><div class="acts-row"><button class="btn line sm" data-renew="' + a.agent_id + '">Renew ID</button><button class="btn line sm" data-award="' + a.agent_id + '" data-nm="' + esc(a.full_name) + '">Award</button>' + (am[a.agent_id] ? (a.status === "active" ? '<button class="btn line sm" data-sus="' + am[a.agent_id].id + '">Suspend</button>' : '<button class="btn line sm" data-rein="' + am[a.agent_id].id + '">Reinstate</button>') : "") + "</div></td>" : "") + "</tr>";
    }).join("") + "</tbody></table></div>" : empty("No agents yet. Approve an application to add the first one.")));
    $$("[data-renew]").forEach(function (b) { b.onclick = async function () { if (!confirm("Renew this ID for one more year?")) return; var r = await sb.rpc("renew_id", { p_user: b.dataset.renew }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("ID renewed"), agents()); }; });
    $$("[data-award]").forEach(function (b) { b.onclick = function () { window.AdminR2.awardDialog(b.dataset.award, b.dataset.nm); }; });
    $$("[data-sus]").forEach(function (b) { b.onclick = function () { ask("Suspend this agent", "Reason (the agent will see this)", "Suspend", async function (n) { var r = await sb.rpc("review_application", { p_id: b.dataset.sus, p_status: "suspended", p_note: n }); if (r.error) throw r.error; CV.toast("Agent suspended"); agents(); }, { long: true, min: 3, hint: "A reason is required." }); }; });
    $$("[data-rein]").forEach(function (b) { b.onclick = async function () { if (!confirm("Reinstate this agent?")) return; var r = await sb.rpc("review_application", { p_id: b.dataset.rein, p_status: "approved", p_note: "Reinstated" }); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Agent reinstated"), agents()); }; });
  }

  /* ---------- Team weekly reporting: agents + staff, calls, outcomes and social results ---------- */
  var WF = [["calls_made", "Calls made"], ["follow_up_calls", "Follow-up calls"], ["answered_calls", "Connected calls"], ["prospects_contacted", "Prospects contacted"], ["meetings_booked", "Meetings booked"], ["viewings_attended", "Viewings attended"], ["new_leads", "New leads"], ["qualified_leads", "Qualified leads"], ["conversions", "Conversions"], ["new_properties_sourced", "Properties sourced"], ["owner_contacts", "Owner contacts"], ["listings_submitted", "Listings submitted"], ["transactions_completed", "Deals completed"], ["rental_enquiries", "Rental enquiries"], ["rental_transactions", "Rental deals"], ["land_opportunities", "Land opportunities"], ["land_inspections", "Land inspections"], ["verified_properties", "Verified properties"]];
  var SOCIAL = [["tiktok", "TikTok"], ["facebook", "Facebook"], ["whatsapp", "WhatsApp"], ["instagram", "Instagram"], ["youtube", "YouTube"]];
  function teamReportCard(r, a, prev) {
    var active = ["calls_made","follow_up_calls","answered_calls","prospects_contacted","meetings_booked","viewings_attended","new_leads","qualified_leads","conversions"];
    var complete = active.filter(function(k){return Number(r[k])>0;}).length, total = active.length, pct = Math.round(complete/total*100);
    var social = r.social_metrics || {}, socialLeads = SOCIAL.map(function(x){return Number((social[x[0]]||{}).leads)||0;}), leadTotal = socialLeads.reduce(function(n,v){return n+v;},0);
    var leadMix = leadTotal ? SOCIAL.map(function(x,i){return socialLeads[i];}).map(function(v,i,arr){var before=arr.slice(0,i).reduce(function(n,x){return n+x;},0), after=before+v;return (v?(["#7BD441","#012547","#2D86D6","#3FC9A0","#8E5BC0"][i]+" "+(before/leadTotal*100).toFixed(2)+"% "+(after/leadTotal*100).toFixed(2)+"%"):"");}).filter(Boolean).join(",") : "#E5322D 0 100%";
    var palette = {calls_made:"#E5322D",follow_up_calls:"#7BD441",answered_calls:"#012547",prospects_contacted:"#2D86D6",meetings_booked:"#3FC9A0",viewings_attended:"#8E5BC0",new_leads:"#E0A06C",qualified_leads:"#4B6B86",conversions:"#2D86D6",new_properties_sourced:"#7BD441",owner_contacts:"#012547",listings_submitted:"#3FC9A0",transactions_completed:"#8E5BC0",rental_enquiries:"#2D86D6",rental_transactions:"#8E5BC0",land_opportunities:"#7BD441",land_inspections:"#3FC9A0",verified_properties:"#012547"};
    var reportFields = a && a.role === "agent" ? WF : WF.slice(0,9);
    var max = Math.max(1,...reportFields.map(function(f){return Number(r[f[0]])||0;}));
    var bars = reportFields.map(function(f){var v=Number(r[f[0]])||0, color=v?palette[f[0]]:"#E5322D";return '<div class="ar-metric"><div><span>'+f[1]+'</span><b class="'+(v?'':'gap-red')+'">'+v+'</b></div><i><u style="width:'+(v/max*100)+'%;background:'+color+'"></u></i></div>';}).join('');
    var socialRows = SOCIAL.map(function(x){var v=social[x[0]]||{};return '<tr><td>'+x[1]+'</td><td>'+(Number(v.views)||0).toLocaleString('en-NG')+'</td><td>'+(Number(v.likes)||0).toLocaleString('en-NG')+'</td><td>'+(Number(v.followers)||0).toLocaleString('en-NG')+'</td><td>'+(Number(v.leads)||0)+'</td></tr>';}).join('');
    var name = a ? (a.full_name||"Team member") : "Team member", code = a && (a.agent_code||a.staff_code) || "";
    return '<article class="agent-report-card" data-agent-report="'+esc(r.user_id)+'"><header><div><small>CALVORA · WEEKLY TEAM PERFORMANCE</small><h3>'+esc(name)+'</h3><p>'+esc(code)+' · '+(a&&a.role==='agent'?'Agent':'Staff')+' · Week commencing '+CV.date(r.week_start)+'</p></div><button type="button" class="btn line sm" data-print-agent="'+esc(r.user_id)+'">Print report</button></header>'+
      '<p class="report-growth">Calls vs last week: <b>' + (prev ? (Number(prev.calls_made)>0 ? ((Number(r.calls_made||0)-Number(prev.calls_made)>0?'+':'')+Math.round((Number(r.calls_made||0)-Number(prev.calls_made))/Number(prev.calls_made)*100)+'%') : (Number(r.calls_made)>0?'New calls':'0% · still zero')) : 'No previous call report') + '</b> · Social leads: <b>' + (prev && prev.social_metrics ? (function(){var now=SOCIAL.reduce(function(n,x){return n+Number(((r.social_metrics||{})[x[0]]||{}).leads||0);},0),was=SOCIAL.reduce(function(n,x){return n+Number(((prev.social_metrics||{})[x[0]]||{}).leads||0);},0);return was?((now-was>0?'+':'')+Math.round((now-was)/was*100)+'%'):now?'New':'No growth data';})() : 'No previous social report') + '</b></p>' +
      '<div class="ar-summary"><div><b>'+Number(r.calls_made||0)+'</b><span>Calls made</span></div><div><b>'+Number(r.follow_up_calls||0)+'</b><span>Follow-up calls</span></div><div><b>'+Number(r.new_leads||0)+'</b><span>New leads</span></div><div><b>'+Number(r.viewings_attended||0)+'</b><span>Viewings / inspections</span></div></div>'+
      '<div class="ar-visual"><div><div class="ar-donut" style="--mix:'+ (complete?('#7BD441 0 '+pct+'%,#E5322D '+pct+'% 100%'):'#E5322D 0 100%') +'"><div><b>'+complete+'/'+total+'</b><small>Activity types<br>recorded</small></div></div><p class="fine" style="text-align:center">Red = no activity recorded</p></div><div class="ar-bars"><h4>Weekly activity breakdown</h4>'+bars+'</div></div>'+
      '<h4>Social media results</h4><div class="scroll"><table class="tbl"><thead><tr><th>Channel</th><th>Views / reach</th><th>Likes / reactions</th><th>Followers gained</th><th>Leads</th></tr></thead><tbody>'+socialRows+'</tbody></table></div>'+
      (a&&a.role==='agent'?'<div class="ar-notes"><b>Assigned responsibilities</b><p>'+esc((r.agent_responsibilities||[]).map(function(k){return ({sales:'Sales',rentals:'Rentals',land_acquisition:'Land acquisition',property_sourcing:'Property sourcing'})[k]||k;}).join(', ')||'Not specified')+'</p><b>Property sourcing details</b><p>'+esc(r.property_details||'No property details submitted')+'</p><b>Lost opportunities</b><p>'+esc(r.lost_opportunities||'None reported')+'</p><b>Customer feedback</b><p>'+esc(r.customer_feedback||'None reported')+'</p><b>Revenue / commission reported</b><p>₦'+Number(r.revenue_generated||0).toLocaleString('en-NG')+' / ₦'+Number(r.commission_earned||0).toLocaleString('en-NG')+'</p></div>':'')+
      '<div class="ar-visual"><div><div class="ar-donut" style="--mix:'+leadMix+'"><div><b>'+leadTotal+'</b><small>Social leads</small></div></div></div><div class="ar-bars"><h4>Social leads by channel</h4>'+SOCIAL.map(function(x,i){var v=socialLeads[i];return '<div class="ar-metric"><div><span>'+x[1]+'</span><b class="'+(v?'':'gap-red')+'">'+v+'</b></div><i><u style="width:'+(leadTotal?v/leadTotal*100:0)+'%;background:'+(v?'#7BD441':'#E5322D')+'"></u></i></div>';}).join('')+'</div></div>'+
      '<div class="ar-notes"><b>Challenges and support required</b><p>'+esc(r.problems||'No challenges reported.')+'</p></div><footer><span>Submitted '+(r.submitted_at?PT.dt(r.submitted_at):'')+'</span><span>CONFIDENTIAL · INTERNAL USE</span></footer></article>';
  }
  async function reports() {
    var wk = (reports.wk = reports.wk || PT.monday());
    var prevDate=new Date(wk+'T12:00:00');prevDate.setDate(prevDate.getDate()-7);var prevWeek=prevDate.getFullYear()+'-'+String(prevDate.getMonth()+1).padStart(2,'0')+'-'+String(prevDate.getDate()).padStart(2,'0');
    var result=await Promise.all([sb.from('team_weekly_reports').select('*').eq('week_start',wk).order('submitted_at',{ascending:false}),sb.from('team_weekly_reports').select('*').eq('week_start',prevWeek)]);
    if(result[0].error)throw result[0].error;if(result[1].error)throw result[1].error;var rows=result[0].data||[],prevRows=result[1].data||[];
    var people = must(await sb.from('profiles').select('id,full_name,agent_code,staff_code,role,staff_role,status').in('role',['agent','staff']).eq('status','active'));
    var map={};people.forEach(function(p){map[p.id]=p;});
    var missing=people.filter(function(p){return !rows.some(function(r){return r.user_id===p.id;});});
    var totals={};WF.forEach(function(f){totals[f[0]]=rows.reduce(function(n,r){return n+(Number(r[f[0]])||0);},0);});
    var socialTotals={};SOCIAL.forEach(function(x){socialTotals[x[0]]={views:0,likes:0,leads:0};rows.forEach(function(r){var v=(r.social_metrics||{})[x[0]]||{};['views','likes','leads'].forEach(function(k){socialTotals[x[0]][k]+=Number(v[k])||0;});});});
    setPane('<div class="report-heading"><div><p class="eyebrow">PEOPLE · WEEKLY ACCOUNTABILITY</p><h2>Team performance reports</h2><p class="muted">Calls, follow-ups, customer outcomes and social-media results for every active agent and staff member.</p></div><button class="btn" id="print-all-agents" type="button">Print all reports</button></div><div class="panel report-filter"><label for="wk" style="margin-top:0">Reporting week (Monday)</label><input id="wk" type="date" value="'+wk+'" style="max-width:220px"><span>'+rows.length+' submitted · '+missing.length+' outstanding</span></div>'+
      '<div class="report-kpis"><div><b>'+rows.length+'/'+people.length+'</b><span>Reports received</span></div><div><b>'+totals.calls_made+'</b><span>Calls made</span></div><div><b>'+totals.follow_up_calls+'</b><span>Follow-up calls</span></div><div><b>'+totals.new_leads+'</b><span>New leads</span></div><div><b>'+totals.viewings_attended+'</b><span>Viewings attended</span></div><div><b>'+totals.conversions+'</b><span>Conversions</span></div></div>'+
      '<section class="panel"><h3>Social media totals · selected week</h3><div class="scroll"><table class="tbl"><thead><tr><th>Channel</th><th>Views / reach</th><th>Likes / reactions</th><th>Leads</th></tr></thead><tbody>'+SOCIAL.map(function(x){var v=socialTotals[x[0]];return '<tr><td><b>'+x[1]+'</b></td><td>'+v.views.toLocaleString('en-NG')+'</td><td>'+v.likes.toLocaleString('en-NG')+'</td><td>'+v.leads+'</td></tr>';}).join('')+'</tbody></table></div></section>'+
      people.length?people.map(function(person){var report=rows.find(function(r){return r.user_id===person.id;})||{user_id:person.id,week_start:wk,problems:'No weekly report submitted',social_metrics:{},calls_made:0,follow_up_calls:0,answered_calls:0,prospects_contacted:0,meetings_booked:0,viewings_attended:0,new_leads:0,qualified_leads:0,conversions:0,new_properties_sourced:0,owner_contacts:0,listings_submitted:0,transactions_completed:0};return teamReportCard(report,person,prevRows.find(function(p){return p.user_id===person.id;}));}).join(''):empty('No active agents or staff found.')+
      (missing.length?'<div class="panel outstanding"><h3>Reports outstanding</h3><p>'+missing.map(function(a){return esc(a.full_name)+' ('+esc(a.agent_code||a.staff_code||'')+')';}).join(' · ')+'</p></div>':'')+
      '<p class="fine">Social figures are self-reported from platform analytics. Calls and outcomes are also self-reported until checked against CRM records. A zero or missing report is a follow-up prompt, not proof that work was not done.</p>');
    $('#wk').onchange=function(){reports.wk=PT.monday(this.value+'T12:00:00');go('reports');};
    $('#print-all-agents').onclick=function(){document.body.classList.add('print-agent-reports');window.print();setTimeout(function(){document.body.classList.remove('print-agent-reports');},500);};
    $$('[data-print-agent]').forEach(function(b){b.onclick=function(){document.body.classList.add('print-agent-one');var card=b.closest('[data-agent-report]');card.classList.add('print-selected');window.print();setTimeout(function(){document.body.classList.remove('print-agent-one');card.classList.remove('print-selected');},500);};});
  }
  async function myreport() {
    var wk=PT.monday(), row=must(await sb.from('team_weekly_reports').select('*').eq('user_id',user.id).eq('week_start',wk).maybeSingle())||{}, sm=row.social_metrics||{};
    function n(id,v){return '<input id="'+id+'" type="number" min="0" max="100000000" step="1" value="'+(Number(v)||0)+'">';}
    var fields=[['calls_made','Calls made'],['follow_up_calls','Follow-up calls'],['answered_calls','Calls answered / connected'],['prospects_contacted','Prospects contacted'],['meetings_booked','Meetings booked'],['viewings_attended','Viewings / inspections attended'],['new_leads','New leads generated'],['qualified_leads','Qualified leads'],['conversions','Conversions / closed customers'],['content_posts','Social posts / videos published']];
    var socials=SOCIAL.map(function(x){var v=sm[x[0]]||{};return '<section class="panel" style="margin:10px 0;padding:14px"><h3 style="margin-top:0">'+x[1]+'</h3><div class="grid2"><div><label for="s_'+x[0]+'_views">'+(x[0]==='whatsapp'?'Status views':'Views / reach')+'</label>'+n('s_'+x[0]+'_views',v.views)+'</div><div><label for="s_'+x[0]+'_likes">'+(x[0]==='whatsapp'?'Reactions':'Likes / reactions')+'</label>'+n('s_'+x[0]+'_likes',v.likes)+'</div><div><label for="s_'+x[0]+'_followers">Followers / subscribers gained</label>'+n('s_'+x[0]+'_followers',v.followers)+'</div><div><label for="s_'+x[0]+'_leads">Leads from channel</label>'+n('s_'+x[0]+'_leads',v.leads)+'</div></div></section>';}).join('');
    setPane('<div class="report-heading"><div><p class="eyebrow">STAFF PORTAL · WEEKLY SUBMISSION</p><h2>My weekly activity report</h2><p class="muted">Submit your calls, customer work and social media results. CEO and operations can review team reports.</p></div></div><div class="panel report-filter"><b>Week starting</b><span>'+CV.date(wk)+'</span><span>'+(row.id?'Saved · Editable':'Not submitted yet')+'</span></div><form id="my-week-form" class="panel"><h3>Calls and customer activity</h3><div class="grid2">'+fields.map(function(f){return '<div><label for="m_'+f[0]+'">'+f[1]+'</label>'+n('m_'+f[0],row[f[0]])+'</div>';}).join('')+'</div><h3 style="margin-top:22px">Social media performance</h3><p class="fine">Use each platform’s weekly analytics. WhatsApp uses Status views and reactions. Enter zero where no activity was recorded.</p>'+socials+'<label for="my-role-work">Role-specific work completed this week</label><textarea id="my-role-work" maxlength="2000" placeholder="Summarise the work delivered for your CALVORA role">'+esc(row.role_work_summary||'')+'</textarea><label for="my-problems">Challenges, missed calls, customer objections or support needed</label><textarea id="my-problems" maxlength="1500">'+esc(row.problems||'')+'</textarea><div id="my-week-box" aria-live="polite"></div><button class="btn" type="submit">'+(row.id?'Update weekly report':'Submit weekly report')+'</button></form>');
    $('#my-week-form').onsubmit=async function(e){e.preventDefault();var data={user_id:user.id,week_start:wk,role_snapshot:'staff',staff_role_snapshot:profile.staff_role||'staff',role_work_summary:$('#my-role-work').value.trim(),problems:$('#my-problems').value.trim()};fields.forEach(function(f){data[f[0]]=Math.max(0,parseInt($('#m_'+f[0]).value,10)||0);});data.social_metrics={};SOCIAL.forEach(function(x){data.social_metrics[x[0]]={views:Math.max(0,parseInt($('#s_'+x[0]+'_views').value,10)||0),likes:Math.max(0,parseInt($('#s_'+x[0]+'_likes').value,10)||0),followers:Math.max(0,parseInt($('#s_'+x[0]+'_followers').value,10)||0),leads:Math.max(0,parseInt($('#s_'+x[0]+'_leads').value,10)||0)};});var b=$('#my-week-form button');b.disabled=true;var r=await sb.from('team_weekly_reports').upsert(data,{onConflict:'user_id,week_start'});if(r.error){$('#my-week-box').innerHTML=fail(r.error);b.disabled=false;}else{CV.toast('Weekly report submitted');myreport();}};
  }

  /* ---------- CEO weekly scorecard ---------- */
  async function scorecard() {
    var wk = (scorecard.wk = scorecard.wk || PT.monday()), sc = must(await sb.rpc("ceo_scorecard", { p_week: wk }));
    var teamRows = must(await sb.from('team_weekly_reports').select('user_id,calls_made,follow_up_calls,new_leads,week_start').eq('week_start',wk));
    var teamIds=teamRows.map(function(r){return r.user_id;}),teamPeople=teamIds.length?must(await sb.from('profiles').select('id,full_name,agent_code,staff_code').in('id',teamIds)):[],teamNames={};teamPeople.forEach(function(p){teamNames[p.id]=p.full_name||p.agent_code||p.staff_code||'Team member';});
    var exp = Number(sc.expenses) || 0, surplus = Number(sc.revenue) - Number(sc.agent_share) - exp;
    var metrics = [["Active agents",sc.active_agents], ["Active properties",sc.active_properties], ["Customer enquiries",sc.enquiries], ["Inspections",sc.inspections], ["Completed transactions",sc.transactions], ["Calls made",teamRows.reduce(function(n,r){return n+(Number(r.calls_made)||0);},0)], ["Follow-up calls",teamRows.reduce(function(n,r){return n+(Number(r.follow_up_calls)||0);},0)]];
    setPane('<div class="report-heading"><div><p class="eyebrow">CEO OFFICE · WEEKLY REVIEW</p><h2>Weekly business scorecard</h2><p class="muted">A management snapshot of activity, revenue and operational priorities.</p></div><button class="btn" type="button" id="print-scorecard">Print / Save PDF</button></div><div class="panel report-filter"><label for="swk" style="margin-top:0">Week starting (Monday)</label><input id="swk" type="date" value="' + wk + '" style="max-width:220px"><span>CALVORA · CONFIDENTIAL</span></div>' +
      '<div class="report-kpis">' + metrics.map(function(m,i){return '<div><small>' + m[0].toUpperCase() + '</small><b>' + (Number(m[1])||0) + '</b><span>' + m[0] + '</span></div>';}).join('') + '</div>' +
      '<div class="score-grid"><section class="panel score-finance"><p class="eyebrow">FINANCIAL PERFORMANCE</p><h3>Weekly financial summary</h3><div class="score-row"><span>Commission revenue earned</span><b>' + CV.naira(sc.revenue) + '</b></div><div class="score-row"><span>Agent commission share</span><b>' + CV.naira(sc.agent_share) + '</b></div><div class="score-row"><span>Operating expenses</span><b>' + CV.naira(exp) + '</b></div><div class="score-row score-total"><span>Operating surplus</span><b id="sur">' + CV.naira(surplus) + '</b></div><form id="sf" novalidate><label for="s_exp">Update expenses for this week (₦)</label><input id="s_exp" type="number" min="0" step="1" inputmode="numeric" value="' + exp + '"><label for="s_iss">Issues requiring CEO attention</label><textarea id="s_iss" rows="3" maxlength="2000">' + esc(sc.issues || '') + '</textarea><div id="sbox" aria-live="polite"></div><div class="acts-row" style="margin-top:12px"><button class="btn" type="submit">Save scorecard</button><button class="btn line" type="button" id="copyrep">Copy summary</button></div></form></section><section class="panel score-activity"><p class="eyebrow">OPERATIONS AT A GLANCE</p><h3>Weekly activity mix</h3><div class="score-bars">' + metrics.slice(1).map(function(m,i){var mx=Math.max(1,...metrics.slice(1).map(function(x){return Number(x[1])||0;}));return '<div><span>' + m[0] + '</span><b>' + (Number(m[1])||0) + '</b><i><u style="width:' + ((Number(m[1])||0)/mx*100) + '%"></u></i></div>';}).join('') + '</div><p class="fine">Counts are taken from the selected reporting week. No targets or estimated results are assumed.</p></section></div><div class="panel score-issues"><p class="eyebrow">MANAGEMENT NOTES</p><h3>Issues requiring attention</h3><p id="issue-preview">' + esc(sc.issues || 'No issues recorded for this week.') + '</p></div>');
    function text() { var e=Number($("#s_exp").value)||0,s=Number(sc.revenue)-Number(sc.agent_share)-e;return ["CALVORA WEEKLY MANAGEMENT SCORECARD","Week starting: "+CV.date(wk),"",metrics.map(function(m){return m[0]+": "+(Number(m[1])||0);}).join("\n"),"","Commission revenue: "+CV.naira(sc.revenue),"Agent share: "+CV.naira(sc.agent_share),"Expenses: "+CV.naira(e),"Operating surplus: "+CV.naira(s),"","CEO issues: "+($("#s_iss").value.trim()||"None")].join("\n"); }
    $("#s_exp").oninput=function(){ $("#sur").textContent=CV.naira(Number(sc.revenue)-Number(sc.agent_share)-(Number(this.value)||0)); };
    $("#s_iss").oninput=function(){ $("#issue-preview").textContent=this.value.trim()||"No issues recorded for this week."; };
    $("#swk").onchange=function(){scorecard.wk=PT.monday(this.value+"T12:00:00");go("scorecard");};
    $("#sf").onsubmit=async function(e){e.preventDefault();var r=await sb.from("weekly_reports").upsert({week_start:wk,active_agents:sc.active_agents,active_properties:sc.active_properties,enquiries:sc.enquiries,inspections:sc.inspections,transactions:sc.transactions,revenue:sc.revenue,expenses:Number($("#s_exp").value)||0,issues:$("#s_iss").value.trim()},{onConflict:"week_start"});if(r.error)$("#sbox").innerHTML=fail(r.error);else CV.toast("Scorecard saved");};
    $("#copyrep").onclick=async function(){try{await navigator.clipboard.writeText(text());CV.toast("Summary copied");}catch(e){window.prompt("Copy this report:",text());}};
    $("#print-scorecard").onclick=function(){document.body.classList.add("print-scorecard");window.print();setTimeout(function(){document.body.classList.remove("print-scorecard");},500);};
  }

  /* ---------- staff chat room ---------- */
  async function chat() {
    if (chatTimer) clearInterval(chatTimer); chatTimer = null;
    var messages = must(await sb.from("staff_chat_messages").select("id,author_id,body,created_at").order("created_at",{ascending:true}).limit(200));
    var authorIds=messages.map(function(m){return m.author_id;}).filter(function(x,i,a){return x&&a.indexOf(x)===i;});
    var people = authorIds.length ? must(await sb.from("profiles").select("id,full_name,staff_code,role,staff_role").in("id",authorIds)) : [];
    var pm={};people.forEach(function(p){pm[p.id]=p;});
    setPane('<div class="report-heading"><div><p class="eyebrow">TEAM COMMUNICATION</p><h2>Staff discussion room</h2><p class="muted">Share updates, coordinate viewings and discuss work with the CALVORA team.</p></div><button class="btn line" type="button" id="chat-refresh">Refresh</button></div><div class="chat-shell"><div class="chat-top"><b>CALVORA TEAM</b><span>Staff-only discussion · Please keep customer information confidential</span></div><div class="chat-feed" id="chat-feed">' + (messages.length?messages.map(function(m){var a=pm[m.author_id]||{};return '<article class="chat-message ' +(m.author_id===user.id?'mine':'')+'"><div class="chat-avatar">'+esc((a.full_name||'S').split(/\s+/).map(function(x){return x[0]||'';}).slice(0,2).join('').toUpperCase())+'</div><div><b>'+esc(a.full_name||'Staff member')+'</b><small>'+PT.dt(m.created_at)+'</small><p>'+esc(m.body).replace(/\n/g,'<br>')+'</p></div></article>';}).join(''):'<div class="chat-empty">No messages yet. Start the team discussion.</div>') + '</div><form id="chat-form" class="chat-compose"><textarea id="chat-body" rows="2" maxlength="2000" placeholder="Write a message to the team…" required></textarea><button class="btn" type="submit">Send message</button></form></div>');
    var feed=$("#chat-feed");feed.scrollTop=feed.scrollHeight;
    $("#chat-form").onsubmit=async function(e){e.preventDefault();var body=$("#chat-body").value.trim();if(!body)return;var b=$("#chat-form button");b.disabled=true;var r=await sb.from("staff_chat_messages").insert({author_id:user.id,body:body});if(r.error){$("#chat-body").insertAdjacentHTML("afterend",'<p class="fine">Could not send: '+esc(PT.msg(r.error))+'</p>');b.disabled=false;return;}chat();};
    $("#chat-refresh").onclick=chat;
    chatTimer=setInterval(async function(){if(tab!=="chat")return;var r=await sb.from("staff_chat_messages").select("id,author_id,body,created_at").order("created_at",{ascending:true}).limit(200);if(!r.error){var before=feed.scrollHeight-feed.scrollTop-feed.clientHeight; if(r.data.length!==messages.length || (r.data.length&&messages.length&&r.data[r.data.length-1].id!==messages[messages.length-1].id)){chat();}}},12000);
  }

  /* ---------- staff management ---------- */
  async function staff() {
    var rows = must(await sb.rpc("list_staff"));
    setPane('<h2>Staff</h2><form class="panel" id="stf" novalidate><h3>Give or change access</h3><p class="fine" style="margin-top:0">The person must first create an account (on the sign-in page, “Create account”). Then enter the email they used. They get a staff ID number and can sign in here.</p><div class="grid2"><div><label for="st_email">Their email</label><input id="st_email" type="email"></div><div><label for="st_acc">Access</label><select id="st_acc"><option value="operations">Operations</option><option value="marketing">Marketing</option><option value="admin">CEO / Admin (full access)</option><option value="none">Remove access</option></select></div></div><div id="stbox" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:14px">Save access</button></form>' +
      (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>ID</th><th>Status</th></tr></thead><tbody>' + rows.map(function (r) { return "<tr><td><b>" + esc(r.full_name) + "</b></td><td>" + esc(r.email) + "</td><td>" + (r.role === "admin" ? "CEO / Admin" : cap(r.staff_role)) + "</td><td>" + esc(r.staff_code || "") + "</td><td>" + chip(r.status) + "</td></tr>"; }).join("") + "</tbody></table></div>" : ""));
    $("#stf").onsubmit = async function (e) {
      e.preventDefault(); var box = $("#stbox"), em = $("#st_email").value.trim(), acc = $("#st_acc").value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { box.innerHTML = CV.problem("Please enter a valid email."); return; }
      if (!confirm("Set " + em + " to: " + $("#st_acc").selectedOptions[0].text + "?")) return;
      var r = await sb.rpc("set_staff_access", { p_email: em, p_access: acc });
      if (r.error) box.innerHTML = fail(r.error); else { CV.toast("Access updated"); staff(); }
    };
  }
  /* ---------- audit log ---------- */
  async function audit() {
    var rows = must(await sb.from("audit_log").select("*").order("id", { ascending: false }).limit(150)), m = await names(rows.map(function (r) { return r.actor_id; }));
    setPane('<h2>Audit log</h2><p class="fine">Every decision, check, approval and payment, with who did it. The latest 150 entries.</p>' + (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead><tbody>' + rows.map(function (r) { return "<tr><td class=\"small\">" + PT.dt(r.created_at) + "</td><td>" + nm(m, r.actor_id) + "</td><td>" + esc(cap(r.action)) + '</td><td class="small">' + esc(r.record_type) + '</td><td class="small" style="max-width:340px;word-break:break-word">' + esc(typeof r.summary === "string" ? r.summary : JSON.stringify(r.summary)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : empty("Nothing recorded yet.")));
  }

  /* ---------- ID card ---------- */
  function idcard() {
    if (!profile.staff_code) return setPane("<h2>My ID card</h2>" + CV.problem("You do not have a staff ID number yet. The CEO can set your access under Staff to create one."));
    setPane(PT.idBlock(profile, {})); PT.bindId();
  }

  window.AdminCtx = { sb: sb, PT: PT, $: $, $$: $$, setPane: setPane, must: must, fail: fail, chip: chip, cap: cap, names: names, go: go, panel: panel, bindGo: bindGo, views: null, flags: function () { return { OPS: OPS, ADM: ADM, ROLE: ROLE, user: user, profile: profile }; } };
  VIEWS = { overview: overview, applications: applications, properties: properties, property: property, enquiries: enquiries, reviews: reviews, complaints: complaints, deals: deals, agents: agents, reports: reports, myreport: myreport, scorecard: scorecard, staff: staff, audit: audit, chat: chat, idcard: idcard };
  window.AdminCtx.views = VIEWS;
  boot();
})();
