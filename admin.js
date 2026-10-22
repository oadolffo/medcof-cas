/* Painel — módulos v2: mapa do Brasil, contratos, postagens, reuniões, engajamento */
const PASTA_CONTRATOS = "https://drive.google.com/drive/folders/12bf5l1rHg7vazrCOs11Cau4Atl9qxMkw";
const NEGOCIACAO = ["interesse", "novo", "contato", "reuniao", "proposta"];
const CT_TIPO = { parceria_anual_CA: "Parceria anual", patrocinio_evento: "Patrocínio de evento", "patrocinio_evento (híbrido)": "Evento + anual" };
const REU_ST = { solicitada: "Solicitada pelo CA", agendada: "Agendada", realizada: "Realizada", cancelada: "Cancelada" };
const REU_B = { solicitada: "b-proposta", agendada: "b-novo", realizada: "b-ativa", cancelada: "b-pausada" };

window.loadExtra = async function () {
  const [k, m, p, r] = await Promise.all([
    sb.from("ca_contratos").select("*").order("vigencia_fim", { ascending: false }),
    sb.from("ca_metas_post").select("*"),
    sb.from("ca_posts").select("*").order("data_post", { ascending: false }),
    sb.from("ca_reunioes").select("*").order("data_hora"),
  ]);
  S.contratos = k.data || []; S.metas = m.data || []; S.posts = p.data || []; S.reunioes = r.data || [];
  const venc = S.contratos.filter((c) => { const d = daysUntil(c.vigencia_fim); return d !== null && d >= 0 && d <= 60; }).length;
  const postPend = S.posts.filter((x) => x.status === "enviado").length;
  const reuSol = S.reunioes.filter((x) => x.status === "solicitada").length;
  const setC = (id, n) => $$(id).forEach((el) => { el.textContent = n; el.classList.toggle("hidden", !n); });
  setC("#ctCount", venc); setC("#postCount", postPend); setC("#reuCount", reuSol);
};

const contratoVigente = (cid) => S.contratos.filter((k) => k.centro_id === cid && daysUntil(k.vigencia_fim) >= 0).sort((a, b) => (a.vigencia_fim || "").localeCompare(b.vigencia_fim || ""))[0];
const scoreClass = (s) => (s >= 75 ? "s-a" : s >= 50 ? "s-b" : s >= 30 ? "s-c" : "s-d");
const scoreOf = (c) => engajamento(c, { eventos: S.eventos, posts: S.posts, metas: S.metas, reunioes: S.reunioes });
const atrasos = () => S.cas.flatMap((c) => statusMetas(S.metas.filter((m) => m.centro_id === c.id), S.posts.filter((p) => p.centro_id === c.id))
  .filter((s) => s.vigente && s.falta > 0 && s.dias !== null && s.dias <= 7).map((s) => ({ ...s, c })));

/* ---------- alertas na visão geral ---------- */
window.homeExtra = function () {
  const venc = S.contratos.filter((k) => { const d = daysUntil(k.vigencia_fim); return d !== null && d >= -15 && d <= 60; }).sort((a, b) => a.vigencia_fim.localeCompare(b.vigencia_fim));
  const at = atrasos().sort((a, b) => a.dias - b.dias);
  const reu = S.reunioes.filter((r) => r.status !== "cancelada" && new Date(r.data_hora) >= new Date(Date.now() - 3600e3) && (new Date(r.data_hora) - Date.now()) / 86400000 <= 14);
  const interesses = S.cas.filter((c) => c.status === "interesse");
  const li = (onclick, ic, t, sub, cls = "") => `<div class="li" onclick="${onclick}"><span>${ic}</span><div style="flex:1;min-width:0"><div class="t">${t}</div><div class="small ${cls || "muted"}">${sub}</div></div></div>`;
  return `<div class="two" style="margin-top:14px">
    <div class="card"><div class="row"><h3 style="margin:0;font-size:16px">Contratos vencendo (60 dias)</h3><span class="spacer"></span><button class="btn sm ghost" onclick="go('contratos')">Ver contratos</button></div>
      <div class="list">${venc.map((k) => { const c = caById(k.centro_id) || {}; const d = daysUntil(k.vigencia_fim); return li(`openCA('${k.centro_id}','contrato')`, "📄", `${esc(c.sigla || "?")} · ${esc(CT_TIPO[k.tipo] || k.tipo || "")} · ${fmtBRL(k.valor_total)}`, d < 0 ? `encerrou há ${-d}d — renovar?` : `vence em ${d}d · ${fmtDate(k.vigencia_fim)}`, d <= 15 ? "late" : ""); }).join("") || `<div class="empty">Nenhum contrato vencendo</div>`}</div></div>
    <div class="card"><div class="row"><h3 style="margin:0;font-size:16px">Postagens a vencer / atrasadas</h3><span class="spacer"></span><button class="btn sm ghost" onclick="go('postagens')">Ver postagens</button></div>
      <div class="list">${at.slice(0, 10).map((s) => li(`openCA('${s.c.id}','postagens')`, "📸", `${esc(s.c.sigla)} · falta ${s.falta}× ${esc(TIPOS_POST[s.tipo] || s.tipo)} ${s.label}`, s.dias < 0 ? "vencido" : `vence em ${s.dias}d`, s.dias <= 3 ? "late" : "")).join("") || `<div class="empty">Tudo em dia</div>`}</div></div>
  </div>
  <div class="two" style="margin-top:14px">
    <div class="card"><div class="row"><h3 style="margin:0;font-size:16px">Reuniões (14 dias)</h3><span class="spacer"></span>${canWrite() ? `<button class="btn sm" onclick="openReuniao()">＋ Agendar</button>` : ""}</div>
      <div class="list">${reu.map((r) => { const c = caById(r.centro_id) || {}; return li(`openReuniao('${r.id}')`, r.status === "solicitada" ? "🙋" : "🤝", `${esc(c.sigla || "")} · ${esc(r.titulo)}`, `${fmtDateTime(r.data_hora)} · ${REU_ST[r.status]}`, r.status === "solicitada" ? "late" : ""); }).join("") || `<div class="empty">Sem reuniões nos próximos 14 dias</div>`}</div></div>
    <div class="card"><h3 style="font-size:16px">Novos interessados</h3>
      <div class="list">${interesses.map((c) => li(`openCA('${c.id}')`, "🤝", `${esc(c.sigla)} · ${esc(c.faculdade || "")}`, `${esc(c.cidade || "")}/${esc(c.uf || "")} · ${esc(c.rep_nome || "")} · ${fmtDate(c.created_at)}`)).join("") || `<div class="empty">Nenhum interesse novo</div>`}</div></div>
  </div>`;
};

