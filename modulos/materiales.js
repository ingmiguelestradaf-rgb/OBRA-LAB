/* ObraLab · Calculadoras de materiales
   pintura, repello, block, tablaroca, plafon, dosificacion (concreto hecho en obra y morteros).
   Todos los rendimientos y consumos son valores de referencia editables. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const x = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const fm = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const up = (v) => Math.ceil(v - 1e-9);
  const kgm = (mm) => 0.00617 * mm * mm;
  const BULTO_L = 1000 * 50 / 1500; // 50 kg de cemento ≈ 33.3 L sueltos
  const BOTE = 19;

  /* ---------- campos comunes ---------- */
  const AREA = [
    { k: "L", label: "Largo total de muros (m)", def: "20" },
    { k: "H", label: "Altura (m)", def: "2.60" },
    { k: "vanos", label: "Vanos a descontar (m²)", def: "4" },
    { k: "Adir", label: "o área directa (m², opcional)", def: "0" }
  ];
  const area = (v) => (num(v.Adir) > 0 ? num(v.Adir) : Math.max(0, num(v.L) * num(v.H) - num(v.vanos)));
  const PROP_MORT = [["1:3", "Cemento-arena 1:3"], ["1:4", "Cemento-arena 1:4"], ["1:5", "Cemento-arena 1:5"], ["1:6", "Cemento-arena 1:6"],
    ["1:0.5:4", "Cemento-cal-arena 1:½:4"], ["1:1:6", "Cemento-cal-arena 1:1:6"]];
  const partes = (p) => { const x = p.split(":").map(Number); return x.length === 2 ? { c: x[0], cal: 0, a: x[1] } : { c: x[0], cal: x[1], a: x[2] }; };

  /* dosificación por volumen suelto: factor F = volumen de material seco por m³ de mezcla */
  function dosifica(vol, P, F, extra = {}) {
    const sum = P.c + (P.cal || 0) + P.a + (P.g || 0);
    const vc = vol * F * P.c / sum;
    const cemKg = vc * 1500;
    const out = {
      cemKg, bultos: cemKg / 50, arena: vol * F * P.a / sum, grava: vol * F * (P.g || 0) / sum,
      calKg: vol * F * (P.cal || 0) / sum * (extra.calDens || 550),
      porBulto: { arena: BULTO_L * P.a / P.c / BOTE, grava: BULTO_L * (P.g || 0) / P.c / BOTE, cal: BULTO_L * (P.cal || 0) / P.c / BOTE },
      rindeBulto: (BULTO_L / 1000) * sum / P.c / F
    };
    return out;
  }
  const tubos = (ml, largo) => up(ml / largo);

  /* ---------- definiciones ---------- */
  const MODS = {
    pintura: {
      campos: [...AREA,
        { k: "sup", label: "Tipo de superficie", def: "1", opts: [["1", "Lisa (yeso, tablaroca, aplanado fino)"], ["1.25", "Aplanado rústico o texturizado"], ["1.5", "Block o concreto aparente"]] },
        { k: "manos", label: "Número de manos", def: "2" },
        { k: "rend", label: "Rendimiento por mano (m²/L)", def: "9" },
        { k: "sell", label: "Sellador", def: "1", opts: [["1", "Sí, una mano"], ["0", "No"]] },
        { k: "rendS", label: "Rendimiento sellador (m²/L)", def: "12", show: (v) => v.sell === "1" },
        { k: "desp", label: "Desperdicio (%)", def: "5" }],
      calc(v) {
        const A = area(v), f = num(v.sup) || 1, d = 1 + num(v.desp) / 100;
        const lt = A * f * num(v.manos) / (num(v.rend) || 1) * d;
        const ls = v.sell === "1" ? A * f / (num(v.rendS) || 1) * d : 0;
        const pres = (l) => { const c = Math.floor(l / 19); const g = up((l - c * 19) / 3.785); const t = []; if (c) t.push(`${c} cubeta${c === 1 ? "" : "s"} de 19 L`); if (g) t.push(`${g} ${g === 1 ? "galón" : "galones"}`); return t.join(" + ") || "—"; };
        return {
          kpis: [["Área a pintar", `${fm(A)} m²`], ["Pintura", `${fm(lt, 1)} L`], ["Presentación", pres(lt)]],
          filas: [["Pintura", fm(lt, 1), "L", `${v.manos} manos · ${fm(up(lt / 3.785), 0)} galones si compras solo galones`],
            ...(ls ? [["Sellador", fm(ls, 1), "L", pres(ls)]] : []),
            ["Superficie efectiva", fm(A * f), "m²", f > 1 ? `área × ${fm(f, 2)} por textura de la superficie` : "superficie lisa"]],
          notas: ["El rendimiento real depende de la marca, el color y la absorción: confirma en la ficha técnica del producto.", "Colores intensos sobre fondo claro (o al revés) suelen requerir una mano adicional."]
        };
      }
    },

    repello: {
      campos: [...AREA,
        { k: "esp", label: "Espesor promedio (m)", def: "0.015" },
        { k: "prop", label: "Proporción del mortero", def: "1:4", opts: PROP_MORT },
        { k: "caras", label: "Caras a repellar", def: "1", opts: [["1", "Una cara"], ["2", "Dos caras"]] },
        { k: "desp", label: "Desperdicio (%)", def: "10" },
        { k: "F", label: "Factor de volumen seco del mortero", def: "1.25" }],
      calc(v) {
        const A = area(v) * num(v.caras), d = 1 + num(v.desp) / 100;
        const vol = A * num(v.esp) * d;
        const D = dosifica(vol, partes(v.prop), num(v.F) || 1.25);
        return {
          kpis: [["Área", `${fm(A)} m²`], ["Mortero", `${fm(vol, 3)} m³`], ["Cemento", `${up(D.bultos)} bultos`]],
          filas: morteroFilas(D, vol),
          notas: ["Humedece el muro antes de repellar y cura el aplanado de mortero al menos 3 días.", `Mezcla en obra por bulto de 50 kg: ${porBultoTxt(D)}.`, "Si el muro está fuera de plomo, mide el espesor real con reventones antes de pedir material."]
        };
      }
    },

    block: {
      campos: [...AREA,
        { k: "pieza", label: "Pieza", def: "15", opts: [["12", "Block 12×20×40"], ["15", "Block 15×20×40"], ["20", "Block 20×20×40"], ["tab", "Tabique rojo 7×14×28"], ["tabicon", "Tabicón 10×14×28"]] },
        { k: "j", label: "Espesor de junta (m)", def: "0.01" },
        { k: "despP", label: "Desperdicio de piezas (%)", def: "5" },
        { k: "prop", label: "Mortero de junteo", def: "1:4", opts: PROP_MORT },
        { k: "despM", label: "Desperdicio de mortero (%)", def: "15" },
        { k: "cast", label: "Castillos", def: "1", opts: [["1", "Calcular castillos y dalas"], ["0", "Solo muro"]] },
        { k: "sepC", label: "Separación máxima de castillos (m)", def: "3.0", show: (v) => v.cast === "1" },
        { k: "extraC", label: "Castillos extra (esquinas, vanos)", def: "2", show: (v) => v.cast === "1" },
        { k: "dalas", label: "Dalas (desplante + cerramiento)", def: "2", show: (v) => v.cast === "1" }],
      calc(v) {
        const P = { "12": [0.4, 0.2, 0.12], "15": [0.4, 0.2, 0.15], "20": [0.4, 0.2, 0.2], tab: [0.28, 0.07, 0.14], tabicon: [0.28, 0.1, 0.14] }[v.pieza];
        const [lp, hp, t] = P, j = num(v.j);
        const A = area(v);
        const pzm2 = 1 / ((lp + j) * (hp + j));
        const pz = up(A * pzm2 * (1 + num(v.despP) / 100));
        const morm2 = t * (1 - (lp * hp) / ((lp + j) * (hp + j)));
        const vol = A * morm2 * (1 + num(v.despM) / 100);
        const D = dosifica(vol, partes(v.prop), 1.25);
        const filas = [["Piezas", pz, "pza", `${fm(pzm2, 1)} pzas/m² con junta de ${fm(j * 100, 1)} cm`], ...morteroFilas(D, vol)];
        const kpis = [["Área de muro", `${fm(A)} m²`], ["Piezas", `${pz}`], ["Mortero", `${fm(vol, 3)} m³`]];
        if (v.cast === "1") {
          const Lm = num(v.L), H = num(v.H);
          const nC = up(Lm / (num(v.sepC) || 3)) + 1 + Math.round(num(v.extraC));
          const nD = Math.round(num(v.dalas));
          const b = t, hD = 0.2, r = 0.02;
          const volC = nC * b * 0.15 * H, volD = nD * b * hD * Lm;
          const estC = (2 * (b - 2 * r + 0.15 - 2 * r) + 0.12), estD = (2 * (b - 2 * r + hD - 2 * r) + 0.12);
          const nEc = nC * (up(H / 0.2) + 1), nEd = nD * (up(Lm / 0.2) + 1);
          const kg3 = (nC * 4 * (H + 0.3) + nD * 4 * (Lm + 0.3 * up(Lm / 12))) * kgm(9.53);
          const kg2 = (nEc * estC + nEd * estD) * kgm(6.35);
          filas.push(["Castillos", nC, "pza", `${fm(b * 100, 0)}×15 cm, armado 4#3 y estribos de alambrón @20 cm`],
            ["Dalas", fm(nD * Lm, 2), "m", `${nD} línea(s) de ${fm(b * 100, 0)}×20 cm`],
            ["Concreto castillos y dalas", fm((volC + volD) * 1.05, 3), "m³", "con 5 % de desperdicio"],
            ["Varilla #3", fm(kg3, 1), "kg", `${up(kg3 / kgm(9.53) / 12)} varillas de 12 m`],
            ["Alambrón #2", fm(kg2, 1), "kg", `${nEc + nEd} estribos`]);
          kpis.push(["Castillos", `${nC}`]);
        }
        return { kpis, filas, notas: [`Mezcla de junteo por bulto de 50 kg: ${porBultoTxt(D)}.`, "Piezas por m² con la medida nominal más la junta. La regla común de 12.5 block/m² supone que la medida ya incluye la junta: captura junta 0 si así lo manejas.", "Ubicación y armado de castillos: confirma con tu proyecto estructural y reglamento."] };
      }
    },

    tablaroca: {
      campos: [...AREA,
        { k: "caras", label: "Caras con placa", def: "2", opts: [["1", "Una cara"], ["2", "Dos caras"]] },
        { k: "capas", label: "Capas por cara", def: "1", opts: [["1", "Una capa"], ["2", "Dos capas"]] },
        { k: "placa", label: "Placa", def: "2.44", opts: [["2.44", "1.22 × 2.44 m"], ["3.05", "1.22 × 3.05 m"]] },
        { k: "tipoP", label: "Tipo de placa", def: "Regular", opts: [["Regular", "Regular"], ["Resistente a humedad", "Resistente a humedad"], ["Resistente al fuego", "Resistente al fuego"], ["Exterior (cementicia)", "Exterior (cementicia)"]] },
        { k: "sep", label: "Separación de postes (m)", def: "0.61", opts: [["0.61", "61 cm"], ["0.406", "40.6 cm"]] },
        { k: "nvanos", label: "Número de puertas y ventanas", def: "1" },
        { k: "lpo", label: "Largo comercial de poste y canal (m)", def: "3.05" },
        { k: "esq", label: "Esquinas exteriores (pza)", def: "2" },
        { k: "tor", label: "Tornillos por placa", def: "30" },
        { k: "comp", label: "Compuesto (kg por m² de placa)", def: "0.9" },
        { k: "cub", label: "Presentación de compuesto (kg)", def: "20" },
        { k: "ais", label: "Aislante en el interior", def: "0", opts: [["0", "No"], ["1", "Sí"]] },
        { k: "desp", label: "Desperdicio de placa (%)", def: "10" }],
      calc(v) {
        const A = area(v), Lm = num(v.L), H = num(v.H), lpo = num(v.lpo) || 3.05;
        const aPlaca = 1.22 * num(v.placa);
        const Ap = A * num(v.caras) * num(v.capas);
        const placas = up(Ap * (1 + num(v.desp) / 100) / aPlaca);
        const nPostes = up(Lm / num(v.sep)) + 1 + 2 * Math.round(num(v.nvanos));
        const tramos = up(H / lpo);
        const postes = nPostes * tramos;
        const canalMl = 2 * Lm + Math.round(num(v.nvanos)) * 2 * 1.0;
        const tor = placas * num(v.tor);
        const torB = nPostes * 4;
        const anclas = 2 * (up(Lm / 0.6) + 1);
        const cinta = A * num(v.caras) * 1.1;
        const comp = A * num(v.caras) * num(v.comp);
        const filas = [
          ["Placa " + v.tipoP, placas, "pza", `1.22 × ${v.placa} m; ${fm(Ap, 1)} m² de placa`],
          ["Postes (montantes)", postes, "pza", `${nPostes} postes @${fm(num(v.sep) * 100, 1)} cm de ${fm(lpo, 2)} m${tramos > 1 ? `, ${tramos} tramos por altura` : ""}`],
          ["Canal (riel) superior e inferior", tubos(canalMl * 1.05, lpo), "pza", `${fm(canalMl, 1)} m, incluye cabezales de vanos`],
          ["Tornillo para placa", tor, "pza", `${up(tor / 1000)} caja(s) de 1000`],
          ["Tornillo de bastidor (framer)", torB, "pza", "4 por poste"],
          ["Anclas o clavo para concreto", anclas, "pza", "canal a piso y losa @60 cm"],
          ["Cinta de refuerzo", fm(cinta, 1), "m", `${up(cinta / 75)} rollo(s) de 75 m`],
          ["Compuesto", fm(comp, 1), "kg", `${up(comp / (num(v.cub) || 20))} cubeta(s) de ${v.cub} kg`],
          ["Esquinero metálico", fm(num(v.esq) * H, 2), "m", `${up(num(v.esq) * H / lpo)} pza de ${fm(lpo, 2)} m`]];
        if (v.ais === "1") filas.push(["Aislante (colchoneta)", fm(A * 1.05, 1), "m²", "con 5 % de traslapes"]);
        return { kpis: [["Área de muro", `${fm(A)} m²`], ["Placas", `${placas}`], ["Postes", `${postes}`]], filas,
          notas: ["Calibre de postes y canal según altura y uso: confirma con el fabricante del sistema.", "Muros en baños y cocinas: placa resistente a humedad; muros de cubos de escalera o separación de locales: verifica resistencia al fuego requerida."] };
      }
    },

    plafon: {
      campos: [
        { k: "tipo", label: "Tipo de plafón", def: "tabla", opts: [["tabla", "Corrido de tablaroca"], ["ret", "Reticular registrable"]] },
        { k: "Lx", label: "Largo del local (m)", def: "6" },
        { k: "Ly", label: "Ancho del local (m)", def: "4" },
        { k: "Adir", label: "o área directa (m², opcional)", def: "0" },
        { k: "per", label: "Perímetro (m, 0 = calcular)", def: "0" },
        { k: "susp", label: "Altura de suspensión (m)", def: "0.50" },
        { k: "mod", label: "Módulo", def: "61x61", opts: [["61x61", "61 × 61 cm"], ["61x122", "61 × 122 cm"]], show: (v) => v.tipo === "ret" },
        { k: "tipoP", label: "Tipo de placa", def: "Regular", opts: [["Regular", "Regular"], ["Resistente a humedad", "Resistente a humedad"], ["Resistente al fuego", "Resistente al fuego"]], show: (v) => v.tipo === "tabla" },
        { k: "tor", label: "Tornillos por placa", def: "36", show: (v) => v.tipo === "tabla" },
        { k: "comp", label: "Compuesto (kg por m²)", def: "0.9", show: (v) => v.tipo === "tabla" },
        { k: "cub", label: "Presentación de compuesto (kg)", def: "20", show: (v) => v.tipo === "tabla" },
        { k: "desp", label: "Desperdicio (%)", def: "8" }],
      calc(v) {
        const Lx = num(v.Lx), Ly = num(v.Ly);
        const A = num(v.Adir) > 0 ? num(v.Adir) : Lx * Ly;
        const per = num(v.per) > 0 ? num(v.per) : 2 * (Lx + Ly);
        const d = 1 + num(v.desp) / 100, susp = num(v.susp);
        if (v.tipo === "tabla") {
          const nCan = Math.floor(Ly / 1.22 + 1e-9) + 1, mlCan = (num(v.Adir) > 0 ? A / 1.22 : nCan * Lx) * d;
          const nLis = Math.floor(Lx / 0.61 + 1e-9) + 1, mlLis = (num(v.Adir) > 0 ? A / 0.61 : nLis * Ly) * d;
          const colg = num(v.Adir) > 0 ? up(A / (1.22 * 1.22)) : nCan * (Math.floor(Lx / 1.22 + 1e-9) + 1);
          const placas = up(A * d / 2.9768);
          const comp = A * num(v.comp);
          return {
            kpis: [["Área", `${fm(A)} m²`], ["Placas", `${placas}`], ["Colgantes", `${colg}`]],
            filas: [["Placa " + v.tipoP + " 1.22 × 2.44", placas, "pza", ""],
              ["Canaleta de carga", up(mlCan / 3.05), "pza", `${fm(mlCan, 1)} m @1.22 m, piezas de 3.05 m`],
              ["Canal listón", up(mlLis / 3.05), "pza", `${fm(mlLis, 1)} m @61 cm perpendicular a la canaleta`],
              ["Ángulo o canal perimetral", up(per * 1.05 / 3.05), "pza", `${fm(per, 1)} m de perímetro`],
              ["Colgantes de alambre galvanizado", colg, "pza", `${fm(colg * (susp + 0.3), 1)} m de alambre (suspensión + amarres)`],
              ["Anclas o fulminantes para colgantes", colg, "pza", "uno por colgante"],
              ["Tornillo para placa", placas * num(v.tor), "pza", `${up(placas * num(v.tor) / 1000)} caja(s) de 1000`],
              ["Cinta de refuerzo", fm(A * 1.1, 1), "m", `${up(A * 1.1 / 75)} rollo(s) de 75 m`],
              ["Compuesto", fm(comp, 1), "kg", `${up(comp / (num(v.cub) || 20))} cubeta(s) de ${v.cub} kg`]],
            notas: ["Colgantes a cada 1.22 m sobre la canaleta; reduce la separación si el plafón lleva luminarias o equipos pesados.", "Deja registros para instalaciones antes de cerrar el plafón."]
          };
        }
        const m2 = v.mod === "61x122";
        const mains = A / 1.22 * d, t122 = up(A * 1.344 * d), t61 = m2 ? 0 : up(A * 1.344 * d);
        const losetas = up(A * d / (m2 ? 0.7442 : 0.3721));
        const colg = up(A / 1.488) + up(per / 1.22 / 2);
        return {
          kpis: [["Área", `${fm(A)} m²`], ["Losetas", `${losetas}`], ["Colgantes", `${colg}`]],
          filas: [[`Losetas ${m2 ? "61 × 122" : "61 × 61"} cm`, losetas, "pza", ""],
            ["Tee principal 3.66 m", up(mains / 3.66), "pza", `${fm(mains, 1)} m @1.22 m`],
            ["Tee secundaria 1.22 m", t122, "pza", "@61 cm entre principales"],
            ...(m2 ? [] : [["Tee secundaria 0.61 m", t61, "pza", "cierra el módulo de 61 × 61"]]),
            ["Ángulo perimetral 3.05 m", up(per * 1.05 / 3.05), "pza", `${fm(per, 1)} m de perímetro`],
            ["Colgantes de alambre galvanizado", colg, "pza", `${fm(colg * (susp + 0.3), 1)} m de alambre, @1.22 m sobre principales`],
            ["Anclas o fulminantes", colg, "pza", "uno por colgante"]],
          notas: ["Inicia la retícula desde el centro del local para que los cortes perimetrales queden iguales y mayores a media loseta.", "Luminarias, difusores y rejillas llevan colgantes propios."]
        };
      }
    },

    dosificacion: {
      campos: [
        { k: "tipo", label: "Mezcla", def: "concreto", opts: [["concreto", "Concreto hecho en obra"], ["mortero", "Mortero"]] },
        { k: "vol", label: "Volumen (m³)", def: "1" },
        { k: "fc", label: "Resistencia buscada", def: "200", opts: [["100", "f'c ≈ 100 kg/cm² (plantillas, firmes ligeros)"], ["150", "f'c ≈ 150 kg/cm² (firmes, banquetas)"], ["200", "f'c ≈ 200 kg/cm² (castillos, dalas, losas ligeras)"], ["250", "f'c ≈ 250 kg/cm² (elementos estructurales)"], ["custom", "Proporción personalizada"]], show: (v) => v.tipo === "concreto" },
        { k: "pc", label: "Cemento (partes)", def: "1", show: (v) => v.tipo === "concreto" && v.fc === "custom" },
        { k: "pa", label: "Arena (partes)", def: "2", show: (v) => v.tipo === "concreto" && v.fc === "custom" },
        { k: "pg", label: "Grava (partes)", def: "3", show: (v) => v.tipo === "concreto" && v.fc === "custom" },
        { k: "ac", label: "Relación agua/cemento", def: "", show: (v) => v.tipo === "concreto" },
        { k: "prop", label: "Proporción del mortero", def: "1:4", opts: PROP_MORT, show: (v) => v.tipo === "mortero" },
        { k: "desp", label: "Desperdicio (%)", def: "5" },
        { k: "F", label: "Factor de volumen seco", def: "", ph: "1.54 concreto · 1.25 mortero" }],
      calc(v) {
        const conc = v.tipo === "concreto";
        const PRE = { "100": [1, 3, 5, 0.7], "150": [1, 2, 4, 0.62], "200": [1, 2, 3, 0.55], "250": [1, 1.5, 2.5, 0.5] };
        let P, ac;
        if (conc) {
          const p = v.fc === "custom" ? [num(v.pc) || 1, num(v.pa), num(v.pg), 0.55] : PRE[v.fc];
          P = { c: p[0], a: p[1], g: p[2] }; ac = num(v.ac) || p[3];
        } else P = partes(v.prop);
        const F = num(v.F) || (conc ? 1.54 : 1.25);
        const vol = num(v.vol) * (1 + num(v.desp) / 100);
        const D = dosifica(vol, P, F);
        const agua = conc ? D.cemKg * ac : vol * 230;
        const aguaB = conc ? 50 * ac : 230 * D.rindeBulto;
        const prop = conc ? `1 : ${fm(P.a, P.a % 1 ? 1 : 0)} : ${fm(P.g, P.g % 1 ? 1 : 0)}` : v.prop;
        const filas = [["Cemento (bulto de 50 kg)", fm(D.bultos, 1), "bultos", `${fm(D.cemKg, 0)} kg · pide ${up(D.bultos)} bultos`],
          ["Arena", fm(D.arena, 2), "m³", ""]];
        if (conc) filas.push(["Grava", fm(D.grava, 2), "m³", "tamaño máximo 3/4\" para elementos delgados"]);
        if (D.calKg) filas.push(["Cal hidratada (bulto de 25 kg)", fm(D.calKg / 25, 1), "bultos", `${fm(D.calKg, 0)} kg`]);
        filas.push(["Agua", fm(agua, 0), "L", conc ? `relación agua/cemento ${fm(ac, 2)}` : "aproximada; ajusta a la trabajabilidad"]);
        const recetaB = [`${fm(D.porBulto.arena, 1)} botes de arena`].concat(conc ? [`${fm(D.porBulto.grava, 1)} botes de grava`] : [], D.calKg ? [`${fm(D.porBulto.cal, 1)} botes de cal`] : [], [`${fm(aguaB, 0)} L de agua (${fm(aguaB / BOTE, 1)} botes)`]);
        return {
          kpis: [["Proporción", prop], ["Cemento", `${up(D.bultos)} bultos`], ["Cada bulto rinde", `${fm(D.rindeBulto, 3)} m³`]],
          filas, receta: { titulo: "Receta por bulto de cemento (botes de 19 L)", items: recetaB },
          notas: conc ? ["Proporciones por volumen orientativas para concreto hecho en obra con cemento CPC 30R. Para elementos estructurales confirma la resistencia con cilindros o usa concreto premezclado.",
            "Agrega primero parte del agua, luego grava, cemento y arena; completa el agua poco a poco. No agregues agua extra para hacerlo más manejable: baja la resistencia.",
            "Mezcla en revolvedora al menos 3 minutos por revoltura y cura el concreto 7 días."] :
            ["Junteo de block: 1:4 o 1:5. Aplanados exteriores: 1:4; interiores: 1:5 o cemento-cal-arena.", "Usa el mortero antes de 2 horas; no lo remezcles con agua cuando ya empezó a fraguar."]
        };
      }
    }
  };

  function morteroFilas(D, vol) {
    const f = [["Mortero", fm(vol, 3), "m³", "incluye desperdicio"], ["Cemento (bulto de 50 kg)", fm(D.bultos, 1), "bultos", `${fm(D.cemKg, 0)} kg · pide ${up(D.bultos)}`], ["Arena", fm(D.arena, 2), "m³", ""]];
    if (D.calKg) f.push(["Cal hidratada (bulto de 25 kg)", fm(D.calKg / 25, 1), "bultos", `${fm(D.calKg, 0)} kg`]);
    f.push(["Agua", fm(vol * 230, 0), "L", "aproximada"]);
    return f;
  }
  const porBultoTxt = (D) => `${fm(D.porBulto.arena, 1)} botes de 19 L de arena${D.calKg ? ` y ${fm(D.porBulto.cal, 1)} de cal` : ""}`;

  /* ---------- motor de interfaz ---------- */
  function mountFor(id) {
    return function (root) {
      const M = MODS[id], KEY = "obralab:mat:" + id;
      let v = {};
      try { v = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
      M.campos.forEach((c) => { if (v[c.k] == null) v[c.k] = c.def; });
      function render() {
        root.innerHTML = `<div class="mt"><div class="ac-grid">${M.campos.filter((c) => !c.show || c.show(v)).map((c) => `<label class="ac-f"><span>${esc(c.label)}</span>${c.opts ?
          `<select data-k="${c.k}">${c.opts.map(([o, l]) => `<option value="${esc(o)}"${String(v[c.k]) === o ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>` :
          `<input data-k="${c.k}" inputmode="decimal" value="${esc(v[c.k])}"${c.ph ? ` placeholder="${esc(c.ph)}"` : ""}>`}</label>`).join("")}</div>
          <div id="mt-out"></div>
          <div class="actions"><button class="btn ghost" type="button" data-mt="reset">Valores de ejemplo</button><button class="btn ghost" type="button" data-mt="csv">Exportar CSV</button></div></div>`;
        out();
      }
      let last = null;
      function out() {
        let R;
        try { R = M.calc(v); } catch (e) { R = null; }
        last = R;
        const o = root.querySelector("#mt-out");
        if (!R) { o.innerHTML = '<p class="ac-note">Revisa los datos capturados.</p>'; return; }
        o.innerHTML = `<div class="ac-kpis">${R.kpis.map(([l, x]) => `<span>${esc(l)}<b>${esc(x)}</b></span>`).join("")}</div>
          ${R.receta ? `<div class="mt-receta"><h4>${esc(R.receta.titulo)}</h4><ul>${R.receta.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
          <div class="ac-tw"><table class="ac-t"><thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Detalle</th></tr></thead><tbody>
          ${R.filas.map((f) => `<tr><td>${esc(f[0])}</td><td><b>${esc(f[1])}</b></td><td>${esc(f[2])}</td><td class="ac-con">${esc(f[3])}</td></tr>`).join("")}</tbody></table></div>
          <ul class="mt-notas">${R.notas.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
      }
      root.addEventListener("input", (ev) => {
        const k = ev.target.dataset.k; if (!k) return;
        v[k] = ev.target.value;
        try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
        if (ev.target.tagName === "SELECT") render(); else out();
      });
      root.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-mt]"); if (!b) return;
        if (b.dataset.mt === "reset") { v = {}; M.campos.forEach((c) => (v[c.k] = c.def)); try { localStorage.removeItem(KEY); } catch (e) {} render(); }
        if (b.dataset.mt === "csv" && last) {
          const rows = [["Material", "Cantidad", "Unidad", "Detalle"], ...last.filas];
          if (last.receta) rows.push([], [last.receta.titulo], ...last.receta.items.map((x) => [x]));
          const t = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = `materiales_${id}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        }
      });
      render();
    };
  }
  window.ObraModulos = window.ObraModulos || {};
  Object.keys(MODS).forEach((id) => (window.ObraModulos[id] = mountFor(id)));
  window.ObraModulos._matTest = { MODS, dosifica };
})();
