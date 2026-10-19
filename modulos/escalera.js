/* ObraLab · Distribución de escalera
   Uno o varios entrepisos: llega a cada piso con un descanso y continúa al siguiente.
   Peraltes, huellas, regla de Blondel, tramos recto / en L / en U con descanso intermedio
   a la mitad o a una altura dada, perfil dibujado, tabla de trazo y volumen de concreto. */
(function () {
  "use strict";
  const KEY = "obralab:escalera:v2";
  const D0 = { nent: "1", hs: ["2.80"], pmax: "0.18", huella: "0.28", tipo: "recto", ancho: "1.00", esp: "0.12", disp: "0", hd: "0", dp: "1.20",
    bl: "1", bh: "0.90", bsp: "1.20", btipo: "vert", bsb: "0.10", blin: "4", bext: "0.30", bcom: "6.10" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const fm = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const cm = (v, d = 1) => fm(v * 100, d);

  function entrepiso(H, s) {
    const pmax = num(s.pmax), h = num(s.huella), a = num(s.ancho), e = num(s.esp), hd = num(s.hd);
    const n = Math.ceil(H / pmax - 1e-9);
    const p = H / n;
    const tramos = s.tipo === "recto" || n < 3 ? 1 : 2;
    let n1 = n;
    if (tramos === 2) n1 = hd > 0 ? Math.min(n - 1, Math.max(1, Math.round(hd / p))) : Math.ceil(n / 2);
    const n2 = n - n1;
    const hu1 = n1 - 1, hu2 = tramos === 2 ? Math.max(0, n2 - 1) : 0;
    const L1 = hu1 * h, L2 = hu2 * h;
    let largo, anchoPlanta;
    if (tramos === 1) { largo = L1; anchoPlanta = a; }
    else if (s.tipo === "U") { largo = Math.max(L1, L2) + a; anchoPlanta = 2 * a; }
    else { largo = L1 + a; anchoPlanta = L2 + a; }
    const inc = (np, nh) => Math.hypot(np * p, nh * h);
    const volRampa = (inc(n1, hu1) + (tramos === 2 ? inc(n2, hu2) : 0)) * a * e;
    const volEsc = (hu1 + hu2) * (p * h / 2) * a;
    const volDesc = tramos === 2 ? a * a * e : 0;
    return { H, n, p, h, a, n1, n2, hu1, hu2, L1, L2, tramos, largo, anchoPlanta, huellas: hu1 + hu2,
      blondel: 2 * p + h, ang: Math.atan(p / h) * 180 / Math.PI, hdReal: n1 * p, volRampa, volEsc, volDesc };
  }

  function calcular(s) {
    const pmax = num(s.pmax), h = num(s.huella);
    const nent = Math.max(1, Math.min(8, Math.round(num(s.nent)) || 1));
    const hs = Array.from({ length: nent }, (_, i) => num((s.hs || [])[i]));
    if (pmax <= 0 || h <= 0 || hs.some((x) => x <= 0)) return null;
    const a = num(s.ancho), e = num(s.esp), disp = num(s.disp), dp = num(s.dp);
    const E = hs.map((H) => entrepiso(H, s));
    const avisos = [];
    const pref = (i) => (nent > 1 ? `Entrepiso ${i + 1}: ` : "");
    E.forEach((r, i) => {
      if (r.blondel < 0.61) avisos.push(["warn", `${pref(i)}2p + h = ${cm(r.blondel)} cm, escalera tendida. Reduce la huella o aumenta el peralte (rango cómodo 61 a 65 cm).`]);
      else if (r.blondel > 0.65) avisos.push(["warn", `${pref(i)}2p + h = ${cm(r.blondel)} cm, escalera forzada. Aumenta la huella o reduce el peralte (rango cómodo 61 a 65 cm).`]);
      else avisos.push(["ok", `${pref(i)}2p + h = ${cm(r.blondel)} cm, dentro del rango cómodo de 61 a 65 cm.`]);
      if (r.tramos === 1 && r.n > 18) avisos.push(["warn", `${pref(i)}${r.n} peraltes en un solo tramo: considera un descanso intermedio (arreglo en L o en U).`]);
      if (r.tramos === 2 && num(s.hd) > 0 && Math.abs(r.hdReal - num(s.hd)) > 0.005)
        avisos.push(["warn", `${pref(i)}el descanso intermedio queda a ${fm(r.hdReal, 3)} m (no a ${fm(num(s.hd), 2)} m) para conservar todos los peraltes iguales.`]);
      if (disp > 0 && r.largo > disp + 1e-9) avisos.push(["bad", `${pref(i)}necesitas ${fm(r.largo, 2)} m de largo y tienes ${fm(disp, 2)} m.` + (r.tramos === 1 && r.hu1 > 0 ? ` Con ese espacio la huella sería de ${cm(disp / r.hu1)} cm; mejor usa arreglo en L o en U.` : " Ajusta la huella o el arreglo.")]);
    });
    if (disp > 0 && E.every((r) => r.largo <= disp + 1e-9)) avisos.push(["ok", `Cabe en el largo disponible: sobran ${fm(disp - Math.max(...E.map((r) => r.largo)), 2)} m.`]);
    if (nent > 1) {
      const ps = E.map((r) => r.p);
      if (Math.max(...ps) - Math.min(...ps) > 0.005) avisos.push(["ok", "Cada entrepiso tiene su propio peralte porque las alturas son distintas; dentro de cada tramo todos los peraltes son iguales."]);
    }
    // segmentos del perfil y pasos de trazo
    const seg = [], pasos = [];
    let nivel = 0, k = 0;
    E.forEach((r, i) => {
      const tramos = r.tramos === 2 ? [[1, r.n1, r.hu1], [2, r.n2, r.hu2]] : [[1, r.n1, r.hu1]];
      tramos.forEach(([t, np, nh], j) => {
        seg.push({ tipo: "esc", np, nh, p: r.p, h: r.h, ent: i + 1, tramo: t });
        for (let q = 1; q <= np; q++) {
          k++;
          const llega = q < np ? "huella " + k : j === 0 && r.tramos === 2 ? "descanso intermedio" : i < nent - 1 ? `piso ${i + 2} (descanso)` : `piso ${i + 2} (llegada)`;
          pasos.push({ k, ent: i + 1, tramo: t, abs: nivel + q * r.p, rel: (j === 1 ? r.n1 * r.p : 0) + q * r.p, x: (q - 1) * r.h, llega });
        }
        nivel += np * r.p;
        if (j === 0 && r.tramos === 2) seg.push({ tipo: "desc", largo: a, label: "Descanso intermedio" });
      });
      if (i < nent - 1) seg.push({ tipo: "desc", largo: dp, label: `Piso ${i + 2} · descanso`, piso: i + 2, nivel });
    });
    const volPisos = (nent - 1) * dp * a * e;
    const vol = E.reduce((t, r) => t + r.volRampa + r.volEsc + r.volDesc, 0) + volPisos;
    return { E, nent, a, dp, seg, pasos, avisos, vol, volPisos, Htot: hs.reduce((t, x) => t + x, 0),
      nTot: E.reduce((t, r) => t + r.n, 0), huTot: E.reduce((t, r) => t + r.huellas, 0) };
  }

  /* barandal: sigue la línea de narices en cada tramo y corre horizontal en descansos */
  function barandal(R, s) {
    const lados = Math.round(num(s.bl));
    if (lados <= 0) return null;
    const bh = num(s.bh), sp = num(s.bsp), sb = num(s.bsb), ext = num(s.bext), com = num(s.bcom) || 6.1, lin = Math.max(1, Math.round(num(s.blin)));
    const tramos = [];
    R.seg.forEach((g) => {
      if (g.tipo === "esc") tramos.push({ t: `Entrepiso ${g.ent} · tramo ${g.tramo}`, len: Math.hypot(g.nh * g.h, Math.max(0, g.np - 1) * g.p), inc: true });
      else tramos.push({ t: g.label, len: g.largo, inc: false });
    });
    const run = tramos.reduce((t, x) => t + x.len, 0);
    const postes = tramos.reduce((t, x) => t + Math.ceil(x.len / (sp || 1) - 1e-9), 0) + 1;
    const fill = s.btipo === "vert" ? tramos.reduce((t, x) => t + Math.max(0, Math.ceil(x.len / (sb || 1) - 1e-9) - 1), 0) : 0;
    const mat = [];
    const add = (concepto, ml, pz, nota) => mat.push({ concepto, ml: ml * lados, pz: pz == null ? null : pz * lados, tubos: ml > 0 ? Math.ceil(ml * lados * 1.05 / com) : null, nota });
    add("Pasamanos", run + 2 * ext, null, `incluye ${fm(ext, 2)} m de prolongación en cada extremo`);
    add("Larguero inferior", run, null, "a 10 cm sobre la nariz de los escalones");
    add("Postes", postes * (bh + 0.05), postes, `${fm(bh + 0.05, 2)} m c/u (altura + 5 cm de empotre o placa)`);
    if (s.btipo === "vert") add("Barrotes verticales", fill * Math.max(0, bh - 0.15), fill, `${fm(Math.max(0, bh - 0.15), 2)} m c/u a cada ${cm(sb, 0)} cm`);
    else if (s.btipo === "hor") add("Líneas horizontales", lin * run, null, `${lin} líneas entre pasamanos y larguero`);
    const area = s.btipo === "panel" ? run * Math.max(0, bh - 0.15) * lados : 0;
    return { lados, tramos, run, postes: postes * lados, placas: postes * lados, anclas: postes * lados * 4, mat, area, com, bh };
  }

  function perfil(R) {
    let totX = 0, totY = 0;
    R.seg.forEach((g) => { if (g.tipo === "esc") { totX += g.nh * g.h; totY += g.np * g.p; } else totX += g.largo; });
    totX += 0.6;
    const W = 680, Hh = Math.max(260, Math.min(520, 160 + R.nent * 120)), pad = 52;
    const k = Math.min((W - pad * 2) / Math.max(totX, 0.1), (Hh - pad * 2) / Math.max(totY, 0.1));
    const X = (v) => pad + v * k, Y = (v) => Hh - pad - v * k;
    let d = `M${X(0)},${Y(0)}`, cx = 0, cy = 0;
    const marks = [];
    R.seg.forEach((g) => {
      if (g.tipo === "esc") {
        for (let i = 1; i <= g.np; i++) { cy += g.p; d += ` L${X(cx)},${Y(cy)}`; if (i < g.np) { cx += g.h; d += ` L${X(cx)},${Y(cy)}`; } }
      } else {
        marks.push({ x1: cx, x2: cx + g.largo, y: cy, label: g.label, piso: g.piso });
        cx += g.largo; d += ` L${X(cx)},${Y(cy)}`;
      }
    });
    d += ` L${X(cx + 0.6)},${Y(cy)}`;
    const pisos = [{ y: 0, t: "Piso 1 · ±0.00" }].concat(marks.filter((m) => m.piso).map((m) => ({ y: m.y, t: `Piso ${m.piso} · +${fm(m.y, 2)}` })), [{ y: cy, t: `Piso ${R.nent + 1} · +${fm(cy, 2)}` }]);
    return `<svg viewBox="0 0 ${W} ${Hh}" class="es-svg" role="img" aria-label="Perfil desarrollado de la escalera">
      ${pisos.map((f) => `<line class="es-floor" x1="${pad - 10}" y1="${Y(f.y)}" x2="${W - 8}" y2="${Y(f.y)}"/><text class="es-lbl" x="${W - 8}" y="${Y(f.y) - 5}" text-anchor="end">${f.t}</text>`).join("")}
      <path class="es-step" d="${d}"/>
      ${marks.map((m) => `<g class="es-dim"><line x1="${X(m.x1)}" y1="${Y(m.y) + 10}" x2="${X(m.x2)}" y2="${Y(m.y) + 10}"/><text x="${(X(m.x1) + X(m.x2)) / 2}" y="${Y(m.y) + 24}" text-anchor="middle">${esc(m.label)} ${fm(m.x2 - m.x1, 2)} m</text></g>`).join("")}
      <text class="es-lbl" x="${pad - 18}" y="${(Y(0) + Y(cy)) / 2}" text-anchor="middle" transform="rotate(-90 ${pad - 18} ${(Y(0) + Y(cy)) / 2})">H total = ${fm(cy, 2)} m</text>
    </svg>`;
  }

  let st, root;
  const fld = (k, label, val) => `<label class="ac-f"><span>${label}</span><input data-k="${k}" inputmode="decimal" value="${esc(val ?? st[k])}"></label>`;
  function render() {
    const nent = Math.max(1, Math.min(8, Math.round(num(st.nent)) || 1));
    while (st.hs.length < nent) st.hs.push(st.hs[st.hs.length - 1] || "2.80");
    root.innerHTML = `<div class="es">
      <div class="ac-grid">
        <label class="ac-f"><span>Entrepisos que sube</span><select data-k="nent">${[1, 2, 3, 4, 5, 6, 7, 8].map((v) => `<option value="${v}"${v === nent ? " selected" : ""}>${v === 1 ? "1 (de un piso al siguiente)" : v + " entrepisos"}</option>`).join("")}</select></label>
        ${Array.from({ length: nent }, (_, i) => fld("hs." + i, nent === 1 ? "Altura de piso a piso H (m)" : `Altura piso ${i + 1} → ${i + 2} (m)`, st.hs[i])).join("")}
        ${nent > 1 ? fld("dp", "Descanso en cada piso (m)") : ""}
      </div>
      <div class="ac-grid">
        ${fld("pmax", "Peralte máximo (m)")}
        ${fld("huella", "Huella deseada (m)")}
        <label class="ac-f"><span>Arreglo por entrepiso</span><select data-k="tipo">${[["recto", "Un tramo recto"], ["L", "Dos tramos en L"], ["U", "Dos tramos en U"]].map(([v, l]) => `<option value="${v}"${st.tipo === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        ${st.tipo !== "recto" ? fld("hd", "Descanso intermedio a (m, 0 = a la mitad)") : ""}
        ${fld("ancho", "Ancho de escalera (m)")}
        ${fld("esp", "Espesor de rampa (m)")}
        ${fld("disp", "Largo disponible (m, 0 = sin límite)")}
      </div>
      <h3>Barandal</h3>
      <div class="ac-grid">
        <label class="ac-f"><span>Lados con barandal</span><select data-k="bl">${[["0", "Sin barandal"], ["1", "Un lado"], ["2", "Dos lados"]].map(([v, l]) => `<option value="${v}"${String(st.bl) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        ${num(st.bl) > 0 ? `${fld("bh", "Altura del barandal (m)")}${fld("bsp", "Separación de postes (m)")}
        <label class="ac-f"><span>Relleno</span><select data-k="btipo">${[["vert", "Barrotes verticales"], ["hor", "Líneas horizontales"], ["panel", "Panel (vidrio, malla, lámina)"]].map(([v, l]) => `<option value="${v}"${st.btipo === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        ${st.btipo === "vert" ? fld("bsb", "Separación de barrotes (m)") : st.btipo === "hor" ? fld("blin", "Número de líneas") : ""}
        ${fld("bext", "Prolongación del pasamanos (m)")}${fld("bcom", "Largo comercial del tubo (m)")}` : ""}
      </div>
      <div id="es-out"></div></div>`;
    out();
  }
  function out() {
    const R = calcular(st), o = root.querySelector("#es-out");
    if (!R) { o.innerHTML = '<p class="ac-note">Captura las alturas, el peralte máximo y la huella.</p>'; return; }
    const uno = R.nent === 1, r0 = R.E[0];
    o.innerHTML = `<div class="ac-kpis">
        <span>Peraltes${uno ? `<b>${r0.n} × ${cm(r0.p)} cm</b>` : `<b>${R.nTot} en ${R.nent} entrepisos</b>`}</span>
        <span>Huellas<b>${R.huTot} × ${cm(r0.h, 0)} cm</b></span>
        <span>Largo por entrepiso<b>${fm(Math.max(...R.E.map((r) => r.largo)), 2)} m</b></span>
        <span>Pendiente<b>${R.E.map((r) => fm(r.ang, 1) + "°").filter((v, i, a) => a.indexOf(v) === i).join(" / ")}</b></span></div>
      <ul class="es-av">${R.avisos.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("")}</ul>
      <div class="ac-tw">${perfil(R)}</div>
      <div class="es-cols">
        <div><h3>Distribución</h3><div class="ac-tw"><table class="ac-t">
          ${R.E.map((r, i) => `${uno ? "" : `<tr class="es-ent"><td colspan="2">Entrepiso ${i + 1}: piso ${i + 1} → piso ${i + 2} · H = ${fm(r.H, 2)} m · ${r.n} peraltes de ${cm(r.p)} cm</td></tr>`}
            <tr><td>Tramo 1</td><td>${r.n1} peraltes · ${r.hu1} huellas · ${fm(r.L1, 2)} m</td></tr>
            ${r.tramos === 2 ? `<tr><td>Descanso intermedio</td><td>${fm(r.a, 2)} × ${fm(r.a, 2)} m a ${fm(r.hdReal, 3)} m sobre el piso ${i + 1}</td></tr><tr><td>Tramo 2</td><td>${r.n2} peraltes · ${r.hu2} huellas · ${fm(r.L2, 2)} m</td></tr>` : ""}
            <tr><td>Llegada</td><td>${i < R.nent - 1 ? `Piso ${i + 2}: descanso de ${fm(R.dp, 2)} m y continúa al siguiente piso` : `Piso ${i + 2}: la losa funciona como último escalón`}</td></tr>
            <tr><td>Planta ocupada</td><td>${fm(r.largo, 2)} × ${fm(r.anchoPlanta, 2)} m</td></tr>`).join("")}
          <tr class="es-ent"><td>Concreto total</td><td>${fm(R.vol, 2)} m³${R.volPisos ? ` (incluye ${fm(R.volPisos, 2)} m³ de descansos en piso)` : ""}</td></tr>
        </table></div></div>
        <div><h3>Tabla de trazo</h3><div class="ac-tw es-trazo"><table class="ac-t"><thead><tr><th>Escalón</th>${uno ? "" : "<th>Entrepiso</th>"}<th>Tramo</th><th>Nivel (m)</th>${uno ? "" : "<th>Sobre su piso (m)</th>"}<th>Peralte a (m) del arranque</th><th>Llega a</th></tr></thead><tbody>
          ${R.pasos.map((s) => `<tr><td>${s.k}</td>${uno ? "" : `<td>${s.ent}</td>`}<td>${s.tramo}</td><td>${fm(s.abs, 3)}</td>${uno ? "" : `<td>${fm(s.abs - R.E.slice(0, s.ent - 1).reduce((t, r) => t + r.H, 0), 3)}</td>`}<td>${fm(s.x, 3)}</td><td>${esc(s.llega)}</td></tr>`).join("")}
        </tbody></table></div></div>
      </div>${baraHTML(barandal(R, st))}`;
  }
  function baraHTML(B) {
    if (!B) return "";
    return `<div class="es-cols"><div><h3>Material de barandal (${B.lados} lado${B.lados > 1 ? "s" : ""})</h3>
      <div class="ac-tw"><table class="ac-t"><thead><tr><th>Concepto</th><th>Metros</th><th>Piezas</th><th>Tubos de ${fm(B.com, 2)} m</th><th>Nota</th></tr></thead><tbody>
      ${B.mat.map((m) => `<tr><td>${m.concepto}</td><td>${fm(m.ml, 2)}</td><td>${m.pz == null ? "—" : m.pz}</td><td>${m.tubos ?? "—"}</td><td>${esc(m.nota)}</td></tr>`).join("")}
      ${B.area ? `<tr><td>Panel de relleno</td><td colspan="3">${fm(B.area, 2)} m²</td><td>altura útil ${fm(B.bh - 0.15, 2)} m</td></tr>` : ""}
      <tr><td>Placas base</td><td>—</td><td>${B.placas}</td><td>—</td><td>una por poste</td></tr>
      <tr><td>Anclas o taquetes</td><td>—</td><td>${B.anclas}</td><td>—</td><td>4 por placa</td></tr>
      </tbody></table></div>
      <p class="ac-note">Recorrido por lado: ${B.tramos.map((t) => `${esc(t.t)} ${fm(t.len, 2)} m`).join(" · ")}. Tubos con 5 % de desperdicio por cortes. En descansos se cuenta un lado del descanso; ajusta si el barandal rodea el descanso. Verifica altura y abertura máxima del relleno con tu reglamento.</p>
      </div></div>`;
  }
  function mount(c) {
    root = c;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!saved) { try { const v1 = JSON.parse(localStorage.getItem("obralab:escalera:v1")); if (v1) saved = Object.assign({}, v1, { hs: [v1.H || "2.80"] }); } catch (e) {} }
    st = Object.assign({}, D0, saved || {});
    if (!Array.isArray(st.hs) || !st.hs.length) st.hs = ["2.80"];
    render();
    const onIn = (ev) => {
      const k = ev.target.dataset.k; if (!k) return;
      if (k.startsWith("hs.")) st.hs[+k.slice(3)] = ev.target.value; else st[k] = ev.target.value;
      try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
      if (["nent", "tipo", "bl", "btipo"].includes(k)) render(); else out();
    };
    root.addEventListener("input", onIn);
  }
  window.ObraModulos = window.ObraModulos || {};
  window.ObraModulos.escalera = mount;
  window.ObraModulos._escaleraTest = { calcular };
})();
