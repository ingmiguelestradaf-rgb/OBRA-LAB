// Valida los datos de ObraLab antes de publicar: node tools/validar.mjs
import { readFileSync, existsSync } from "node:fs";
const H = JSON.parse(readFileSync(new URL("../data/herramientas.json", import.meta.url))).herramientas;
const U = JSON.parse(readFileSync(new URL("../data/actualizaciones.json", import.meta.url))).actualizaciones;
const errs = [];
// carga los módulos en un entorno simulado para saber cuáles quedan registrados
import { readdirSync } from "node:fs";
import vm from "node:vm";
const MODULOS = new Set();
{
  const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {} }, console };
  vm.createContext(ctx);
  for (const f of readdirSync(new URL("../modulos/", import.meta.url)).filter((x) => x.endsWith(".js")))
    vm.runInContext(readFileSync(new URL("../modulos/" + f, import.meta.url), "utf8"), ctx);
  Object.keys(ctx.window.ObraModulos || {}).filter((k) => !k.startsWith("_")).forEach((k) => MODULOS.add(k));
}
const ids = new Set();
const TIPOS = ["calculadora", "formato", "calidad", "metodo", "recurso"];
for (const t of H) {
  const w = (m) => errs.push(`${t.id || "(sin id)"}: ${m}`);
  for (const k of ["id", "tipo", "categoria", "titulo", "resumen", "agregada"]) if (!t[k]) w(`falta ${k}`);
  if (ids.has(t.id)) w("id duplicado"); ids.add(t.id);
  if (!TIPOS.includes(t.tipo)) w(`tipo inválido ${t.tipo}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.agregada || "")) w("fecha agregada inválida");
  if (!Array.isArray(t.como_usar) || t.como_usar.length < 2) w("como_usar necesita al menos 2 pasos");
  if (t.modulo) {
    if (!MODULOS.has(t.modulo)) w(`ningún archivo de modulos/ registra el módulo "${t.modulo}"`);
  } else if (t.tipo === "calculadora") {
    const ins = t.entradas || [], outs = t.salidas || [];
    if (!ins.length || !outs.length) w("calculadora sin entradas o salidas");
    const names = ins.map((e) => e.id), vals = ins.map((e) => e.valor);
    for (const s of outs) {
      try { const v = new Function(...names, `return (${s.formula})`)(...vals);
        if (!Number.isFinite(v)) w(`salida "${s.label}" no da número con los valores de ejemplo`);
      } catch (e) { w(`fórmula "${s.label}" con error: ${e.message}`); }
    }
  }
  if ((t.tipo === "formato" || t.tipo === "calidad") && (!t.campos?.length || !t.items?.length)) w("formato sin campos o items");
  if (t.tipo === "recurso" && !t.url) w("recurso sin url");
}
for (const u of U) {
  if (!u.fecha || !u.titulo || !u.resumen) errs.push(`actualización ${u.fecha}: faltan datos`);
  for (const id of u.herramientas || []) if (!ids.has(id)) errs.push(`actualización ${u.fecha}: id desconocido ${id}`);
}
if (errs.length) { console.error("ERRORES:\n" + errs.join("\n")); process.exit(1); }
console.log(`OK · ${H.length} herramientas · ${U.length} actualizaciones`);
