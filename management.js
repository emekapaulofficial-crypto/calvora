/* CALVORA Management Hub. Reads real records from Supabase (RLS enforced on the server).
   Nothing here is sample data: a chart with no records says so. */
(function () {
  var S = window.SITE, sb = window.supabase.createClient(S.supabase.url, S.supabase.key);
  var $ = function (s) { return document.querySelector(s); };
  var NAVY = "#012547", GREEN = "#7BD441", SOFT = "#E6ECF3", ORANGE = "#e8821c";
  var N = function (n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var user, profile, ROLE, D = {}, charts = {}, R, preset = "month", year = new Date().getFullYear();
  var st = { gran: "month", growth: "properties", agent: "sales" };

  async function q(b) { var r = await b; if (r.error) throw r.error; return r.data || []; }
  async function safe(b) { try { return await q(b); } catch (e) { return null; } }

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
  function pkey() {
    var e = new Date(R[1] + "T00:00:00"), y = e.getFullYear();
    if (preset === "year") return String(y);
    if (preset === "quarter") return y + "-Q" + (Math.floor(e.getMonth() / 3) + 1);
    return y + "-" + String(e.getMonth() + 1).padStart(2, "0");
  }
  var inR = function (d) { d = (d || "").slice(0, 10); return d >= R[0] && d <= R[1]; };
  function target(metric, period) {
    var t = (D.targets || []).filter(function (x) { return x.metric === metric && x.period === period; })[0];
    return t && Number(t.value) > 0 ? Number(t.value) : null;
  }

  function card(cls, id, title, extra) {
    return '<section class="card ' + cls + '" id="' + id + '"><div class="hd2"><div><h2>' + title + '</h2></div>' + (extra || "") + '</div><div class="body"><div class="state">Loading\u2026</div></div></section>';
  }
  function setBody(id, html) { $("#" + id + " .body").innerHTML = html; }
  function fail(id, fn) {
    killChart(id);
    setBody(id, '<div class="state"><div>Could not load this section. It may need permission, or the connection failed.<br><button class="btn2" type="button" data-retry="1">Try again</button></div></div>');
    $("#" + id + " [data-retry]").onclick = function () { load(); };
  }
  function empty(id, msg) { killChart(id); setBody(id, '<div class="state">' + msg + "</div>"); }
  function killChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  function canvas(id) { killChart(id); setBody(id, '<div class="cv"><canvas></canvas></div>'); return $("#" + id + " canvas"); }
  function seg(id, key, opts) {
    return '<div class="seg2" data-seg="' + key + '">' + opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '" class="' + (st[key] === o[0] ? "on" : "") + '">' + o[1] + "</button>"; }).join("") + "</div>";
  }
  var base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { usePointStyle: true, boxWidth: 8 } } } };

  function layout() {
    var yrs = ""; for (var y = new Date().getFullYear(); y >= new Date().getFullYear() - 4; y--) yrs += '<option value="' + y + '"' + (y === year ? " selected" : "") + ">" + y + "</option>";
    $("#app").innerHTML =
      '<div class="card kpi" id="k1"><small>Total Properties</small><b>\u2026</b><p></p></div>' +
      '<div class="card kpi" id="k2"><small>Properties Sold</small><b>\u2026</b><p></p></div>' +
      '<div class="card kpi" id="k3"><small>Total Company Income</small><b>\u2026</b><p></p></div>' +
      '<div class="card kpi" id="k4"><small>Total Expenses</small><b>\u2026</b><p></p></div>' +
      card("w8", "c1", "Monthly Sales Performance", '<select id="yr" aria-label="Year">' + yrs + "</select>") +
      card("w4", "c5", "Company Health", ADM() ? '<button class="btn2" type="button" id="settg">Set targets</button>' : "") +
      card("w8", "c2", "Company Income vs Expenses", seg("c2", "gran", [["day", "Daily"], ["week", "Weekly"], ["month", "Monthly"], ["year", "Yearly"]])) +
      card("w4", "c6", "Alerts") +
      card("w6", "c3", "Calvora Company Growth", seg("c3", "growth", [["properties", "Properties"], ["sales", "Sales"], ["leads", "Customers"], ["income", "Income"]])) +
      card("w6", "c4", "Agent Performance", seg("c4", "agent", [["sales", "Sales"], ["revenue", "Revenue"], ["submitted", "Submitted"], ["verified", "Verified"]])) +
      card("w12", "c7", "Saved Reports (weekly and monthly)") +
      '<div class="card w12" id="tgbox" hidden></div>';
    $("#yr").onchange = function () { year = +this.value; drawSales(); };
    document.querySelectorAll("[data-seg]").forEach(function (g) {
      g.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        st[g.dataset.seg] = b.dataset.v; g.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
        ({ gran: drawMoney, growth: drawGrowth, agent: drawAgents })[g.dataset.seg]();
      };
    });
    if ($("#settg")) $("#settg").onclick = targetForm;
  }
  function ADM() { return ROLE === "admin"; }

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
    kpis(); drawSales(); drawMoney(); drawGrowth(); drawAgents(); drawHealth(); drawAlerts(); drawSaved();
  }

  function kset(id, v, sub) { var k = $("#" + id); k.querySelector("b").textContent = v; k.querySelector("p").innerHTML = sub; }
  var done = function () { return (D.tx || []).filter(function (t) { return t.status === "completed"; }); };
  var cnt = function (a, f) { return a.filter(f).length; };
  function kpis() {
    var P = D.props;
    if (!P) kset("k1", "\u2013", "Could not load"); else {
      kset("k1", P.length, cnt(P, function (p) { return p.status === "approved"; }) + " available \u00b7 " + cnt(P, function (p) { return p.status === "sold"; }) + " sold \u00b7 " + cnt(P, function (p) { return p.status === "rented"; }) + " rented \u00b7 " + cnt(P, function (p) { return p.status === "pending_review" || p.status === "under_review"; }) + " pending verification");
    }
    if (!D.tx) kset("k2", "\u2013", "Could not load"); else kset("k2", cnt(done(), function (t) { return inR(t.completed_at); }), "Approved completed deals, " + R[0] + " to " + R[1]);
    if (!D.fin) { kset("k3", "\u2013", "Restricted or unavailable"); kset("k4", "\u2013", "Restricted or unavailable"); return; }
    var inc = 0, exp = 0; D.fin.forEach(function (f) { if (!inR(f.entry_date)) return; if (f.kind === "income") inc += Number(f.amount) || 0; else if (f.kind === "expense") exp += Number(f.amount) || 0; });
    kset("k3", N(inc), "Confirmed company income only");
    kset("k4", N(exp), '<a href="admin.html">View expense records \u2192</a>');
    D.inc = inc; D.exp = exp;
  }

  function drawSales() {
    if (!D.tx) return fail("c1");
    var act = new Array(12).fill(0), tg = [], any = false;
    done().forEach(function (t) { var d = (t.completed_at || "").slice(0, 10); if (d.slice(0, 4) === String(year)) { act[+d.slice(5, 7) - 1]++; any = true; } });
    for (var m = 0; m < 12; m++) tg.push(target("sales", year + "-" + String(m + 1).padStart(2, "0")));
    if (!any && !tg.some(Boolean)) return empty("c1", "No sales records are available for " + year + ".");
    charts.c1 = new Chart(canvas("c1"), {
      type: "bar",
      data: { labels: MON, datasets: [{ label: "Completed sales", data: act, backgroundColor: NAVY, borderRadius: 5 }, { label: "Target", data: tg, backgroundColor: GREEN, borderRadius: 5 }] },
      options: Object.assign({}, base, {
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        onClick: function () { location.href = "admin.html"; },
        plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { afterBody: function (it) { var i = it[0].dataIndex; return tg[i] == null ? "Target not set" : "Difference: " + (act[i] - tg[i]); } } } })
      })
    });
  }

  function bucket(d) {
    if (st.gran === "day") return d;
    if (st.gran === "month") return d.slice(0, 7);
    if (st.gran === "year") return d.slice(0, 4);
    var x = new Date(d + "T00:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x);
  }
  function drawMoney() {
    if (!D.fin) return fail("c2");
    var m = {}, inc = 0, exp = 0;
    D.fin.forEach(function (f) {
      if (!inR(f.entry_date) || (f.kind !== "income" && f.kind !== "expense")) return;
      var k = bucket(f.entry_date.slice(0, 10)); m[k] = m[k] || { i: 0, e: 0 };
      var a = Number(f.amount) || 0; if (f.kind === "income") { m[k].i += a; inc += a; } else { m[k].e += a; exp += a; }
    });
    var ks = Object.keys(m).sort();
    if (!ks.length) return empty("c2", "No income or expense records are available for this period.");
    charts.c2 = new Chart(canvas("c2"), {
      type: "line",
      data: { labels: ks, datasets: [{ label: "Income", data: ks.map(function (k) { return m[k].i; }), borderColor: GREEN, backgroundColor: GREEN, tension: .3 }, { label: "Expenses", data: ks.map(function (k) { return m[k].e; }), borderColor: NAVY, backgroundColor: NAVY, tension: .3 }] },
      options: Object.assign({}, base, { interaction: { mode: "index", intersect: false }, scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return N(v); } } } }, plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + N(c.parsed.y); } } } }) })
    });
    $("#c2 .body").insertAdjacentHTML("beforeend", '<div class="sum"><span><i style="background:' + GREEN + '"></i>Total income <b>' + N(inc) + '</b></span><span><i style="background:' + NAVY + '"></i>Total expenses <b>' + N(exp) + '</b></span><a href="admin.html">Open financial records \u2192</a></div>');
  }

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
  function drawGrowth() {
    var src = { properties: D.props, sales: D.tx, leads: D.leads, income: D.fin }[st.growth];
    if (!src) return fail("c3");
    var y = new Date().getFullYear(), cur = series(st.growth, y), prev = series(st.growth, y - 1), mo = new Date().getMonth();
    var distinct = cur.v.slice(0, mo + 1).filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; }).length;
    if (!cur.has || (distinct < 2 && !prev.has)) return empty("c3", "There is not enough historical data yet to show growth for this measure.");
    var money = st.growth === "income", ds = [{ label: String(y), data: cur.v.map(function (v, i) { return i <= mo ? v : null; }), borderColor: NAVY, backgroundColor: "rgba(1,37,71,.12)", fill: true, tension: .3 }];
    if (prev.has) ds.push({ label: String(y - 1), data: prev.v, borderColor: GREEN, borderDash: [5, 4], tension: .3, pointRadius: 2 });
    charts.c3 = new Chart(canvas("c3"), { type: "line", data: { labels: MON, datasets: ds }, options: Object.assign({}, base, { interaction: { mode: "index", intersect: false }, scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return money ? N(v) : v; } } } }, plugins: Object.assign({}, base.plugins, { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + (money ? N(c.parsed.y) : c.parsed.y); } } } }) }) });
  }

  function drawAgents() {
    if (!D.agents || !D.tx || !D.props) return fail("c4");
    var name = {}; D.agents.forEach(function (a) { name[a.id] = (a.full_name || "Agent") + (a.agent_code ? " (" + a.agent_code + ")" : ""); });
    var s = {}, money = st.agent === "revenue";
    function add(id, v) { if (!id) return; s[id] = (s[id] || 0) + v; }
    if (st.agent === "sales") done().forEach(function (t) { if (inR(t.completed_at)) add(t.agent_id, 1); });
    else if (money) done().forEach(function (t) { if (inR(t.completed_at)) add(t.agent_id, Number(t.commission_amount) || 0); });
    else D.props.forEach(function (p) { if (inR(p.created_at) && (st.agent === "submitted" || ["approved", "sold", "rented"].indexOf(p.status) > -1)) add(p.agent_id, 1); });
    var ks = Object.keys(s).filter(function (k) { return s[k] > 0; }).sort(function (a, b) { return s[b] - s[a]; }).slice(0, 10);
    if (!ks.length) return empty("c4", "No agent activity is recorded for this period.");
    charts.c4 = new Chart(canvas("c4"), {
      type: "bar",
      data: { labels: ks.map(function (k) { return name[k] || "Agent"; }), datasets: [{ data: ks.map(function (k) { return s[k]; }), backgroundColor: ks.map(function (k, i) { return i === 0 ? GREEN : NAVY; }), borderRadius: 5 }] },
      options: Object.assign({}, base, { indexAxis: "y", onClick: function () { location.href = "admin.html"; }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return money ? N(c.parsed.x) : c.parsed.x; } } } }, scales: { x: { beginAtZero: true, ticks: { precision: 0, callback: function (v) { return money ? N(v) : v; } } } } })
    });
  }

  function ring(label, actual, tg) {
    if (!tg) return '<div class="ring"><div class="d"><span>\u2013</span></div><b>' + label + "</b><small>Target not set</small></div>";
    var pct = Math.round(actual / tg * 100), left = Math.max(0, tg - actual), over = actual > tg, f = label === "Company income";
    return '<div class="ring"><div class="d" style="--p:' + Math.min(100, pct) + '"><span>' + pct + "%</span></div><b>" + label + "</b><small>" + (over ? "Target exceeded" : (100 - pct) + "% left \u00b7 " + (f ? N(left) : left + " to go")) + "</small></div>";
  }
  function drawHealth() {
    if (!D.fin || !D.props || !D.leads || !D.agents) return fail("c5");
    var k = pkey(), inc = D.inc || 0;
    var list = cnt(D.props, function (p) { return inR(p.created_at); });
    var ag = cnt(D.agents, function (a) { return a.status === "active"; });
    var lr = cnt(D.leads, function (l) { return inR(l.created_at) && l.status !== "new"; });
    setBody("c5", '<div class="health">' + ring("Company income", inc, target("income", k)) + ring("Property listings", list, target("listings", k)) + ring("Active agents", ag, target("agents", k)) + ring("Lead response", lr, target("leads", k)) + "</div>");
  }

  function drawAlerts() {
    var t = iso(new Date()), rows = [
      ["Properties awaiting verification", D.props && cnt(D.props, function (p) { return p.status === "pending_review" || p.status === "under_review"; })],
      ["Commissions due or pending", D.com && cnt(D.com, function (c) { return c.status === "due" || c.status === "pending"; })],
      ["Complaints awaiting response", D.cmp && cnt(D.cmp, function (c) { return c.status === "received"; })],
      ["Overdue customer follow-ups", D.leads && cnt(D.leads, function (l) { return l.next_follow_up && l.next_follow_up < t && (l.status === "new" || l.status === "contacted"); })]
    ], total = 0;
    rows.forEach(function (r) { if (r[1]) total += r[1]; });
    var bn = $("#bn"); bn.textContent = total; bn.hidden = !total;
    setBody("c6", '<ul class="al">' + rows.map(function (r) {
      var n = r[1]; return "<li><span class=\"n " + (n === null || n === false ? "z" : n ? "w" : "z") + '">' + (n === null || n === false ? "\u2013" : n) + '</span><div><a href="admin.html">' + r[0] + "</a><small>" + (n === null || n === false ? "Not available for your access" : n ? "Needs attention" : "All clear") + "</small></div></li>";
    }).join("") + "</ul>");
  }

  function targetForm() {
    var b = $("#tgbox"); b.hidden = !b.hidden; if (b.hidden) return;
    b.innerHTML = '<h2>Set a target</h2><p class="muted">Saved to the database. Only the CEO can change targets. Period: 2026-11 (month), 2026-Q4 (quarter) or 2026 (year).</p><div class="tg"><select id="tm"><option value="sales">Sales (count)</option><option value="income">Income (\u20A6)</option><option value="listings">Property listings</option><option value="agents">Active agents</option><option value="leads">Lead responses</option></select><input id="tp" value="' + pkey() + '" aria-label="Period"><input id="tv" type="number" min="0" placeholder="Target value" aria-label="Value"><button class="btn2" id="ts" type="button">Save target</button></div><p id="tmsg" class="small"></p>';
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
    if (!ROLE) { $("#app").innerHTML = '<div class="card gate"><h2>No access</h2><p>The Management Hub is for the CEO and authorised managers only.</p><a class="btn2" href="index.html" style="text-decoration:none;display:inline-block">Back to home</a></div>'; $("#who").textContent = ""; return; }
    $("#who").textContent = (profile.full_name || user.email) + " \u00b7 " + (ROLE === "admin" ? "CEO / Admin" : "Manager (" + ROLE + ")");
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
      return '<li><span class="n">' + (r.period_type === "week" ? "W" : "M") + "</span><div><b>" + (r.period_type === "week" ? "Weekly" : "Monthly") + " report</b><small>" + r.period_start + " to " + r.period_end + "</small></div><button class=\"btn2\" style=\"margin-left:auto\" type=\"button\" data-s=\"" + i + "\">Download</button></li>";
    }).join("") + "</ul>");
    document.querySelectorAll("#c7 [data-s]").forEach(function (b) {
      b.onclick = function () {
        var r = rows[+b.dataset.s], x = [["CALVORA " + r.period_type.toUpperCase() + "LY REPORT"], ["Period", r.period_start + " to " + r.period_end], [], ["Measure", "Value"]];
        Object.keys(LBL).forEach(function (k) { if (r.data[k] != null) x.push([LBL[k], r.data[k]]); });
        save("calvora-" + r.period_type + "-report-" + r.period_start + ".csv", x);
      };
    });
  }
  $("#dl").onclick = function () { if (!user) return; if (!D.props) { alert("Data is still loading."); return; } save("calvora-report-" + R[0] + "-to-" + R[1] + ".csv", reportRows()); };
  $("#pr").onclick = function () { window.print(); };

  $("#range").onchange = function () { preset = this.value; $("#cust").hidden = preset !== "custom"; if (preset !== "custom" && user) load(); };
  $("#d1").onchange = $("#d2").onchange = function () { if (user && $("#d1").value && $("#d2").value) load(); };
  $("#refresh").onclick = function () { if (user) load(); };
  $("#bell").onclick = function () { $("#c6").scrollIntoView({ behavior: "smooth" }); };
  $("#pbtn").onclick = function () { $("#pmenu").hidden = !$("#pmenu").hidden; };
  $("#out").onclick = async function () { await sb.auth.signOut(); location.href = "admin.html"; };
  $("#menu").onclick = $("#shade").onclick = function () { $("#sb").classList.toggle("open"); $("#shade").classList.toggle("open"); };
  boot();
})();
