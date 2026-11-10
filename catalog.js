/* One script for rent.html, buy.html and lands.html. Each page sets <body data-cat="rent|buy|land">. */
(function () {
  "use strict";
  var CV = window.CV, esc = CV.esc;
  var key = document.body.dataset.cat, cat = CV.CATALOGUES[key];
  var isLand = key === "land", PAGE = 12;
  var form = document.getElementById("filters"), grid = document.getElementById("grid"), msg = document.getElementById("msg"),
      count = document.getElementById("count"), more = document.getElementById("more");
  var offset = 0, total = 0, busy = false;

  function opts(list, any) { return '<option value="">' + any + "</option>" + list.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + "</option>"; }).join(""); }
  var priceLabel = key === "rent" ? "per year" : "";
  var bedsHtml = isLand ? "" :
    '<div><label for="beds">Bedrooms (minimum)</label><select id="beds" name="beds"><option value="">Any</option>' + [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '">' + n + "+</option>"; }).join("") + "</select></div>";
  var landHtml = !isLand ? "" :
    '<div><label for="size">Land size (min. sqm)</label><input id="size" name="size" type="number" min="0" step="1" inputmode="numeric" placeholder="e.g. 600"></div>' +
    '<div><label for="title">Title document</label><select id="title" name="title">' + opts(CV.LAND_TITLES, "Any") + "</select></div>";
  form.innerHTML = '<div class="row">' +
    '<div><label for="q">Area, state or code</label><input id="q" name="q" type="search" placeholder="e.g. Ado-Ekiti, Ijigbo" autocomplete="off"></div>' +
    '<div><label for="type">' + (isLand ? "Land use" : "Property type") + '</label><select id="type" name="type">' + opts(isLand ? CV.LAND_USE : CV.HOUSE_TYPES, "Any") + "</select></div>" +
    '<div><label for="min">Min. price (₦' + (priceLabel ? " " + priceLabel : "") + ')</label><input id="min" name="min" type="number" min="0" step="1000" inputmode="numeric" placeholder="0"></div>' +
    '<div><label for="max">Max. price (₦' + (priceLabel ? " " + priceLabel : "") + ')</label><input id="max" name="max" type="number" min="0" step="1000" inputmode="numeric" placeholder="No limit"></div>' +
    bedsHtml + landHtml +
    '<div><label for="sort">Sort by</label><select id="sort" name="sort"><option value="new">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select></div>' +
    '<button class="btn" type="submit">Show properties</button></div>';

  // restore filters from the address (so a search can be shared or refreshed)
  var sp = CV.qs();
  ["q", "type", "min", "max", "beds", "size", "title", "sort"].forEach(function (k) { if (form.elements[k] && sp.get(k)) form.elements[k].value = sp.get(k); });

  function build(off) {
    var f = form.elements, p = [
      "select=*", "listing_type=eq." + cat.listing_type, "category=eq." + cat.category, "status=eq.approved"
    ];
    var q = (f.q.value || "").replace(/[,()*%\\"']/g, " ").trim().slice(0, 60);
    if (q) { var e = encodeURIComponent("*" + q + "*"); p.push("or=(" + ["area", "state", "title", "listing_code"].map(function (c) { return c + ".ilike." + e; }).join(",") + ")"); }
    if (f.type.value) p.push("property_type=eq." + encodeURIComponent(f.type.value));
    if (f.min.value) p.push("price=gte." + Math.max(0, Number(f.min.value)));
    if (f.max.value) p.push("price=lte." + Math.max(0, Number(f.max.value)));
    if (f.beds && f.beds.value) p.push("bedrooms=gte." + Number(f.beds.value));
    if (f.size && f.size.value) p.push("land_size_sqm=gte." + Number(f.size.value));
    if (f.title && f.title.value) p.push("land_title=eq." + encodeURIComponent(f.title.value));
    var s = f.sort.value; p.push("order=" + (s === "low" ? "price.asc" : s === "high" ? "price.desc" : "published_at.desc.nullslast,created_at.desc"));
    p.push("limit=" + PAGE, "offset=" + off);
    return "public_properties?" + p.join("&");
  }
  function syncUrl() {
    var u = new URLSearchParams();
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.value && !(el.name === "sort" && el.value === "new")) u.set(el.name, el.value); });
    history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
  }
  function emptyHtml() {
    var wa = CV.waLink("Hello CALVORA, I am looking for " + cat.label.toLowerCase() + " in Ado-Ekiti.");
    return '<div class="empty"><h3>No properties match yet</h3><p>We only list a property after our team has checked it, so new listings appear steadily rather than all at once. ' +
      "Try fewer filters, or tell us what you need and we will look for you.</p>" +
      (wa ? '<a class="btn green" href="' + wa + '" rel="noopener">' + CV.icon("wa") + " Tell us what you need</a> " : "") +
      '<a class="btn line" href="list-property.html">List a property</a></div>';
  }
  async function load(reset) {
    if (busy) return; busy = true;
    if (reset) { offset = 0; grid.innerHTML = ""; msg.innerHTML = '<div class="loading"><span class="pulse"></span>Loading properties…</div>'; more.classList.add("hidden"); count.textContent = ""; }
    try {
      var r = await CV.get(build(offset), true);
      msg.innerHTML = ""; total = r.total;
      if (reset && !r.rows.length) { msg.innerHTML = emptyHtml(); busy = false; return; }
      grid.insertAdjacentHTML("beforeend", r.rows.map(CV.card).join(""));
      offset += r.rows.length;
      count.textContent = "Showing " + offset + " of " + total + " " + (total === 1 ? "property" : "properties");
      more.classList.toggle("hidden", offset >= total);
    } catch (e) {
      msg.innerHTML = CV.problem("The listings could not load right now. Please check your connection and try again.") +
        '<p><button class="btn line" id="retry" type="button">Try again</button></p>';
      var rb = document.getElementById("retry"); if (rb) rb.onclick = function () { load(true); };
    }
    busy = false;
  }
  form.addEventListener("submit", function (ev) { ev.preventDefault(); syncUrl(); load(true); });
  more.querySelector("button").addEventListener("click", function () { load(false); });
  load(true);
})();
