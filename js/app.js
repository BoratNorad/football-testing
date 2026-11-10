// Gridiron Dex - Pokédex-style browser for Madden ratings with pixel-art nflverse headshots.
(function () {
  const D = window.DEX_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const byId = new Map(D.players.map((p) => [p.id, p]));
  const teamList = Object.values(D.teams).sort((a, b) => a.name.localeCompare(b.name));

  const LONG = {
    speed: "Speed", acceleration: "Acceleration", agility: "Agility", changeOfDirection: "Change of Dir.",
    strength: "Strength", jumping: "Jumping", stamina: "Stamina", toughness: "Toughness", injury: "Injury",
    awareness: "Awareness", throwPower: "Throw Power", throwAccuracyShort: "Short Accuracy",
    throwAccuracyMid: "Medium Accuracy", throwAccuracyDeep: "Deep Accuracy", throwOnTheRun: "Throw on Run",
    throwUnderPressure: "Under Pressure", playAction: "Play Action", breakSack: "Break Sack",
    carrying: "Carrying", bCVision: "BC Vision", breakTackle: "Break Tackle", trucking: "Trucking",
    stiffArm: "Stiff Arm", jukeMove: "Juke Move", spinMove: "Spin Move", catching: "Catching",
    catchInTraffic: "Catch in Traffic", spectacularCatch: "Spectacular Catch",
    shortRouteRunning: "Short Routes", mediumRouteRunning: "Medium Routes", deepRouteRunning: "Deep Routes",
    release: "Release", kickReturn: "Kick Return", passBlock: "Pass Block", passBlockPower: "Pass Blk Power",
    passBlockFinesse: "Pass Blk Finesse", runBlock: "Run Block", runBlockPower: "Run Blk Power",
    runBlockFinesse: "Run Blk Finesse", leadBlock: "Lead Block", impactBlocking: "Impact Block",
    tackle: "Tackle", hitPower: "Hit Power", pursuit: "Pursuit", playRecognition: "Play Recognition",
    blockShedding: "Block Shedding", powerMoves: "Power Moves", finesseMoves: "Finesse Moves",
    manCoverage: "Man Coverage", zoneCoverage: "Zone Coverage", press: "Press",
    kickPower: "Kick Power", kickAccuracy: "Kick Accuracy",
  };

  // Pokémon-style "types" per position family
  const TYPES = {
    QB: ["PASSER", "#e8742a"], RB: ["RUSHER", "#5ba446"], WR: ["RECEIVER", "#4f7ee8"],
    TE: ["HYBRID", "#98a41c"], OL: ["WALL", "#a88f3a"], DL: ["RUSH", "#c0352b"],
    LB: ["HUNTER", "#7a56a8"], DB: ["COVER", "#e0507e"], ST: ["BOOT", "#8f8f7a"],
  };
  const SIDE = { O: ["OFFENSE", "#2f5fb8"], D: ["DEFENSE", "#2d2d38"], S: ["SPECIAL", "#6c7a3a"] };

  // which stat groups matter most per position family (shown first, others collapsible)
  const FOCUS = {
    QB: ["Passing", "Physical", "Rushing"], RB: ["Rushing", "Physical", "Receiving"],
    WR: ["Receiving", "Physical", "Rushing"], TE: ["Receiving", "Blocking", "Physical"],
    OL: ["Blocking", "Physical"], DL: ["Defense", "Physical"], LB: ["Defense", "Physical"],
    DB: ["Defense", "Physical", "Receiving"], ST: ["Kicking", "Physical"],
  };
  const POS_ORDER = ["QB", "HB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "LEDG", "DT", "REDG",
    "SAM", "MIKE", "WILL", "CB", "FS", "SS", "K", "P", "LS"];

  const state = {
    team: "BUF", view: "dex", q: "", pos: "", sort: "ovr", startersOnly: false,
    sel: null, showAll: false,
  };
  try { Object.assign(state, JSON.parse(localStorage.getItem("gridiron-dex") || "{}")); } catch (e) { /* ignore */ }
  const save = () => {
    try {
      const { team, view, pos, sort, startersOnly, sel } = state;
      localStorage.setItem("gridiron-dex", JSON.stringify({ team, view, pos, sort, startersOnly, sel, gb: Portrait.getMode() === "gb" }));
    } catch (e) { /* ignore */ }
  };
  try { if (JSON.parse(localStorage.getItem("gridiron-dex") || "{}").gb) Portrait.setMode("gb"); } catch (e) { /* ignore */ }

  const val = (p, k) => { const v = p.stats[k]; return Array.isArray(v) ? v[0] : v; };
  const diff = (p, k) => { const v = p.stats[k]; return Array.isArray(v) ? v[1] : 0; };
  const pad = (n) => String(n).padStart(4, "0");
  const teamOf = (p) => D.teams[p.team] || { c1: "#555", c2: "#aaa", c3: "#999", name: p.team, abbr: p.team };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function tierColor(v) {
    if (v >= 90) return "#5a3fd1";
    if (v >= 80) return "#2f9e44";
    if (v >= 70) return "#b5b816";
    if (v >= 60) return "#e8892a";
    return "#d13b3b";
  }

  // ---------------------------------------------------------------- team bar
  function renderTeams() {
    const nav = $("#teams");
    nav.innerHTML = "";
    const all = document.createElement("button");
    all.className = "team-chip all" + (state.team === "ALL" ? " active" : "");
    all.textContent = "ALL";
    all.onclick = () => selectTeam("ALL");
    nav.append(all);
    for (const t of teamList) {
      const b = document.createElement("button");
      b.className = "team-chip" + (state.team === t.abbr ? " active" : "");
      b.title = t.name;
      b.append(Sprites.helmetCanvas(t, 3), document.createTextNode(t.abbr));
      b.onclick = () => selectTeam(t.abbr);
      nav.append(b);
    }
    const act = nav.querySelector(".active");
    if (act) act.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function selectTeam(abbr) {
    state.team = abbr;
    if (abbr === "ALL" && state.view === "field") state.view = "dex";
    state.sel = null;
    renderTeams();
    render();
  }

  // ---------------------------------------------------------------- list
  function filtered() {
    let ps = D.players;
    if (state.team !== "ALL") ps = ps.filter((p) => p.team === state.team);
    if (state.pos) ps = ps.filter((p) => p.pos === state.pos || p.group === state.pos);
    if (state.startersOnly) ps = ps.filter((p) => p.starter);
    if (state.q) {
      const q = state.q.toLowerCase();
      ps = ps.filter((p) => (p.first + " " + p.last).toLowerCase().includes(q));
    }
    const cmp = {
      ovr: (a, b) => b.ovr - a.ovr || a.dex - b.dex,
      dex: (a, b) => a.dex - b.dex,
      num: (a, b) => (a.num ?? 999) - (b.num ?? 999),
      name: (a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first),
      depth: (a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || a.depth - b.depth,
    }[state.sort];
    return ps.slice().sort(cmp);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const c = e.target;
      io.unobserve(c);
      const p = byId.get(+c.dataset.id);
      Portrait.paint(c, p, teamOf(p));
    }
  }, { root: null, rootMargin: "200px" });

  function rowEl(p) {
    const li = document.createElement("li");
    li.className = "dex-row" + (state.sel === p.id ? " sel" : "");
    li.dataset.id = p.id;
    const c = document.createElement("canvas");
    c.width = c.height = Portrait.SIZE;
    c.dataset.id = p.id;
    c.style.background = teamOf(p).c1;
    io.observe(c);
    li.innerHTML = `<span class="no">No.${pad(p.dex)}</span>`;
    li.prepend(c);
    const nm = document.createElement("span");
    nm.className = "nm";
    nm.innerHTML = `${p.starter ? '<span class="star" title="Starter">★</span>' : ""}${esc(p.first[0])}. ${esc(p.last)}<small>${esc(p.pos)}${state.team === "ALL" ? " · " + p.team : ""}</small>`;
    const ov = document.createElement("span");
    ov.className = "ov";
    ov.textContent = p.ovr;
    ov.style.color = state.sel === p.id ? "#fff" : tierColor(p.ovr);
    li.append(nm, ov);
    li.onclick = () => select(p.id);
    return li;
  }

  function renderList() {
    const ps = filtered();
    const ol = $("#list");
    ol.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const p of ps) frag.append(rowEl(p));
    ol.append(frag);
    $("#count").textContent = `${ps.length} PLAYER${ps.length === 1 ? "" : "S"} SEEN`;
    if (!ps.some((p) => p.id === state.sel)) state.sel = ps.length ? ps[0].id : null;
    markSel();
    renderDetail();
  }

  function markSel(scroll) {
    for (const li of document.querySelectorAll("#list .dex-row")) {
      const on = +li.dataset.id === state.sel;
      li.classList.toggle("sel", on);
      const ov = li.querySelector(".ov");
      ov.style.color = on ? "#fff" : tierColor(byId.get(+li.dataset.id).ovr);
      if (on && scroll) li.scrollIntoView({ block: "nearest" });
    }
  }

  function select(id, scroll) {
    state.sel = id;
    state.showAll = false;
    markSel(scroll);
    renderDetail();
    save();
  }

  // ---------------------------------------------------------------- detail
  function flavor(p) {
    const groups = FOCUS[p.group] || ["Physical"];
    const keys = D.statGroups.filter(([g]) => groups.includes(g)).flatMap(([, s]) => s.map(([k]) => k))
      .filter((k) => !["stamina", "injury", "toughness"].includes(k));
    const top = keys.map((k) => [k, val(p, k)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const t = teamOf(p);
    const arch = p.arch ? `${p.arch.toUpperCase()} ` : "";
    const where = p.starter ? `the ${t.nick || t.name} starting ${p.starter}` : `${p.pos}${p.depth} on the ${t.nick || t.name} depth chart`;
    const xf = p.abil.map((a) => D.abilities[a]).find((a) => a && a.type === "XF");
    return `The ${arch}${p.posName.toUpperCase()}. ${p.first} ${p.last} is ${where}. ` +
      `Known for ${top.map(([k, v]) => `${LONG[k]} (${v})`).join(", ").replace(/, ([^,]*)$/, " and $1")}.` +
      (xf ? ` Enters the zone with ${xf.name.toUpperCase()}.` : "");
  }

  function statBar(v) {
    const segs = 20, on = Math.round(v / 100 * segs), col = tierColor(v);
    let h = "";
    for (let i = 0; i < segs; i++) h += `<span style="background:${i < on ? col : "transparent"}"></span>`;
    return `<div class="bar">${h}</div>`;
  }

  function groupHtml(p, name, stats) {
    const rows = stats.map(([k]) => {
      const v = val(p, k);
      if (v == null) return "";
      const d = diff(p, k);
      const di = d ? `<i class="${d > 0 ? "up" : "dn"}">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</i>` : "";
      return `<div class="stat"><span class="lbl">${LONG[k] || k}</span>${statBar(v)}<span class="val">${v}${di}</span></div>`;
    }).join("");
    return `<div class="group"><h4>${name.toUpperCase()}</h4>${rows}</div>`;
  }

  function renderDetail() {
    const el = $("#detail");
    const p = byId.get(state.sel);
    if (!p) { el.innerHTML = `<div class="empty">NO PLAYER FOUND.<br>TRY ANOTHER SEARCH.</div>`; return; }
    const t = teamOf(p);
    el.style.setProperty("--team1", t.c1);
    el.style.setProperty("--team2", t.c2);
    const [typeName, typeCol] = TYPES[p.group] || TYPES.ST;
    const [sideName, sideCol] = SIDE[p.side];
    const focus = FOCUS[p.group] || [];
    const focusGroups = D.statGroups.filter(([g]) => focus.includes(g)).sort((a, b) => focus.indexOf(a[0]) - focus.indexOf(b[0]));
    const otherGroups = D.statGroups.filter(([g]) => !focus.includes(g));
    const moves = p.abil.map((a) => D.abilities[a]).filter(Boolean);
    const od = p.ovrDiff ? `<i style="font-style:normal;font-size:8px;color:${p.ovrDiff > 0 ? "#1f8a3a" : "#c0262d"}">${p.ovrDiff > 0 ? "▲" : "▼"}${Math.abs(p.ovrDiff)}</i>` : "";

    el.innerHTML = `
      <div class="d-top">
        <div class="portrait"><canvas width="${Portrait.SIZE}" height="${Portrait.SIZE}"></canvas><span class="jersey">#${p.num ?? "--"}</span></div>
        <div class="d-head">
          <div class="ovr-orb"><b style="color:${tierColor(p.ovr)}">${p.ovr}</b><span>OVR ${od}</span></div>
          <div class="no">No.${pad(p.dex)} · ${esc(t.name.toUpperCase())}</div>
          <h2><span class="first">${esc(p.first.toUpperCase())}</span>${esc(p.last.toUpperCase())}</h2>
          <div class="badges">
            <span class="badge" style="background:${typeCol}">${typeName}</span>
            <span class="badge" style="background:${sideCol}">${sideName}</span>
            <span class="badge" style="background:${t.c1}">${p.pos}${p.depth}</span>
            ${p.starter ? `<span class="badge" style="background:#d18b00">★ STARTER ${p.starter}</span>` : ""}
          </div>
          <dl class="info">
            <div><dt>POS</dt><dd>${esc(p.posName)}</dd></div>
            <div><dt>ARCH</dt><dd>${esc(p.arch || "-")}</dd></div>
            <div><dt>HT</dt><dd>${esc(p.ht)}</dd></div>
            <div><dt>WT</dt><dd>${p.wt} lbs</dd></div>
            <div><dt>AGE</dt><dd>${p.age}</dd></div>
            <div><dt>EXP</dt><dd>${p.yrs ? p.yrs + " yrs" : "Rookie"}</dd></div>
            <div><dt>COLLEGE</dt><dd title="${esc(p.college)}">${esc(p.college || "-")}</dd></div>
            <div><dt>DRAFT</dt><dd title="${esc(p.draft)}">${esc(p.draft || "-")}</dd></div>
            <div><dt>HAND</dt><dd>${p.hand === "L" ? "Left" : "Right"}</dd></div>
            <div><dt>BORN</dt><dd>${esc(p.bday)}</dd></div>
          </dl>
        </div>
      </div>
      <div class="flavor">${esc(flavor(p))}</div>

      <div class="section-title">ABILITIES</div>
      ${moves.length ? `<div class="moves">${moves.map((m) => `
        <div class="move"><header><b>${esc(m.name.toUpperCase())}</b><span class="t ${m.type}">${m.type === "XF" ? "X-FACTOR" : "SUPERSTAR"}</span></header><p>${esc(m.desc)}</p></div>`).join("")}</div>`
        : `<div class="none">No superstar abilities.</div>`}

      <div class="section-title">RATINGS</div>
      <div class="groups">${focusGroups.map(([g, s]) => groupHtml(p, g, s)).join("")}</div>
      <div class="groups ${state.showAll ? "" : "hidden"}" id="otherGroups" style="margin-top:10px">${otherGroups.map(([g, s]) => groupHtml(p, g, s)).join("")}</div>
      <button class="more" id="moreBtn">${state.showAll ? "▲ HIDE OTHER RATINGS" : "▼ ALL RATINGS"}</button>
      ${p.runStyle ? `<div class="none" style="margin-top:8px">Running style: ${esc(p.runStyle)}</div>` : ""}
      <div class="none" style="margin-top:4px;font-size:16px">nflverse: ${esc(p.gsis || "not matched")}${p.espn ? " · ESPN " + p.espn : ""}</div>
    `;
    Portrait.paint($(".portrait canvas", el), p, t);
    $("#moreBtn", el).onclick = () => {
      state.showAll = !state.showAll;
      $("#otherGroups", el).classList.toggle("hidden", !state.showAll);
      $("#moreBtn", el).textContent = state.showAll ? "▲ HIDE OTHER RATINGS" : "▼ ALL RATINGS";
    };
    el.scrollTop = 0;
  }

  // ---------------------------------------------------------------- field (starting 22)
  // logical field is 288x216; LOS at y=108. x,y = sprite top-left center anchor
  const FW = 288, FH = 192, LOS = 96, S = 3;
  const SPOTS = {
    // offense (back view, below LOS)
    LT: [100, 102], LG: [122, 102], C: [144, 102], RG: [166, 102], RT: [188, 102], TE: [212, 104],
    WR1: [22, 102], WR3: [62, 108], WR2: [266, 102], QB: [144, 138], HB: [168, 140],
    // defense (front view, above LOS)
    REDG: [98, 70], DT2: [130, 70], DT1: [158, 70], LEDG: [190, 70],
    WILL: [100, 42], MIKE: [144, 38], SAM: [200, 42],
    CB1: [22, 56], CB2: [266, 56], FS: [114, 4], SS: [180, 6],
  };
  const hit = [];

  function drawField() {
    const cv = $("#field");
    const t = D.teams[state.team];
    cv.width = FW * S; cv.height = FH * S;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    // turf stripes
    for (let i = 0; i < FH / 12; i++) {
      ctx.fillStyle = i % 2 ? "#3b8f3e" : "#348238";
      ctx.fillRect(0, i * 12 * S, FW * S, 12 * S);
    }
    ctx.fillStyle = "#ffffff55";
    for (let y = 8; y < FH; y += 24) ctx.fillRect(0, y * S, FW * S, S);           // yard lines
    for (let y = 8; y < FH; y += 4.8) { ctx.fillRect(96 * S, y * S, 4 * S, S); ctx.fillRect(188 * S, y * S, 4 * S, S); } // hashes
    ctx.fillStyle = "#4fa8ff"; ctx.fillRect(0, (LOS + 4) * S, FW * S, S);      // line of scrimmage
    ctx.fillStyle = "#ffd23e"; ctx.fillRect(0, (LOS - 36) * S, FW * S, S);     // first-down line
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S, FH * S); ctx.fillRect((FW - 1) * S, 0, S, FH * S);

    hit.length = 0;
    const plates = [];
    ctx.font = `${2 * S}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    for (const [slot, [cx, y]] of Object.entries(SPOTS)) {
      const id = t.lineup[slot];
      const p = byId.get(id);
      if (!p) continue;
      const x = cx - 8;
      const offense = y > LOS;
      // shadow
      ctx.fillStyle = "#0004";
      ctx.fillRect((x + 2) * S, (y + 20) * S, 12 * S, 3 * S);
      Sprites.drawPlayer(ctx, t, p.num, x * S, y * S, S, offense ? "back" : "front");
      // label plate
      const label = `${p.last.toUpperCase().replace(/[^A-Z' -]/g, "").slice(0, 8).trim()} ${p.ovr}`;
      const w = ctx.measureText(label).width + 4 * S;
      const lx = Math.min(Math.max(cx * S, w / 2 + S), FW * S - w / 2 - S);
      let ly = (y + 23) * S;
      // push the plate down until it no longer overlaps one already drawn (tight OL/DL splits)
      while (plates.some((r) => lx - w / 2 < r.x + r.w && lx + w / 2 > r.x && ly < r.y + r.h && ly + 4 * S > r.y)) ly += 5 * S;
      plates.push({ x: lx - w / 2, y: ly, w, h: 4 * S });
      ctx.fillStyle = "#14141ccc";
      ctx.fillRect(lx - w / 2, ly, w, 4 * S);
      ctx.fillStyle = tierColor(p.ovr) === "#5a3fd1" ? "#c9b8ff" : "#fff";
      ctx.fillText(label, lx, ly + 3.2 * S);
      hit.push({ id: p.id, x: x, y: y, w: 16, h: 28 });
    }
    cv.onclick = (e) => {
      const r = cv.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width * FW, my = (e.clientY - r.top) / r.height * FH;
      const h = hit.find((h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h);
      if (h) openInDex(h.id);
    };
    cv.onmousemove = (e) => {
      const r = cv.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width * FW, my = (e.clientY - r.top) / r.height * FH;
      cv.style.cursor = hit.some((h) => mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) ? "pointer" : "default";
    };
  }

  function renderField() {
    const t = D.teams[state.team];
    const ids = Object.entries(t.lineup);
    const avg = (slots) => {
      const v = ids.filter(([s]) => slots.includes(s)).map(([, id]) => byId.get(id).ovr);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : "-";
    };
    const O = ["QB", "HB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"];
    const Df = ["LEDG", "DT1", "DT2", "REDG", "SAM", "MIKE", "WILL", "CB1", "CB2", "FS", "SS"];
    $("#fieldHead").innerHTML = `
      <canvas width="36" height="27" id="fh"></canvas>
      <h2>${esc(t.name.toUpperCase())}</h2>
      <div class="units">
        <span class="unit">OFF<b>${avg(O)}</b></span>
        <span class="unit">DEF<b>${avg(Df)}</b></span>
        <span class="unit">STARTERS<b>${t.ovr}</b></span>
        <span class="unit">${esc(t.div || "")}</span>
      </div>`;
    Sprites.drawHelmet($("#fh").getContext("2d"), t, 0, 0, 3);
    drawField();
    const sp = $("#special");
    sp.innerHTML = "";
    for (const slot of ["K", "P", "LS"]) {
      const p = byId.get(t.lineup[slot]);
      if (!p) continue;
      const r = rowEl(p);
      r.classList.remove("sel");
      r.onclick = () => openInDex(p.id);
      sp.append(r);
    }
  }

  function openInDex(id) {
    state.view = "dex";
    state.q = ""; $("#search").value = "";
    state.pos = ""; $("#posFilter").value = "";
    state.startersOnly = false; $("#startersOnly").checked = false;
    state.sel = id;
    render();
    markSel(true);
  }

  // ---------------------------------------------------------------- shell
  function render() {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    $("#view-dex").classList.toggle("hidden", state.view !== "dex");
    $("#view-field").classList.toggle("hidden", state.view !== "field");
    document.querySelector('.tab[data-view="field"]').disabled = state.team === "ALL";
    if (state.view === "dex") {
      renderList();
      markSel(true);
    } else renderField();
    save();
  }

  function init() {
    $("#source").textContent = `MADDEN 27 · ${String(D.source).toUpperCase()} · ${D.players.length} PLAYERS`;
    const pf = $("#posFilter");
    pf.innerHTML = `<option value="">ALL POS</option>` +
      ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "ST"].map((g) => `<option value="${g}">${g} (group)</option>`).join("") +
      POS_ORDER.map((p) => `<option value="${p}">${p}</option>`).join("");
    pf.value = state.pos; $("#sort").value = state.sort; $("#startersOnly").checked = state.startersOnly;
    $("#gbMode").checked = Portrait.getMode() === "gb";
    document.body.classList.toggle("gb", Portrait.getMode() === "gb");
    if (state.team !== "ALL" && !D.teams[state.team]) state.team = "BUF";

    $("#search").oninput = (e) => { state.q = e.target.value.trim(); renderList(); };
    pf.onchange = (e) => { state.pos = e.target.value; render(); };
    $("#sort").onchange = (e) => { state.sort = e.target.value; render(); };
    $("#startersOnly").onchange = (e) => { state.startersOnly = e.target.checked; render(); };
    $("#gbMode").onchange = (e) => {
      Portrait.setMode(e.target.checked ? "gb" : "color");
      document.body.classList.toggle("gb", e.target.checked);
      render();
    };
    document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => {
      if (b.disabled) return;
      state.view = b.dataset.view; render();
    }));

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (state.view !== "dex") return;
        e.preventDefault();
        const ps = filtered();
        const i = ps.findIndex((p) => p.id === state.sel);
        const n = ps[Math.max(0, Math.min(ps.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
        if (n) select(n.id, true);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const order = ["ALL", ...teamList.map((t) => t.abbr)];
        const i = order.indexOf(state.team);
        selectTeam(order[(i + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length]);
      }
    });

    renderTeams();
    render();
    // redraw the field once the pixel font has loaded (canvas text)
    if (document.fonts) document.fonts.ready.then(() => { if (state.view === "field") drawField(); });
  }

  init();
})();
