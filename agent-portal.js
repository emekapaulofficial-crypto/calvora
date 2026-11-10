/* CALVORA staff panel, release 2: customer CRM, landlords, finance and agent subscriptions.
   Loaded by admin.html after admin-panel.js, which exposes window.AdminCtx. */
(function () {
  "use strict";
  var X = window.AdminCtx; if (!X) return;
  var PT = X.PT, CV = window.CV, esc = CV.esc, sb = X.sb, $ = X.$, $$ = X.$$, setPane = X.setPane, must = X.must, fail = X.fail, chip = X.chip, cap = X.cap, VIEWS = X.views;
  function iso(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function opts(list, cur, labels) { return list.map(function (v) { return '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(labels ? labels[v] : cap(v)) + "</option>"; }).join(""); }
  function tbl(head, rows) { return '<div class="scroll"><table class="tbl"><thead><tr>' + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>"; }
  function empty(t) { return '<div class="empty">' + t + "</div>"; }
  function ex(n) { return Number(n) || 0; }

  /* ---------- tabs (called by admin-panel.js) ---------- */
  window.AdminR2 = {
    tabs: function (tabs, f, n) {
      var i = tabs.findIndex(function (t) { return t[0] === "deals"; }); if (i < 0) i = tabs.findIndex(function (t) { return t[0] === "agents"; });
      tabs.splice(i < 0 ? tabs.length : i, 0, ["crm", "Customers (CRM)", n.crm || ""], ["landlords", "Landlords"]);
      if (f.ADM) { var j = tabs.findIndex(function (t) { return t[0] === "scorecard"; }); tabs.splice(j < 0 ? tabs.length : j, 0, ["finance", "Finance"], ["subs", "Subscriptions", n.subsDue || ""]); }
    },
    /* landlord picker on the property page (operations and CEO) */
    landlordPanel: async function (p) {
      var col = $("#pane .two > div:last-child"); if (!col) return;
      var rows = must(await sb.from("landlords").select("id,landlord_code,full_name").order("full_name"));
      col.insertAdjacentHTML("afterbegin", '<div class="panel"><h3>Landlord record</h3><label for="ll_pick" style="margin-top:0">Who owns this property?</label><select id="ll_pick"><option value="">Not linked</option>' + rows.map(function (l) { return '<option value="' + l.id + '"' + (l.id === p.landlord_id ? " selected" : "") + ">" + esc(l.full_name) + " (" + esc(l.landlord_code) + ")</option>"; }).join("") + '</select><div class="acts-row" style="margin-top:10px"><button class="btn line sm" id="ll_save" type="button">Save link</button></div><p class="fine">Add the owner under Landlords first. This only links the records. The checks above still decide whether the property goes live.</p></div>');
      $("#ll_save").onclick = async function () { var r = await sb.rpc("link_property_landlord", { p_property: p.id, p_landlord: $("#ll_pick").value || null }); r.error ? CV.toast(PT.msg(r.error), 1) : CV.toast("Landlord link saved"); };
    },
    awardDialog: function (agentId, agentName) {
      var d = document.createElement("dialog"); d.className = "dlg";
      var AW = ["Verified Listing Specialist", "Customer Service Star", "Top Performer", "Fast Responder", "Trusted Partner"];
      d.innerHTML = '<form method="dialog"><h3 style="margin-top:0">Give an award to ' + esc(agentName) + '</h3><label for="aw_a">Award</label><select id="aw_a">' + opts(AW, "", AW.reduce(function (o, a) { o[a] = a; return o; }, {})) + '</select>' +
        '<label for="aw_p">Period <span class="fine">(optional, e.g. ' + iso().slice(0, 7) + ' for a monthly award)</span></label><input id="aw_p" maxlength="20" value="' + iso().slice(0, 7) + '">' +
        '<label for="aw_n">Why is it given? <span class="fine">(the evidence)</span></label><textarea id="aw_n" rows="3" maxlength="300"></textarea><div id="aw_box" aria-live="polite"></div>' +
        '<div class="acts-row" style="margin-top:14px"><button class="btn" id="aw_ok" type="button">Give award</button><button class="btn line" value="cancel">Cancel</button></div></form>';
      document.body.appendChild(d); d.showModal(); d.addEventListener("close", function () { d.remove(); });
      $("#aw_ok", d).onclick = async function () {
        var note = $("#aw_n", d).value.trim(); if (note.length < 3) { $("#aw_box", d).innerHTML = CV.problem("Please say why the award is given."); return; }
        $("#aw_ok", d).disabled = true; var r = await sb.rpc("give_award", { p_agent: agentId, p_award: $("#aw_a", d).value, p_period: $("#aw_p", d).value.trim(), p_note: note });
        if (r.error) { $("#aw_box", d).innerHTML = fail(r.error); $("#aw_ok", d).disabled = false; } else { CV.toast("Award given"); d.close(); }
      };
    }
  };

  /* ---------- CRM ---------- */
  var SRC = ["website", "whatsapp", "facebook", "instagram", "tiktok", "referral", "walk_in", "phone_call", "other"];
  var LST = ["new", "contacted", "inspection_booked", "negotiating", "won", "lost"];
  var INT = ["rent", "buy", "land", "other"];
  var LCH = { new: "n", contacted: "g", inspection_booked: "g", negotiating: "g", won: "g", lost: "o" };
  function lchip(s) { return '<span class="chip ' + (LCH[s] || "o") + '">' + esc(cap(s)) + "</span>"; }
  var CSEG = { due: "Follow up today", open: "Open", won: "Won", lost: "Lost", all: "All" };
  async function crm() {
    var rows = must(await sb.from("leads").select("*").order("next_follow_up", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500));
    var seg = (crm.seg = crm.seg || "due"), today = iso();
    var isOpen = function (l) { return l.status !== "won" && l.status !== "lost"; };
    var fl = { due: function (l) { return isOpen(l) && l.next_follow_up && l.next_follow_up <= today; }, open: isOpen, won: function (l) { return l.status === "won"; }, lost: function (l) { return l.status === "lost"; }, all: function () { return true; } };
    var cnt = {}; Object.keys(CSEG).forEach(function (k) { cnt[k] = rows.filter(fl[k]).length; });
    var shown = rows.filter(fl[seg]), m = await X.names(shown.map(function (l) { return l.assigned_to; }));
    var conv = rows.filter(function (l) { return l.status === "won"; }).length, closed = rows.filter(function (l) { return !isOpen(l); }).length;
    setPane('<h2>Customers (CRM)</h2><p class="muted">Every person who wants a property, from any source, with the next follow-up date so nobody is forgotten.</p>' +
      '<div class="stats4"><div class="stat"><b>' + cnt.due + "</b><span>Follow-ups due</span></div><div class=\"stat\"><b>" + cnt.open + "</b><span>Open customers</span></div><div class=\"stat\"><b>" + conv + "</b><span>Won</span></div><div class=\"stat\"><b>" + (closed ? Math.round(conv / closed * 100) + "%" : "–") + "</b><span>Of closed customers won</span></div></div>" +
      '<p><button class="btn" id="lead_new" type="button">Add a customer</button></p><div id="lead_form"></div>' +
      '<div class="seg">' + Object.keys(CSEG).map(function (k) { return '<button data-cseg="' + k + '" class="' + (seg === k ? "on" : "") + '">' + CSEG[k] + " (" + cnt[k] + ")</button>"; }).join("") + "</div>" +
      (shown.length ? tbl(["Customer", "Looking for", "Status", "Next follow-up", "Owner", ""], shown.map(function (l) {
        var late = isOpen(l) && l.next_follow_up && l.next_follow_up < today;
        return "<tr><td><b>" + esc(l.full_name) + '</b><div class="small">' + PT.contactLinks(l.phone, "Hello " + l.full_name + ", this is " + esc(X.flags().profile.full_name || "Calvora") + " from Calvora Property Solutions.") + '</div><div class="small muted">' + esc(cap(l.source)) + "</div></td><td>" + esc(cap(l.interest)) + (l.budget ? '<div class="small">Budget ' + CV.naira(l.budget) + "</div>" : "") + (l.preferred_area ? '<div class="small muted">' + esc(l.preferred_area) + "</div>" : "") + "</td><td>" + lchip(l.status) + "</td><td>" + (l.next_follow_up ? CV.date(l.next_follow_up) + (late ? ' <span class="chip o">Overdue</span>' : "") : '<span class="muted">Not set</span>') + "</td><td class=\"small\">" + (l.assigned_to && m[l.assigned_to] ? esc(m[l.assigned_to].full_name) : "") + '</td><td><button class="btn line sm" data-lead="' + l.id + '">Open</button></td></tr>';
      })) : empty(seg === "due" ? "No follow-ups due. Well done." : "Nothing here yet.")));
    $$("[data-cseg]").forEach(function (b) { b.onclick = function () { crm.seg = b.dataset.cseg; X.go("crm"); }; });
    $$("[data-lead]").forEach(function (b) { b.onclick = function () { X.go("lead", b.dataset.lead); }; });
    $("#lead_new").onclick = function () {
      var f = $("#lead_form"); if (f.innerHTML) { f.innerHTML = ""; return; }
      f.innerHTML = '<form class="panel" id="lf2" novalidate><h3>New customer</h3><div class="grid2"><div><label for="l_name">Full name</label><input id="l_name" maxlength="100"></div><div><label for="l_phone">Phone</label><input id="l_phone" type="tel"></div></div>' +
        '<div class="grid2"><div><label for="l_email">Email <span class="fine">(optional)</span></label><input id="l_email" type="email"></div><div><label for="l_src">Where did they come from?</label><select id="l_src">' + opts(SRC, "whatsapp") + "</select></div></div>" +
        '<div class="grid2"><div><label for="l_int">Looking for</label><select id="l_int">' + opts(INT, "rent", { rent: "A house to rent", buy: "A house to buy", land: "Land", other: "Other" }) + '</select></div><div><label for="l_bud">Budget (₦)</label><input id="l_bud" type="number" min="0" step="1" inputmode="numeric"></div></div>' +
        '<div class="grid2"><div><label for="l_area">Preferred area</label><input id="l_area" maxlength="100"></div><div><label for="l_fu">First follow-up date</label><input id="l_fu" type="date" value="' + iso(new Date(Date.now() + 864e5)) + '"></div></div>' +
        '<label for="l_notes">Notes</label><textarea id="l_notes" rows="2" maxlength="1000"></textarea><div id="l_box" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:12px">Save customer</button></form>';
      $("#l_name").focus();
      $("#lf2").onsubmit = async function (e) {
        e.preventDefault(); var box = $("#l_box"), nm = $("#l_name").value.trim(), ph = $("#l_phone").value.trim();
        if (nm.length < 2) { box.innerHTML = CV.problem("Please enter the customer’s name."); return; }
        if (ph.replace(/\D/g, "").length < 7) { box.innerHTML = CV.problem("Please enter a phone number."); return; }
        var r = await sb.from("leads").insert({ full_name: nm, phone: ph, email: $("#l_email").value.trim() || null, source: $("#l_src").value, interest: $("#l_int").value, budget: $("#l_bud").value === "" ? null : Number($("#l_bud").value), preferred_area: $("#l_area").value.trim(), next_follow_up: $("#l_fu").value || null, notes: $("#l_notes").value.trim(), created_by: X.flags().user.id, assigned_to: X.flags().user.id });
        if (r.error) box.innerHTML = fail(r.error); else { CV.toast("Customer saved"); X.panel(true); crm(); }
      };
    };
  }
  async function lead(id) {
    var l = must(await sb.from("leads").select("*").eq("id", id).single());
    var notes = must(await sb.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false })), m = await X.names(notes.map(function (n) { return n.author_id; }).concat([l.assigned_to]));
    var prop = l.property_id ? (await sb.from("properties").select("title,listing_code").eq("id", l.property_id).maybeSingle()).data : null;
    setPane('<p><button class="linkbtn" data-go="crm">&larr; Back to customers</button></p><h2 style="margin-bottom:4px">' + esc(l.full_name) + "</h2><p>" + lchip(l.status) + ' <span class="muted small">Added ' + PT.dt(l.created_at) + " · " + esc(cap(l.source)) + "</span></p>" +
      '<p>' + PT.contactLinks(l.phone, "Hello " + l.full_name + ", this is " + esc(X.flags().profile.full_name || "Calvora") + " from Calvora Property Solutions.") + (l.email ? " · " + esc(l.email) : "") + "</p>" + (prop ? '<p class="small">Asked about: <b>' + esc(prop.title) + "</b> (" + esc(prop.listing_code) + ")</p>" : "") +
      '<div class="two"><form class="panel" id="lf3" novalidate><h3>Details</h3><div class="grid2"><div><label for="e_st" style="margin-top:0">Status</label><select id="e_st">' + opts(LST, l.status) + '</select></div><div><label for="e_fu" style="margin-top:0">Next follow-up</label><input id="e_fu" type="date" value="' + (l.next_follow_up || "") + '"></div></div>' +
      '<div class="grid2"><div><label for="e_int">Looking for</label><select id="e_int">' + opts(INT, l.interest) + '</select></div><div><label for="e_bud">Budget (₦)</label><input id="e_bud" type="number" min="0" step="1" value="' + (l.budget == null ? "" : l.budget) + '"></div></div>' +
      '<label for="e_area">Preferred area</label><input id="e_area" maxlength="100" value="' + esc(l.preferred_area) + '"><label for="e_lost">Reason, if lost <span class="fine">(required when status is Lost)</span></label><input id="e_lost" maxlength="200" value="' + esc(l.lost_reason) + '">' +
      '<label for="e_notes">Summary notes</label><textarea id="e_notes" rows="3" maxlength="1000">' + esc(l.notes) + '</textarea><p class="small muted">Handled by ' + (l.assigned_to && m[l.assigned_to] ? esc(m[l.assigned_to].full_name) : "nobody yet") + '</p><div id="e_box" aria-live="polite"></div><div class="acts-row"><button class="btn" type="submit">Save changes</button><button class="btn line" type="button" id="e_me">Assign to me</button></div></form>' +
      '<div class="panel"><h3>Follow-up history</h3><label for="n_new" style="margin-top:0">Add a note <span class="fine">(who you spoke to, what was said, what happens next)</span></label><textarea id="n_new" rows="2" maxlength="500"></textarea><div id="n_box"></div><p style="margin-top:8px"><button class="btn line sm" id="n_add" type="button">Add note</button></p>' +
      (notes.length ? notes.map(function (n) { return '<div class="chk"><div><div class="small muted">' + PT.dt(n.created_at) + " · " + ((m[n.author_id] && esc(m[n.author_id].full_name)) || "staff") + '</div><div style="white-space:pre-line">' + esc(n.note) + "</div></div></div>"; }).join("") : '<p class="muted">No notes yet.</p>') + "</div></div>");
    X.bindGo();
    $("#lf3").onsubmit = async function (e) {
      e.preventDefault(); var st = $("#e_st").value, box = $("#e_box");
      if (st === "lost" && $("#e_lost").value.trim().length < 3) { box.innerHTML = CV.problem("Please write why this customer was lost."); return; }
      var r = await sb.from("leads").update({ status: st, next_follow_up: $("#e_fu").value || null, interest: $("#e_int").value, budget: $("#e_bud").value === "" ? null : Number($("#e_bud").value), preferred_area: $("#e_area").value.trim(), lost_reason: st === "lost" ? $("#e_lost").value.trim() : "", notes: $("#e_notes").value.trim() }).eq("id", id);
      if (r.error) box.innerHTML = fail(r.error); else { CV.toast("Saved"); X.panel(true); lead(id); }
    };
    $("#e_me").onclick = async function () { var r = await sb.from("leads").update({ assigned_to: X.flags().user.id }).eq("id", id); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Assigned to you"), lead(id)); };
    $("#n_add").onclick = async function () {
      var t = $("#n_new").value.trim(); if (!t) { $("#n_box").innerHTML = CV.problem("Please write the note first."); return; }
      var r = await sb.from("lead_notes").insert({ lead_id: id, author_id: X.flags().user.id, note: t });
      r.error ? $("#n_box").innerHTML = fail(r.error) : (CV.toast("Note added"), lead(id));
    };
  }

  /* ---------- landlords ---------- */
  var LLS = ["prospect", "contacted", "registered", "inactive"], LSRC = ["outreach", "website", "agent", "referral", "other"];
  async function landlords() {
    var rows = must(await sb.from("landlords").select("*").order("created_at", { ascending: false }).limit(500));
    var props = rows.length ? must(await sb.from("properties").select("id,landlord_id,status").not("landlord_id", "is", null)) : [], pc = {};
    props.forEach(function (p) { pc[p.landlord_id] = (pc[p.landlord_id] || 0) + 1; });
    var seg = (landlords.seg = landlords.seg || "all"), shown = rows.filter(function (l) { return seg === "all" || l.status === seg; });
    var cnt = function (s) { return rows.filter(function (l) { return s === "all" || l.status === s; }).length; };
    setPane('<h2>Landlords</h2><p class="muted">Property owners and companies we work with. Website sign-ups from the “List your property” page arrive here as prospects.</p><p><button class="btn" id="ll_new" type="button">Add a landlord</button></p><div id="ll_form"></div>' +
      '<div class="seg">' + ["all"].concat(LLS).map(function (k) { return '<button data-lseg="' + k + '" class="' + (seg === k ? "on" : "") + '">' + cap(k) + " (" + cnt(k) + ")</button>"; }).join("") + "</div>" +
      (shown.length ? tbl(["Landlord", "Area", "Status", "Properties", ""], shown.map(function (l) {
        return "<tr><td><b>" + esc(l.full_name) + '</b> <span class="small muted">' + esc(l.landlord_code) + '</span><div class="small">' + PT.contactLinks(l.phone, "Hello " + l.full_name + ", this is Calvora Property Solutions.") + '</div><div class="small muted">' + esc(cap(l.source)) + "</div></td><td>" + esc(l.area) + "</td><td>" + chip(l.status) + "</td><td>" + (pc[l.id] || 0) + '</td><td><button class="btn line sm" data-ll="' + l.id + '">Open</button></td></tr>';
      })) : empty("No landlords here yet.")));
    $$("[data-lseg]").forEach(function (b) { b.onclick = function () { landlords.seg = b.dataset.lseg; X.go("landlords"); }; });
    $$("[data-ll]").forEach(function (b) { b.onclick = function () { X.go("landlord", b.dataset.ll); }; });
    $("#ll_new").onclick = function () {
      var f = $("#ll_form"); if (f.innerHTML) { f.innerHTML = ""; return; }
      f.innerHTML = '<form class="panel" id="llf" novalidate><h3>New landlord</h3><div class="grid2"><div><label for="g_name">Full name or company</label><input id="g_name" maxlength="100"></div><div><label for="g_phone">Phone</label><input id="g_phone" type="tel"></div></div><div class="grid2"><div><label for="g_email">Email <span class="fine">(optional)</span></label><input id="g_email" type="email"></div><div><label for="g_src">How did we find them?</label><select id="g_src">' + opts(LSRC, "outreach") + '</select></div></div><div class="grid2"><div><label for="g_area">Area of their property</label><input id="g_area" maxlength="100"></div><div><label for="g_addr">Address</label><input id="g_addr" maxlength="200"></div></div><label for="g_notes">Notes</label><textarea id="g_notes" rows="2" maxlength="1000"></textarea><div id="g_box" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:12px">Save landlord</button></form>';
      $("#g_name").focus();
      $("#llf").onsubmit = async function (e) {
        e.preventDefault(); var box = $("#g_box");
        if ($("#g_name").value.trim().length < 2) { box.innerHTML = CV.problem("Please enter the landlord’s name."); return; }
        var r = await sb.from("landlords").insert({ full_name: $("#g_name").value.trim(), phone: $("#g_phone").value.trim(), email: $("#g_email").value.trim() || null, source: $("#g_src").value, area: $("#g_area").value.trim(), address: $("#g_addr").value.trim(), notes: $("#g_notes").value.trim(), created_by: X.flags().user.id, assigned_to: X.flags().user.id });
        if (r.error) box.innerHTML = fail(r.error); else { CV.toast("Landlord saved"); landlords(); }
      };
    };
  }
  async function landlord(id) {
    var l = must(await sb.from("landlords").select("*").eq("id", id).single());
    var props = must(await sb.from("properties").select("id,title,listing_code,status,price,listing_type").eq("landlord_id", id).order("created_at", { ascending: false }));
    setPane('<p><button class="linkbtn" data-go="landlords">&larr; Back to landlords</button></p><h2 style="margin-bottom:4px">' + esc(l.full_name) + "</h2><p>" + chip(l.status) + ' <span class="muted small">' + esc(l.landlord_code) + " · added " + PT.dt(l.created_at) + "</span></p><p>" + PT.contactLinks(l.phone, "Hello " + l.full_name + ", this is Calvora Property Solutions.") + (l.email ? " · " + esc(l.email) : "") + "</p>" +
      '<div class="two"><form class="panel" id="llf2" novalidate><h3>Details</h3><div class="grid2"><div><label for="h_name" style="margin-top:0">Name</label><input id="h_name" maxlength="100" value="' + esc(l.full_name) + '"></div><div><label for="h_st" style="margin-top:0">Status</label><select id="h_st">' + opts(LLS, l.status) + '</select></div></div><div class="grid2"><div><label for="h_phone">Phone</label><input id="h_phone" type="tel" value="' + esc(l.phone) + '"></div><div><label for="h_email">Email</label><input id="h_email" type="email" value="' + esc(l.email || "") + '"></div></div><div class="grid2"><div><label for="h_area">Area</label><input id="h_area" maxlength="100" value="' + esc(l.area) + '"></div><div><label for="h_addr">Address</label><input id="h_addr" maxlength="200" value="' + esc(l.address) + '"></div></div><label for="h_notes">Notes</label><textarea id="h_notes" rows="5" maxlength="4000">' + esc(l.notes) + '</textarea><div id="h_box" aria-live="polite"></div><div class="acts-row"><button class="btn" type="submit">Save changes</button>' + (X.flags().ADM ? '<button class="btn line" type="button" id="h_del">Delete</button>' : "") + "</div></form>" +
      '<div class="panel"><h3>Their properties on Calvora</h3>' + (props.length ? props.map(function (p) { return '<div class="chk"><div><b>' + esc(p.title) + '</b><div class="small muted">' + esc(p.listing_code) + " · " + CV.naira(p.price) + "</div></div>" + chip(p.status) + "</div>"; }).join("") : '<p class="muted">No properties linked yet. Open a property under Properties and link it to this landlord.</p>') + "</div></div>");
    X.bindGo();
    $("#llf2").onsubmit = async function (e) {
      e.preventDefault(); if ($("#h_name").value.trim().length < 2) { $("#h_box").innerHTML = CV.problem("Please enter the name."); return; }
      var r = await sb.from("landlords").update({ full_name: $("#h_name").value.trim(), status: $("#h_st").value, phone: $("#h_phone").value.trim(), email: $("#h_email").value.trim() || null, area: $("#h_area").value.trim(), address: $("#h_addr").value.trim(), notes: $("#h_notes").value.trim() }).eq("id", id);
      r.error ? $("#h_box").innerHTML = fail(r.error) : (CV.toast("Saved"), landlord(id));
    };
    var dl = $("#h_del"); if (dl) dl.onclick = async function () { if (!confirm("Delete this landlord record? Linked properties stay, but lose the link.")) return; var r = await sb.from("landlords").delete().eq("id", id); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Deleted"), X.go("landlords")); };
  }

  /* ---------- finance (CEO only) ---------- */
  var ICAT = ["Commission (other)", "Paid service", "Partnership", "Other income"], ECAT = ["Marketing and adverts", "Data and airtime", "Transport", "Software and hosting", "Printing and ID cards", "Staff pay", "Legal and registration", "Other expense"];
  function range(k) {
    var n = new Date(), y = n.getFullYear(), mo = n.getMonth();
    if (k === "last") return [iso(new Date(y, mo - 1, 1)), iso(new Date(y, mo, 0))];
    if (k === "year") return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    return [iso(new Date(y, mo, 1)), iso(new Date(y, mo + 1, 0))];
  }
  async function finance() {
    var preset = (finance.preset = finance.preset || "month"), rg = finance.rg && preset === "custom" ? finance.rg : range(preset);
    var s = must(await sb.rpc("finance_summary", { p_from: rg[0], p_to: rg[1] }));
    var ent = must(await sb.from("finance_entries").select("*").gte("entry_date", rg[0]).lte("entry_date", rg[1]).order("entry_date", { ascending: false }).limit(300));
    var company = ex(s.commission_earned) - ex(s.agent_share), maxv = Math.max.apply(null, [1].concat(s.months.map(function (x) { return Math.max(ex(x.commission) + ex(x.subscriptions) + ex(x.other_income), ex(x.expenses)); })));
    var card = function (v, l) { return '<div class="stat"><b>' + CV.naira(v) + "</b><span>" + l + "</span></div>"; };
    setPane('<h2>Finance</h2><p class="muted">Income and spending for the company. Commission comes from recorded deals and subscriptions from recorded payments, so you never type those twice. Only the CEO sees this page.</p>' +
      '<div class="seg">' + [["month", "This month"], ["last", "Last month"], ["year", "This year"], ["custom", "Custom"]].map(function (p) { return '<button data-fp="' + p[0] + '" class="' + (preset === p[0] ? "on" : "") + '">' + p[1] + "</button>"; }).join("") + "</div>" +
      '<div class="panel"><div class="grid2"><div><label for="f_from" style="margin-top:0">From</label><input id="f_from" type="date" value="' + rg[0] + '"></div><div><label for="f_to" style="margin-top:0">To</label><input id="f_to" type="date" value="' + rg[1] + '"></div></div></div>' +
      '<div class="stats4">' + card(s.net, "Net result") + card(company, "Commission kept by Calvora") + card(s.subscription_income, "Agent subscriptions") + card(s.expenses, "Expenses") + "</div>" +
      '<div class="panel"><table class="kv"><tr><td>Commission earned on deals</td><td>' + CV.naira(s.commission_earned) + "</td></tr><tr><td>Less agents’ share</td><td>" + CV.naira(s.agent_share) + "</td></tr><tr><td>Subscription income</td><td>" + CV.naira(s.subscription_income) + "</td></tr><tr><td>Other income entered</td><td>" + CV.naira(s.other_income) + "</td></tr><tr><td>Expenses entered</td><td>" + CV.naira(s.expenses) + "</td></tr><tr><td><b>Net result</b></td><td><b>" + CV.naira(s.net) + "</b></td></tr></table>" +
      '<p class="fine">Owed to agents right now: <b>' + CV.naira(s.commission_due_to_agents) + "</b>. Paid to agents in this period: <b>" + CV.naira(s.commission_paid_out) + "</b>.</p></div>" +
      '<div class="panel"><h3>Last 6 months</h3>' + s.months.map(function (x) {
        var inc = ex(x.commission) + ex(x.subscriptions) + ex(x.other_income);
        return '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:.92rem"><b>' + esc(x.month) + '</b><span>In ' + CV.naira(inc) + " · Out " + CV.naira(x.expenses) + '</span></div><div class="bar" aria-hidden="true" style="margin-bottom:3px"><i style="width:' + Math.round(inc / maxv * 100) + '%"></i></div><div class="bar" aria-hidden="true"><i style="width:' + Math.round(ex(x.expenses) / maxv * 100) + '%;background:var(--slate,#566577)"></i></div></div>';
      }).join("") + '<p class="fine">Green bar: income (commission kept + subscriptions + other). Grey bar: expenses.</p></div>' +
      '<form class="panel" id="ff" novalidate><h3>Add an entry</h3><div class="grid2"><div><label for="x_kind" style="margin-top:0">Type</label><select id="x_kind"><option value="expense">Expense (money out)</option><option value="income">Other income (money in)</option></select></div><div><label for="x_date" style="margin-top:0">Date</label><input id="x_date" type="date" value="' + iso() + '"></div></div>' +
      '<div class="grid2"><div><label for="x_cat">Category</label><select id="x_cat"></select></div><div><label for="x_amt">Amount (₦)</label><input id="x_amt" type="number" min="1" step="1" inputmode="numeric"></div></div><div class="grid2"><div><label for="x_desc">What was it for?</label><input id="x_desc" maxlength="200"></div><div><label for="x_ref">Receipt or reference <span class="fine">(optional)</span></label><input id="x_ref" maxlength="80"></div></div><div id="x_box" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:12px">Save entry</button></form>' +
      "<h3>Entries in this period</h3>" + (ent.length ? tbl(["Date", "Type", "Category", "What for", "Amount", ""], ent.map(function (e) { return "<tr><td>" + CV.date(e.entry_date) + "</td><td>" + (e.kind === "income" ? '<span class="chip g">Income</span>' : '<span class="chip n">Expense</span>') + "</td><td>" + esc(e.category) + "</td><td>" + esc(e.description) + (e.reference ? '<div class="small muted">' + esc(e.reference) + "</div>" : "") + "</td><td><b>" + CV.naira(e.amount) + '</b></td><td><button class="btn line sm" data-fdel="' + e.id + '">Delete</button></td></tr>'; })) + '<p><button class="btn line sm" id="x_csv" type="button">Download these entries (CSV)</button></p>' : empty("No manual entries in this period.")));
    var fillCats = function () { $("#x_cat").innerHTML = (($("#x_kind").value === "income") ? ICAT : ECAT).map(function (c) { return "<option>" + esc(c) + "</option>"; }).join(""); }; fillCats(); $("#x_kind").onchange = fillCats;
    $$("[data-fp]").forEach(function (b) { b.onclick = function () { finance.preset = b.dataset.fp; if (b.dataset.fp === "custom") finance.rg = rg; X.go("finance"); }; });
    var chg = function () { if ($("#f_from").value && $("#f_to").value) { finance.preset = "custom"; finance.rg = [$("#f_from").value, $("#f_to").value]; X.go("finance"); } };
    $("#f_from").onchange = chg; $("#f_to").onchange = chg;
    $("#ff").onsubmit = async function (e) {
      e.preventDefault(); var box = $("#x_box"), amt = Number($("#x_amt").value);
      if (!(amt > 0)) { box.innerHTML = CV.problem("Please enter the amount."); return; }
      if ($("#x_desc").value.trim().length < 3) { box.innerHTML = CV.problem("Please say what it was for."); return; }
      var r = await sb.from("finance_entries").insert({ entry_date: $("#x_date").value || iso(), kind: $("#x_kind").value, category: $("#x_cat").value, amount: amt, description: $("#x_desc").value.trim(), reference: $("#x_ref").value.trim(), created_by: X.flags().user.id });
      r.error ? box.innerHTML = fail(r.error) : (CV.toast("Entry saved"), finance());
    };
    $$("[data-fdel]").forEach(function (b) { b.onclick = async function () { if (!confirm("Delete this entry?")) return; var r = await sb.from("finance_entries").delete().eq("id", b.dataset.fdel); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Deleted"), finance()); }; });
    var cs = $("#x_csv"); if (cs) cs.onclick = function () {
      var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
      var csv = ["Date,Type,Category,Description,Reference,Amount"].concat(ent.map(function (e) { return [e.entry_date, e.kind, e.category, e.description, e.reference, e.amount].map(q).join(","); })).join("\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "calvora-finance-" + rg[0] + "-to-" + rg[1] + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    };
  }

  /* ---------- subscriptions (CEO only) ---------- */
  async function subs() {
    var plans = must(await sb.from("subscription_plans").select("*").order("created_at")), sl = must(await sb.from("agent_subscriptions").select("*, subscription_plans(name,price_monthly)").order("created_at", { ascending: false }));
    var pays = must(await sb.from("subscription_payments").select("*").order("paid_on", { ascending: false }).limit(50)), ag = must(await sb.rpc("staff_agent_stats")).filter(function (a) { return a.status === "active"; });
    var m = await X.names(sl.map(function (s) { return s.agent_id; }).concat(pays.map(function (p) { return p.agent_id; }))), today = iso();
    var live = sl.filter(function (s) { return s.status === "active"; }), mrr = live.reduce(function (a, s) { return a + ex(s.subscription_plans && s.subscription_plans.price_monthly); }, 0);
    var subscribed = {}; sl.forEach(function (s) { if (s.status !== "cancelled") subscribed[s.agent_id] = 1; });
    var free = ag.filter(function (a) { return !subscribed[a.agent_id]; }), activePlans = plans.filter(function (p) { return p.active; });
    setPane('<h2>Agent subscriptions</h2><p class="muted">Optional paid plans for agents, to be introduced once agents have seen the value of Calvora. Payments are recorded by you with a reference, and each one moves the renewal date on by a month.</p>' +
      '<div class="stats4"><div class="stat"><b>' + live.length + "</b><span>Active subscribers</span></div><div class=\"stat\"><b>" + CV.naira(mrr) + "</b><span>Monthly value</span></div><div class=\"stat\"><b>" + live.filter(function (s) { return s.renews_on < today; }).length + "</b><span>Overdue renewals</span></div><div class=\"stat\"><b>" + plans.length + "</b><span>Plans</span></div></div>" +
      '<form class="panel" id="pf2" novalidate><h3>Plans</h3>' + (plans.length ? tbl(["Plan", "Per month", "Status", ""], plans.map(function (p) { return "<tr><td><b>" + esc(p.name) + '</b><div class="small muted">' + esc(p.description) + "</div></td><td>" + CV.naira(p.price_monthly) + "</td><td>" + (p.active ? '<span class="chip g">Offered</span>' : '<span class="chip o">Not offered</span>') + '</td><td><button class="btn line sm" type="button" data-ptog="' + p.id + '" data-on="' + (p.active ? 1 : 0) + '">' + (p.active ? "Stop offering" : "Offer again") + "</button></td></tr>"; })) : "<p class=\"muted\">No plans yet. Create the first one below.</p>") +
      '<div class="grid2"><div><label for="pl_name">New plan name</label><input id="pl_name" maxlength="60" placeholder="e.g. Agent Pro"></div><div><label for="pl_price">Price per month (₦)</label><input id="pl_price" type="number" min="0" step="1" inputmode="numeric"></div></div><label for="pl_desc">What the agent gets</label><input id="pl_desc" maxlength="200"><div id="pl_box" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:12px">Create plan</button></form>' +
      '<form class="panel" id="sf2" novalidate><h3>Put an agent on a plan</h3>' + (free.length && activePlans.length ? '<div class="grid2"><div><label for="sa_agent" style="margin-top:0">Agent</label><select id="sa_agent">' + free.map(function (a) { return '<option value="' + a.agent_id + '">' + esc(a.full_name) + " (" + esc(a.agent_code) + ")</option>"; }).join("") + '</select></div><div><label for="sa_plan" style="margin-top:0">Plan</label><select id="sa_plan">' + activePlans.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + " – " + CV.naira(p.price_monthly) + "</option>"; }).join("") + '</select></div></div><label for="sa_due">First payment due</label><input id="sa_due" type="date" value="' + iso(new Date(Date.now() + 30 * 864e5)) + '" style="max-width:220px"><div id="sa_box" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:12px">Start subscription</button>' : "<p class=\"muted\">" + (activePlans.length ? "Every active agent already has a subscription." : "Create a plan first.") + "</p>") + "</form>" +
      "<h3>Subscribers</h3>" + (sl.length ? tbl(["Agent", "Plan", "Status", "Renews", ""], sl.map(function (s) {
        var late = s.status === "active" && s.renews_on < today, a = m[s.agent_id];
        return "<tr><td><b>" + esc(a ? a.full_name : "") + '</b><div class="small muted">' + esc(a ? a.agent_code || "" : "") + "</div></td><td>" + esc(s.subscription_plans ? s.subscription_plans.name : "") + "<div class=\"small\">" + CV.naira(s.subscription_plans ? s.subscription_plans.price_monthly : 0) + "/month</div></td><td>" + chip(s.status) + "</td><td>" + CV.date(s.renews_on) + (late ? ' <span class="chip o">Overdue</span>' : "") + '</td><td><div class="acts-row">' + (s.status !== "cancelled" ? '<button class="btn sm" data-spay="' + s.id + '" data-amt="' + (s.subscription_plans ? s.subscription_plans.price_monthly : 0) + '">Record payment</button>' : "") + (s.status === "active" ? '<button class="btn line sm" data-sst="' + s.id + '" data-to="paused">Pause</button>' : s.status === "paused" ? '<button class="btn line sm" data-sst="' + s.id + '" data-to="active">Resume</button>' : "") + (s.status !== "cancelled" ? '<button class="btn line sm" data-sst="' + s.id + '" data-to="cancelled">Cancel</button>' : "") + "</div></td></tr>";
      })) : empty("No subscribers yet.")) +
      '<h3 style="margin-top:22px">Recent payments</h3>' + (pays.length ? tbl(["Paid", "Agent", "Period", "Amount", "Reference"], pays.map(function (p) { return "<tr><td>" + CV.date(p.paid_on) + "</td><td>" + esc((m[p.agent_id] || {}).full_name || "") + "</td><td class=\"small\">" + CV.date(p.period_start) + " to " + CV.date(p.period_end) + "</td><td><b>" + CV.naira(p.amount) + "</b></td><td>" + esc(p.reference) + "</td></tr>"; })) : empty("No payments recorded yet.")));
    $("#pf2").onsubmit = async function (e) {
      e.preventDefault(); var box = $("#pl_box"), nm = $("#pl_name").value.trim(), pr = $("#pl_price").value;
      if (nm.length < 2 || pr === "") { box.innerHTML = CV.problem("Please enter a plan name and a monthly price."); return; }
      var r = await sb.from("subscription_plans").insert({ name: nm, price_monthly: Number(pr), description: $("#pl_desc").value.trim() });
      r.error ? box.innerHTML = fail(r.error) : (CV.toast("Plan created"), subs());
    };
    $$("[data-ptog]").forEach(function (b) { b.onclick = async function () { var r = await sb.from("subscription_plans").update({ active: b.dataset.on !== "1" }).eq("id", b.dataset.ptog); r.error ? CV.toast(PT.msg(r.error), 1) : subs(); }; });
    var sf = $("#sf2"); if (sf && $("#sa_agent")) sf.onsubmit = async function (e) {
      e.preventDefault(); var r = await sb.from("agent_subscriptions").insert({ agent_id: $("#sa_agent").value, plan_id: $("#sa_plan").value, renews_on: $("#sa_due").value || iso(new Date(Date.now() + 30 * 864e5)) });
      r.error ? $("#sa_box").innerHTML = fail(r.error) : (CV.toast("Subscription started"), X.panel(true), subs());
    };
    $$("[data-sst]").forEach(function (b) { b.onclick = async function () { if (b.dataset.to === "cancelled" && !confirm("Cancel this subscription?")) return; var r = await sb.from("agent_subscriptions").update({ status: b.dataset.to }).eq("id", b.dataset.sst); r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Updated"), X.panel(true), subs()); }; });
    $$("[data-spay]").forEach(function (b) {
      b.onclick = function () {
        var d = document.createElement("dialog"); d.className = "dlg";
        d.innerHTML = '<form method="dialog"><h3 style="margin-top:0">Record a subscription payment</h3><label for="sp_amt">Amount received (₦)</label><input id="sp_amt" type="number" min="1" step="1" value="' + esc(b.dataset.amt) + '"><label for="sp_date">Date received</label><input id="sp_date" type="date" value="' + iso() + '"><label for="sp_ref">Bank transfer reference</label><input id="sp_ref" maxlength="80"><div id="sp_box" aria-live="polite"></div><div class="acts-row" style="margin-top:14px"><button class="btn" id="sp_ok" type="button">Record payment</button><button class="btn line" value="cancel">Cancel</button></div></form>';
        document.body.appendChild(d); d.showModal(); d.addEventListener("close", function () { d.remove(); });
        $("#sp_ok", d).onclick = async function () {
          if ($("#sp_ref", d).value.trim().length < 3) { $("#sp_box", d).innerHTML = CV.problem("A payment reference is required so the payment can be traced."); return; }
          $("#sp_ok", d).disabled = true; var r = await sb.rpc("record_subscription_payment", { p_sub: b.dataset.spay, p_amount: Number($("#sp_amt", d).value), p_paid_on: $("#sp_date", d).value, p_reference: $("#sp_ref", d).value.trim() });
          if (r.error) { $("#sp_box", d).innerHTML = fail(r.error); $("#sp_ok", d).disabled = false; } else { CV.toast("Payment recorded"); d.close(); subs(); }
        };
      };
    });
  }

  VIEWS.crm = crm; VIEWS.lead = lead; VIEWS.landlords = landlords; VIEWS.landlord = landlord; VIEWS.finance = finance; VIEWS.subs = subs;
})();
