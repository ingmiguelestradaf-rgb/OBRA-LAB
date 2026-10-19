/* ObraLab · Distribución de escalera
   Número de peraltes, peralte real, huellas, regla de Blondel, tramos recto / en L / en U,
   descanso, perfil dibujado, tabla de trazo y volumen de concreto. */
(function () {
  "use strict";
  const KEY = "obralab:escalera:v1";
  const D0 = { H: "2.80", pmax: "0.18", huella: "0.28", tipo: "recto", ancho: "1.00", esp: "0.12", disp: "0" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const fm = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const cm = (v, d = 1) => fm(v * 100, d);

  function calcular(s) {
    const H = num(s.H), pmax = num(s.pmax), h = num(s.huella), a = num(s.ancho), e = num(s.esp), disp = num(s.disp);
    if (H <= 0 || pmax <= 0 || h <= 0) return null;
    const n = Math.ceil(H / pmax - 1e-9);
    const p = H / n;
    const tramos = s.tipo === "recto" ? 1 : 2;
    const n1 = tramos === 1 ? n : Math.ceil(n / 2), n2 = n - n1;
    const hu1 = n1 - 1, hu2 = tramos === 2 ? Math.max(0, n2 - 1) : 0;
    const L1 = hu1 * h, L2 = hu2 * h;
    const huellas = hu1 + hu2;
    const blondel = 2 * p + h;
    const ang = Math.atan(p / h) * 180 / Math.PI;
    let largo, anchoPlanta;
    if (s.tipo === "recto") { largo = L1; anchoPlanta = a; }
    else if (s.tipo === "U") { largo = Math.max(L1, L2) + a; anchoPlanta = 2 * a; }
    else { largo = L1 + a; anchoPlanta = L2 + a; }
    const inc = (np, nh) => Math.hypot(np * p, nh * h);
    const volRampa = (inc(n1, hu1) + (tramos === 2 ? inc(n2, hu2) : 0)) * a * e;
    const volEsc = huellas * (p * h / 2) * a;
    const volDesc = tramos === 2 ? a * a * e : 0;
    const avisos = [];
    if (blondel < 0.61) avisos.push(["warn", `2p + h = ${cm(blondel)} cm: escalera tendida. Reduce la huella o aumenta el peralte (rango cómodo 61 a 65 cm).`]);
    else if (blondel > 0.65) avisos.push(["warn", `2p + h = ${cm(blondel)} cm: escalera forzada. Aumenta la huella o reduce el peralte (rango cómodo 61 a 65 cm).`]);
    else avisos.push(["ok", `2p + h = ${cm(blondel)} cm: dentro del rango cómodo de 61 a 65 cm (regla de Blondel).`]);
    if (s.tipo === "recto" && n > 18) avisos.push(["warn", `${n} peraltes en un solo tramo: considera un descanso intermedio (tramo en L o en U).`]);
    if (disp > 0 && largo > disp + 1e-9) {
      const hReq = s.tipo === "recto" ? disp / Math.max(1, hu1) : null;
      avisos.push(["bad", `Necesitas ${fm(largo, 2)} m de largo y tienes ${fm(disp, 2)} m.` + (hReq ? ` Con ese espacio la huella sería de ${cm(hReq)} cm; mejor cambia a escalera en L o en U.` : " Ajusta la huella o el arreglo.")]);
    } else if (disp > 0) avisos.push(["ok", `Cabe en el espacio disponible: sobran ${fm(disp - largo, 2)} m.`]);
    const pasos = [];
    let x = 0, y = 0;
    for (let i = 1; i <= n; i++) {
      y = i * p;
      const tramo = i <= n1 ? 1 : 2;
      pasos.push({ i, tramo, y, x: tramo === 1 ? (i - 1) * h : (i - n1 - 1) * h, ultimo: i === n1 && tramos === 2 });
    }
    return { H, n, p, h, n1, n2, hu1, hu2, L1, L2, huellas, blondel, ang, largo, anchoPlanta, tramos, a, vol: volRampa + volEsc + volDesc, volRampa, volEsc, volDesc, avisos, pasos };
  }

  function perfil(R, tipo) {
    // perfil desarrollado: tramo 1, descanso, tramo 2
    const desc = R.tramos === 2 ? R.a : 0;
    const totalX = R.L1 + desc + R.L2 + R.h * 0.6, totalY = R.H;
    const W = 640, Hh = 300, pad = 46;
    const k = Math.min((W - pad * 2) / Math.max(totalX, 0.1), (Hh - pad * 2) / Math.max(totalY, 0.1));
    const X = (v) => pad + v * k, Y = (v) => Hh - pad - v * k;
    let d = `M${X(0)},${Y(0)}`, cx = 0, cy = 0;
    for (let i = 1; i <= R.n1; i++) { cy += R.p; d += ` L${X(cx)},${Y(cy)}`; if (i < R.n1) { cx += R.h; d += ` L${X(cx)},${Y(cy)}`; } }
    if (R.tramos === 2) {
      cx += desc; d += ` L${X(cx)},${Y(cy)}`;
      for (let i = 1; i <= R.n2; i++) { cy += R.p; d += ` L${X(cx)},${Y(cy)}`; if (i < R.n2) { cx += R.h; d += ` L${X(cx)},${Y(cy)}`; } }
    }
    d += ` L${X(cx + R.h * 0.6)},${Y(cy)}`;
    const dim = (x1, y1, x2, y2, t, off = 0) => `<g class="es-dim"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text x="${(x1 + x2) / 2 + off}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle">${t}</text></g>`;
    const descX = X(R.L1);
    return `<svg viewBox="0 0 ${W} ${Hh}" class="es-svg" role="img" aria-label="Perfil de la escalera">
      <line class="es-floor" x1="${pad - 20}" y1="${Y(0)}" x2="${X(R.L1 + desc + R.L2) + 30}" y2="${Y(0)}"/>
      <path class="es-step" d="${d}"/>
      ${dim(pad - 26, Y(0), pad - 26, Y(R.H), "", 0)}<text class="es-lbl" x="${pad - 30}" y="${(Y(0) + Y(R.H)) / 2}" text-anchor="end" transform="rotate(-90 ${pad - 30} ${(Y(0) + Y(R.H)) / 2})">H = ${fm(R.H, 2)} m</text>
      ${dim(X(0), Y(0) + 22, X(R.L1), Y(0) + 22, `Tramo 1: ${R.hu1} huellas · ${fm(R.L1, 2)} m`)}
      ${R.tramos === 2 ? dim(descX, Y(R.n1 * R.p) - 14, descX + desc * k, Y(R.n1 * R.p) - 14, `Descanso ${fm(desc, 2)} m`) + dim(descX + desc * k, Y(0) + 22, X(R.L1 + desc + R.L2), Y(0) + 22, `Tramo 2: ${R.hu2} huellas · ${fm(R.L2, 2)} m`) : ""}
      <text class="es-lbl" x="${X(R.L1 + desc + R.L2)}" y="${Y(R.H) + 20}" text-anchor="end">peralte ${cm(R.p)} cm · huella ${cm(R.h, 0)} cm</text>
    </svg>`;
  }

  let st, root;
  const fld = (k, label, extra = "") => `<label class="ac-f"><span>${label}</span><input data-k="${k}" inputmode="decimal" value="${esc(st[k])}" ${extra}></label>`;
  function render() {
    root.innerHTML = `<div class="es">
      <div class="ac-grid">
        ${fld("H", "Altura de piso a piso H (m)")}
        ${fld("pmax", "Peralte máximo (m)")}
        ${fld("huella", "Huella deseada (m)")}
        <label class="ac-f"><span>Arreglo</span><select data-k="tipo">${[["recto", "Un tramo recto"], ["L", "Dos tramos en L"], ["U", "Dos tramos en U"]].map(([v, l]) => `<option value="${v}"${st.tipo === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        ${fld("ancho", "Ancho de escalera (m)")}
        ${fld("esp", "Espesor de rampa (m)")}
        ${fld("disp", "Largo disponible (m, 0 = sin límite)")}
      </div>
      <div id="es-out"></div></div>`;
    out();
  }
  function out() {
    const R = calcular(st), o = root.querySelector("#es-out");
    if (!R) { o.innerHTML = '<p class="ac-note">Captura la altura, el peralte máximo y la huella.</p>'; return; }
    o.innerHTML = `<div class="ac-kpis">
        <span>Peraltes<b>${R.n} × ${cm(R.p)} cm</b></span><span>Huellas<b>${R.huellas} × ${cm(R.h, 0)} cm</b></span>
        <span>Largo en planta<b>${fm(R.largo, 2)} m</b></span><span>Pendiente<b>${fm(R.ang, 1)}°</b></span></div>
      <ul class="es-av">${R.avisos.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("")}</ul>
      <div class="ac-tw">${perfil(R)}</div>
      <div class="es-cols">
        <div><h3>Distribución</h3><table class="ac-t">
          <tr><td>Tramo 1</td><td>${R.n1} peraltes · ${R.hu1} huellas · ${fm(R.L1, 2)} m</td></tr>
          ${R.tramos === 2 ? `<tr><td>Descanso</td><td>${fm(R.a, 2)} × ${fm(R.a, 2)} m a ${fm(R.n1 * R.p, 3)} m de altura</td></tr><tr><td>Tramo 2</td><td>${R.n2} peraltes · ${R.hu2} huellas · ${fm(R.L2, 2)} m</td></tr>` : ""}
          <tr><td>Huella de llegada</td><td>la losa superior funciona como último escalón</td></tr>
          <tr><td>Huella máx. con este largo</td><td>${st.tipo === "recto" && num(st.disp) > 0 && R.hu1 > 0 ? cm(num(st.disp) / R.hu1) + " cm" : "—"}</td></tr>
          <tr><td>Planta ocupada</td><td>${fm(R.largo, 2)} × ${fm(R.anchoPlanta, 2)} m</td></tr>
          <tr><td>Concreto</td><td>${fm(R.vol, 2)} m³ (rampa ${fm(R.volRampa, 2)}, escalones ${fm(R.volEsc, 2)}${R.volDesc ? `, descanso ${fm(R.volDesc, 2)}` : ""})</td></tr>
        </table></div>
        <div><h3>Tabla de trazo</h3><div class="ac-tw es-trazo"><table class="ac-t"><thead><tr><th>Escalón</th><th>Tramo</th><th>Nivel de huella (m)</th><th>Peralte a (m) del arranque del tramo</th><th>Llega a</th></tr></thead><tbody>
          ${R.pasos.map((s) => `<tr><td>${s.i}</td><td>${s.tramo}</td><td>${fm(s.y, 3)}</td><td>${fm(s.x, 3)}</td><td>${s.ultimo ? "descanso" : s.i === R.n ? "losa superior" : "huella " + s.i}</td></tr>`).join("")}
        </tbody></table></div></div>
      </div>`;
  }
  function mount(c) {
    root = c;
    try { st = Object.assign({}, D0, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { st = Object.assign({}, D0); }
    render();
    root.addEventListener("input", (ev) => { const k = ev.target.dataset.k; if (!k) return; st[k] = ev.target.value; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} out(); });
  }
  window.ObraModulos = window.ObraModulos || {};
  window.ObraModulos.escalera = mount;
  window.ObraModulos._escaleraTest = { calcular };
})();
