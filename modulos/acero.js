/* ObraLab · Cuantificador de acero por elemento
   Trabes, contratrabes, columnas (rect, circular, L, T, perímetro libre), castillos/dalas,
   losas y losas de cimentación (parrilla sencilla o doble), zapatas aisladas y corridas, muros.
   Corridas, bastones, estribos por zonas, grapas, zunchos y parrillas. */
(function () {
  "use strict";
  const DIAM = { "2": 6.35, "2.5": 7.94, "3": 9.53, "4": 12.7, "5": 15.88, "6": 19.05, "7": 22.23, "8": 25.4, "9": 28.58, "10": 31.75, "12": 38.1 };
  const FRAC = { "2": '1/4"', "2.5": '5/16"', "3": '3/8"', "4": '1/2"', "5": '5/8"', "6": '3/4"', "7": '7/8"', "8": '1"', "9": '1 1/8"', "10": '1 1/4"', "12": '1 1/2"' };
  const NUMS = ["2", "2.5", "3", "4", "5", "6", "7", "8", "9", "10", "12"];
  const kgm = (n) => 0.00617 * DIAM[n] * DIAM[n];
  const dbm = (n) => DIAM[n] / 1000;
  const KEY = "obralab:acero:v1";
  const CRIT0 = { desp: 5, lt: 40, g90: 12, gem: 6, gmin: 0.08, com: 12 };

  const TIPOS = {
    trabe: "Trabe", columna: "Columna", losa: "Losa", castillo: "Castillo / dala",
    zapata: "Zapata aislada", zapcorrida: "Zapata corrida", contratrabe: "Contratrabe",
    losacim: "Losa de cimentación", muro: "Muro", generico: "Elemento libre"
  };
  const GRUPOS = [
    ["Estructura", ["trabe", "columna", "losa", "castillo", "muro"]],
    ["Cimentación", ["zapata", "zapcorrida", "contratrabe", "losacim"]],
    ["Otro", ["generico"]]
  ];
  const LINEAL = ["trabe", "contratrabe", "columna", "castillo", "generico"];
  const PLACA = ["losa", "losacim", "zapata", "zapcorrida", "muro"];
  const GEO = {
    lineal: ["L", "b", "h", "r"],
    losa: ["Lx", "Ly", "esp", "r"], losacim: ["Lx", "Ly", "esp", "r"],
    zapata: ["B", "L", "h", "r"], zapcorrida: ["L", "B", "h", "r"], muro: ["L", "H", "esp", "r"]
  };
  const GLAB = {
    L: "Longitud L (m)", b: "Base b (m)", h: "Peralte / lado h (m)", r: "Recubrimiento r (m)",
    Lx: "Claro Lx (m)", Ly: "Claro Ly (m)", esp: "Espesor (m)", B: "Ancho B (m)", H: "Altura H (m)",
    D: "Diámetro D (m)", t1: "Espesor de ala t1 (m)", t2: "Espesor de alma t2 (m)"
  };
  const GLAB_T = { zapata: { L: "Largo L (m)", h: "Peralte h (m)" }, zapcorrida: { L: "Longitud L (m)", h: "Peralte h (m)" }, columna: { L: "Altura libre L (m)" }, castillo: { L: "Altura / longitud L (m)" } };
  const FORMAS = { rect: "Rectangular", circ: "Circular", L: "Sección L", T: "Sección T" };
  const ROL_BARRA = ["Corrida superior", "Corrida inferior", "Corrida intermedia (piel)", "Longitudinal", "Bastón en apoyo (−)", "Bastón al centro (+)", "Varilla adicional"];
  const ROL_PARR = ["Lecho inferior X", "Lecho inferior Y", "Lecho superior X", "Lecho superior Y", "Bastones / columpios X", "Bastones / columpios Y", "Transversal", "Vertical cara 1", "Horizontal cara 1", "Vertical cara 2", "Horizontal cara 2", "Parrilla"];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const fm = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const uid = () => Math.random().toString(36).slice(2, 8);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- plantillas ---------- */
  const B = (rol, cant, n, long, ganchos = 2, tras = 0) => ({ k: "barra", rol, cant: String(cant), n, long, ganchos, tras });
  const E = (n, Lc, s1, s2, extra = {}) => Object.assign({ k: "estribo", modo: "seccion", n, juegos: "1", Lc, s1, s2, grapas: "0", perim: "", gn: n }, extra);
  const P = (rol, n, sep, reparto, long, ganchos = 2, lecho = "inf", veces = "1") => ({ k: "parrilla", rol, n, sep, reparto, long, ganchos, veces, lecho });

  function plantilla(tipo) {
    const base = { id: uid(), tipo, marca: "", piezas: "1", geo: {}, filas: [], parr: "sencilla" };
    const cnt = (state ? state.els.filter((e) => e.tipo === tipo).length : 0) + 1;
    const pre = { trabe: "T", contratrabe: "CT", columna: "C", castillo: "K", losa: "L", losacim: "LC", zapata: "Z", zapcorrida: "ZC", muro: "M", generico: "E" }[tipo];
    base.marca = pre + "-" + cnt;
    switch (tipo) {
      case "trabe":
        base.geo = { forma: "rect", L: 6, b: 0.25, h: 0.5, r: 0.04 };
        base.filas = [B("Corrida superior", 2, "5", "L"), B("Corrida inferior", 2, "5", "L"), B("Bastón en apoyo (−)", 4, "5", "L/3", 1), B("Bastón al centro (+)", 1, "4", "L/2", 0), E("3", "2*h", "0.10", "0.20")];
        break;
      case "contratrabe":
        base.geo = { forma: "rect", L: 5, b: 0.3, h: 0.8, r: 0.05 };
        base.filas = [B("Corrida superior", 3, "6", "L"), B("Corrida inferior", 3, "6", "L"), B("Corrida intermedia (piel)", 2, "3", "L", 0), B("Bastón en apoyo (−)", 4, "6", "L/3", 1), E("3", "2*h", "0.10", "0.20")];
        break;
      case "columna":
        base.geo = { forma: "rect", L: 3, b: 0.4, h: 0.4, r: 0.04, D: 0.5, t1: 0.25, t2: 0.25 };
        base.filas = [B("Longitudinal", 8, "6", "L", 1, 1), E("3", "max(b,h,L/6,0.6)", "0.10", "0.20", { grapas: "2" })];
        break;
      case "castillo":
        base.geo = { forma: "rect", L: 2.6, b: 0.15, h: 0.15, r: 0.025 };
        base.filas = [B("Longitudinal", 4, "3", "L", 2), E("2", "0", "0.20", "0")];
        break;
      case "generico":
        base.geo = { forma: "rect", L: 3, b: 0.2, h: 0.2, r: 0.03, D: 0.3, t1: 0.2, t2: 0.2 };
        base.filas = [B("Longitudinal", 4, "4", "L", 2)];
        break;
      case "losa":
        base.geo = { Lx: 5, Ly: 4, esp: 0.12, r: 0.025 };
        base.filas = [P("Lecho inferior X", "3", "0.20", "Ly", "Lx"), P("Lecho inferior Y", "3", "0.20", "Lx", "Ly"),
          P("Bastones / columpios X", "3", "0.40", "Ly", "Lx/4", 1, "-", "2"), P("Bastones / columpios Y", "3", "0.40", "Lx", "Ly/4", 1, "-", "2")];
        break;
      case "losacim":
        base.geo = { Lx: 10, Ly: 8, esp: 0.3, r: 0.05 };
        base.filas = [P("Lecho inferior X", "4", "0.20", "Ly", "Lx"), P("Lecho inferior Y", "4", "0.20", "Lx", "Ly")];
        aplicaParrilla(base, "doble");
        break;
      case "zapata":
        base.geo = { B: 2, L: 2, h: 0.4, r: 0.05 };
        base.filas = [P("Lecho inferior X", "4", "0.15", "B", "L"), P("Lecho inferior Y", "4", "0.15", "L", "B")];
        break;
      case "zapcorrida":
        base.geo = { L: 10, B: 0.8, h: 0.25, r: 0.05 };
        base.filas = [P("Transversal", "3", "0.20", "L", "B", 2, "inf"), B("Longitudinal", 4, "3", "L", 2)];
        break;
      case "muro":
        base.geo = { L: 5, H: 2.8, esp: 0.15, r: 0.03 };
        base.filas = [P("Vertical cara 1", "3", "0.30", "L", "H", 1, "inf"), P("Horizontal cara 1", "3", "0.30", "H", "L", 2, "inf")];
        break;
    }
    return base;
  }

  const ESPEJO = [["inferior", "superior"], ["cara 1", "cara 2"]];
  function aplicaParrilla(el, modo) {
    el.parr = modo;
    if (modo === "sencilla") { el.filas = el.filas.filter((f) => f.lecho !== "sup"); return; }
    const nuevas = [];
    el.filas.forEach((f, i) => {
      if (f.k !== "parrilla" || f.lecho !== "inf") return;
      f.uid = f.uid || uid();
      if (!el.filas.some((g) => g.par === f.uid)) {
        let rol = f.rol; ESPEJO.forEach(([a, b]) => (rol = rol.replace(a, b)));
        if (rol === f.rol) rol = f.rol + " (sup.)";
        nuevas.push({ i, fila: Object.assign({}, f, { rol, lecho: "sup", par: f.uid, uid: uid() }) });
      }
    });
    nuevas.reverse().forEach(({ i, fila }) => el.filas.splice(i + 1, 0, fila));
  }

  /* ---------- cálculo ---------- */
  const fnCache = {};
  const VARS = ["L", "b", "h", "r", "Lx", "Ly", "esp", "B", "H", "D", "t1", "t2", "max", "min", "PI"];
  function ev(expr, g) {
    let s = String(expr ?? "").trim();
    if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    if (s === "") return 0;
    if (!/^[\d\s.+\-*/()a-zA-Z,]*$/.test(s)) throw new Error("expresión");
    let f = fnCache[s];
    if (!f) { f = new Function(...VARS, "return (" + s + ");"); fnCache[s] = f; }
    const v = f(...VARS.map((k) => (k === "max" ? Math.max : k === "min" ? Math.min : k === "PI" ? Math.PI : g[k] || 0)));
    if (!Number.isFinite(v)) throw new Error("valor");
    return v;
  }
  function trasAuto(lc, n, C) {
    if (lc <= C.com) return { lc, ns: 0 };
    const lt = C.lt * dbm(n);
    const ns = Math.ceil((lc - C.com) / (C.com - lt));
    return { lc: lc + ns * lt, ns };
  }
  function posiciones(Lel, Lc, s1, s2) {
    if (s1 <= 0 || Lel <= 0) return 0;
    if (s2 > 0 && Lc > 0 && Lel > 2 * Lc) return 2 * (Math.floor(Lc / s1 + 1e-9) + 1) + Math.max(0, Math.ceil((Lel - 2 * Lc) / s2 - 1e-9) - 1);
    return Math.floor(Lel / s1 + 1e-9) + 1;
  }
  function volumen(el, g) {
    if (LINEAL.includes(el.tipo)) {
      const f = el.geo.forma;
      const area = f === "circ" ? Math.PI * g.D * g.D / 4 : (f === "L" || f === "T") ? g.b * g.t1 + g.t2 * Math.max(0, g.h - g.t1) : g.b * g.h;
      return area * g.L;
    }
    if (el.tipo === "losa" || el.tipo === "losacim") return g.Lx * g.Ly * g.esp;
    if (el.tipo === "zapata" || el.tipo === "zapcorrida") return g.B * g.L * g.h;
    if (el.tipo === "muro") return g.L * g.H * g.esp;
    return 0;
  }
  function calcFila(f, el, g, C) {
    const out = [];
    if (f.k === "barra") {
      const n = f.n, db = dbm(n);
      const cant = Math.round(ev(f.cant, g));
      let lc = ev(f.long, g) + num(f.ganchos) * C.g90 * db + num(f.tras) * C.lt * db;
      const t = trasAuto(lc, n, C);
      const det = [];
      if (num(f.ganchos)) det.push(`${f.ganchos} gancho${f.ganchos > 1 ? "s" : ""} 90°`);
      if (num(f.tras)) det.push(`${f.tras} traslape${f.tras > 1 ? "s" : ""}`);
      if (t.ns) det.push(`+${t.ns} traslape${t.ns > 1 ? "s" : ""} por long. comercial`);
      out.push({ n, concepto: f.rol + (det.length ? ` (${det.join(", ")})` : ""), pz: cant, lc: t.lc });
    } else if (f.k === "parrilla") {
      const n = f.n, db = dbm(n);
      const sep = ev(f.sep, g), rep = ev(f.reparto, g), veces = Math.max(1, Math.round(ev(f.veces || "1", g)));
      const cnt = sep > 0 ? Math.floor(Math.max(0, rep - 2 * g.r) / sep + 1e-9) + 1 : 0;
      let lc = Math.max(0, ev(f.long, g) - 2 * g.r) + num(f.ganchos) * C.g90 * db;
      const t = trasAuto(lc, n, C);
      out.push({ n, concepto: `${f.rol} @${fm(sep * 100, 0)} cm${veces > 1 ? ` ×${veces}` : ""}${t.ns ? ` (+${t.ns} trasl.)` : ""}`, pz: cnt * veces, lc: t.lc });
    } else if (f.k === "estribo") {
      const n = f.n, db = dbm(n), r = g.r;
      const gk = Math.max(C.gem * db, C.gmin);
      const Lel = g.L, s1 = ev(f.s1, g), s2 = ev(f.s2, g), Lc = ev(f.Lc, g);
      const juegos = Math.max(1, Math.round(ev(f.juegos || "1", g)));
      const forma = el.geo.forma || "rect";
      const Di = g.D - 2 * r, bi = g.b - 2 * r, hi = g.h - 2 * r;
      const zona = s2 > 0 && Lc > 0 && Lel > 2 * Lc ? `@${fm(s1 * 100, 0)}/${fm(s2 * 100, 0)} cm` : `@${fm(s1 * 100, 0)} cm`;
      if (f.modo === "espiral") {
        const p = s1, vueltas = p > 0 ? Lel / p : 0;
        const lc = vueltas * Math.hypot(Math.PI * Di, p) + 3 * Math.PI * Di;
        out.push({ n, concepto: `Zunchado (espiral) paso ${fm(p * 100, 1)} cm, ${fm(vueltas, 1)} vueltas`, pz: 1, lc });
      } else {
        const npos = posiciones(Lel, Lc, s1, s2);
        if (f.modo === "perim") {
          out.push({ n, concepto: `Estribo perímetro libre ${zona} (${npos} pos.)`, pz: npos * juegos, lc: ev(f.perim, g) + 2 * gk });
        } else if (forma === "circ") {
          out.push({ n, concepto: `Anillo ${zona} (${npos} pos.)`, pz: npos * juegos, lc: Math.PI * Di + 2 * gk });
        } else if (forma === "L" || forma === "T") {
          const a = 2 * ((g.b - 2 * r) + (g.t1 - 2 * r)) + 2 * gk;
          const b = 2 * ((g.t2 - 2 * r) + (g.h - 2 * r)) + 2 * gk;
          out.push({ n, concepto: `Estribo ${forma === "L" ? "ala horizontal" : "patín"} ${zona} (${npos} pos.)`, pz: npos * juegos, lc: a });
          out.push({ n, concepto: `Estribo ${forma === "L" ? "ala vertical" : "alma"} ${zona} (${npos} pos.)`, pz: npos * juegos, lc: b });
        } else {
          out.push({ n, concepto: `Estribo ${fm(g.b * 100, 0)}×${fm(g.h * 100, 0)} ${zona} (${npos} pos.)`, pz: npos * juegos, lc: 2 * (bi + hi) + 2 * gk });
        }
        const gr = Math.max(0, Math.round(ev(f.grapas || "0", g)));
        if (gr && f.modo !== "espiral") {
          const gn = f.gn || n;
          const ancho = forma === "circ" ? Di : Math.max(bi, hi);
          out.push({ n: gn, concepto: `Grapa ${zona} (${gr} por posición)`, pz: npos * gr, lc: ancho + 2 * Math.max(C.gem * dbm(gn), C.gmin) });
        }
      }
    }
    out.forEach((o) => { o.ml = o.pz * o.lc; o.kg = o.ml * kgm(o.n); });
    return out;
  }
  function calcular(st) {
    const C = Object.fromEntries(Object.entries(CRIT0).map(([k, v]) => [k, Number.isFinite(parseFloat(st.crit[k])) ? parseFloat(st.crit[k]) : v]));
    const res = { els: {}, filas: {}, desp: [], sum: {}, kg: 0, vol: 0 };
    st.els.forEach((el) => {
      const g = {}; VARS.slice(0, 12).forEach((k) => (g[k] = num(el.geo[k])));
      const piezas = Math.max(0, Math.round(num(el.piezas)));
      let kgEl = 0, err = 0;
      el.filas.forEach((f, i) => {
        let rows;
        try { rows = calcFila(f, el, g, C); } catch (e) { rows = null; err++; }
        res.filas[el.id + ":" + i] = rows;
        (rows || []).forEach((o) => {
          const pzT = o.pz * piezas, mlT = o.ml * piezas, kgT = o.kg * piezas;
          kgEl += kgT;
          res.desp.push({ marca: el.marca, tipo: TIPOS[el.tipo], concepto: o.concepto, n: o.n, pz: pzT, lc: o.lc, ml: mlT, kg: kgT });
          const s = (res.sum[o.n] = res.sum[o.n] || { ml: 0, kg: 0 });
          s.ml += mlT; s.kg += kgT;
        });
      });
      const vol = volumen(el, g) * piezas;
      res.els[el.id] = { kg: kgEl, vol, err };
      res.kg += kgEl; res.vol += vol;
    });
    res.C = C;
    return res;
  }

  /* ---------- interfaz ---------- */
  let state = null, root = null;
  const save = () => store.set(state);

  function ejemplo() {
    state = { crit: Object.assign({}, CRIT0), els: [], ejemplo: true };
    ["trabe", "columna", "losa", "zapata"].forEach((t) => state.els.push(plantilla(t)));
    state.els[1].piezas = "6"; state.els[3].piezas = "6";
    aplicaParrilla(state.els[2], "doble");
  }

  const selN = (val, attr) => `<select ${attr}>${NUMS.map((n) => `<option value="${n}"${n === val ? " selected" : ""}>#${n} · ${FRAC[n]}</option>`).join("")}</select>`;
  const fld = (label, inner, cls = "") => `<label class="ac-f ${cls}"><span>${label}</span>${inner}</label>`;
  const inp = (path, val, opts = {}) => `<input data-p="${path}" value="${esc(val)}"${opts.num ? ' inputmode="decimal"' : ""}${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ""}>`;

  function rowHTML(el, f, i) {
    const p = `${el.id}.filas.${i}`;
    let body = "";
    if (f.k === "barra") {
      body = fld("Concepto", `<select data-p="${p}.rol">${ROL_BARRA.concat(ROL_BARRA.includes(f.rol) ? [] : [f.rol]).map((r) => `<option${r === f.rol ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>`, "w2") +
        fld("Piezas", inp(p + ".cant", f.cant, { num: 1 })) +
        fld("Varilla", selN(f.n, `data-p="${p}.n"`)) +
        fld("Longitud (m o fórmula)", inp(p + ".long", f.long, { ph: "L, L/3, Lx+0.3" })) +
        fld("Ganchos 90°", `<select data-p="${p}.ganchos">${[0, 1, 2].map((v) => `<option${+f.ganchos === v ? " selected" : ""}>${v}</option>`).join("")}</select>`) +
        fld("Traslapes extra", inp(p + ".tras", f.tras, { num: 1 }));
    } else if (f.k === "parrilla") {
      body = fld("Concepto", `<select data-p="${p}.rol">${ROL_PARR.concat(ROL_PARR.includes(f.rol) ? [] : [f.rol]).map((r) => `<option${r === f.rol ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>`, "w2") +
        fld("Varilla", selN(f.n, `data-p="${p}.n"`)) +
        fld("Separación (m)", inp(p + ".sep", f.sep, { num: 1 })) +
        fld("Ancho de reparto", inp(p + ".reparto", f.reparto, { ph: "Ly" })) +
        fld("Largo de varilla", inp(p + ".long", f.long, { ph: "Lx" })) +
        fld("Ganchos 90°", `<select data-p="${p}.ganchos">${[0, 1, 2].map((v) => `<option${+f.ganchos === v ? " selected" : ""}>${v}</option>`).join("")}</select>`) +
        fld("Veces (×)", inp(p + ".veces", f.veces, { num: 1 }));
    } else {
      const circ = el.geo.forma === "circ";
      body = fld("Tipo", `<select data-p="${p}.modo" data-re="1">${[["seccion", circ ? "Anillo (según sección)" : "Cerrado (según sección)"], ["espiral", "Zuncho en espiral"], ["perim", "Perímetro libre"]].map(([v, l]) => `<option value="${v}"${f.modo === v ? " selected" : ""}>${l}</option>`).join("")}</select>`, "w2") +
        fld("Varilla", selN(f.n, `data-p="${p}.n"`)) +
        (f.modo === "espiral" ? fld("Paso (m)", inp(p + ".s1", f.s1, { num: 1 })) :
          fld("Zona confinada Lc", inp(p + ".Lc", f.Lc, { ph: "2*h" })) +
          fld("Sep. confinada (m)", inp(p + ".s1", f.s1, { num: 1 })) +
          fld("Sep. central (0 = uniforme)", inp(p + ".s2", f.s2, { num: 1 })) +
          fld("Juegos por posición", inp(p + ".juegos", f.juegos, { num: 1 })) +
          fld("Grapas por posición", inp(p + ".grapas", f.grapas, { num: 1 })) +
          (num(f.grapas) ? fld("Varilla de grapa", selN(f.gn || f.n, `data-p="${p}.gn"`)) : "") +
          (f.modo === "perim" ? fld("Perímetro del estribo (m)", inp(p + ".perim", f.perim, { ph: "1.80" })) : ""));
    }
    const kind = { barra: "Varilla / bastón", parrilla: "Parrilla", estribo: "Estribos" }[f.k];
    return `<div class="ac-row ac-${f.k}"><div class="ac-rowh"><span class="ac-kind">${kind}${f.lecho === "sup" ? " · lecho sup." : ""}</span><button type="button" class="ac-x" data-act="del-row" data-e="${el.id}" data-i="${i}" aria-label="Quitar renglón">Quitar</button></div>
      <div class="ac-grid">${body}</div><div class="ac-out" data-r="${el.id}:${i}"></div></div>`;
  }

  function elHTML(el, open) {
    const lin = LINEAL.includes(el.tipo);
    const forma = el.geo.forma || "rect";
    let geoF = lin ? (forma === "circ" ? ["L", "D", "r"] : forma === "L" || forma === "T" ? ["L", "b", "h", "t1", "t2", "r"] : GEO.lineal) : GEO[el.tipo];
    const lab = (k) => (GLAB_T[el.tipo] && GLAB_T[el.tipo][k]) || GLAB[k];
    const parrOK = PLACA.includes(el.tipo);
    const nota = forma === "L" ? "L: b = ancho total, h = alto total, t1 = espesor del ala horizontal, t2 = espesor del ala vertical." :
      forma === "T" ? "T: b = ancho del patín, t1 = espesor del patín, t2 = ancho del alma, h = altura total." : "";
    return `<details class="ac-el" data-el="${el.id}"${open ? " open" : ""}>
      <summary><span class="ac-badge">${esc(TIPOS[el.tipo])}</span><b>${esc(el.marca)}</b><span class="ac-mut">× ${esc(el.piezas)}</span><span class="ac-kg" data-k="${el.id}"></span></summary>
      <div class="ac-body">
        <div class="ac-grid ac-geo">
          ${fld("Marca", inp(el.id + ".marca", el.marca))}
          ${fld("Piezas iguales", inp(el.id + ".piezas", el.piezas, { num: 1 }))}
          ${lin ? fld("Sección", `<select data-p="${el.id}.geo.forma" data-re="1">${Object.entries(FORMAS).map(([v, l]) => `<option value="${v}"${forma === v ? " selected" : ""}>${l}</option>`).join("")}</select>`) : ""}
          ${geoF.map((k) => fld(lab(k), inp(`${el.id}.geo.${k}`, el.geo[k] ?? "", { num: 1 }))).join("")}
        </div>
        ${nota ? `<p class="ac-note">${nota}</p>` : ""}
        ${parrOK ? `<div class="ac-parr" role="group" aria-label="Tipo de parrilla"><span>${el.tipo === "muro" ? "Refuerzo" : "Parrilla"}</span>
          <button type="button" data-act="parr" data-e="${el.id}" data-v="sencilla" aria-pressed="${el.parr !== "doble"}">${el.tipo === "muro" ? "Una capa" : "Sencilla"}</button>
          <button type="button" data-act="parr" data-e="${el.id}" data-v="doble" aria-pressed="${el.parr === "doble"}">${el.tipo === "muro" ? "Dos capas" : "Doble"}</button></div>` : ""}
        <div class="ac-rows">${el.filas.map((f, i) => rowHTML(el, f, i)).join("")}</div>
        <div class="ac-add">
          <button type="button" data-act="add-row" data-e="${el.id}" data-k="barra">+ Varilla / bastón</button>
          ${lin ? `<button type="button" data-act="add-row" data-e="${el.id}" data-k="estribo">+ Estribos</button>` : ""}
          <button type="button" data-act="add-row" data-e="${el.id}" data-k="parrilla">+ Parrilla</button>
          <span class="ac-sp"></span>
          <button type="button" data-act="dup-el" data-e="${el.id}">Duplicar</button>
          <button type="button" data-act="del-el" data-e="${el.id}" class="ac-danger">Eliminar</button>
        </div>
      </div></details>`;
  }

  function render(openId) {
    const opened = new Set([...root.querySelectorAll(".ac-el[open]")].map((d) => d.dataset.el));
    if (openId) opened.add(openId);
    const first = !root.querySelector(".ac");
    const c = state.crit;
    root.innerHTML = `<div class="ac">
      ${state.ejemplo ? `<p class="ac-banner">Proyecto de ejemplo cargado: cambia las medidas por las de tu plano o pulsa <b>Nuevo proyecto</b> para empezar desde cero.</p>` : ""}
      <div class="ac-addel">${GRUPOS.map(([g, ts]) => `<div><span class="ac-mut">${g}</span>${ts.map((t) => `<button type="button" data-act="add-el" data-t="${t}">+ ${TIPOS[t]}</button>`).join("")}</div>`).join("")}</div>
      <details class="ac-crit"><summary>Criterios de cuantificación</summary>
        <div class="ac-grid">
          ${fld("Desperdicio (%)", inp("crit.desp", c.desp, { num: 1 }))}
          ${fld("Traslape (× diámetro)", inp("crit.lt", c.lt, { num: 1 }))}
          ${fld("Gancho 90° (× diámetro)", inp("crit.g90", c.g90, { num: 1 }))}
          ${fld("Gancho estribo 135° (× diámetro)", inp("crit.gem", c.gem, { num: 1 }))}
          ${fld("Gancho estribo mínimo (m)", inp("crit.gmin", c.gmin, { num: 1 }))}
          ${fld("Largo comercial (m)", inp("crit.com", c.com, { num: 1 }))}
        </div>
        <p class="ac-note">Valores de referencia usuales; ajústalos a las notas de tu proyecto estructural. Las longitudes aceptan fórmulas con las medidas del elemento: L, b, h, r, Lx, Ly, B, H, esp, D, t1, t2, max( ), min( ).</p>
      </details>
      <div class="ac-list">${state.els.map((el) => elHTML(el, first ? state.els.length <= 2 : opened.has(el.id))).join("") || '<p class="ac-note">Agrega tu primer elemento con los botones de arriba.</p>'}</div>
      <section class="ac-res">
        <div class="ac-kpis" id="ac-kpis"></div>
        <h3>Resumen por diámetro</h3><div class="ac-tw"><table class="ac-t" id="ac-sum"></table></div>
        <h3>Despiece</h3><div class="ac-tw"><table class="ac-t" id="ac-desp"></table></div>
        <div class="actions"><button class="btn" type="button" data-act="csv">Exportar despiece CSV</button><button class="btn ghost" type="button" data-act="print">Imprimir / PDF</button>
          <button class="btn ghost" type="button" data-act="nuevo" id="ac-nuevo">Nuevo proyecto</button><button class="btn ghost" type="button" data-act="ejemplo">Cargar ejemplo</button></div>
      </section></div>`;
    refresh();
  }

  function refresh() {
    const R = calcular(state);
    state.els.forEach((el) => {
      const e = R.els[el.id];
      const k = root.querySelector(`[data-k="${el.id}"]`);
      if (k) k.textContent = e.err ? "revisa datos" : `${fm(e.kg, 1)} kg`;
      const s = root.querySelector(`[data-el="${el.id}"] summary .ac-mut`); if (s) s.textContent = "× " + el.piezas;
      const m = root.querySelector(`[data-el="${el.id}"] summary b`); if (m) m.textContent = el.marca;
      el.filas.forEach((f, i) => {
        const o = root.querySelector(`[data-r="${el.id}:${i}"]`); if (!o) return;
        const rows = R.filas[el.id + ":" + i];
        o.classList.toggle("bad", !rows);
        o.innerHTML = !rows ? "No se pudo calcular: revisa la fórmula o las medidas." :
          rows.map((x) => `<span>${esc(x.concepto)}: <b>${x.pz} pzas × ${fm(x.lc, 2)} m</b> = ${fm(x.ml, 2)} m · <b>${fm(x.kg, 1)} kg</b> por pieza de elemento</span>`).join("");
      });
    });
    const d = 1 + R.C.desp / 100;
    const kgD = R.kg * d;
    root.querySelector("#ac-kpis").innerHTML =
      `<span>Acero neto<b>${fm(R.kg, 1)} kg</b></span><span>Con ${fm(R.C.desp, 0)} % desperdicio<b>${fm(kgD / 1000, 3)} t</b></span>` +
      `<span>Concreto de los elementos<b>${fm(R.vol, 2)} m³</b></span><span>Cuantía<b>${R.vol > 0 ? fm(R.kg / R.vol, 0) : "—"} kg/m³</b></span>`;
    const ns = NUMS.filter((n) => R.sum[n] && R.sum[n].kg > 0);
    root.querySelector("#ac-sum").innerHTML = `<thead><tr><th>Varilla</th><th>kg/m</th><th>Metros</th><th>kg neto</th><th>kg + desp.</th><th>Piezas de ${fm(R.C.com, 0)} m</th></tr></thead><tbody>` +
      ns.map((n) => { const s = R.sum[n]; return `<tr><td>#${n} · ${FRAC[n]}</td><td>${fm(kgm(n), 3)}</td><td>${fm(s.ml, 1)}</td><td>${fm(s.kg, 1)}</td><td>${fm(s.kg * d, 1)}</td><td>${n === "2" ? "rollo" : Math.ceil(s.ml * d / R.C.com)}</td></tr>`; }).join("") +
      `</tbody><tfoot><tr><td>Total</td><td></td><td>${fm(ns.reduce((a, n) => a + R.sum[n].ml, 0), 1)}</td><td>${fm(R.kg, 1)}</td><td>${fm(kgD, 1)}</td><td></td></tr></tfoot>`;
    root.querySelector("#ac-desp").innerHTML = `<thead><tr><th>Marca</th><th>Elemento</th><th>Concepto</th><th>Varilla</th><th>Pzas</th><th>L. corte (m)</th><th>Long. total (m)</th><th>kg</th></tr></thead><tbody>` +
      R.desp.map((x) => `<tr><td>${esc(x.marca)}</td><td>${esc(x.tipo)}</td><td class="ac-con">${esc(x.concepto)}</td><td>#${x.n}</td><td>${x.pz}</td><td>${fm(x.lc, 2)}</td><td>${fm(x.ml, 2)}</td><td>${fm(x.kg, 1)}</td></tr>`).join("") + "</tbody>";
    root._R = R;
  }

  function setPath(path, val) {
    const parts = path.split(".");
    let o;
    if (parts[0] === "crit") o = state.crit;
    else { o = state.els.find((e) => e.id === parts[0]); }
    if (!o) return;
    for (let i = 1; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }

  function csv() {
    const R = root._R, d = 1 + R.C.desp / 100;
    const rows = [["ObraLab - Cuantificación de acero", new Date().toLocaleDateString("es-MX")], [],
      ["Marca", "Elemento", "Concepto", "Varilla", "Piezas", "Long. corte (m)", "Long. total (m)", "kg"]];
    R.desp.forEach((x) => rows.push([x.marca, x.tipo, x.concepto, "#" + x.n, x.pz, x.lc.toFixed(2), x.ml.toFixed(2), x.kg.toFixed(1)]));
    rows.push([], ["Resumen", "", "", "Varilla", "", "Metros", "kg neto", "kg + desperdicio"]);
    NUMS.filter((n) => R.sum[n]).forEach((n) => rows.push(["", "", "", "#" + n, "", R.sum[n].ml.toFixed(1), R.sum[n].kg.toFixed(1), (R.sum[n].kg * d).toFixed(1)]));
    rows.push(["Total", "", "", "", "", "", R.kg.toFixed(1), (R.kg * d).toFixed(1)]);
    const text = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = `despiece_acero_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function mount(container) {
    root = container;
    state = store.get();
    if (!state || !Array.isArray(state.els)) ejemplo();
    state.crit = Object.assign({}, CRIT0, state.crit);
    render();
    root.addEventListener("input", (ev) => {
      const p = ev.target.dataset.p; if (!p) return;
      setPath(p, ev.target.value);
      if (ev.target.dataset.re) { const id = p.split(".")[0]; render(id); }
      else refresh();
      save();
    });
    root.addEventListener("change", (ev) => {
      const p = ev.target.dataset.p; if (!p || ev.target.tagName !== "SELECT") return;
      setPath(p, ev.target.value);
      if (ev.target.dataset.re || /\.grapas$/.test(p)) render(p.split(".")[0]); else refresh();
      save();
    });
    root.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-act]"); if (!b) return;
      const act = b.dataset.act, el = state.els.find((e) => e.id === b.dataset.e);
      if (act === "add-el") { const n = plantilla(b.dataset.t); state.els.push(n); render(n.id); save(); root.querySelector(`[data-el="${n.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }); return; }
      if (act === "add-row" && el) {
        const k = b.dataset.k;
        el.filas.push(k === "barra" ? B("Varilla adicional", 2, "4", LINEAL.includes(el.tipo) ? "L" : "1.00", 1) :
          k === "estribo" ? E("3", "0", "0.15", "0") : P("Parrilla", "3", "0.20", el.geo.Ly != null ? "Ly" : "L", el.geo.Lx != null ? "Lx" : "1.00", 2, "-"));
        render(el.id); save(); return;
      }
      if (act === "del-row" && el) { el.filas.splice(+b.dataset.i, 1); render(el.id); save(); return; }
      if (act === "dup-el" && el) { const c = JSON.parse(JSON.stringify(el)); c.id = uid(); c.marca = el.marca + " (copia)"; state.els.splice(state.els.indexOf(el) + 1, 0, c); render(c.id); save(); return; }
      if (act === "del-el" && el) {
        if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "Confirmar eliminar"; setTimeout(() => { if (b.isConnected) { b.dataset.ok = ""; b.textContent = "Eliminar"; } }, 4000); return; }
        state.els = state.els.filter((e) => e !== el); render(); save(); return;
      }
      if (act === "parr" && el) { aplicaParrilla(el, b.dataset.v); render(el.id); save(); return; }
      if (act === "csv") return csv();
      if (act === "print") { root.querySelectorAll(".ac-el").forEach((d) => (d.open = true)); return window.print(); }
      if (act === "ejemplo") { ejemplo(); render(); save(); return; }
      if (act === "nuevo") {
        if (b.dataset.ok !== "1") { b.dataset.ok = "1"; b.textContent = "Confirmar: borrar todo"; setTimeout(() => { if (b.isConnected) { b.dataset.ok = ""; b.textContent = "Nuevo proyecto"; } }, 4000); return; }
        state = { crit: state.crit, els: [], ejemplo: false }; render(); save();
      }
    });
  }

  window.ObraModulos = window.ObraModulos || {};
  window.ObraModulos.acero = mount;
  window.ObraModulos._aceroTest = { calcular, plantilla, aplicaParrilla, posiciones, CRIT0, setState: (s) => (state = s) };
})();
