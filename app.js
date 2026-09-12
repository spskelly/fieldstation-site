// Public site renderer. No framework, no build. Reads data-page/data-slug/
// data-root from <body>, fetches JSON under data/, builds DOM with
// textContent only (never innerHTML from data).
(function () {
  const body = document.body;
  const root = body.dataset.root || "";
  const app = document.getElementById("app");

  const el = (tag, attrs, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of children) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  };
  const speciesLink = (slug, name) =>
    slug ? el("a", { href: `${root}species/${slug}/` }, name) : el("span", null, name);
  const img = (path, alt) => el("img", { src: root + path, alt, loading: "lazy" });
  // a crop that opens the full-size file when clicked
  const picture = (path, alt) => el("a", { class: "pic", href: root + path, title: "Open the full crop" }, img(path, alt));
  const fetchJson = async (rel) => {
    const r = await fetch(root + rel, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${rel}: ${r.status}`);
    return r.json();
  };
  const clear = () => { app.replaceChildren(); };
  const stat = (n, label, cls) => el("div", { class: cls ? `stat ${cls}` : "stat" }, el("span", { class: "n" }, n), el("span", { class: "what" }, label));
  const longDate = (iso) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  // ?species=<slug> on the day page narrows the grid and feed to one species
  // (the Days list on a species page links there).
  const dayQuery = (iso, slug) => `?date=${iso}${slug ? `&species=${encodeURIComponent(slug)}` : ""}`;
  const dayHref = (iso, slug) => `${root}day/${dayQuery(iso, slug)}`;
  const dayLink = (iso, text, slug) => el("a", { href: dayHref(iso, slug) }, text || longDate(iso));
  const speciesParam = () => new URLSearchParams(location.search).get("species") || null;

  // Badge wording is explained once on the About page; the tooltip repeats it.
  const BADGE_HELP = {
    probable: "Likely this species, but the classifier was not sure enough to say so plainly.",
    possible: "Several candidates; these are the top guesses, best first.",
    unverified: "An unusual species for this area that no second line of evidence has confirmed yet.",
  };
  const badge = (text) => el("span", { class: `badge ${text}`, title: BADGE_HELP[text] || null }, text);

  // Identification labels come from fieldstation/publish/site.py
  // (tier_label and _identification_display). The prose form is the data;
  // this only splits it into a name and a badge for display.
  const UNVERIFIED = "possible identification (unverified detection): ";
  function ident(label) {
    if (label.startsWith(UNVERIFIED)) return { name: label.slice(UNVERIFIED.length), badge: "unverified" };
    if (label.startsWith("possible: ")) return { name: label.slice(10), badge: "possible" };
    if (label.endsWith(" (probable)")) return { name: label.slice(0, -11), badge: "probable" };
    return { name: label, badge: null };
  }
  // A candidate list reads as "A or B, +3 more" with the full list on hover;
  // five names joined by slashes is a ranked model output, not an
  // identification, and an unverified claim is not linked as if it were one.
  function identNode(slug, label) {
    const { name, badge: b } = ident(label);
    const node = el("span", { class: "ident" });
    const names = name.split(" / ");
    if ((b === "possible" || b === "unverified") && names.length > 1) {
      node.append(el("span", { title: names.join(", ") }, names.slice(0, 2).join(" or ")));
      if (names.length > 2) node.append(el("span", { class: "more", title: names.slice(2).join(", ") }, ` +${names.length - 2} more`));
    } else if (b === "unverified") {
      node.append(el("span", null, name));
    } else {
      node.append(speciesLink(slug, name));
    }
    if (b) node.append(" ", badge(b));
    return node;
  }

  // ---- day page --------------------------------------------------------
  const shiftDate = (date, days) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  function dayNav(index, date) {
    const picker = el("input", { type: "date", value: date, min: index.first_date, max: index.latest_date });
    picker.addEventListener("change", () => loadDay(index, picker.value, true));
    const step = (delta, text, label) => {
      const target = shiftDate(date, delta);
      const b = el("button", { type: "button", "aria-label": label, title: label }, text);
      if (target < index.first_date || target > index.latest_date) b.disabled = true;
      else b.addEventListener("click", () => loadDay(index, target, true));
      return b;
    };
    return el("nav", { class: "daynav" }, step(-1, "‹", "Previous day"), picker, step(1, "›", "Next day"));
  }

  function renderDay(index, day) {
    clear();
    // ?species=<slug>: the page becomes "this species on this day". The
    // heading, counts and note lead; the day's narrative and highlights are
    // left out because they describe the whole day.
    const only = speciesParam();
    let grid = day.grid, feed = day.feed;
    if (only) {
      grid = day.grid.filter((r) => r.slug === only);
      feed = day.feed.filter((f) => f.slug === only);
      const name = (grid[0] && grid[0].common) || (feed[0] && feed[0].common)
        || (index.species.find((s) => s.slug === only) || {}).common || only;
      app.append(el("div", { class: "toolbar" },
        el("h1", null, name, el("small", { class: "sub" }, day.heading)), dayNav(index, day.date)));
      const seen = feed.filter((f) => f.kind === "visit").length;
      app.append(el("div", { class: "stats" }, stat(seen, "seen on camera"), stat(feed.length - seen, "heard")));
      app.append(el("p", { class: "filter-note" }, `Only ${name} is shown. `,
        el("a", { href: dayHref(day.date) }, "Show the whole day"), " or ",
        el("a", { href: `${root}species/${only}/` }, "open the species page"), "."));
    } else {
      app.append(el("div", { class: "toolbar" }, el("h1", null, day.heading), dayNav(index, day.date)));
      const c = day.counts;
      app.append(el("div", { class: "stats" },
        stat(c.species, "species"), stat(c.visits, "feeder visits"), stat(c.seen, "seen on camera"), stat(c.heard, "heard")));
    }

    const cond = [];
    if (day.sunrise) cond.push(`sunrise ${day.sunrise}`, `sunset ${day.sunset}`);
    if (day.weather) {
      const w = day.weather;
      if (typeof w.high_c === "number") cond.push(`high ${w.high_c.toFixed(0)} °C`);
      if (typeof w.wind_kph === "number") cond.push(`wind ${w.wind_kph.toFixed(0)} km/h`);
      if (typeof w.precip_mm === "number") cond.push(w.precip_mm ? `${w.precip_mm.toFixed(1)} mm rain` : "dry");
    }
    if (cond.length) app.append(el("p", { class: "meta" }, cond.join(" · ")));

    if (day.editions && day.editions.length && !only) {
      app.append(editionGrid(day.editions.map((e) => editionCard(e, null))));
      const target = location.hash && document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }

    if (day.highlights.length && !only) {
      const list = el("div", { class: "highlights" });
      for (const h of day.highlights) {
        const fig = el("figure", null);
        if (h.image) fig.append(picture(h.image, ident(h.label).name));
        fig.append(el("figcaption", null, identNode(h.slug, h.label), el("span", { class: "time" }, h.time)));
        if (h.caption) fig.append(el("p", null, h.caption));
        list.append(fig);
      }
      app.append(el("section", { class: "card" }, el("h2", null, "Highlights"), list));
    }

    app.append(el("section", { class: "card" }, el("h2", null, only ? "By hour" : "Species by hour"),
      gridTable(grid, { sunrise: day.sunrise, sunset: day.sunset })));
    app.append(el("section", { class: "card" }, el("h2", null, "Detections"), feedList(feed)));

    if (index.recent_days && index.recent_days.length) {
      const list = el("ul", { class: "days" });
      for (const d of index.recent_days)
        list.append(el("li", { class: d.date === day.date ? "current" : null }, dayLink(d.date),
          el("span", { class: "detail" }, `${d.species} species · ${d.visits} visits · ${d.heard} heard`)));
      app.append(el("section", { class: "card" }, el("h2", null, "Recent days"), list));
    }

    if (index.species && index.species.length) {
      const chips = el("ul", { class: "chips" });
      for (const s of index.species) chips.append(el("li", null, speciesLink(s.slug, s.common)));
      app.append(el("section", { class: "card" }, el("h2", null, "Species recorded at this station"), chips));
    }
  }

  // opts.sunrise/sunset ("HH:MM") add a daylight strip above the hours;
  // opts.header names the first column (default "Species").
  function gridTable(rows, opts) {
    opts = opts || {};
    if (!rows.length) return el("p", { class: "empty" }, "Nothing detected.");
    const thead = el("thead", null);
    if (opts.sunrise && opts.sunset) {
      const rise = parseInt(opts.sunrise.slice(0, 2), 10), set = parseInt(opts.sunset.slice(0, 2), 10);
      const strip = el("tr", { class: "strip" }, el("th", { class: "lbl" }, "Daylight"), el("th", null));
      for (let h = 0; h < 24; h++)
        strip.append(el("td", null, el("span", { class: h >= rise && h <= set ? "light day" : "light night" })));
      thead.append(strip);
    }
    const head = el("tr", null, el("th", null, opts.header === undefined ? "Species" : opts.header), el("th", { class: "num" }, "Total"));
    for (let h = 0; h < 24; h++) head.append(el("th", { class: "hour" }, String(h)));
    thead.append(head);
    const table = el("table", { class: "grid" }, thead);
    const tbody = el("tbody", null);
    for (const r of rows) {
      const max = Math.max(...r.hours, 1);
      // the day's best crop of the species leads the label (heard-only rows have none)
      const label = el("td", { class: "species-cell" });
      if (r.image) label.append(picture(r.image, r.common));
      else label.append(el("span", { class: "thumb-empty", "aria-hidden": "true" }, "♪"));
      label.append(speciesLink(r.slug, r.common));
      const tr = el("tr", null, label, el("td", { class: "num" }, r.total));
      r.hours.forEach((n, h) => {
        const level = n === 0 ? 0 : Math.min(5, Math.ceil((n / max) * 5));
        tr.append(el("td", { class: `cell l${level}`, title: `${n} at ${h}:00` }, n || ""));
      });
      tbody.append(tr);
    }
    table.append(tbody);
    return el("div", { class: "scroll" }, table);
  }

  const FEED_ROWS = 40;
  // Newest first. A run of the same species heard back to back collapses to
  // one row with the count and the best confidence, and a toggle narrows the
  // list to what was seen or what was heard.
  function feedList(feed) {
    if (!feed.length) return el("p", { class: "empty" }, "No detections.");
    const groups = [];
    for (const f of [...feed].reverse()) {
      const last = groups[groups.length - 1];
      if (f.kind === "audio" && last && last.kind === "audio" && last.slug === f.slug) {
        last.count += 1;
        last.until = f.time;
        last.best = Math.max(last.best, f.confidence);
      } else {
        groups.push({ ...f, count: 1, until: f.time, best: f.confidence });
      }
    }
    // a busy day runs to hundreds of rows; fold past FEED_ROWS behind a button
    const list = el("ul", { class: groups.length > FEED_ROWS ? "feed folded" : "feed" });
    for (const g of groups) {
      const li = el("li", { class: g.kind });
      if (g.kind === "visit" && g.image) li.append(picture(g.image, ident(g.label).name));
      else li.append(el("span", { class: "thumb", "aria-hidden": "true" }, g.kind === "audio" ? "♪" : ""));
      li.append(el("span", { class: "time" }, g.count > 1 ? `${g.until}–${g.time}` : g.time));
      if (g.kind === "audio") {
        const name = el("span", { class: "ident" }, speciesLink(g.slug, g.common));
        if (g.count > 1) name.append(" ", el("span", { class: "count" }, `×${g.count}`));
        li.append(name, el("span", { class: "detail" },
          g.count > 1 ? `heard · up to ${Math.round(g.best * 100)}%` : `heard · ${Math.round(g.confidence * 100)}%`));
      } else {
        li.append(identNode(g.slug, g.label), el("span", { class: "detail" }, "seen"));
      }
      list.append(li);
    }
    const tools = el("div", { class: "feed-tools", role: "group", "aria-label": "Show" });
    for (const [cls, text] of [["", "All"], ["only-visit", "Seen"], ["only-audio", "Heard"]]) {
      const b = el("button", { type: "button", "aria-pressed": cls ? "false" : "true" }, text);
      b.addEventListener("click", () => {
        list.classList.remove("only-visit", "only-audio");
        if (cls) list.classList.add(cls);
        for (const other of tools.querySelectorAll("button")) other.setAttribute("aria-pressed", other === b ? "true" : "false");
      });
      tools.append(b);
    }
    const seen = feed.filter((f) => f.kind === "visit").length;
    tools.append(el("span", { class: "hint" }, `${seen} seen, ${feed.length - seen} heard`));
    const wrap = el("div", null, tools, list);
    if (groups.length > FEED_ROWS) {
      const more = el("button", { type: "button", class: "show-all" }, `Show all ${groups.length} rows`);
      more.addEventListener("click", () => { list.classList.remove("folded"); more.remove(); });
      wrap.append(more);
    }
    return wrap;
  }

  async function loadDay(index, date, push) {
    let day;
    try { day = await fetchJson(`data/days/${date}.json`); }
    catch (e) {
      clear();
      app.append(el("div", { class: "toolbar" }, el("h1", null, date), dayNav(index, date)),
        el("p", { class: "empty" }, `No data for ${date}.`));
      return;
    }
    if (push) history.replaceState(null, "", dayQuery(date, speciesParam()));
    document.title = `${day.heading}${speciesParam() ? ` (${speciesParam()})` : ""} - ${index.station}`;
    try { renderDay(index, day); }
    catch (e) { clear(); app.append(el("p", { class: "empty" }, `Could not render ${date}.`)); }
  }

  // ---- species page ----------------------------------------------------
  function renderSpecies(sp) {
    clear();
    app.append(el("h1", null, sp.common), el("p", { class: "scientific" }, sp.scientific));
    const hero = el("section", { class: "card hero" });
    if (sp.best_image) hero.append(picture(sp.best_image, sp.common));
    else hero.append(el("div", { class: "nophoto" }, "Heard, not yet photographed"));
    hero.append(el("div", { class: "stats" },
      stat(sp.total_seen, "seen on camera"), stat(sp.total_heard, "heard"),
      stat(sp.days.length, sp.days.length === 1 ? "day recorded" : "days recorded"),
      stat(sp.last_date ? longDate(sp.last_date) : "–", "last record", "date")));
    app.append(hero);
    app.append(el("section", { class: "card" }, el("h2", null, "Time of day"),
      gridTable([{ slug: null, common: "All days", hours: sp.hourly_profile, total: sp.hourly_profile.reduce((a, b) => a + b, 0) }], { header: "" })));
    app.append(el("section", { class: "card" }, el("h2", null, "Every record"), recordList(sp)));
  }

  // Every sighting and hearing, newest first, grouped by day. The day heading
  // and each row open that day filtered to this species; a crop opens the
  // full image. Days after the third start collapsed.
  function recordList(sp) {
    const records = sp.records || [];
    if (!records.length) return el("p", { class: "empty" }, "No records.");
    const byDay = new Map();
    for (const r of records) (byDay.get(r.date) || byDay.set(r.date, []).get(r.date)).push(r);
    const wrap = el("div", { class: "records" });
    let n = 0;
    for (const [date, rows] of byDay) {
      const seen = rows.filter((r) => r.kind === "visit").length;
      const details = el("details", n++ < 3 ? { open: "" } : {});
      details.append(el("summary", null, dayLink(date, null, sp.slug),
        el("span", { class: "detail" }, ` ${seen} seen · ${rows.length - seen} heard`)));
      const list = el("ul", { class: "feed" });
      for (const r of rows) {
        const li = el("li", { class: r.kind });
        if (r.kind === "visit" && r.image) li.append(picture(r.image, sp.common));
        else li.append(el("span", { class: "thumb", "aria-hidden": "true" }, r.kind === "audio" ? "♪" : ""));
        li.append(el("span", { class: "time" }, r.time));
        if (r.kind === "audio") {
          li.append(el("span", { class: "ident" }, "heard"), el("span", { class: "detail" }, `${Math.round(r.confidence * 100)}%`));
        } else {
          const { badge: b } = ident(r.label);
          const node = el("span", { class: "ident" }, "seen");
          if (b) node.append(" ", badge(b));
          li.append(node, el("a", { class: "detail", href: dayHref(date, sp.slug) }, "that day ›"));
        }
        list.append(li);
      }
      details.append(list);
      wrap.append(details);
    }
    return wrap;
  }

  // ---- species index ---------------------------------------------------
  function renderSpeciesIndex(index) {
    clear();
    const species = [...(index.species || [])].sort((a, b) =>
      (b.last_date || "").localeCompare(a.last_date || "")
      || (b.total_seen + b.total_heard) - (a.total_seen + a.total_heard)
      || a.common.localeCompare(b.common));
    document.title = `Species - ${index.station}`;
    app.append(el("h1", null, "Species"),
      el("p", { class: "meta" }, `${species.length} species recorded at this station, most recent first.`));
    if (!species.length) { app.append(el("p", { class: "empty" }, "Nothing recorded yet.")); return; }
    const grid = el("ul", { class: "species-grid" });
    for (const s of species) {
      const card = el("li", { class: "card" });
      const link = el("a", { href: `${root}species/${s.slug}/`, "aria-label": s.common });
      if (s.best_image) link.append(img(s.best_image, s.common));
      else link.append(el("span", { class: "nophoto", "aria-hidden": "true" }, "♪"));
      card.append(link,
        el("p", { class: "name" }, el("a", { href: `${root}species/${s.slug}/` }, s.common)),
        el("p", { class: "scientific" }, s.scientific),
        el("p", { class: "detail" }, `${s.total_seen} seen · ${s.total_heard} heard`),
        el("p", { class: "detail" }, s.last_date ? `last ${longDate(s.last_date)}` : ""));
      grid.append(card);
    }
    app.append(grid);
  }

  // ---- narrative editions and the front-page feed ----------------------
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const BLURB_CHARS = 320;
  const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // the first paragraph, cut at a word boundary when it runs long
  function blurb(text) {
    const first = paragraphs(text)[0] || "";
    if (first.length <= BLURB_CHARS) return first;
    return first.slice(0, BLURB_CHARS).replace(/\s+\S*$/, "") + " …";
  }
  const editionId = (e) => `edition-${e.edition}`;
  // One edition as a card showing its blurb. On the feed (`post` given) the
  // card links to the full edition on the day page; on the day page the rest
  // of the text sits in a native expander, opened when the link lands on it.
  function editionCard(e, post) {
    const head = el("div", { class: "edition-head" });
    if (post) head.append(el("h2", null, dayLink(post.date, post.heading)));
    head.append(el("p", { class: "edition-meta" },
      el("span", { class: "edition-name" }, `${cap(e.edition)} edition`),
      e.byline ? el("span", { class: "byline" }, ` · ${e.byline}`) : "",
      el("span", { class: "time" }, ` · ${e.time}`)));
    const card = el("article", { class: "card narrative", id: post ? null : editionId(e) }, head);
    const paras = paragraphs(e.text);
    if (post) {
      card.append(el("p", null, blurb(e.text)));
      const c = post.counts;
      card.append(el("p", { class: "post-foot" },
        el("a", { href: `${dayHref(post.date)}#${editionId(e)}` }, "Read the full edition"),
        ` · ${c.species} species · ${c.visits} feeder visits · ${c.heard} heard`));
      return card;
    }
    card.append(el("p", null, paras[0] || ""));
    if (paras.length > 1) {
      const rest = el("details", { open: location.hash === `#${editionId(e)}` ? "" : null },
        el("summary", null, "Read the full edition"));
      for (const para of paras.slice(1)) rest.append(el("p", null, para));
      card.append(rest);
    }
    return card;
  }
  const editionGrid = (cards) => el("div", { class: "posts" }, ...cards);

  async function renderFeed(index) {
    clear();
    const weeks = index.weeks || [];
    if (!weeks.length) {
      app.append(el("h1", null, "Field log"), el("p", { class: "empty" }, "No entries yet."));
      if (index.latest_date) app.append(el("p", null, dayLink(index.latest_date, "See the latest day")));
      return;
    }
    const wanted = new URLSearchParams(location.search).get("week");
    const i = Math.max(0, weeks.indexOf(wanted));
    const week = weeks[i];
    const feed = await fetchJson(`data/feed/${week}.json`);
    const weekHref = (w) => `${root}?week=${w}`;
    const pager = el("nav", { class: "pager" });
    pager.append(i > 0 ? el("a", { href: weekHref(weeks[i - 1]) }, "‹ Newer") : el("span", null, ""));
    pager.append(el("span", { class: "week" }, `Week ${week.slice(6)}, ${week.slice(0, 4)}`));
    pager.append(i < weeks.length - 1 ? el("a", { href: weekHref(weeks[i + 1]) }, "Older ›") : el("span", null, ""));
    app.append(el("div", { class: "toolbar" }, el("h1", null, "Field log"), pager));
    app.append(editionGrid(feed.posts.map((post) => editionCard(post, post))));
    app.append(pager.cloneNode(true));
    document.title = `Field log - ${index.station}`;
  }

  // ---- boot --------------------------------------------------------------
  async function main() {
    try {
      if (body.dataset.page === "feed") {
        await renderFeed(await fetchJson("data/index.json"));
      } else if (body.dataset.page === "day") {
        const index = await fetchJson("data/index.json");
        const date = new URLSearchParams(location.search).get("date") || index.latest_date;
        if (!date) { clear(); app.append(el("p", { class: "empty" }, "No data yet.")); return; }
        await loadDay(index, date, false);
      } else if (body.dataset.page === "species") {
        renderSpecies(await fetchJson(`data/species/${body.dataset.slug}.json`));
      } else if (body.dataset.page === "species-index") {
        renderSpeciesIndex(await fetchJson("data/index.json"));
      }
    } catch (e) {
      clear();
      app.append(el("p", { class: "empty" }, "Could not load data."));
    }
  }
  main();
})();