/* ---------- MAPA ---------- */
let MAP = null, MAPF = { regiao: "", tipo: "", rel: "" };
async function renderMapa() {
  const escolas = await loadEscolas();
  const relacao = new Map(); // escola.id -> [CAs]
  const semEscola = [];
  for (const c of S.cas) {
    const e = matchEscola(escolas, c);
    if (e) { if (!relacao.has(e.id)) relacao.set(e.id, []); relacao.get(e.id).push(c); } else semEscola.push(c);
  }
  const relOf = (e) => { const cs = relacao.get(e.id) || []; if (cs.some((c) => c.status === "ativa")) return "ativa"; if (cs.some((c) => NEGOCIACAO.includes(c.status))) return "negociacao"; if (cs.length) return "antiga"; return "nenhuma"; };
  const COR = { ativa: "#16a34a", negociacao: "#f59e0b", antiga: "#94a3b8", nenhuma: "#6366f1" };
  const REL_L = { ativa: "Parceria ativa", negociacao: "Em negociação / interesse", antiga: "Já foi parceiro", nenhuma: "Sem relação ainda" };
  const reg = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
  const stats = reg.map((r) => { const es = escolas.filter((e) => e.regiao === r); const at = es.filter((e) => relOf(e) === "ativa"); return { r, n: es.length, vagas: es.reduce((a, e) => a + (e.vagas || 0), 0), ativas: at.length, vagasAt: at.reduce((a, e) => a + (e.vagas || 0), 0), neg: es.filter((e) => relOf(e) === "negociacao").length }; });
  const tot = { n: escolas.length, vagas: escolas.reduce((a, e) => a + (e.vagas || 0), 0) };
  const ativasN = escolas.filter((e) => relOf(e) === "ativa"), vagasAt = ativasN.reduce((a, e) => a + (e.vagas || 0), 0);
  const filtradas = () => escolas.filter((e) => (!MAPF.regiao || e.regiao === MAPF.regiao) && (!MAPF.tipo || e.tipo === MAPF.tipo) && (!MAPF.rel || relOf(e) === MAPF.rel));
  const oport = escolas.filter((e) => relOf(e) === "nenhuma" && (!MAPF.regiao || e.regiao === MAPF.regiao) && (!MAPF.tipo || e.tipo === MAPF.tipo)).slice(0, 25);

  $("#main").innerHTML = `
  <div class="topbar"><h1>Mapa do Brasil</h1><span class="muted">${tot.n} escolas médicas · ${tot.vagas.toLocaleString("pt-BR")} vagas/ano</span></div>
  <div class="kpis">
    <div class="kpi"><div class="v">${ativasN.length}</div><div class="l">Escolas com parceria ativa</div></div>
    <div class="kpi"><div class="v">${tot.vagas ? Math.round((vagasAt / tot.vagas) * 1000) / 10 : 0}%</div><div class="l">Das vagas do país cobertas</div></div>
    <div class="kpi"><div class="v" style="color:var(--warn)">${escolas.filter((e) => relOf(e) === "negociacao").length}</div><div class="l">Em negociação / interesse</div></div>
    <div class="kpi"><div class="v" style="color:var(--info)">${escolas.filter((e) => relOf(e) === "nenhuma").length}</div><div class="l">Escolas sem relação</div></div>
  </div>
  <div class="filters">
    <select onchange="MAPF.regiao=this.value;renderMapa()"><option value="">Todas as regiões</option>${reg.map((r) => `<option ${MAPF.regiao === r ? "selected" : ""}>${r}</option>`).join("")}</select>
    <select onchange="MAPF.tipo=this.value;renderMapa()"><option value="">Pública e privada</option><option ${MAPF.tipo === "Pública" ? "selected" : ""}>Pública</option><option ${MAPF.tipo === "Privada" ? "selected" : ""}>Privada</option></select>
    <select onchange="MAPF.rel=this.value;renderMapa()"><option value="">Todas as situações</option>${Object.entries(REL_L).map(([k, l]) => `<option value="${k}" ${MAPF.rel === k ? "selected" : ""}>${l}</option>`).join("")}</select>
  </div>
  <div class="legend">${Object.entries(REL_L).map(([k, l]) => `<span><i style="background:${COR[k]}"></i>${l}</span>`).join("")}<span class="muted">· tamanho do círculo = vagas por ano</span></div>
  <div id="map" class="map"></div>
  <div class="two" style="margin-top:14px">
    <div class="card"><h3 style="font-size:16px">Por região</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Região</th><th>Escolas</th><th>Vagas/ano</th><th>Parceiros</th><th>Negociação</th><th>Cobertura</th></tr></thead><tbody>
      ${stats.map((s) => `<tr class="click" onclick="MAPF.regiao='${s.r}';renderMapa()"><td><b>${s.r}</b></td><td>${s.n}</td><td>${s.vagas.toLocaleString("pt-BR")}</td><td>${s.ativas}</td><td>${s.neg}</td><td>${s.vagas ? Math.round((s.vagasAt / s.vagas) * 100) : 0}%</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h3 style="font-size:16px">Maiores oportunidades <span class="muted small">· sem relação, por nº de vagas</span></h3><div class="list">
      ${oport.map((e) => `<div class="li" onclick="mapFocus(${e.id})"><b style="width:34px" class="muted">#${e.rank}</b><div style="flex:1;min-width:0"><div class="t">${esc(e.sigla ? e.sigla + " · " : "")}${esc(e.nome)}</div><div class="small muted">${esc(e.cidade)}/${e.uf} · ${e.tipo} · ${e.vagas ?? "?"} vagas/ano</div></div>
        ${canWrite() ? `<button class="btn sm" onclick="event.stopPropagation();prospectar(${e.id})">＋ Prospectar</button>` : ""}</div>`).join("")}</div></div>
  </div>
  ${semEscola.length ? `<p class="small muted">CAs sem escola identificada no mapa: ${semEscola.map((c) => `<a href="#" onclick="openCA('${c.id}','dados');return false">${esc(c.sigla)}</a>`).join(", ")} — confira cidade/UF/faculdade no cadastro.</p>` : ""}`;

  if (MAP) { MAP.remove(); MAP = null; }
  MAP = L.map("map", { scrollWheelZoom: true }).setView([-14.5, -51.5], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { attribution: "© OpenStreetMap · © CARTO", maxZoom: 18 }).addTo(MAP);
  window._mapMarkers = {};
  const list = filtradas().sort((a, b) => (b.vagas || 0) - (a.vagas || 0));
  for (const e of list) {
    const rel = relOf(e), cs = relacao.get(e.id) || [];
    const jitter = (e.id % 7) * 0.004;
    const m = L.circleMarker([e.lat + jitter, e.lng + jitter], { radius: 3 + Math.sqrt(e.vagas || 30) / 2.2, color: "#fff", weight: 1, fillColor: COR[rel], fillOpacity: rel === "nenhuma" ? 0.55 : 0.9 }).addTo(MAP);
    m.bindPopup(`<b>${esc(e.nome)}</b><br>${esc(e.cidade)}/${e.uf} · ${e.tipo}${e.esfera && e.esfera !== "privada" ? " (" + e.esfera + ")" : ""}<br>${e.vagas ?? "?"} vagas/ano · #${e.rank} do país${e.ano ? " · desde " + e.ano : ""}
      <br><b style="color:${COR[rel]}">${REL_L[rel]}</b>${cs.map((c) => `<br><a href="#" onclick="openCA('${c.id}');return false">${esc(c.sigla)}</a> · ${STATUS_CA[c.status]}`).join("")}
      ${!cs.length && canWrite() ? `<br><a href="#" onclick="prospectar(${e.id});return false">＋ Criar CA para prospectar</a>` : ""}`);
    window._mapMarkers[e.id] = m;
  }
}
function mapFocus(id) { const m = window._mapMarkers?.[id]; if (m) { MAP.setView(m.getLatLng(), 9); m.openPopup(); window.scrollTo({ top: 0, behavior: "smooth" }); } }
async function prospectar(id) {
  const e = (await loadEscolas()).find((x) => x.id === id); if (!e) return;
  const sigla = prompt(`Sigla do CA/DA da ${e.sigla || e.nome} (pode ajustar depois):`, "CA " + (e.sigla || "")); if (!sigla) return;
  const { data, error } = await sb.from("ca_centros").insert({ sigla: sigla.toUpperCase(), nome: sigla, faculdade: e.nome, cidade: e.cidade, uf: e.uf, regiao: e.regiao, escola_ref: String(e.id), lat: e.lat, lng: e.lng, status: "contato", origem: "Prospecção (mapa)", responsavel_id: S.user.id }).select().single();
  if (error) return toast(errMsg(error));
  await sb.from("ca_atividades").insert({ centro_id: data.id, tipo: "nota", descricao: `Prospecção iniciada pelo mapa (${e.nome})`, autor_id: S.user.id });
  await refresh(); openCA(data.id, "dados");
}
Object.assign(window, { renderMapa, mapFocus, prospectar, MAPF });

/* ---------- CONTRATOS ---------- */
let CTF = { q: "", sit: "vigentes" };
function renderContratos() {
  const list = S.contratos.filter((k) => {
    const c = caById(k.centro_id) || {}; const d = daysUntil(k.vigencia_fim);
    return (!CTF.q || [c.sigla, c.nome, c.faculdade, k.titulo].join(" ").toLowerCase().includes(CTF.q.toLowerCase())) &&
      (CTF.sit === "todos" || (CTF.sit === "vigentes" ? d >= 0 : CTF.sit === "vencendo" ? d >= 0 && d <= 60 : d < 0));
  }).sort((a, b) => (a.vigencia_fim || "").localeCompare(b.vigencia_fim || ""));
  const vig = S.contratos.filter((k) => daysUntil(k.vigencia_fim) >= 0);
  const ano = new Date().getFullYear();
  $("#main").innerHTML = `
  <div class="topbar"><h1>Contratos</h1><span class="muted">visível só para a equipe</span><span class="spacer"></span>
    <a class="btn" href="${PASTA_CONTRATOS}" target="_blank">📁 Pasta dos contratos</a>${canWrite() ? `<button class="btn primary" onclick="openContrato()">＋ Novo contrato</button>` : ""}</div>
  <div class="kpis">
    <div class="kpi"><div class="v">${vig.length}</div><div class="l">Contratos vigentes</div></div>
    <div class="kpi"><div class="v">${fmtBRL(vig.reduce((a, k) => a + (+k.valor_total || 0), 0))}</div><div class="l">Valor dos vigentes</div></div>
    <div class="kpi"><div class="v">${fmtBRL(S.contratos.filter((k) => (k.data_assinatura || k.vigencia_inicio || "").startsWith(String(ano))).reduce((a, k) => a + (+k.valor_total || 0), 0))}</div><div class="l">Contratado em ${ano}</div></div>
    <div class="kpi"><div class="v" style="color:var(--warn)">${vig.filter((k) => daysUntil(k.vigencia_fim) <= 60).length}</div><div class="l">Vencem em 60 dias</div></div>
  </div>
  <div class="filters"><input type="search" placeholder="Buscar CA, faculdade, contrato…" value="${esc(CTF.q)}" oninput="CTF.q=this.value;renderContratos()">
    <select onchange="CTF.sit=this.value;renderContratos()">${[["vigentes", "Vigentes"], ["vencendo", "Vencendo (60d)"], ["encerrados", "Encerrados"], ["todos", "Todos"]].map(([k, l]) => `<option value="${k}" ${CTF.sit === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>CA</th><th>Tipo</th><th>Valor</th><th>Vigência</th><th>Postagens</th><th></th></tr></thead><tbody>
  ${list.map((k) => {
    const c = caById(k.centro_id) || {}; const d = daysUntil(k.vigencia_fim);
    const st = statusMetas(S.metas.filter((m) => m.contrato_id === k.id), S.posts.filter((p) => p.centro_id === k.centro_id));
    const req = st.reduce((a, s) => a + (s.quantidade || 0), 0), feito = st.reduce((a, s) => a + Math.min(s.feitos, s.quantidade || 0), 0);
    return `<tr class="click" onclick="openCA('${k.centro_id}','contrato')"><td><b>${esc(c.sigla || "?")}</b><div class="small muted">${esc(c.faculdade || "")}</div></td>
      <td class="small">${esc(CT_TIPO[k.tipo] || k.tipo || "")}${k.cota ? ` · ${esc(k.cota)}` : ""}</td><td><b>${fmtBRL(k.valor_total)}</b></td>
      <td class="small">${fmtDate(k.vigencia_inicio)} → ${fmtDate(k.vigencia_fim)}<div class="${d !== null && d <= 30 && d >= 0 ? "late" : "muted"}">${d === null ? "" : d < 0 ? "encerrado" : `faltam ${d} dias`}</div></td>
      <td class="small" style="min-width:120px">${req ? `<div class="prog"><span style="width:${Math.round((feito / req) * 100)}%"></span></div>${feito}/${req} no período` : `<span class="muted">sem metas</span>`}</td>
      <td>${k.drive_url ? `<a class="btn sm" href="${esc(k.drive_url)}" target="_blank" onclick="event.stopPropagation()">PDF</a>` : ""}</td></tr>`;
  }).join("") || `<tr><td colspan="6" class="empty">Nenhum contrato</td></tr>`}</tbody></table></div>`;
}
function openContrato(id, centroId) {
  const k = id ? S.contratos.find((x) => x.id === id) : { centro_id: centroId || "", tipo: "parceria_anual_CA" };
  const metas = id ? S.metas.filter((m) => m.contrato_id === id) : [];
  const metaRow = (m = {}) => `<div class="row meta-row" style="margin-bottom:6px"><input type="number" min="1" name="mq" value="${m.quantidade || 1}" style="width:70px">
    <select name="mt" style="width:auto">${Object.keys(TIPOS_POST).map((t) => `<option value="${t}" ${m.tipo === t ? "selected" : ""}>${TIPOS_POST[t]}</option>`).join("")}</select>
    <select name="mp" style="width:auto">${[["mensal", "por mês"], ["semanal", "por semana"], ["total", "no contrato todo"]].map(([v, l]) => `<option value="${v}" ${m.periodicidade === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    <button type="button" class="btn sm ghost danger" onclick="this.parentElement.remove()">✕</button></div>`;
  $("#modalRoot").innerHTML = `<div class="modal" onclick="if(event.target===this)this.remove()"><div class="card" style="max-width:720px">
  <h2 style="font-size:18px">${id ? "Editar contrato" : "Novo contrato"}</h2>
  <p class="small muted" style="margin-top:-6px">Salve o PDF assinado na <a href="${PASTA_CONTRATOS}" target="_blank">pasta dos contratos</a> e cole o link aqui.</p>
  <form id="ctForm"><div class="grid g2">
    <div><label>CA *</label><select name="centro_id" required><option value="">—</option>${[...S.cas].sort((a, b) => a.sigla.localeCompare(b.sigla)).map((c) => `<option value="${c.id}" ${k.centro_id === c.id ? "selected" : ""}>${esc(c.sigla)} · ${esc(c.faculdade || "")}</option>`).join("")}</select></div>
    <div><label>Tipo</label><select name="tipo">${Object.entries(CT_TIPO).map(([v, l]) => `<option value="${v}" ${k.tipo === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div><label>Valor total (R$)</label><input name="valor_total" inputmode="decimal" value="${k.valor_total ?? ""}"></div>
    <div><label>Cota / pacote</label><input name="cota" value="${esc(k.cota || "")}"></div>
    <div><label>Início da vigência</label><input type="date" name="vigencia_inicio" value="${k.vigencia_inicio || ""}"></div>
    <div><label>Fim da vigência *</label><input type="date" name="vigencia_fim" required value="${k.vigencia_fim || ""}"></div>
    <div style="grid-column:span 2"><label>Forma de pagamento</label><input name="forma_pagamento" value="${esc(k.forma_pagamento || "")}"></div>
    <div style="grid-column:span 2"><label>Link do PDF no Drive</label><input name="drive_url" type="url" value="${esc(k.drive_url || "")}"></div>
    <div style="grid-column:span 2"><label>Contrapartidas da MedCof (uma por linha)</label><textarea name="contrapartidas">${esc((k.contrapartidas || []).join("\n"))}</textarea></div>
    <div style="grid-column:span 2"><label>Obrigações do CA (uma por linha)</label><textarea name="obrigacoes">${esc((k.obrigacoes || []).join("\n"))}</textarea></div>
    <div><label>Exclusividade</label><input name="exclusividade" value="${esc(k.exclusividade || "")}"></div><div><label>Renovação</label><input name="renovacao" value="${esc(k.renovacao || "")}"></div>
    <div style="grid-column:span 2"><label>Peculiaridades / observações</label><textarea name="notas">${esc(k.notas || (k.peculiaridades || []).join("\n"))}</textarea></div>
  </div>
  <label style="margin-top:12px">Metas de postagem (aparecem para o CA com os prazos)</label><div id="metasBox">${metas.map(metaRow).join("")}</div>
  <button type="button" class="btn sm" id="addMeta">＋ Meta</button>
  <div class="row" style="margin-top:16px"><button class="btn primary">Salvar</button><button type="button" class="btn ghost" onclick="this.closest('.modal').remove()">Cancelar</button>${id && isOwner() ? `<span class="spacer"></span><button type="button" class="btn danger sm" onclick="delContrato('${id}')">Excluir</button>` : ""}</div></form></div></div>`;
  $("#addMeta").addEventListener("click", () => $("#metasBox").insertAdjacentHTML("beforeend", metaRow()));
  $("#ctForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const o = formToObject(e.target);
    const lines = (t) => (t || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const row = { centro_id: o.centro_id, tipo: o.tipo, cota: o.cota || null, valor_total: o.valor_total ? +String(o.valor_total).replace(/\./g, "").replace(",", ".") : null,
      vigencia_inicio: o.vigencia_inicio || null, vigencia_fim: o.vigencia_fim || null, forma_pagamento: o.forma_pagamento || null, drive_url: o.drive_url || null,
      contrapartidas: lines(o.contrapartidas), obrigacoes: lines(o.obrigacoes), exclusividade: o.exclusividade || null, renovacao: o.renovacao || null, notas: o.notas || null,
      titulo: k.titulo || `Contrato ${caById(o.centro_id)?.sigla || ""}` };
    const q = id ? sb.from("ca_contratos").update(row).eq("id", id).select().single() : sb.from("ca_contratos").insert(row).select().single();
    const { data, error } = await q; if (error) return toast(errMsg(error));
    const ms = $$(".meta-row", e.target).map((r) => ({ centro_id: o.centro_id, contrato_id: data.id, quantidade: +r.querySelector("[name=mq]").value || 1, tipo: r.querySelector("[name=mt]").value, periodicidade: r.querySelector("[name=mp]").value, inicio: row.vigencia_inicio, fim: row.vigencia_fim }));
    if (id) await sb.from("ca_metas_post").delete().eq("contrato_id", id);
    if (ms.length) await sb.from("ca_metas_post").insert(ms);
    if (daysUntil(row.vigencia_fim) >= 0 && caById(o.centro_id)?.status !== "ativa") await sb.from("ca_centros").update({ status: "ativa" }).eq("id", o.centro_id);
    await sb.from("ca_atividades").insert({ centro_id: o.centro_id, tipo: "nota", descricao: (id ? "Contrato atualizado" : "Contrato cadastrado") + ` · ${fmtBRL(row.valor_total)} · até ${fmtDate(row.vigencia_fim)}`, autor_id: S.user.id });
    $("#modalRoot").innerHTML = ""; toast("Contrato salvo"); refresh();
  });
}
async function delContrato(id) { if (!confirm("Excluir este contrato e suas metas?")) return; await sb.from("ca_contratos").delete().eq("id", id); $("#modalRoot").innerHTML = ""; refresh(); }
Object.assign(window, { renderContratos, openContrato, delContrato, CTF });

/* ---------- POSTAGENS ---------- */
let PF = { st: "enviado" };
function renderPostagens() {
  const list = S.posts.filter((p) => !PF.st || p.status === PF.st);
  const at = atrasos().sort((a, b) => a.dias - b.dias);
  $("#main").innerHTML = `<div class="topbar"><h1>Postagens dos CAs</h1><span class="spacer"></span>
    <select style="width:auto" onchange="PF.st=this.value;renderPostagens()">${[["enviado", "Para validar"], ["validado", "Validadas"], ["recusado", "Recusadas"], ["", "Todas"]].map(([k, l]) => `<option value="${k}" ${PF.st === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="two"><div class="card"><h3 style="font-size:16px">Registradas pelos CAs</h3><div class="list">${list.map(postLine).join("") || `<div class="empty">Nada aqui</div>`}</div></div>
  <div class="card"><h3 style="font-size:16px">Prazos vencendo / atrasados (7 dias)</h3><div class="list">${at.map((s) => `<div class="li" onclick="openCA('${s.c.id}','postagens')"><span>⏰</span><div style="flex:1"><div class="t">${esc(s.c.sigla)} · ${s.falta}× ${esc(TIPOS_POST[s.tipo] || s.tipo)} ${s.label}</div><div class="small ${s.dias <= 3 ? "late" : "muted"}">${s.dias < 0 ? "vencido" : "vence em " + s.dias + "d"} · ${s.feitos}/${s.quantidade} feitos</div></div>
    ${waLink(s.c.rep_whatsapp) ? `<a class="btn sm" target="_blank" onclick="event.stopPropagation()" href="${waLink(s.c.rep_whatsapp, `Oi, ${(s.c.rep_nome || "").split(" ")[0]}! Lembrete da parceria MedCof: falta ${s.falta} ${TIPOS_POST[s.tipo] || s.tipo} ${s.label} (vence em ${Math.max(0, s.dias)} dias). Depois é só registrar o link na Área do CA: ${location.origin}/ca`)}">💬 Lembrar</a>` : ""}</div>`).join("") || `<div class="empty">Tudo em dia</div>`}</div></div></div>`;
}
function postLine(p) {
  const c = caById(p.centro_id) || {};
  return `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="t">${esc(c.sigla || "")} · ${esc(TIPOS_POST[p.tipo] || p.tipo)} · ${fmtDate(p.data_post)}</div>
    <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(p.link)}" target="_blank">${esc(p.link)}</a>${p.descricao ? " · " + esc(p.descricao) : ""}</div></div>
    ${canWrite() && p.status === "enviado" ? `<button class="btn sm" onclick="setPost('${p.id}','validado')">✔</button><button class="btn sm ghost danger" onclick="setPost('${p.id}','recusado')">✕</button>` : `<span class="badge ${p.status === "validado" ? "b-ativa" : p.status === "recusado" ? "b-perdida" : "b-novo"}">${p.status}</span>`}</div>`;
}
async function setPost(id, st) { const { error } = await sb.from("ca_posts").update({ status: st }).eq("id", id); if (error) return toast(errMsg(error)); await loadExtra(); go(S.view); }
Object.assign(window, { renderPostagens, setPost, PF });

/* ---------- REUNIÕES ---------- */
function renderReunioes() {
  const fut = S.reunioes.filter((r) => new Date(r.data_hora) >= new Date(Date.now() - 3600e3) && r.status !== "cancelada");
  const pas = S.reunioes.filter((r) => new Date(r.data_hora) < new Date(Date.now() - 3600e3)).reverse().slice(0, 40);
  const line = (r) => { const c = caById(r.centro_id) || {}; const d = new Date(r.data_hora); return `<div class="cal-item click" onclick="openReuniao('${r.id}')"><div class="cal-date"><b>${String(d.getDate()).padStart(2, "0")}</b><span class="small muted">${["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][d.getMonth()]}</span></div>
    <div style="flex:1;min-width:0"><div style="font-weight:600">${esc(c.sigla || "")} · ${esc(r.titulo)}</div><div class="small muted">${d.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}${r.link ? " · com link" : ""}</div></div><span class="badge ${REU_B[r.status]}">${REU_ST[r.status]}</span></div>`; };
  $("#main").innerHTML = `<div class="topbar"><h1>Reuniões</h1><span class="muted">aparecem também na Área do CA</span><span class="spacer"></span>${canWrite() ? `<button class="btn primary" onclick="openReuniao()">＋ Agendar reunião</button>` : ""}</div>
  <div class="two"><div class="card"><h3 style="font-size:16px">Próximas e solicitadas</h3>${fut.map(line).join("") || `<div class="empty">Nenhuma</div>`}</div>
  <div class="card"><h3 style="font-size:16px">Anteriores</h3>${pas.map(line).join("") || `<div class="empty">—</div>`}</div></div>`;
}
function openReuniao(id, centroId) {
  const r = id ? S.reunioes.find((x) => x.id === id) : { centro_id: centroId || "", titulo: "Reunião de alinhamento", duracao_min: 45, status: "agendada" };
  const local = r.data_hora ? new Date(new Date(r.data_hora).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const c = caById(r.centro_id) || {};
  $("#modalRoot").innerHTML = `<div class="modal" onclick="if(event.target===this)this.remove()"><div class="card" style="max-width:620px">
  <h2 style="font-size:18px">${id ? "Reunião" : "Agendar reunião"}${r.status === "solicitada" ? ` <span class="badge b-proposta">solicitada pelo CA</span>` : ""}</h2>
  <form id="reuF"><div class="grid g2">
    <div style="grid-column:span 2"><label>CA *</label><select name="centro_id" required ${canWrite() ? "" : "disabled"}><option value="">—</option>${[...S.cas].sort((a, b) => a.sigla.localeCompare(b.sigla)).map((x) => `<option value="${x.id}" ${r.centro_id === x.id ? "selected" : ""}>${esc(x.sigla)} · ${esc(x.faculdade || "")}</option>`).join("")}</select></div>
    <div style="grid-column:span 2"><label>Assunto *</label><input name="titulo" required value="${esc(r.titulo || "")}"></div>
    <div><label>Data e hora *</label><input type="datetime-local" name="data_hora" required value="${local}"></div>
    <div><label>Duração (min)</label><input type="number" name="duracao_min" value="${r.duracao_min || 45}"></div>
    <div style="grid-column:span 2"><label>Link (Meet/Zoom) ou local</label><input name="link" value="${esc(r.link || r.local || "")}"></div>
    <div><label>Status</label><select name="status">${Object.entries(REU_ST).map(([k, l]) => `<option value="${k}" ${r.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div></div>
    <div style="grid-column:span 2"><label>Pauta</label><textarea name="pauta">${esc(r.pauta || "")}</textarea></div>
    <div style="grid-column:span 2"><label>Ata / resumo (depois da reunião)</label><textarea name="ata">${esc(r.ata || "")}</textarea></div>
  </div><div class="row" style="margin-top:14px">${canWrite() ? `<button class="btn primary">${r.status === "solicitada" ? "Confirmar" : "Salvar"}</button>` : ""}
    ${id ? `<a class="btn" target="_blank" href="${gcalLink(r, c.sigla)}">📅 Google Agenda</a>` : ""}
    ${id && waLink(c.rep_whatsapp) ? `<a class="btn" target="_blank" href="${waLink(c.rep_whatsapp, `Oi, ${(c.rep_nome || "").split(" ")[0]}! Reunião MedCof × ${c.sigla}: ${fmtDateTime(r.data_hora)}${r.link ? " · " + r.link : ""}. Também aparece na Área do CA: ${location.origin}/ca`)}">💬 Avisar CA</a>` : ""}
    <span class="spacer"></span>${id && canWrite() ? `<button type="button" class="btn danger sm" onclick="delReuniao('${id}')">Excluir</button>` : ""}</div></form></div></div>`;
  $("#reuF").addEventListener("submit", async (e) => {
    e.preventDefault(); const o = formToObject(e.target);
    const row = { centro_id: o.centro_id, titulo: o.titulo, data_hora: new Date(o.data_hora).toISOString(), duracao_min: +o.duracao_min || 45, link: o.link || null, pauta: o.pauta || null, ata: o.ata || null, status: r.status === "solicitada" && o.status === "solicitada" ? "agendada" : o.status };
    const { error } = id ? await sb.from("ca_reunioes").update(row).eq("id", id) : await sb.from("ca_reunioes").insert(row);
    if (error) return toast(errMsg(error));
    await sb.from("ca_atividades").insert({ centro_id: o.centro_id, tipo: "reuniao", descricao: `Reunião ${row.status}: ${row.titulo} · ${fmtDateTime(row.data_hora)}`, autor_id: S.user.id });
    $("#modalRoot").innerHTML = ""; toast("Reunião salva"); refresh();
  });
}
async function delReuniao(id) { if (!confirm("Excluir reunião?")) return; await sb.from("ca_reunioes").delete().eq("id", id); $("#modalRoot").innerHTML = ""; refresh(); }
Object.assign(window, { renderReunioes, openReuniao, delReuniao });

/* ---------- ENGAJAMENTO ---------- */
function renderEngajamento() {
  const rows = S.cas.filter((c) => ["ativa", "pausada", "encerrada"].includes(c.status) || S.posts.some((p) => p.centro_id === c.id)).map((c) => {
    const evs = S.eventos.filter((e) => e.centro_id === c.id);
    return { c, score: scoreOf(c), posts: S.posts.filter((p) => p.centro_id === c.id && p.status !== "recusado").length, eventos: evs.length,
      inscritos: evs.reduce((a, e) => a + (e.inscritos_atual || 0), 0), publico: evs.filter((e) => ["solicitado", "realizado"].includes(e.status)).reduce((a, e) => a + (e.publico_real || e.publico_estimado || 0), 0),
      reunioes: S.reunioes.filter((r) => r.centro_id === c.id && r.status === "realizada").length };
  }).sort((a, b) => b.score - a.score);
  $("#main").innerHTML = `<div class="topbar"><h1>Ranking de engajamento</h1></div>
  <p class="muted small" style="margin-top:-8px">Score 0–100: postagens do contrato (35) · eventos aprovados (20) · antecedência ≥45 dias (15) · reuniões realizadas (15) · cadastro completo (15).</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>CA</th><th>Score</th><th>Postagens</th><th>Eventos</th><th>Público aprovado</th><th>Inscritos</th><th>Reuniões</th><th>Status</th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr class="click" onclick="openCA('${r.c.id}')"><td>${i + 1}</td><td><b>${esc(r.c.sigla)}</b><div class="small muted">${esc(r.c.faculdade || "")} · ${esc(r.c.uf || "")}</div></td>
    <td><span class="score ${scoreClass(r.score)}">${r.score}</span></td><td>${r.posts}</td><td>${r.eventos}</td><td>${r.publico.toLocaleString("pt-BR")}</td><td>${r.inscritos || "—"}</td><td>${r.reunioes}</td>
    <td><span class="badge b-${r.c.status}">${STATUS_CA[r.c.status]}</span></td></tr>`).join("") || `<tr><td colspan="9" class="empty">Sem dados ainda</td></tr>`}</tbody></table></div>`;
}

window.EXTRA_VIEWS = { mapa: renderMapa, contratos: renderContratos, postagens: renderPostagens, reunioes: renderReunioes, engajamento: renderEngajamento };

/* ---------- abas extras no CA ---------- */
window.EXTRA_TABS_LIST = [["contrato", "Contrato"], ["postagens", "Postagens"], ["reunioes", "Reuniões"]];
window.EXTRA_TABS = {
  contrato(c, body) {
    const ks = S.contratos.filter((k) => k.centro_id === c.id);
    const sc = scoreOf(c);
    body.innerHTML = `<div class="row" style="margin-bottom:12px"><span>Engajamento <span class="score ${scoreClass(sc)}">${sc}</span></span><span class="spacer"></span>${canWrite() ? `<button class="btn sm primary" onclick="openContrato(null,'${c.id}')">＋ Contrato</button>` : ""}</div>
    ${ks.map((k) => { const d = daysUntil(k.vigencia_fim); const st = statusMetas(S.metas.filter((m) => m.contrato_id === k.id), S.posts.filter((p) => p.centro_id === c.id));
      return `<div class="card" style="padding:14px;margin-bottom:12px"><div class="row"><b>${esc(CT_TIPO[k.tipo] || k.tipo || "Contrato")}${k.cota ? " · " + esc(k.cota) : ""}</b><span class="spacer"></span><b>${fmtBRL(k.valor_total)}</b></div>
        <div class="small ${d !== null && d <= 30 && d >= 0 ? "late" : "muted"}">${fmtDate(k.vigencia_inicio)} → ${fmtDate(k.vigencia_fim)} · ${d === null ? "" : d < 0 ? "encerrado" : `faltam ${d} dias`}${k.forma_pagamento ? " · " + esc(k.forma_pagamento) : ""}</div>
        ${(k.contrapartidas || []).length ? `<div class="small" style="margin-top:8px"><b>MedCof oferece:</b> ${k.contrapartidas.map(esc).join(" · ")}</div>` : ""}
        ${(k.obrigacoes || []).length ? `<div class="small" style="margin-top:6px"><b>CA se compromete:</b><ul style="margin:4px 0;padding-left:18px">${k.obrigacoes.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div>` : ""}
        ${k.exclusividade ? `<div class="small"><b>Exclusividade:</b> ${esc(k.exclusividade)}</div>` : ""}${k.renovacao ? `<div class="small"><b>Renovação:</b> ${esc(k.renovacao)}</div>` : ""}
        ${(k.peculiaridades || []).length ? `<div class="small" style="margin-top:6px"><b>Peculiaridades:</b> ${k.peculiaridades.map(esc).join(" · ")}</div>` : ""}${k.notas ? `<div class="small muted">${esc(k.notas)}</div>` : ""}
        ${st.length ? `<div class="list" style="margin-top:8px">${st.map((s) => `<div class="li" style="cursor:default;padding:6px 0"><div style="flex:1" class="small">${s.quantidade}× ${esc(TIPOS_POST[s.tipo] || s.tipo)} ${s.label}</div><span class="small lvl-${s.nivel}">${s.feitos}/${s.quantidade}</span></div>`).join("")}</div>` : ""}
        <div class="row" style="margin-top:10px">${k.drive_url ? `<a class="btn sm" target="_blank" href="${esc(k.drive_url)}">📄 PDF</a>` : ""}${canWrite() ? `<button class="btn sm" onclick="openContrato('${k.id}')">Editar</button>` : ""}</div></div>`; }).join("") || `<div class="empty">Nenhum contrato cadastrado. <a href="${PASTA_CONTRATOS}" target="_blank">Pasta dos contratos</a></div>`}`;
  },
  postagens(c, body) {
    const st = statusMetas(S.metas.filter((m) => m.centro_id === c.id), S.posts.filter((p) => p.centro_id === c.id));
    body.innerHTML = `${st.length ? `<div class="card" style="padding:14px;margin-bottom:12px"><b class="small">Metas</b>${st.map((s) => `<div class="row small" style="margin-top:6px"><span style="flex:1">${s.quantidade}× ${esc(TIPOS_POST[s.tipo] || s.tipo)} ${s.label}</span><span class="lvl-${s.nivel}">${s.feitos}/${s.quantidade}${s.vigente && s.falta && s.dias !== null ? ` · vence em ${s.dias}d` : ""}</span></div>`).join("")}</div>` : ""}
    <div class="list card" style="padding:6px 14px">${S.posts.filter((p) => p.centro_id === c.id).map(postLine).join("") || `<div class="empty">Nenhuma postagem registrada</div>`}</div>`;
  },
  reunioes(c, body) {
    const rs = S.reunioes.filter((r) => r.centro_id === c.id).sort((a, b) => b.data_hora.localeCompare(a.data_hora));
    body.innerHTML = `<div class="row" style="margin-bottom:10px"><span class="spacer"></span>${canWrite() ? `<button class="btn sm primary" onclick="openReuniao(null,'${c.id}')">＋ Agendar</button>` : ""}</div>
    <div class="list card" style="padding:6px 14px">${rs.map((r) => `<div class="li" onclick="openReuniao('${r.id}')"><span>🤝</span><div style="flex:1"><div class="t">${esc(r.titulo)}</div><div class="small muted">${fmtDateTime(r.data_hora)}${r.ata ? " · com ata" : ""}</div></div><span class="badge ${REU_B[r.status]}">${REU_ST[r.status]}</span></div>`).join("") || `<div class="empty">Nenhuma reunião</div>`}</div>`;
  },
};
