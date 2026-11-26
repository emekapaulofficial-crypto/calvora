/* CALVORA CEO Dashboard. Reads real records from Supabase (RLS enforced on the server).
   Nothing here is sample data: a chart with no records is still drawn, with a note saying so. */
(function () {
  var S = window.SITE, sb = window.supabase.createClient(S.supabase.url, S.supabase.key);
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var NAVY = "#012547", GREEN = "#7BD441", GD = "#4FB52A", RED = "#E5322D", GRID = { color: "#E9EEF3" };
  var BON = ["#7BD441", "#3FC9A0", "#2BB3C8", "#2D86D6", "#2F55C8", "#4B3BC4", "#6C3FC0", "#8E5BC0", "#A05BB0", "#B25B9A"];
  var N = function (n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); };
  var fmtK = function (v) { v = Number(v) || 0; if (v >= 1e9) return (v / 1e9).toFixed(1).replace(".0", "") + "B"; if (v >= 1e6) return (v / 1e6).toFixed(1).replace(".0", "") + "M"; if (v >= 1e3) return Math.round(v / 1e3) + "K"; return String(v); };
  var NS = function (n) { return "\u20A6" + fmtK(n); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var p2 = function (n) { return String(n).padStart(2, "0"); };
  var iso = function (d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var PL = { today: "Today", week: "This Week", month: "This Month", quarter: "This Quarter", year: "This Year", custom: "Selected Period" };
  var VS = { today: "vs yesterday", week: "vs last week", month: "vs last month", quarter: "vs last quarter", year: "vs last year", custom: "vs previous period" };
  var user, profile, ROLE, D = {}, charts = {}, R, preset = "month";
  var st = { gran: "month", growth: "properties", agent: "sales", sales: "6" };

  /* icons (24x24 paths) */
  var IC = {
    house: '<path d="M12 3 2 12h3v9h5v-6h4v6h5v-9h3z"/>',
    key: '<path fill-rule="evenodd" d="M7 14a5 5 0 1 1 4.6-7H22v4h-2v3h-3v-3h-2.4A5 5 0 0 1 7 14zm0-7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/>',
    coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 9v3c0 1.7 3.6 3 8 3s8-1.3 8-3V9c0 1.7-3.6 3-8 3S4 10.7 4 9zm0 6v3c0 1.7 3.6 3 8 3s8-1.3 8-3v-3c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/>',
    wallet: '<path fill-rule="evenodd" d="M3 6a3 3 0 0 1 3-3h12v3H6a1 1 0 0 0 0 2h14a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3zm14 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
    bars: '<path d="M4 20V10h4v10zM10 20V4h4v16zM16 20v-7h4v7z"/>',
    trend: '<path d="M2 17l6-6 4 4 7-8h-3V5h7v7h-2V9l-8 9-4-4-4 4z"/>',
    trophy: '<path d="M7 3h10v4a5 5 0 0 1-10 0zM4 4h3v3a3 3 0 0 1-3-3zm13 0h3a3 3 0 0 1-3 3zM11 13h2v3h3v2H8v-2h3z"/>',
    heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    warn: '<path fill-rule="evenodd" d="M12 2 23 21H1zM11 9v6h2V9zm0 8v2h2v-2z"/>',
    pie: '<path d="M11 3a9 9 0 1 0 9 9h-9zM13 1v10h10A10 10 0 0 0 13 1z"/>'
  };
  var svg = function (k) { return '<svg viewBox="0 0 24 24">' + IC[k] + "</svg>"; };

  async function q(b) { var r = await b; if (r.error) throw r.error; return r.data || []; }
  async function safe(b) { try { return await q(b); } catch (e) { return null; } }

  /* ---------- date ranges ---------- */
  function range() {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth(), a, b = n;
    if (preset === "today") a = n;
    else if (preset === "week") { a = new Date(n); a.setDate(n.getDate() - ((n.getDay() + 6) % 7)); }
    else if (preset === "month") a = new Date(y, m, 1);
    else if (preset === "quarter") a = new Date(y, Math.floor(m / 3) * 3, 1);
    else if (preset === "year") a = new Date(y, 0, 1);
    else { var d1 = $("#d1").value, d2 = $("#d2").value; return [d1 || iso(new Date(y, m, 1)), d2 || iso(n)]; }
    return [iso(a), iso(b)];
  }
  function prevRange() {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth();
    if (preset === "month") return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (preset === "quarter") { var qs = Math.floor(m / 3) * 3; return [iso(new Date(y, qs - 3, 1)), iso(new Date(y, qs, 0))]; }
    if (preset === "year") return [(y - 1) + "-01-01", (y - 1) + "-12-31"];
    var a = new Date(R[0] + "T00:00:00"), b = new Date(R[1] + "T00:00:00"), len = Math.round((b - a) / 864e5) + 1;
    var pe = new Date(a); pe.setDate(pe.getDate() - 1); var ps = new Date(pe); ps.setDate(ps.getDate() - (len - 1));
    return [iso(ps), iso(pe)];
  }
  /* the window that a target belongs to (month, quarter or year that contains the end of the range) */
  function twin() {
    var e = new Date(R[1] + "T00:00:00"), y = e.getFullYear(), m = e.getMonth();
    if (preset === "year") return [y + "-01-01", R[1]];
    if (preset === "quarter") return [iso(new Date(y, Math.floor(m / 3) * 3, 1)), R[1]];
    return [iso(new Date(y, m, 1)), R[1]];
  }
  function pkey() {
    var e = new Date(R[1] + "T00:00:00"), y = e.getFullYear();
    if (preset === "year") return String(y);
    if (preset === "quarter") return y + "-Q" + (Math.floor(e.getMonth() / 3) + 1);
    return y + "-" + p2(e.getMonth() + 1);
  }
  var within = function (d, a, b) { d = (d || "").slice(0, 10); return d >= a && d <= b; };
  var inR = function (d) { return within(d, R[0], R[1]); };
  function target(metric, period) {
    var t = (D.targets || []).filter(function (x) { return x.metric === metric && x.period === period; })[0];
    return t && Number(t.value) > 0 ? Number(t.value) : null;
  }
  function sumFin(kind, a, b) { var t = 0; (D.fin || []).forEach(function (f) { if (f.kind === kind && within(f.entry_date, a, b)) t += Number(f.amount) || 0; }); return t; }
  var done = function () { return (D.tx || []).filter(function (t) { return t.status === "completed"; }); };
  var cnt = function (a, f) { return a.filter(f).length; };
  function delta(c, p) {
    var v = " " + VS[preset];
    if (!c && !p) return '<span class="dl">No activity yet</span>';
    if (!p) return '<span class="up">\u2191 New</span>' + v;
    var pc = Math.round((c - p) / p * 100);
    if (pc === 0) return '<span class="dl">No change</span>' + v;
    return (pc > 0 ? '<span class="up">\u2191 ' + pc + "%</span>" : '<span class="dn">\u2193 ' + Math.abs(pc) + "%</span>") + v;
  }

  /* ---------- card helpers ---------- */
  function card(cls, id, title, extra, icon) {
    return '<section class="card ' + cls + '" id="' + id + '"><div class="hd2"><h2>' + (icon ? svg(icon) : "") + title + "</h2>" + (extra || "") + '</div><div class="body"><div class="state">Loading\u2026</div></div></section>';
  }
  function kcard(id, cls, icon, label) {
    return '<div class="card kpi ' + cls + '" id="' + id + '"><svg class="wm" viewBox="0 0 24 24">' + IC[icon] + '</svg><svg class="ic" viewBox="0 0 24 24">' + IC[icon] + "</svg><b>\u2026</b><small>" + label + "</small><p></p></div>";
  }
  function setBody(id, html) { $("#" + id + " .body").innerHTML = html; }
  function killChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function fail(id) {
    killChart(id);
    setBody(id, '<div class="state"><div>Could not load this section. It may need permission, or the connection failed.<br><button class="btn2" type="button" data-retry="1">Try again</button></div></div>');
    $("#" + id + " [data-retry]").onclick = function () { load(); };
  }
  function empty(id, msg) { killChart(id); setBody(id, '<div class="state">' + msg + "</div>"); }
  function canvas(id) { killChart(id); setBody(id, '<div class="cv"><canvas></canvas></div>'); return $("#" + id + " canvas"); }
  function mk(id, cfg, note) {
    if (typeof Chart === "undefined") return empty(id, "The chart library could not load. Check your internet connection and refresh.");
    charts[id] = new Chart(canvas(id), cfg);
    if (note) $("#" + id + " .body").insertAdjacentHTML("beforeend", '<p class="note">' + note + "</p>");
  }
  function seg(key, opts) {
    return '<div class="seg2" data-seg="' + key + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (st[key] === o[0] ? "on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div>";
  }
  var ini = function (n) { return String(n || "A").trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join(""); };
  var ADM = function () { return ROLE === "admin"; };

  /* value labels drawn on bars and points (small plugin, no extra file) */
  if (typeof Chart !== "undefined") {
    Chart.defaults.font.family = "Figtree, system-ui, sans-serif";
    Chart.defaults.color = "#566577";
    Chart.register({
      id: "vl",
      afterDatasetsDraw: function (ch) {
        var ctx = ch.ctx;
        ch.data.datasets.forEach(function (ds, i) {
          if (!ds.vl) return; var meta = ch.getDatasetMeta(i); if (meta.hidden) return;
          meta.data.forEach(function (el, j) {
            var v = ds.data[j]; if (v == null || (ds.vlSkip0 && !v)) return;
            var p = el.tooltipPosition(), below = ds.vlPos === "below";
            ctx.save(); ctx.font = "700 11px Figtree, sans-serif"; ctx.fillStyle = ds.vlColor || NAVY; ctx.textAlign = "center"; ctx.textBaseline = below ? "top" : "bottom";
            ctx.fillText(ds.vlFmt ? ds.vlFmt(v) : v, p.x, p.y + (below ? 9 : -7)); ctx.restore();
          });
        });
      }
    });
  }
  var base = { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 16 } }, interaction: { mode: "index", intersect: false }, plugins: { legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8, font: { weight: "600" } } } } };
  function opts(o) { return Object.assign({}, base, o); }

  /* ---------- layout ---------- */
  function layout() {
    var yrs = '<option value="6">Last 6 months</option>', cy = new Date().getFullYear();
    for (var y = cy; y >= cy - 4; y--) yrs += '<option value="' + y + '"' + (st.sales === String(y) ? " selected" : "") + ">" + y + "</option>";
    $("#app").innerHTML =
      kcard("k1", "navy", "house", "Total Properties") +
      kcard("k2", "green", "key", "Sold " + PL[preset]) +
      kcard("k3", "navy", "coins", "Total Income") +
      kcard("k4", "red", "wallet", "Total Expenses") +
      card("w6", "c1", "Monthly Sales Trend", '<select id="sy" aria-label="Period">' + yrs + "</select>", "bars") +
      card("w6", "c2", "Income vs Expenses", seg("gran", [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["year", "Yearly"]]), "trend") +
      card("w5", "ctop", "Top 3 Agents " + PL[preset], '<a class="vall" href="admin.html">View All \u2192</a>', "trophy") +
      card("w7", "c5", "Company Health Overview", "", "heart") +
      card("w6", "c6", "Alerts &amp; Warnings", '<a class="vall" href="admin.html">View All \u2192</a>', "warn") +
      card("w6", "c8", "Company Performance Summary", "", "pie") +
      card("w6", "c3", "Company Growth", seg("growth", [["properties", "Properties"], ["sales", "Sales"], ["leads", "Customers"], ["income", "Income"]]), "trend") +
      card("w6", "c4", "Agent Performance", seg("agent", [["sales", "Sales"], ["revenue", "Revenue"], ["submitted", "Submitted"], ["verified", "Verified"]]), "trophy") +
      card("w12", "c7", "Saved Reports (weekly and monthly)", "", "bars") +
      '<div class="card w12" id="tgbox" hidden></div>';
    $("#sy").onchange = function () { st.sales = this.value; drawSales(); };
    $$("[data-seg]").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        st[g.dataset.seg] = b.dataset.v; g.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
        ({ gran: drawMoney, growth: drawGrowth, agent: drawAgents })[g.dataset.seg]();
      };
    });
    $("#ppd").textContent = "Period: " + R[0] + " to " + R[1] + "  \u00b7  Generated: " + iso(new Date());
  }

  async function load() {
    R = range();
    layout();
    var res = await Promise.all([
      safe(sb.from("properties").select("id,status,created_at,agent_id").limit(10000)),
      safe(sb.from("transactions").select("id,status,completed_at,commission_amount,agent_id").limit(10000)),
      safe(sb.from("finance_entries").select("entry_date,kind,amount").limit(10000)),
      safe(sb.from("leads").select("id,status,created_at,next_follow_up").limit(10000)),
      safe(sb.from("commissions").select("id,status").limit(10000)),
      safe(sb.from("complaints").select("id,status").limit(10000)),
      safe(sb.from("profiles").select("id,full_name,agent_code,status").eq("role", "agent").limit(2000)),
      safe(sb.from("management_targets").select("*"))
    ]);
    D = { props: res[0], tx: res[1], fin: res[2], leads: res[3], com: res[4], cmp: res[5], agents: res[6], targets: res[7] || [] };
    kpis(); drawSales(); drawMoney(); drawTop(); drawHealth(); drawAlerts(); drawPerf(); drawGrowth(); drawAgents(); drawSaved();
  }

  /* ---------- KPI cards ---------- */
  function kset(id, v, sub, full) {
    var k = $("#" + id), b = k.querySelector("b"); b.textContent = v; b.title = full || ""; k.querySelector("p").innerHTML = sub;
  }
  function kpis() {
    var P = D.props, pr = prevRange(), TW = twin();
    if (!P) kset("k1", "\u2013", "Could not load"); else kset("k1", P.length, delta(P.length, cnt(P, function (p) { return (p.created_at || "").slice(0, 10) < R[0]; })));
    if (!D.tx) kset("k2", "\u2013", "Could not load");
    else kset("k2", cnt(done(), function (t) { return inR(t.completed_at); }), delta(cnt(done(), function (t) { return inR(t.completed_at); }), cnt(done(), function (t) { return within(t.completed_at, pr[0], pr[1]); })));
    if (!D.fin) { kset("k3", "\u2013", "Restricted or unavailable"); kset("k4", "\u2013", "Restricted or unavailable"); return; }
    var inc = sumFin("income", R[0], R[1]), exp = sumFin("expense", R[0], R[1]);
    D.inc = inc; D.exp = exp; D.incT = sumFin("income", TW[0], TW[1]);
    kset("k3", NS(inc), delta(inc, sumFin("income", pr[0], pr[1])), N(inc));
    kset("k4", NS(exp), delta(exp, sumFin("expense", pr[0], pr[1])), N(exp));
  }

  /* ---------- Monthly Sales Trend (bars + target line) ---------- */
  function drawSales() {
    if (!D.tx) return fail("c1");
    var n = new Date(), keys = [], labs = [], i, d;
    if (st.sales === "6") { for (i = 5; i >= 0; i--) { d = new Date(n.getFullYear(), n.getMonth() - i, 1); keys.push(d.getFullYear() + "-" + p2(d.getMonth() + 1)); labs.push(MON[d.getMonth()]); } }
    else for (i = 0; i < 12; i++) { keys.push(st.sales + "-" + p2(i + 1)); labs.push(MON[i]); }
    var act = keys.map(function () { return 0; }), any = false;
    done().forEach(function (t) { var j = keys.indexOf((t.completed_at || "").slice(0, 7)); if (j > -1) { act[j]++; any = true; } });
    var tg = keys.map(function (k) { return target("sales", k); }), hasT = tg.some(Boolean);
    var mx = Math.max.apply(null, act.concat(tg.map(function (x) { return x || 0; })));
    var ds = [{ type: "bar", label: "Sales", data: act, backgroundColor: NAVY, borderRadius: 6, barPercentage: .55, order: 2, vl: true, vlSkip0: true }];
    if (hasT) ds.push({ type: "line", label: "Target", data: tg, borderColor: GD, backgroundColor: GD, pointBackgroundColor: GD, pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 5, tension: .2, spanGaps: true, order: 1, vl: true, vlColor: "#2f7d12" });
    mk("c1", {
      type: "bar", data: { labels: labs, datasets: ds },
      options: opts({
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, suggestedMax: mx ? undefined : 5, ticks: { precision: 0 }, grid: GRID } },
        plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { afterBody: function (it) { var j = it[0].dataIndex; return hasT ? (tg[j] == null ? "Target not set" : "Difference: " + (act[j] - tg[j])) : ""; } } } })
      })
    }, any || hasT ? (hasT ? null : "No sales target set yet. Use Set New Target below to draw the green target line.") : "No completed sales recorded in this period yet. Bars appear as deals are completed.");
  }

  /* ---------- Income vs Expenses ---------- */
  function buckets() {
    var n = new Date(), ks = [], ls = [], i, d;
    if (st.gran === "day") { for (i = 29; i >= 0; i--) { d = new Date(n); d.setDate(n.getDate() - i); ks.push(iso(d)); ls.push(d.getDate() + " " + MON[d.getMonth()]); } }
    else if (st.gran === "week") { var mon = new Date(n); mon.setDate(n.getDate() - ((n.getDay() + 6) % 7)); for (i = 7; i >= 0; i--) { d = new Date(mon); d.setDate(mon.getDate() - 7 * i); ks.push(iso(d)); ls.push(d.getDate() + " " + MON[d.getMonth()]); } }
    else if (st.gran === "year") { for (i = 4; i >= 0; i--) { ks.push(String(n.getFullYear() - i)); ls.push(String(n.getFullYear() - i)); } }
    else { for (i = 5; i >= 0; i--) { d = new Date(n.getFullYear(), n.getMonth() - i, 1); ks.push(d.getFullYear() + "-" + p2(d.getMonth() + 1)); ls.push(MON[d.getMonth()]); } }
    return { ks: ks, ls: ls };
  }
  function bucketOf(d) {
    if (st.gran === "day") return d;
    if (st.gran === "month") return d.slice(0, 7);
    if (st.gran === "year") return d.slice(0, 4);
    var x = new Date(d + "T00:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x);
  }
  function drawMoney() {
    if (!D.fin) return fail("c2");
    var B = buckets(), inc = B.ks.map(function () { return 0; }), exp = inc.slice(), ti = 0, te = 0, any = false;
    D.fin.forEach(function (f) {
      if (f.kind !== "income" && f.kind !== "expense") return;
      var j = B.ks.indexOf(bucketOf((f.entry_date || "").slice(0, 10))); if (j < 0) return;
      var a = Number(f.amount) || 0; any = true;
      if (f.kind === "income") { inc[j] += a; ti += a; } else { exp[j] += a; te += a; }
    });
    var lab = B.ks.length <= 12, mx = Math.max.apply(null, inc.concat(exp));
    var pt = { pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 5, tension: .3, vl: lab, vlFmt: fmtK, vlSkip0: true };
    mk("c2", {
      type: "line",
      data: { labels: B.ls, datasets: [
        Object.assign({ label: "Income", data: inc, borderColor: GD, backgroundColor: GD, pointBackgroundColor: GD, vlColor: "#2f7d12" }, pt),
        Object.assign({ label: "Expenses", data: exp, borderColor: RED, backgroundColor: RED, pointBackgroundColor: RED, vlColor: RED, vlPos: "below" }, pt)
      ] },
      options: opts({
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, suggestedMax: mx ? undefined : 1000000, grid: GRID, ticks: { callback: function (v) { return fmtK(v); } } } },
        plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + N(c.parsed.y); } } } })
      })
    }, any ? null : "No income or expense records for this view yet. Lines appear as finance entries are added.");
    $("#c2 .body").insertAdjacentHTML("beforeend", '<div class="sum"><span><i style="background:' + GD + '"></i>Income <b>' + N(ti) + '</b></span><span><i style="background:' + RED + '"></i>Expenses <b>' + N(te) + '</b></span><a href="admin.html">Open financial records \u2192</a></div>');
  }

  /* ---------- Top 3 agents ---------- */
  function drawTop() {
    if (!D.agents || !D.tx || !D.props) return fail("ctop");
    var a = {};
    function row(id) { return a[id] || (a[id] = { s: 0, r: 0, l: 0 }); }
    D.props.forEach(function (p) { if (p.agent_id && inR(p.created_at)) row(p.agent_id).l++; });
    done().forEach(function (t) { if (t.agent_id && inR(t.completed_at)) { var x = row(t.agent_id); x.s++; x.r += Number(t.commission_amount) || 0; } });
    var nm = {}; D.agents.forEach(function (g) { nm[g.id] = g.full_name || g.agent_code || "Agent"; });
    var ks = Object.keys(a).filter(function (k) { return a[k].s || a[k].l; }).sort(function (x, y) { return (a[y].s - a[x].s) || (a[y].r - a[x].r) || (a[y].l - a[x].l); }).slice(0, 3);
    if (!ks.length) return empty("ctop", "No agent activity is recorded for this period.");
    var useRev = a[ks[0]].r > 0, top = useRev ? a[ks[0]].r : a[ks[0]].l || 1;
    setBody("ctop", ks.map(function (k, i) {
      var w = Math.max(6, Math.round((useRev ? a[k].r : a[k].l) / top * 100));
      return '<div class="ag a' + (i + 1) + '"><span class="av">' + esc(ini(nm[k])) + '</span><div class="agm"><b>' + esc(nm[k] || "Agent") + "</b><small>" + a[k].l + " Listing" + (a[k].l === 1 ? "" : "s") + " \u2022 " + N(a[k].r) + '</small><i class="bar"><u style="width:' + w + '%"></u></i></div><span class="rk r' + (i + 1) + '">#' + (i + 1) + "</span></div>";
    }).join(""));
  }

  /* ---------- Company health rings ---------- */
  function ring(pct, color, label, sub, cls) {
    var C = 263.9, p = pct == null ? 0 : Math.min(100, Math.max(0, pct));
    return '<div class="rg"><div class="d" style="color:' + color + '"><svg viewBox="0 0 100 100"><circle class="t" cx="50" cy="50" r="42"/><circle class="v" cx="50" cy="50" r="42" stroke-dasharray="' + (p / 100 * C).toFixed(1) + " " + C + '"/></svg><span>' + (pct == null ? "\u2013" : Math.round(pct) + "%") + "</span></div><b>" + label + '</b><small class="' + cls + '">' + sub + "</small></div>";
  }
  function drawHealth() {
    if (!D.fin || !D.props || !D.leads || !D.agents || !D.tx) return fail("c5");
    var k = pkey(), TW = twin(), out = [], v, t;
    t = target("income", k);
    if (t) { v = (D.incT || 0) / t * 100; out.push(ring(v, GD, "Earnings Achieved", v >= 100 ? "\u2713 Target met" : "\u2193 " + Math.round(100 - v) + "% Lacking", v >= 100 ? "ok" : "")); }
    else out.push(ring(null, GD, "Earnings Achieved", "Set an income target", "na"));
    t = target("listings", k);
    if (t) { var l = cnt(D.props, function (p) { return within(p.created_at, TW[0], TW[1]); }); v = l / t * 100; out.push(ring(v, "#3B82F6", "Listings Achieved", v >= 100 ? "\u2713 Target met" : "\u2193 " + Math.round(100 - v) + "% Lacking", v >= 100 ? "ok" : "")); }
    else out.push(ring(null, "#3B82F6", "Listings Achieved", "Set a listings target", "na"));
    var act = {};
    D.props.forEach(function (p) { if (p.agent_id && inR(p.created_at)) act[p.agent_id] = 1; });
    done().forEach(function (x) { if (x.agent_id && inR(x.completed_at)) act[x.agent_id] = 1; });
    var ag = D.agents.filter(function (a) { return a.status === "active"; }), on = cnt(ag, function (a) { return act[a.id]; });
    if (ag.length) { v = on / ag.length * 100; out.push(ring(v, "#8E5BC0", "Agent Activity", v >= 100 ? "\u2713 All active" : "\u2193 " + Math.round(100 - v) + "% Inactive", v >= 100 ? "ok" : "")); }
    else out.push(ring(null, "#8E5BC0", "Agent Activity", "No active agents", "na"));
    var ld = D.leads.filter(function (x) { return inR(x.created_at); }), rs = cnt(ld, function (x) { return x.status !== "new"; });
    if (ld.length) { v = rs / ld.length * 100; out.push(ring(v, "#F59E0B", "Customer Response", v >= 100 ? "\u2713 All answered" : "\u2193 " + Math.round(100 - v) + "% Pending", v >= 100 ? "ok" : "")); }
    else out.push(ring(null, "#F59E0B", "Customer Response", "No leads in this period", "na"));
    setBody("c5", '<div class="rings">' + out.join("") + "</div>");
  }

  /* ---------- Alerts & Warnings ---------- */
  function drawAlerts() {
    var t = iso(new Date()), cut = iso(new Date(Date.now() - 7 * 864e5)), inactive = null;
    if (D.agents && D.props && D.tx) {
      var act = {};
      D.props.forEach(function (p) { if (p.agent_id && (p.created_at || "").slice(0, 10) >= cut) act[p.agent_id] = 1; });
      D.tx.forEach(function (x) { if (x.agent_id && (x.completed_at || "").slice(0, 10) >= cut) act[x.agent_id] = 1; });
      inactive = cnt(D.agents, function (a) { return a.status === "active" && !act[a.id]; });
    }
    var rows = [
      ["red", "!", "c-red", inactive, "Agents inactive for 7+ days", "No listing submitted and no sale completed in the last 7 days"],
      ["orange", "\u25B2", "c-orange", D.props && cnt(D.props, function (p) { return p.status === "pending_review" || p.status === "under_review"; }), "Properties awaiting verification", ""],
      ["blue", "i", "c-blue", D.com && cnt(D.com, function (c) { return c.status === "due" || c.status === "pending"; }), "Commissions due or pending", ""],
      ["green", "\u2713", "c-green", D.leads && cnt(D.leads, function (l) { return l.next_follow_up && l.next_follow_up < t && (l.status === "new" || l.status === "contacted"); }), "Customer follow-ups overdue", ""],
      ["purple", "i", "c-purple", D.cmp && cnt(D.cmp, function (c) { return c.status === "received"; }), "Complaints awaiting response", ""]
    ], total = 0;
    rows.forEach(function (r) { if (r[3]) total += r[3]; });
    var bn = $("#bn"); bn.textContent = total; bn.hidden = !total;
    var cm = rows[4][3], bd = $("#bdg-cmp"); bd.textContent = cm || 0; bd.hidden = !cm;
    setBody("c6", '<ul class="alr">' + rows.map(function (r) {
      var n = r[3], none = n === null || n === false;
      return '<li title="' + esc(r[5]) + '"><span class="ai ' + r[0] + '">' + r[1] + '</span><a href="admin.html"><b class="' + (none || !n ? "z" : r[2]) + '">' + (none ? "\u2013" : n) + "</b> " + r[4] + (none ? " (not available for your access)" : "") + "</a></li>";
    }).join("") + "</ul>");
  }

  /* ---------- Company Performance Summary ---------- */
  function drawPerf() {
    if (!D.fin) return fail("c8");
    var k = pkey(), tg = target("income", k), act = D.incT || 0, C = 2 * Math.PI * 62;
    var tl = preset === "year" ? "Yearly Target" : preset === "quarter" ? "Quarterly Target" : "Monthly Target";
    var pct = tg ? Math.round(act / tg * 100) : null, left = tg ? Math.max(0, tg - act) : null, p = pct == null ? 0 : Math.min(100, pct);
    setBody("c8", '<div class="perf"><div><label>' + tl + '</label><span class="big">' + (tg ? N(tg) : "Not set") + "</span><label>Actual Earnings</label><span class=\"big\">" + N(act) + "</span></div>" +
      '<div class="donut"><svg viewBox="0 0 160 160"><circle class="t" cx="80" cy="80" r="62"/><circle class="v" cx="80" cy="80" r="62" stroke-dasharray="' + (p / 100 * C).toFixed(1) + " " + C.toFixed(1) + '"/></svg><span>' + (pct == null ? "\u2013" : pct + "%") + "</span></div>" +
      '<div class="rem"><label>' + (tg && act >= tg ? "Target exceeded by" : "Remaining") + '</label><span class="big">' + (tg ? (act >= tg ? N(act - tg) : N(left)) : "\u2013") + "</span>" +
      (ADM() ? '<button class="btn-g" type="button" id="settg">Set New Target</button>' : "") + "</div></div>");
    if ($("#settg")) $("#settg").onclick = function () { targetForm(true); };
  }

  /* ---------- Company Growth (extra) ---------- */
  function series(metric, y) {
    var out = new Array(12).fill(0), cum = metric === "properties" || metric === "leads", rows;
    if (metric === "properties") rows = (D.props || []).map(function (p) { return [p.created_at, 1]; });
    else if (metric === "leads") rows = (D.leads || []).map(function (p) { return [p.created_at, 1]; });
    else if (metric === "sales") rows = done().map(function (t) { return [t.completed_at, 1]; });
    else rows = (D.fin || []).filter(function (f) { return f.kind === "income"; }).map(function (f) { return [f.entry_date, Number(f.amount) || 0]; });
    var before = 0, has = false;
    rows.forEach(function (r) {
      var d = (r[0] || "").slice(0, 10); if (!d) return; var yy = +d.slice(0, 4);
      if (yy === y) { out[+d.slice(5, 7) - 1] += r[1]; has = true; } else if (cum && yy < y) before += r[1];
    });
    if (cum) { var run = before; out = out.map(function (v) { run += v; return run; }); }
    return { v: out, has: has || before > 0 };
  }
  function areaFill(rgb) {
    return function (c) { var a = c.chart.chartArea; if (!a) return "rgba(" + rgb + ",.15)"; var g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, "rgba(" + rgb + ",.30)"); g.addColorStop(1, "rgba(" + rgb + ",0)"); return g; };
  }
  function drawGrowth() {
    var src = { properties: D.props, sales: D.tx, leads: D.leads, income: D.fin }[st.growth];
    if (!src) return fail("c3");
    var y = new Date().getFullYear(), cur = series(st.growth, y), prev = series(st.growth, y - 1), mo = new Date().getMonth(), money = st.growth === "income";
    var ds = [{ label: String(y), data: cur.v.map(function (v, i) { return i <= mo ? v : null; }), borderColor: NAVY, backgroundColor: areaFill("1,37,71"), fill: true, tension: .3, pointRadius: 3 }];
    if (prev.has) ds.push({ label: String(y - 1), data: prev.v, borderColor: GD, borderDash: [5, 4], tension: .3, pointRadius: 2 });
    mk("c3", { type: "line", data: { labels: MON, datasets: ds }, options: opts({ scales: { x: { grid: { display: false } }, y: { beginAtZero: true, suggestedMax: cur.has ? undefined : 5, grid: GRID, ticks: { precision: 0, callback: function (v) { return money ? fmtK(v) : v; } } } }, plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + (money ? N(c.parsed.y) : c.parsed.y); } } } }) }) },
      cur.has ? null : "Not enough records yet to show growth for this measure.");
  }

  /* ---------- Agent Performance (leaderboard bars) ---------- */
  function drawAgents() {
    if (!D.agents || !D.tx || !D.props) return fail("c4");
    var name = {}; D.agents.forEach(function (a) { name[a.id] = (a.full_name || "Agent") + (a.agent_code ? " (" + a.agent_code + ")" : ""); });
    var s = {}, money = st.agent === "revenue";
    function add(id, v) { if (!id) return; s[id] = (s[id] || 0) + v; }
    if (st.agent === "sales") done().forEach(function (t) { if (inR(t.completed_at)) add(t.agent_id, 1); });
    else if (money) done().forEach(function (t) { if (inR(t.completed_at)) add(t.agent_id, Number(t.commission_amount) || 0); });
    else D.props.forEach(function (p) { if (inR(p.created_at) && (st.agent === "submitted" || ["approved", "sold", "rented"].indexOf(p.status) > -1)) add(p.agent_id, 1); });
    var ks = Object.keys(s).filter(function (k) { return s[k] > 0; }).sort(function (a, b) { return s[b] - s[a]; }).slice(0, 8);
    if (!ks.length) return empty("c4", "No agent activity is recorded for this period.");
    mk("c4", {
      type: "bar",
      data: { labels: ks.map(function (k) { return name[k] || "Agent"; }), datasets: [{ data: ks.map(function (k) { return s[k]; }), backgroundColor: ks.map(function (k, i) { return BON[i % BON.length]; }), borderRadius: 5, barPercentage: .7 }] },
      options: opts({ indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return money ? N(c.parsed.x) : c.parsed.x; } } } }, scales: { y: { grid: { display: false } }, x: { beginAtZero: true, grid: GRID, ticks: { precision: 0, callback: function (v) { return money ? fmtK(v) : v; } } } } })
    });
  }

  /* ---------- targets ---------- */
  function targetForm(open) {
    var b = $("#tgbox"); b.hidden = open === true ? false : !b.hidden; if (b.hidden) return;
    b.innerHTML = '<h2>Set a target</h2><p class="muted">Saved to the database. Only the CEO can change targets. Period: 2026-11 (month), 2026-Q4 (quarter) or 2026 (year).</p><div class="tg"><select id="tm"><option value="income">Income (\u20A6)</option><option value="sales">Sales (count)</option><option value="listings">Property listings</option></select><input id="tp" value="' + pkey() + '" aria-label="Period"><input id="tv" type="number" min="0" placeholder="Target value" aria-label="Value"><button class="btn2" id="ts" type="button">Save target</button></div><p id="tmsg" class="small"></p>';
    b.scrollIntoView({ behavior: "smooth", block: "center" });
    $("#ts").onclick = async function () {
      var v = Number($("#tv").value), p = $("#tp").value.trim();
      if (!p || !(v >= 0) || $("#tv").value === "") { $("#tmsg").textContent = "Enter the period and a value."; return; }
      var r = await sb.from("management_targets").upsert({ metric: $("#tm").value, period: p, value: v, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "metric,period" });
      $("#tmsg").textContent = r.error ? "Could not save: " + r.error.message : "Saved.";
      if (!r.error) load();
    };
  }

  async function boot() {
    var s = (await sb.auth.getSession()).data.session;
    if (!s) { location.href = "admin.html"; return; }
    user = s.user;
    try { profile = await q(sb.from("profiles").select("*").eq("id", user.id).single()); } catch (e) { profile = null; }
    ROLE = profile && profile.status === "active" ? (profile.role === "admin" ? "admin" : profile.role === "staff" ? profile.staff_role || "staff" : null) : null;
    if (!ROLE) { $("#app").innerHTML = '<div class="card gate"><h2>No access</h2><p>The Management Hub is for the CEO and authorised managers only.</p><a class="btn2" href="index.html" style="text-decoration:none;display:inline-block">Back to home</a></div>'; $("#pnm").textContent = ""; return; }
    var nm = profile.full_name || user.email;
    $("#pnm").textContent = nm; $("#pav").textContent = ini(nm);
    $("#prl").textContent = ROLE === "admin" ? "CEO" : "Manager (" + ROLE + ")";
    $("#ttl").textContent = ROLE === "admin" ? "CEO Dashboard" : "Management Dashboard";
    load();
  }

  /* ---------- downloads ---------- */
  function csv(rows) { return "\uFEFF" + rows.map(function (r) { return r.map(function (c) { c = c == null ? "" : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\r\n"); }
  function save(name, rows) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(rows)], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function reportRows() {
    var P = D.props || [], t = new Date().toISOString().slice(0, 10), rows = [["CALVORA MANAGEMENT REPORT"], ["Period", R[0] + " to " + R[1]], ["Generated", t], [], ["SUMMARY"], ["Measure", "Value"],
      ["Total properties", P.length], ["Available", cnt(P, function (p) { return p.status === "approved"; })], ["Sold", cnt(P, function (p) { return p.status === "sold"; })], ["Rented", cnt(P, function (p) { return p.status === "rented"; })],
      ["Awaiting verification", cnt(P, function (p) { return p.status === "pending_review" || p.status === "under_review"; })],
      ["Completed sales in period", D.tx ? cnt(done(), function (x) { return inR(x.completed_at); }) : "n/a"],
      ["Company income (NGN)", D.fin ? D.inc : "restricted"], ["Expenses (NGN)", D.fin ? D.exp : "restricted"], ["Net (NGN)", D.fin ? D.inc - D.exp : "restricted"], []];
    if (D.fin) {
      var m = {}; D.fin.forEach(function (f) { if (!inR(f.entry_date) || (f.kind !== "income" && f.kind !== "expense")) return; var k = f.entry_date.slice(0, 7); m[k] = m[k] || [0, 0]; m[k][f.kind === "income" ? 0 : 1] += Number(f.amount) || 0; });
      rows.push(["INCOME AND EXPENSES BY MONTH"], ["Month", "Income (NGN)", "Expenses (NGN)", "Net (NGN)"]);
      Object.keys(m).sort().forEach(function (k) { rows.push([k, m[k][0], m[k][1], m[k][0] - m[k][1]]); }); rows.push([]);
    }
    if (D.tx && D.agents) {
      var nm = {}, a = {}; D.agents.forEach(function (x) { nm[x.id] = x.full_name || x.agent_code || "Agent"; });
      done().forEach(function (x) { if (inR(x.completed_at) && x.agent_id) { a[x.agent_id] = a[x.agent_id] || [0, 0]; a[x.agent_id][0]++; a[x.agent_id][1] += Number(x.commission_amount) || 0; } });
      rows.push(["AGENT PERFORMANCE (completed sales)"], ["Agent", "Sales", "Commission (NGN)"]);
      Object.keys(a).sort(function (x, y) { return a[y][0] - a[x][0]; }).forEach(function (k) { rows.push([nm[k] || "Agent", a[k][0], a[k][1]]); });
    }
    return rows;
  }
  var LBL = { total_properties: "Total properties", new_properties: "New properties", completed_sales: "Completed sales", income: "Income (NGN)", expenses: "Expenses (NGN)", net: "Net (NGN)", new_leads: "New leads", complaints_received: "Complaints received", active_agents: "Active agents" };
  async function drawSaved() {
    try { await sb.rpc("catch_up_snapshots"); } catch (e) {}
    var rows = await safe(sb.from("management_report_snapshots").select("*").order("period_start", { ascending: false }).limit(30));
    if (!rows) return empty("c7", "Saved reports are not set up yet. Run sql/management_reports.sql in Supabase once.");
    if (!rows.length) return empty("c7", "No saved reports yet. The first weekly and monthly reports are saved when a week or month ends.");
    setBody("c7", '<ul class="al">' + rows.map(function (r, i) {
      return '<li><span class="n">' + (r.period_type === "week" ? "W" : "M") + "</span><div><b>" + (r.period_type === "week" ? "Weekly" : "Monthly") + " report</b><small>" + r.period_start + " to " + r.period_end + '</small></div><button class="btn2" style="margin-left:auto" type="button" data-s="' + i + '">Download</button></li>';
    }).join("") + "</ul>");
    $$("#c7 [data-s]").forEach(function (b) {
      b.onclick = function () {
        var r = rows[+b.dataset.s], x = [["CALVORA " + r.period_type.toUpperCase() + "LY REPORT"], ["Period", r.period_start + " to " + r.period_end], [], ["Measure", "Value"]];
        Object.keys(LBL).forEach(function (k) { if (r.data[k] != null) x.push([LBL[k], r.data[k]]); });
        save("calvora-" + r.period_type + "-report-" + r.period_start + ".csv", x);
      };
    });
  }

  /* ---------- print / save as PDF: charts are swapped for pictures so they print sharp ---------- */
  function prepPrint() {
    if ($(".pimg")) return;
    $$(".cv canvas").forEach(function (c) { var im = new Image(); im.className = "pimg"; im.alt = ""; im.src = c.toDataURL("image/png"); c.parentNode.appendChild(im); });
  }
  window.addEventListener("beforeprint", prepPrint);
  window.addEventListener("afterprint", function () { $$(".pimg").forEach(function (i) { i.remove(); }); });

  $("#dl").onclick = function () { if (!user) return; if (!D.props) { alert("Data is still loading."); return; } save("calvora-report-" + R[0] + "-to-" + R[1] + ".csv", reportRows()); };
  $("#pr").onclick = function () { if (!user) return; prepPrint(); setTimeout(function () { window.print(); }, 250); };
  $("#range").onchange = function () { preset = this.value; $("#cust").hidden = preset !== "custom"; if (preset !== "custom" && user) load(); };
  $("#d1").onchange = $("#d2").onchange = function () { if (user && $("#d1").value && $("#d2").value) load(); };
  $("#refresh").onclick = function () { if (user) load(); };
  $("#bell").onclick = function () { var c = $("#c6"); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("#pbtn").onclick = function () { $("#pmenu").hidden = !$("#pmenu").hidden; };
  $("#out").onclick = async function () { await sb.auth.signOut(); location.href = "admin.html"; };
  $("#menu").onclick = $("#shade").onclick = function () { $("#sb").classList.toggle("open"); $("#shade").classList.toggle("open"); };
  $("#srch").onkeydown = function (e) {
    if (e.key !== "Enter") return;
    var v = this.value.trim().toLowerCase(); if (!v) return;
    var hit = Array.prototype.filter.call($$("#app .card"), function (c) { var h = c.querySelector("h2"); return h && h.textContent.toLowerCase().indexOf(v) > -1 || c.querySelector("small") && c.querySelector("small").textContent.toLowerCase().indexOf(v) > -1; })[0];
    if (hit) { hit.scrollIntoView({ behavior: "smooth", block: "center" }); hit.classList.remove("flash"); void hit.offsetWidth; hit.classList.add("flash"); }
    else { this.value = ""; this.placeholder = "No match. Try: agents, income, alerts, health"; }
  };
  boot();
})();
