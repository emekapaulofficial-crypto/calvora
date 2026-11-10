/* CALVORA portal toolkit, shared by agent.html and admin.html.
   Needs: config.js, core.js, supabase-js (pinned in the page) and, for ID cards, qrcode-generator. */
(function () {
  "use strict";
  var S = window.SITE, CV = window.CV, esc = CV.esc;
  var PT = (window.PT = {});
  PT.sb = window.supabase.createClient(S.supabase.url, S.supabase.key);
  var sb = PT.sb;

  PT.$ = function (s, r) { return (r || document).querySelector(s); };
  PT.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  PT.STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"];
  PT.FEATURES = {
    house: ["Prepaid meter", "Water supply", "Borehole", "Fenced compound", "Gated estate", "Security", "Parking space", "Tiled floors", "Fitted kitchen", "POP ceiling", "Wardrobes", "Generator house", "Good road access", "Close to market", "Close to school"],
    land: ["Fenced", "Good road access", "Dry land", "Gated estate", "Electricity nearby", "Water nearby", "Corner piece", "Survey plan available", "Close to main road"]
  };
  PT.opts = function (list, sel, any) {
    return (any ? '<option value="">' + any + "</option>" : "") + list.map(function (x) { return '<option' + (x === sel ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("");
  };
  PT.dt = function (d) { return d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""; };
  /* Save a row that is unique on one or two key columns. PostgREST upsert also rewrites the key columns, which the
     column-level grants do not allow, so look the row up, then update (without keys) or insert. */
  PT.saveRow = async function (sb, table, keys, row) {
    var q = sb.from(table).select("id"); Object.keys(keys).forEach(function (k) { q = q.eq(k, keys[k]); });
    var f = await q.maybeSingle(); if (f.error) return f;
    if (f.data) return sb.from(table).update(row).eq("id", f.data.id);
    return sb.from(table).insert(Object.assign({}, keys, row));
  };
  PT.msg = function (e) { return (e && (e.message || e.error_description)) || "Something went wrong. Please try again."; };
  PT.safeName = function (n) { return String(n || "file").toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "file"; };
  /** Monday (local) of the week containing d, as YYYY-MM-DD */
  PT.monday = function (d) {
    d = d ? new Date(d) : new Date(); var day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  PT.wa = function (phone, text) {
    var n = String(phone || "").replace(/[^0-9]/g, ""); if (!n) return "";
    if (n.charAt(0) === "0") n = "234" + n.slice(1);
    return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
  };
  PT.contactLinks = function (phone, text) {
    var ph = String(phone || ""), t = ph.replace(/[^0-9+]/g, "");
    return '<a href="tel:' + esc(t) + '">' + esc(ph) + "</a> · " + '<a href="' + esc(PT.wa(ph, text)) + '" rel="noopener">WhatsApp</a>';
  };

  /* ---------- sign in / create account / forgot / reset ---------- */
  PT.authCard = function (root, opt) {
    opt = opt || {};
    var mode = "in";
    function draw() {
      root.innerHTML = '<div class="panel" id="authpanel"><h2 style="font-size:1.35rem;margin-bottom:.4em">' + esc(opt.title || "Sign in") + "</h2>" +
        (opt.signUp === false ? "" : '<div class="seg" role="tablist"><button type="button" role="tab" data-m="in" class="' + (mode === "in" ? "on" : "") + '" aria-selected="' + (mode === "in") + '">Sign in</button><button type="button" role="tab" data-m="up" class="' + (mode === "up" ? "on" : "") + '" aria-selected="' + (mode === "up") + '">Create account</button></div>') +
        '<form id="authform" novalidate>' +
        (mode === "up" ? '<label for="a_name">Full name</label><input id="a_name" name="name" autocomplete="name" required maxlength="100">' : "") +
        '<label for="a_email">Email</label><input id="a_email" name="email" type="email" autocomplete="email" required>' +
        (mode === "forgot" ? "" : '<label for="a_pw">Password' + (mode === "up" ? ' <span class="fine">(at least 8 characters)</span>' : "") + '</label><input id="a_pw" name="pw" type="password" autocomplete="' + (mode === "up" ? "new-password" : "current-password") + '" required minlength="8">') +
        '<div id="authbox" aria-live="polite"></div>' +
        '<button class="btn" type="submit" style="width:100%;margin-top:14px">' + (mode === "up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in") + "</button></form>" +
        (mode === "in" ? '<p style="margin:12px 0 0"><button type="button" class="linkbtn" data-m="forgot">Forgot your password?</button></p>' : "") +
        (mode === "forgot" ? '<p style="margin:12px 0 0"><button type="button" class="linkbtn" data-m="in">Back to sign in</button></p>' : "") + "</div>";
      PT.$$("[data-m]", root).forEach(function (b) { b.onclick = function () { mode = b.dataset.m; draw(); }; });
      PT.$("#authform", root).onsubmit = submit;
    }
    async function submit(ev) {
      ev.preventDefault();
      var f = ev.target, box = PT.$("#authbox", root), btn = f.querySelector("button[type=submit]"), email = f.email.value.trim();
      box.innerHTML = "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { box.innerHTML = CV.problem("Please enter a valid email address."); return; }
      if (mode !== "forgot" && (!f.pw.value || f.pw.value.length < 8)) { box.innerHTML = CV.problem("Your password needs at least 8 characters."); return; }
      if (mode === "up" && f.name.value.trim().length < 2) { box.innerHTML = CV.problem("Please enter your full name."); return; }
      btn.disabled = true;
      try {
        var r;
        if (mode === "in") {
          r = await sb.auth.signInWithPassword({ email: email, password: f.pw.value }); if (r.error) throw r.error;
          opt.onSignedIn && opt.onSignedIn();
        } else if (mode === "up") {
          r = await sb.auth.signUp({ email: email, password: f.pw.value, options: { data: { full_name: f.name.value.trim() }, emailRedirectTo: location.origin + location.pathname } }); if (r.error) throw r.error;
          if (r.data.session) opt.onSignedIn && opt.onSignedIn();
          else box.innerHTML = CV.success("<b>Account created.</b> Check your email for a confirmation link, then come back and sign in.");
        } else {
          r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (r.error) throw r.error;
          box.innerHTML = CV.success("<b>Check your email.</b> If an account exists for that address, a reset link is on its way.");
        }
      } catch (e) { box.innerHTML = CV.problem(PT.msg(e)); }
      btn.disabled = false;
    }
    draw();
  };

  /** set-new-password form (after the reset email link) */
  PT.resetCard = function (root, done) {
    root.innerHTML = '<div class="panel"><h2 style="font-size:1.35rem">Choose a new password</h2><form id="rsf" novalidate><label for="r_pw">New password <span class="fine">(at least 8 characters)</span></label><input id="r_pw" name="pw" type="password" autocomplete="new-password" minlength="8" required><div id="rsbox" aria-live="polite"></div><button class="btn" type="submit" style="margin-top:14px;width:100%">Save password</button></form></div>';
    PT.$("#rsf", root).onsubmit = async function (e) {
      e.preventDefault(); var box = PT.$("#rsbox", root), pw = e.target.pw.value;
      if (pw.length < 8) { box.innerHTML = CV.problem("Your password needs at least 8 characters."); return; }
      var r = await sb.auth.updateUser({ password: pw });
      if (r.error) { box.innerHTML = CV.problem(PT.msg(r.error)); return; }
      history.replaceState(null, "", location.pathname); done();
    };
  };
  PT.isRecovery = function () { return /type=recovery/.test(location.hash); };

  /* ---------- pictures: shrink before upload ---------- */
  PT.compress = async function (file, max, q) {
    max = max || 1600; q = q || 0.82;
    if (!/^image\//.test(file.type)) return file;
    try {
      var bmp = await createImageBitmap(file), sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
      var blob = await new Promise(function (r) { c.toBlob(r, "image/jpeg", q); });
      if (blob) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { /* use the original */ }
    return file;
  };
  PT.uploadPublic = async function (uid, file, prefix) {
    var path = uid + "/" + (prefix || "p") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + ".jpg";
    var up = await sb.storage.from("property-photos").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (up.error) throw up.error;
    return sb.storage.from("property-photos").getPublicUrl(path).data.publicUrl;
  };
  PT.signed = async function (bucket, path) {
    var r = await sb.storage.from(bucket).createSignedUrl(path, 300);
    if (r.error) throw r.error; return r.data.signedUrl;
  };

  /* ---------- tabs ---------- */
  PT.shell = function (root, tabs, active, who, onTab, onOut) {
    root.innerHTML = '<div class="whoami"><span>Signed in as <b>' + esc(who) + '</b></span><button class="btn line sm" id="signout" type="button">Sign out</button></div>' +
      '<div class="portal"><nav class="side" aria-label="Sections">' + tabs.map(function (t) { return '<button type="button" data-t="' + t[0] + '"' + (t[0] === active ? ' class="on" aria-current="page"' : "") + ">" + esc(t[1]) + (t[2] ? ' <span class="cnt">' + t[2] + "</span>" : "") + "</button>"; }).join("") + '</nav><section id="pane" aria-live="polite" tabindex="-1"></section></div>';
    PT.$$(".side button", root).forEach(function (b) { b.onclick = function () { onTab(b.dataset.t); }; });
    PT.$("#signout", root).onclick = onOut;
  };
  PT.mark = function (t) {
    PT.$$(".side button").forEach(function (b) { var on = b.dataset.t === t; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  };

  /* ---------- ID card with QR ---------- */
  PT.idCard = function (p, opt) {
    opt = opt || {};
    var code = p.agent_code || p.staff_code, isAgent = !!p.agent_code && p.role === "agent";
    var cat = isAgent ? "Registered Agent" : p.role === "admin" ? "Management" : p.staff_role === "operations" ? "Staff · Operations" : p.staff_role === "marketing" ? "Staff · Marketing" : "Staff";
    var av = p.photo_url ? '<img class="av" src="' + esc(p.photo_url) + '" alt="Photo of ' + esc(p.full_name) + '" crossorigin="anonymous">' : '<span class="av av-i" aria-hidden="true">' + esc(CV.initials(p.full_name)) + "</span>";
    var url = location.origin + location.pathname.replace(/[^/]*$/, "") + "verify.html?id=" + encodeURIComponent(code);
    return '<div class="idcard" id="idcard"><div class="top"><img src="img/logo.png" alt="Calvora Property Solutions"></div>' +
      '<div class="mid">' + av + '<div><b style="font-size:1.15rem;color:var(--navy)">' + esc(p.full_name) + '</b><div class="muted small">' + esc(cat) + '</div><div style="font-weight:800;color:var(--navy);margin-top:4px">' + esc(code) + "</div>" +
      (isAgent && opt.badge ? '<div style="margin-top:6px">' + CV.badgeChip(opt.badge, 20) + "</div>" : "") + "</div></div>" +
      '<div class="bt"><div class="small"><div class="muted">Valid until</div><b>' + (p.id_expires_at ? CV.date(p.id_expires_at) : "Not set") + '</b><div class="muted" style="margin-top:6px">Scan to verify or visit<br><b>' + esc(S.domain || "") + "/verify</b></div></div>" +
      '<div class="qr" id="qrbox" data-url="' + esc(url) + '" aria-label="QR code that opens the verification page"></div></div></div>';
  };
  PT.drawQr = function () {
    var box = PT.$("#qrbox"); if (!box) return; var url = box.dataset.url;
    function go() {
      try {
        var q = window.qrcode(0, "M"); q.addData(url); q.make();
        box.innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }).replace(/fill="black"/g, 'fill="#012547"').replace(/<svg /, '<svg width="96" height="96" role="img" aria-label="QR code" ');
      } catch (e) { box.innerHTML = '<span class="small" style="max-width:96px;display:block;word-break:break-all">' + esc(url) + "</span>"; }
    }
    if (window.qrcode) return go();
    var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"; s.onload = go;
    s.onerror = function () { box.innerHTML = '<span class="small" style="max-width:96px;display:block;word-break:break-all">' + esc(url) + "</span>"; };
    document.head.appendChild(s);
  };
  PT.idBlock = function (p, opt) {
    return '<h2>My ID card</h2><p class="muted">Show this card to customers. Anyone can scan the QR code to check that it is genuine and still valid.</p>' + PT.idCard(p, opt) +
      '<p style="margin-top:16px"><button class="btn" id="printid" type="button">Print my ID card</button></p><p class="fine">Print on card stock at 100% scale. If your card shows as expired, ask the Calvora team to renew it.</p>';
  };
  PT.bindId = function () { PT.drawQr(); var b = PT.$("#printid"); if (b) b.onclick = function () { window.print(); }; };
})();
