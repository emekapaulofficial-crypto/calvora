/* CALVORA staff panel: property requests (request board + personal concierge). Loaded after admin-r2.js. */
(function () {
  "use strict";
  var X = window.AdminCtx; if (!X) return;
  var CV = window.CV, PT = X.PT, esc = CV.esc, sb = X.sb, $ = X.$, $$ = X.$$, setPane = X.setPane, must = X.must, chip = X.chip, cap = X.cap;
  var LT = { rent: "To rent", buy: "To buy", land: "Land to buy" };
  var ST = ["new", "approved", "matched", "closed", "rejected"];
  function opts(cur) { return ST.map(function (v) { return '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + cap(v) + "</option>"; }).join(""); }

  /* add the tab after "Enquiries and visits", with a count of new requests */
  var R2 = window.AdminR2;
  if (R2 && R2.tabs) {
    var orig = R2.tabs;
    R2.tabs = function (tabs, f, n) {
      orig(tabs, f, n);
      var i = tabs.findIndex(function (t) { return t[0] === "enquiries"; });
      tabs.splice(i < 0 ? tabs.length : i + 1, 0, ["requests", "Property requests", n.req || ""]);
    };
  }

  var seg = "new";
  async function requests() {
    var q = sb.from("property_requests").select("*").order("created_at", { ascending: false }).limit(200);
    if (seg === "new") q = q.eq("status", "new");
    else if (seg === "board" || seg === "concierge") q = q.eq("kind", seg);
    var rows = must(await q);
    var segs = [["new", "New"], ["board", "Request board"], ["concierge", "Concierge"], ["all", "All"]];
    setPane("<h2>Property requests</h2>" +
      '<div class="formtabs" role="tablist" aria-label="Show">' + segs.map(function (s) { return '<button type="button" role="tab" data-seg="' + s[0] + '" aria-selected="' + (s[0] === seg) + '">' + s[1] + "</button>"; }).join("") + "</div>" +
      '<p class="fine">Request board: set a request to <b>Approved</b> to show it publicly (area, budget and details only, never the name or phone). Concierge requests are never public.</p>' +
      (rows.length ? rows.map(function (r) {
        var msg = "Hello " + (r.name || "") + ", this is Calvora about your property request " + r.code + ".";
        return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>' + esc(r.code) + "</b> " + chip(r.status) + ' <span class="chip ' + (r.kind === "board" ? "" : "g") + '">' + (r.kind === "board" ? "Board" : "Concierge") + '</span><div class="small muted">' + PT.dt(r.created_at) + "</div></div></div>" +
          "<h3 style=\"margin:10px 0 4px\">" + esc(LT[r.listing_type] || "") + ": " + esc(r.property_type || "Property") + " in " + esc(r.area) + "</h3>" +
          (r.budget_max ? "<p style=\"margin:0 0 6px\"><b>Budget up to " + CV.naira(r.budget_max) + "</b></p>" : "") +
          (r.details ? '<p style="white-space:pre-line">' + esc(r.details) + "</p>" : "") +
          '<p class="small">From: ' + (r.name ? esc(r.name) : "No name") + " · " + PT.contactLinks(r.phone, msg) + "</p>" +
          '<div class="grid2"><div><label for="rs_' + r.id + '">Status</label><select id="rs_' + r.id + '">' + opts(r.status) + '</select></div><div><label for="rn_' + r.id + '">Staff note (private)</label><textarea id="rn_' + r.id + '" rows="2" maxlength="1000">' + esc(r.staff_note || "") + "</textarea></div></div>" +
          '<button class="btn sm" data-r="' + r.id + '" data-k="' + r.kind + '" style="margin-top:10px">Save</button></div>';
      }).join("") : '<div class="empty">No requests here yet.</div>'));
    $$("[data-seg]").forEach(function (b) { b.onclick = function () { seg = b.dataset.seg; X.go("requests"); }; });
    $$("[data-r]").forEach(function (b) {
      b.onclick = async function () {
        var id = b.dataset.r, st = $("#rs_" + id).value, note = $("#rn_" + id).value.trim();
        if (st === "approved" && b.dataset.k !== "board") { CV.toast("Only request-board requests can be approved. Use Matched for the concierge.", 1); return; }
        if (st === "rejected" && !note) { CV.toast("Please write a short reason in the staff note before you reject a request.", 1); return; }
        b.disabled = true;
        var r = await sb.from("property_requests").update({ status: st, staff_note: note }).eq("id", id);
        b.disabled = false;
        r.error ? CV.toast(PT.msg(r.error), 1) : (CV.toast("Saved"), X.panel(true), X.go("requests"));
      };
    });
  }
  if (X.views) X.views.requests = requests;
})();
