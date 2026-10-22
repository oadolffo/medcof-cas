/* Painel interno — fluxo dos Centros Acadêmicos */
const STATUS_CA = {
  interesse: "Interesse", novo: "Cadastro completo", contato: "Em contato", reuniao: "Reunião", proposta: "Proposta",
  ativa: "Parceria ativa", pausada: "Pausada", perdida: "Perdida", encerrada: "Contrato encerrado",
};
const STATUS_EV = { pendente: "Pendente", solicitado: "Solicitado", recusado: "Recusado", realizado: "Realizado", cancelado: "Cancelado" };
const EV_BADGE = { pendente: "b-proposta", solicitado: "b-novo", recusado: "b-perdida", realizado: "b-ativa", cancelado: "b-pausada" };
const PRIO = { alta: "Alta", media: "Média", baixa: "Baixa" };
const TIPOS_ATIV = { nota: "📝", ligacao: "📞", whatsapp: "💬", email: "✉️", reuniao: "🤝", status: "🔁", sistema: "⚙️" };

const S = { user: null, me: null, team: [], cas: [], eventos: [], view: "home", filters: {}, evFilters: { status: "", periodo: "futuros", q: "" } };
const canWrite = () => ["owner", "editor"].includes(S.me?.role);
const isOwner = () => S.me?.role === "owner";
const caById = (id) => S.cas.find((c) => c.id === id);
const memberName = (id) => { const m = S.team.find((t) => t.user_id === id); return m ? (m.nome || m.email) : "—"; };

/* ================= AUTH ================= */
let signupMode = false;
$("#toggleAuth").addEventListener("click", (e) => {
  e.preventDefault(); signupMode = !signupMode;
  $("#nameField").classList.toggle("hidden", !signupMode);
  $("#authBtn").textContent = signupMode ? "Criar conta" : "Entrar";
  e.target.textContent = signupMode ? "Já tenho conta" : "Criar conta";
});
$("#forgot").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = $("#authForm").email.value.trim();
  if (!email) return showAuthErr("Digite seu e-mail acima e clique de novo em “Esqueci a senha”.");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/painel" });
  if (error) return showAuthErr(errMsg(error));
  showAuthOk("Enviamos um link para redefinir a senha.");
});
function showAuthErr(m) { const e = $("#authErr"); e.textContent = m; e.classList.remove("hidden"); $("#authOk").classList.add("hidden"); }
function showAuthOk(m) { const e = $("#authOk"); e.textContent = m; e.classList.remove("hidden"); $("#authErr").classList.add("hidden"); }
$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, btn = $("#authBtn");
  btn.disabled = true;
  try {
    if (signupMode) {
      const { data, error } = await sb.auth.signUp({
        email: f.email.value.trim(), password: f.senha.value,
        options: { data: { nome: f.nome.value.trim() }, emailRedirectTo: location.origin + "/painel" },
      });
      if (error) throw error;
      if (!data.session) showAuthOk("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre.");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
      if (error) throw error;
    }
  } catch (err) { showAuthErr(errMsg(err)); }
  finally { btn.disabled = false; }
});
async function logout() { await sb.auth.signOut(); location.reload(); }
window.logout = logout;

function show(id) { ["authView", "pendingView", "appView"].forEach((v) => $("#" + v).classList.toggle("hidden", v !== id)); }

sb.auth.onAuthStateChange((ev, session) => {
  if (ev === "PASSWORD_RECOVERY") {
    const np = prompt("Digite a nova senha (mín. 6 caracteres):");
    if (np) sb.auth.updateUser({ password: np }).then(({ error }) => toast(error ? errMsg(error) : "Senha atualizada"));
  }
  if (ev === "SIGNED_IN" || ev === "INITIAL_SESSION") boot(session);
  if (ev === "SIGNED_OUT") show("authView");
});

let booted = false;
async function boot(session) {
  if (!session) return show("authView");
  if (booted && S.user?.id === session.user.id) return;
  booted = true; S.user = session.user;
  const { data: me, error } = await sb.from("team_members").select("*").eq("user_id", S.user.id).maybeSingle();
  if (error || !me) { show("pendingView"); return; }
  S.me = me;
  if (me.role === "pending") return show("pendingView");
  show("appView");
  $("#whoami").textContent = (me.nome || me.email) + " · " + ({ owner: "admin", editor: "editor", viewer: "leitura" }[me.role]);
  $$(".ownerOnly").forEach((el) => el.classList.toggle("hidden", !isOwner()));
  await loadAll();
  const h = location.hash.replace("#", "");
  go(["home", "cas", "pipeline", "eventos", "equipe", ...Object.keys(window.EXTRA_VIEWS || {})].includes(h) ? h : "home");
}

/* ================= DATA ================= */
async function loadAll() {
  const [t, c, e] = await Promise.all([
    sb.from("team_members").select("*").order("created_at"),
    sb.from("ca_centros").select("*").order("sigla"),
    sb.from("ca_eventos").select("*").order("data_inicio", { ascending: true }),
  ]);
  if (c.error) toast("Erro ao carregar: " + errMsg(c.error));
  S.team = t.data || []; S.cas = c.data || []; S.eventos = e.data || [];
  if (window.loadExtra) await window.loadExtra();
  const pend = S.eventos.filter((x) => x.status === "pendente").length;
  $$("#pendCount").forEach((el) => { el.textContent = pend; el.classList.toggle("hidden", !pend); });
  const waiting = S.team.filter((x) => x.role === "pending").length;
  $$("#teamCount").forEach((el) => { el.textContent = waiting; el.classList.toggle("hidden", !waiting || !isOwner()); });
}

/* ================= NAV ================= */
$$("[data-view]").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
function go(v) {
  S.view = v; location.hash = v;
  $$("[data-view]").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  ({ home: renderHome, cas: renderCas, pipeline: renderPipeline, eventos: renderEventos, equipe: renderEquipe, ...(window.EXTRA_VIEWS || {}) }[v] || renderHome)();
}
function refresh() { return loadAll().then(() => go(S.view)); }

/* ================= HOME ================= */
function renderHome() {
  const ativos = S.cas.filter((c) => c.status === "ativa");
  const novos = S.cas.filter((c) => c.status === "novo");
  const pend = S.eventos.filter((e) => e.status === "pendente");
  const prox = S.eventos.filter((e) => { const d = daysUntil(e.data_inicio); return d !== null && d >= 0 && d <= 30 && !["recusado", "cancelado"].includes(e.status); });
  const pubProx = prox.reduce((a, e) => a + (e.publico_estimado || 0), 0);
  const gestao = S.cas.filter((c) => { const d = daysUntil(c.gestao_fim); return d !== null && d <= 60 && !["perdida"].includes(c.status); })
    .sort((a, b) => (a.gestao_fim || "").localeCompare(b.gestao_fim || ""));
  const semCodigo = S.cas.filter((c) => ["ativa", "novo", "interesse", "proposta"].includes(c.status) && !c.codigo_enviado && !(S.usuarios || []).some((u) => u.centro_id === c.id));
  const acoes = S.cas.filter((c) => c.proxima_acao_data && daysUntil(c.proxima_acao_data) <= 3).sort((a, b) => a.proxima_acao_data.localeCompare(b.proxima_acao_data));
  const alunos = ativos.reduce((a, c) => a + (c.alunos_cobertos || 0), 0);

  $("#main").innerHTML = `
  <div class="topbar"><h1>Visão geral</h1><span class="spacer"></span>
    ${canWrite() ? `<button class="btn" onclick="openNewCA()">＋ Novo CA</button>` : ""}
    <button class="btn" onclick="refresh()">↻ Atualizar</button></div>
  <div class="kpis">
    <div class="kpi"><div class="v">${ativos.length}</div><div class="l">Parcerias ativas</div></div>
    <div class="kpi"><div class="v">${alunos.toLocaleString("pt-BR")}</div><div class="l">Alunos alcançados</div></div>
    <div class="kpi"><div class="v" style="color:var(--warn)">${pend.length}</div><div class="l">Eventos para analisar</div></div>
    <div class="kpi"><div class="v">${prox.length}</div><div class="l">Eventos em 30 dias · ${pubProx.toLocaleString("pt-BR")} pessoas</div></div>
    <div class="kpi"><div class="v" style="color:var(--info)">${novos.length}</div><div class="l">Novos cadastros</div></div>
  </div>
  <div class="two">
    <div class="card"><div class="row"><h3 style="margin:0;font-size:16px">Eventos aguardando análise</h3><span class="spacer"></span><button class="btn sm ghost" onclick="S.evFilters.status='pendente';S.evFilters.periodo='todos';go('eventos')">Ver todos</button></div>
      <div class="list">${pend.length ? pend.slice(0, 8).map(evLine).join("") : `<div class="empty">Nada pendente 🎉</div>`}</div></div>
    <div class="card"><h3 style="font-size:16px">Próximos 30 dias</h3>
      <div class="list">${prox.length ? prox.slice(0, 8).map(evLine).join("") : `<div class="empty">Sem eventos nos próximos 30 dias</div>`}</div></div>
  </div>
  <div class="two" style="margin-top:14px">
    <div class="card"><h3 style="font-size:16px">Gestões terminando (60 dias) <span class="muted small">· hora de conhecer a nova diretoria</span></h3>
      <div class="list">${gestao.length ? gestao.map((c) => { const d = daysUntil(c.gestao_fim); return `<div class="li" onclick="openCA('${c.id}')"><div style="flex:1"><div class="t">${esc(c.sigla)}</div><div class="small muted">${esc(c.faculdade)}</div></div><span class="${d < 0 ? "late" : ""} small">${d < 0 ? "encerrou há " + -d + "d" : "em " + d + "d"} · ${fmtDate(c.gestao_fim)}</span></div>`; }).join("") : `<div class="empty">Nenhuma gestão terminando</div>`}</div></div>
    <div class="card"><h3 style="font-size:16px">Pendências da equipe</h3>
      <div class="list">
      ${acoes.map((c) => `<div class="li" onclick="openCA('${c.id}')"><span>📌</span><div style="flex:1"><div class="t">${esc(c.sigla)} · ${esc(c.proxima_acao || "Próxima ação")}</div><div class="small ${daysUntil(c.proxima_acao_data) < 0 ? "late" : "muted"}">${fmtDate(c.proxima_acao_data)}</div></div></div>`).join("")}
      ${semCodigo.map((c) => `<div class="li" onclick="openCA('${c.id}')"><span>🔑</span><div style="flex:1"><div class="t">Convidar ${esc(c.sigla)} para a Área do CA</div><div class="small muted">Ninguém do CA criou acesso ainda${c.rep_email ? " · " + esc(c.rep_email) : " · sem e-mail cadastrado"}</div></div></div>`).join("")}
      ${!acoes.length && !semCodigo.length ? `<div class="empty">Tudo em dia</div>` : ""}
      </div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3 style="font-size:16px">Funil de parcerias</h3><div class="funnel">
    ${Object.entries(STATUS_CA).map(([k, l]) => { const n = S.cas.filter((c) => c.status === k).length; const max = Math.max(1, ...Object.keys(STATUS_CA).map((s) => S.cas.filter((c) => c.status === s).length)); return `<div class="fbar"><span>${l}</span><div class="track"><div class="fill" style="width:${(n / max) * 100}%"></div></div><b>${n}</b></div>`; }).join("")}
  </div></div>${window.homeExtra ? window.homeExtra() : ""}`;
}
function evLine(e) {
  const c = caById(e.centro_id) || {};
  const d = daysUntil(e.data_inicio);
  return `<div class="li" onclick="openEvento('${e.id}')">
    <div style="width:46px;text-align:center"><div style="font-weight:800;font-size:18px;line-height:1">${e.data_inicio ? e.data_inicio.slice(8, 10) : "—"}</div><div class="small muted">${e.data_inicio ? ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][+e.data_inicio.slice(5, 7) - 1] : ""}</div></div>
    <div style="flex:1;min-width:0"><div class="t">${esc(e.nome)}</div><div class="small muted">${esc(c.sigla || "")} · ${e.publico_estimado ?? "?"} pessoas · ${esc((e.ciclos || []).join(", ") || e.publico_majoritario || "")}${e.link_inscritos ? ` · 👥 ${e.inscritos_atual ?? "?"} inscritos` : ""}${d !== null && d >= 0 ? ` · em ${d}d` : ""}</div></div>
    <span class="badge ${EV_BADGE[e.status]}">${STATUS_EV[e.status]}</span></div>`;
}

/* ================= CAs (tabela) ================= */
function filteredCas() {
  const f = S.filters, q = (f.q || "").toLowerCase();
  return S.cas.filter((c) =>
    (!q || [c.sigla, c.nome, c.faculdade, c.cidade, c.rep_nome, c.rep_email].join(" ").toLowerCase().includes(q)) &&
    (!f.status || c.status === f.status) && (!f.uf || c.uf === f.uf) && (!f.resp || c.responsavel_id === f.resp));
}
function renderCas() {
  const list = filteredCas();
  $("#main").innerHTML = `
  <div class="topbar"><h1>Centros acadêmicos</h1><span class="muted">${list.length} de ${S.cas.length}</span><span class="spacer"></span>
    <button class="btn" onclick="exportCasCSV()">⬇ CSV</button>
    ${canWrite() ? `<button class="btn primary" onclick="openNewCA()">＋ Novo CA</button>` : ""}</div>
  <div class="filters">
    <input type="search" placeholder="Buscar por sigla, faculdade, representante, e-mail…" value="${esc(S.filters.q || "")}" oninput="S.filters.q=this.value;renderCasTable()">
    <select onchange="S.filters.status=this.value;renderCasTable()"><option value="">Todos os status</option>${Object.entries(STATUS_CA).map(([k, l]) => `<option value="${k}" ${S.filters.status === k ? "selected" : ""}>${l}</option>`).join("")}</select>
    <select onchange="S.filters.uf=this.value;renderCasTable()"><option value="">Todas as UFs</option>${[...new Set(S.cas.map((c) => c.uf))].sort().map((u) => `<option ${S.filters.uf === u ? "selected" : ""}>${u}</option>`).join("")}</select>
    <select onchange="S.filters.resp=this.value;renderCasTable()"><option value="">Qualquer responsável</option>${S.team.filter((t) => t.role !== "pending").map((t) => `<option value="${t.user_id}" ${S.filters.resp === t.user_id ? "selected" : ""}>${esc(t.nome || t.email)}</option>`).join("")}</select>
  </div>
  <div class="tbl-wrap" id="casTable"></div>`;
  renderCasTable();
}
function renderCasTable() {
  const list = filteredCas();
  $("#casTable").innerHTML = `<table class="tbl"><thead><tr><th>Entidade</th><th>Local</th><th>Status</th><th>Representante</th><th>Gestão até</th><th>Eventos</th><th>Área do CA</th></tr></thead><tbody>
  ${list.map((c) => {
    const evs = S.eventos.filter((e) => e.centro_id === c.id);
    const fut = evs.filter((e) => daysUntil(e.data_inicio) >= 0 && !["recusado", "cancelado"].includes(e.status)).length;
    const dg = daysUntil(c.gestao_fim);
    return `<tr class="click" onclick="openCA('${c.id}')">
      <td><b>${esc(c.sigla)}</b><div class="small muted">${esc(c.faculdade)}</div></td>
      <td class="small">${esc(c.cidade)}/${esc(c.uf)}</td>
      <td><span class="badge b-${c.status}">${STATUS_CA[c.status]}</span></td>
      <td class="small">${esc(c.rep_nome)}<div class="muted">${esc(c.rep_cargo || "")}</div></td>
      <td class="small ${dg !== null && dg <= 30 ? "late" : ""}">${fmtDate(c.gestao_fim)}</td>
      <td class="small">${evs.length} <span class="muted">(${fut} futuros)</span></td>
      <td class="small">${(S.usuarios || []).filter((u) => u.centro_id === c.id).length ? `<span class="badge b-ativa">${(S.usuarios || []).filter((u) => u.centro_id === c.id).length} acesso(s)</span>` : c.codigo_enviado ? `<span class="badge b-novo">convidado</span>` : `<span class="badge b-proposta">sem acesso</span>`}</td></tr>`;
  }).join("") || `<tr><td colspan="7" class="empty">Nenhum CA encontrado</td></tr>`}</tbody></table>`;
}
function csvDownload(name, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name; a.click();
}
function exportCasCSV() {
  const cols = ["sigla", "nome", "faculdade", "cidade", "uf", "status", "rep_nome", "rep_cargo", "rep_email", "rep_whatsapp", "instagram", "alunos_cobertos", "alunos_grupos", "gestao_inicio", "gestao_fim", "entrega_nome", "entrega_telefone", "entrega_logradouro", "entrega_complemento", "entrega_bairro", "entrega_cidade", "entrega_uf", "entrega_cep", "cupom", "proxima_acao", "proxima_acao_data", "notas"];
  csvDownload("centros-academicos.csv", [cols, ...filteredCas().map((c) => cols.map((k) => c[k]))]);
}

/* ================= FUNIL (kanban) ================= */
function renderPipeline() {
  $("#main").innerHTML = `<div class="topbar"><h1>Funil de parcerias</h1><span class="muted small">${canWrite() ? "Arraste os cards para mudar o status" : ""}</span><span class="spacer"></span>${canWrite() ? `<button class="btn primary" onclick="openNewCA()">＋ Novo CA</button>` : ""}</div>
  <div class="kanban">${Object.entries(STATUS_CA).map(([k, l]) => {
    const cs = S.cas.filter((c) => c.status === k);
    return `<div class="col" data-status="${k}"><h4><span class="badge b-${k}">${cs.length}</span>${l}</h4>
      ${cs.map((c) => { const ad = c.proxima_acao_data ? daysUntil(c.proxima_acao_data) : null; return `<div class="kcard" draggable="${canWrite()}" data-id="${c.id}" onclick="openCA('${c.id}')">
        <div class="t">${esc(c.sigla)}</div><div class="s">${esc(c.faculdade)} · ${esc(c.uf)}</div>
        ${c.proxima_acao ? `<div class="s ${ad !== null && ad < 0 ? "late" : ""}" style="margin-top:6px">📌 ${esc(c.proxima_acao)}${c.proxima_acao_data ? " · " + fmtDate(c.proxima_acao_data) : ""}</div>` : ""}
        <div class="m"><span class="badge p-${c.prioridade}">${PRIO[c.prioridade]}</span>${c.responsavel_id ? `<span class="badge">${esc(memberName(c.responsavel_id))}</span>` : ""}</div></div>`; }).join("")}
    </div>`; }).join("")}</div>`;
  if (!canWrite()) return;
  let dragId = null;
  $$(".kcard").forEach((k) => k.addEventListener("dragstart", (e) => { dragId = k.dataset.id; e.dataTransfer.effectAllowed = "move"; }));
  $$(".col").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", () => col.classList.remove("drop"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault(); col.classList.remove("drop");
      const c = caById(dragId); if (!c || c.status === col.dataset.status) return;
      await updateCA(c.id, { status: col.dataset.status }); renderPipeline();
    });
  });
}
async function updateCA(id, patch) {
  const { data, error } = await sb.from("ca_centros").update(patch).eq("id", id).select().single();
  if (error) { toast(errMsg(error)); return null; }
  Object.assign(caById(id), data); toast("Salvo"); return data;
}

/* ================= DRAWER DO CA ================= */
let drawerTab = "resumo";
function closeDrawer() { $("#drawerRoot").innerHTML = ""; if (S.view !== "pipeline") go(S.view); else renderPipeline(); }
window.closeDrawer = closeDrawer;
async function openCA(id, tab) {
  const c = caById(id); if (!c) return;
  if (tab) drawerTab = tab;
  $("#drawerRoot").innerHTML = `<div class="overlay" onclick="closeDrawer()"></div><div class="drawer" role="dialog" aria-label="${esc(c.sigla)}">
    <div class="drawer-head"><div class="row"><div style="flex:1;min-width:0"><div class="small muted">${esc(c.tipo)} · ${esc(c.cidade)}/${esc(c.uf)}</div><h2 style="margin:0;font-size:20px">${esc(c.sigla)} <span class="badge b-${c.status}" style="vertical-align:middle">${STATUS_CA[c.status]}</span></h2><div class="small muted">${esc(c.nome)}</div></div>
      <button class="btn ghost" onclick="closeDrawer()" aria-label="Fechar">✕</button></div>
      <div class="row" style="margin-top:10px;gap:6px">
        ${waLink(c.rep_whatsapp) ? `<a class="btn sm" target="_blank" href="${waLink(c.rep_whatsapp, `Oi, ${(c.rep_nome || "").split(" ")[0]}! Aqui é da equipe MedCof.`)}">💬 WhatsApp ${esc((c.rep_nome || "").split(" ")[0])}</a>` : ""}
        ${waLink(c.rep_whatsapp) ? `<a class="btn sm" target="_blank" onclick="markCodeSent('${c.id}')" href="${waLink(c.rep_whatsapp, `Oi, ${(c.rep_nome || "").split(" ")[0]}! A Área do CA da parceria MedCof já está liberada para o ${c.sigla}: ${location.origin}/ca — clique em “Primeiro acesso”, use o e-mail ${c.rep_email || "cadastrado"} e crie sua senha. Lá vocês completam o cadastro, registram eventos, postagens e veem o Manual do CA.`)}">🔑 Convidar para a Área do CA</a>` : ""}
        ${c.instagram ? `<a class="btn sm" target="_blank" href="https://instagram.com/${encodeURIComponent(c.instagram.replace(/^@/, ""))}">📸 Instagram</a>` : ""}
      </div>
      <div class="tabs">${[["resumo", "Acompanhamento"], ["dados", "Dados do CA"], ["contatos", "Contatos"], ["eventos", "Eventos"], ...(window.EXTRA_TABS_LIST || []), ["historico", "Histórico"]].map(([k, l]) => `<button class="tab ${drawerTab === k ? "on" : ""}" onclick="openCA('${c.id}','${k}')">${l}</button>`).join("")}</div>
    </div><div class="drawer-body" id="drawerBody"><div class="empty">Carregando…</div></div></div>`;
  const body = $("#drawerBody");
  if (drawerTab === "resumo") body.innerHTML = tabResumo(c);
  if (drawerTab === "dados") body.innerHTML = tabDados(c);
  if (drawerTab === "eventos") body.innerHTML = tabEventos(c);
  if (drawerTab === "contatos") await tabContatos(c, body);
  if (drawerTab === "historico") await tabHistorico(c, body);
  if (window.EXTRA_TABS && window.EXTRA_TABS[drawerTab]) await window.EXTRA_TABS[drawerTab](c, body);
}
window.openCA = openCA;
async function markCodeSent(id) { await updateCA(id, { codigo_enviado: true }); }
window.markCodeSent = markCodeSent;

function tabResumo(c) {
  const dis = canWrite() ? "" : "disabled";
  return `<form id="resumoForm" class="grid" data-id="${c.id}">
    <div class="grid g3">
      <div><label>Status</label><select name="status" ${dis}>${Object.entries(STATUS_CA).map(([k, l]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label>Prioridade</label><select name="prioridade" ${dis}>${Object.entries(PRIO).map(([k, l]) => `<option value="${k}" ${c.prioridade === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <div><label>Responsável MedCof</label><select name="responsavel_id" ${dis}><option value="">—</option>${S.team.filter((t) => t.role !== "pending").map((t) => `<option value="${t.user_id}" ${c.responsavel_id === t.user_id ? "selected" : ""}>${esc(t.nome || t.email)}</option>`).join("")}</select></div>
    </div>
    <div class="grid g3">
      <div style="grid-column:span 2"><label>Próxima ação</label><input name="proxima_acao" value="${esc(c.proxima_acao || "")}" placeholder="Ex.: alinhar Simulado de novembro" ${dis}></div>
      <div><label>Data</label><input type="date" name="proxima_acao_data" value="${c.proxima_acao_data || ""}" ${dis}></div>
    </div>
    <div class="grid g3">
      <div><label>Cupom da entidade</label><input name="cupom" value="${esc(c.cupom || "")}" ${dis}></div>
      <div><label>Acessos à Área do CA</label><input value="${(S.usuarios || []).filter((u) => u.centro_id === c.id).length}" disabled></div>
      <div><label>Convite enviado?</label><select name="codigo_enviado" ${dis}><option value="true" ${c.codigo_enviado ? "selected" : ""}>Sim</option><option value="false" ${!c.codigo_enviado ? "selected" : ""}>Não</option></select></div>
    </div>
    <div id="perdaWrap" class="${c.status === "perdida" ? "" : "hidden"}"><label>Motivo da perda</label><input name="motivo_perda" value="${esc(c.motivo_perda || "")}" ${dis}></div>
    <div><label>Notas internas</label><textarea name="notas" rows="4" ${dis}>${esc(c.notas || "")}</textarea></div>
    ${canWrite() ? `<div class="row"><button class="btn primary">Salvar</button>${isOwner() ? `<span class="spacer"></span><button type="button" class="btn danger sm" onclick="deleteCA('${c.id}')">Excluir CA</button>` : ""}</div>` : ""}
  </form>
  <div class="card" style="margin-top:16px;padding:14px">
    <div class="grid g3 small">
      <div><div class="muted">Alunos cobertos</div><b>${c.alunos_cobertos ?? "—"}</b></div>
      <div><div class="muted">Alunos em grupos</div><b>${c.alunos_grupos ?? "—"}</b></div>
      <div><div class="muted">Gestão</div><b>${fmtDate(c.gestao_inicio)} → ${fmtDate(c.gestao_fim)}</b></div>
    </div>
  </div>
  ${canWrite() ? `<div class="card" style="margin-top:14px;padding:14px"><label>Registrar interação</label>
    <div class="row"><select id="ativTipo" style="width:auto">${Object.entries({ nota: "Nota", whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", reuniao: "Reunião" }).map(([k, l]) => `<option value="${k}">${TIPOS_ATIV[k]} ${l}</option>`).join("")}</select>
    <input id="ativTxt" placeholder="O que aconteceu?" style="flex:1;min-width:180px"><button class="btn" onclick="addAtividade('${c.id}')">Adicionar</button></div></div>` : ""}
`;
}
document.addEventListener("submit", async (e) => {
  if (e.target.id === "resumoForm") {
    e.preventDefault();
    const o = formToObject(e.target);
    const id = e.target.dataset.id;
    const patch = { ...o, responsavel_id: o.responsavel_id || null, proxima_acao_data: o.proxima_acao_data || null, codigo_enviado: o.codigo_enviado === "true" };
    if (await updateCA(id, patch)) openCA(id, "resumo");
  }
  if (e.target.id === "dadosForm") {
    e.preventDefault();
    const id = e.target.dataset.id, o = formToObject(e.target);
    ["gestao_inicio", "gestao_fim"].forEach((k) => (o[k] = o[k] || null));
    ["alunos_cobertos", "alunos_grupos", "seguidores"].forEach((k) => (o[k] = o[k] ? parseInt(onlyDigits(o[k])) || null : null));
    if (await updateCA(id, o)) openCA(id, "dados");
  }
});
document.addEventListener("change", (e) => { if (e.target.name === "status" && e.target.closest("#resumoForm")) $("#perdaWrap").classList.toggle("hidden", e.target.value !== "perdida"); });

async function addAtividade(id) {
  const txt = $("#ativTxt").value.trim(); if (!txt) return;
  const { error } = await sb.from("ca_atividades").insert({ centro_id: id, tipo: $("#ativTipo").value, descricao: txt, autor_id: S.user.id });
  if (error) return toast(errMsg(error));
  toast("Interação registrada"); openCA(id, "historico");
}
window.addAtividade = addAtividade;
async function deleteCA(id) {
  const c = caById(id);
  if (!confirm(`Excluir ${c.sigla} e todos os eventos, contatos e histórico? Isso não pode ser desfeito.`)) return;
  const { error } = await sb.from("ca_centros").delete().eq("id", id);
  if (error) return toast(errMsg(error));
  $("#drawerRoot").innerHTML = ""; await refresh(); toast("CA excluído");
}
window.deleteCA = deleteCA;

const DADOS_FIELDS = [
  ["Entidade", [["sigla", "Sigla"], ["nome", "Nome", 2], ["tipo", "Tipo", 1, ["CA", "DA", "DCE", "Diretório Científico", "Atlética", "Liga", "Outro"]], ["faculdade", "Faculdade", 2], ["cidade", "Cidade"], ["uf", "UF", 1, UFS], ["regiao", "Região"], ["email_entidade", "E-mail da entidade"], ["telefone_entidade", "Telefone da entidade"], ["cnpj", "CNPJ"]]],
  ["Gestão", [["gestao_inicio", "Início", 1, "date"], ["gestao_fim", "Término", 1, "date"], ["troca_gestao", "Troca"], ["tamanho_gestao", "Tamanho da gestão", 2], ["alunos_cobertos", "Alunos cobertos"], ["alunos_cobertos_obs", "Obs. alunos", 2]]],
  ["Canais", [["instagram", "Instagram"], ["seguidores", "Seguidores"], ["outros_canais", "Outros canais"], ["alunos_grupos", "Alunos nos grupos"], ["alunos_grupos_obs", "Obs. grupos", 2]]],
  ["Representante", [["rep_nome", "Nome", 2], ["rep_cargo", "Cargo"], ["rep_email", "E-mail"], ["rep_whatsapp", "WhatsApp"], ["rep_cpf", "CPF"]]],
  ["Entrega de brindes", [["entrega_nome", "Destinatário", 2], ["entrega_telefone", "Telefone"], ["entrega_email", "E-mail"], ["entrega_cpf", "CPF"], ["entrega_cep", "CEP"], ["entrega_logradouro", "Endereço", 2], ["entrega_complemento", "Complemento"], ["entrega_bairro", "Bairro"], ["entrega_cidade", "Cidade"], ["entrega_uf", "UF", 1, UFS]]],
];
function tabDados(c) {
  const dis = canWrite() ? "" : "disabled";
  return `<form id="dadosForm" data-id="${c.id}">${DADOS_FIELDS.map(([sec, fs]) => `<h3 style="font-size:15px;margin-top:6px">${sec}</h3><div class="grid g3" style="margin-bottom:14px">${fs.map(([k, l, span, opt]) => {
    const v = c[k] ?? "";
    let input;
    if (Array.isArray(opt)) input = `<select name="${k}" ${dis}><option value=""></option>${opt.map((o) => `<option ${v === o ? "selected" : ""}>${o}</option>`).join("")}</select>`;
    else input = `<input name="${k}" type="${opt === "date" ? "date" : "text"}" value="${esc(v)}" ${dis}>`;
    return `<div style="${span === 2 ? "grid-column:span 2" : ""}"><label>${l}</label>${input}</div>`;
  }).join("")}</div>`).join("")}
  <h3 style="font-size:15px">Observações do CA</h3><textarea name="observacoes_ca" ${dis}>${esc(c.observacoes_ca || "")}</textarea>
  <p class="small muted">Origem: ${esc(c.origem)} · cadastrado em ${fmtDateTime(c.created_at)}</p>
  ${canWrite() ? `<button class="btn primary">Salvar dados</button>` : ""}</form>`;
}
function tabEventos(c) {
  const evs = S.eventos.filter((e) => e.centro_id === c.id).sort((a, b) => (b.data_inicio || "").localeCompare(a.data_inicio || ""));
  const tot = evs.filter((e) => ["solicitado", "realizado"].includes(e.status)).reduce((a, e) => a + (e.publico_real || e.publico_estimado || 0), 0);
  return `<div class="row" style="margin-bottom:10px"><span class="muted small">${evs.length} eventos · ${tot.toLocaleString("pt-BR")} pessoas em eventos aprovados</span><span class="spacer"></span>${canWrite() ? `<button class="btn sm primary" onclick="openEvento(null,'${c.id}')">＋ Evento</button>` : ""}</div>
    <div class="list card" style="padding:6px 14px">${evs.map(evLine).join("") || `<div class="empty">Nenhum evento registrado</div>`}</div>`;
}
async function tabContatos(c, body) {
  const { data } = await sb.from("ca_contatos").select("*").eq("centro_id", c.id).order("principal", { ascending: false }).order("created_at");
  body.innerHTML = `<p class="small muted" style="margin-top:0">Quem tiver o e-mail cadastrado aqui (ou como representante) pode criar acesso na Área do CA.</p><div class="list">${(data || []).map((k) => `<div class="li" style="cursor:default"><div style="flex:1;min-width:0"><div class="t">${esc(k.nome)} ${k.principal ? `<span class="badge b-novo">principal</span>` : ""}</div><div class="small muted">${esc(k.cargo || "")}${k.email ? " · " + esc(k.email) : ""}${k.whatsapp ? " · " + esc(k.whatsapp) : ""}</div></div>
    ${waLink(k.whatsapp) ? `<a class="btn sm" target="_blank" href="${waLink(k.whatsapp)}">💬</a>` : ""}${k.email ? `<a class="btn sm" href="mailto:${esc(k.email)}">✉️</a>` : ""}
    ${canWrite() ? `<button class="btn sm ghost danger" onclick="delContato('${k.id}','${c.id}')" aria-label="Remover">✕</button>` : ""}</div>`).join("") || `<div class="empty">Sem contatos</div>`}</div>
  ${canWrite() ? `<form class="card" style="margin-top:14px;padding:14px" onsubmit="addContato(event,'${c.id}')"><label>Novo contato</label>
    <div class="grid g2"><input name="nome" placeholder="Nome" required><input name="cargo" placeholder="Cargo"><input name="email" type="email" placeholder="E-mail"><input name="whatsapp" placeholder="WhatsApp"></div>
    <button class="btn" style="margin-top:10px">Adicionar contato</button></form>` : ""}`;
}
async function addContato(e, cid) {
  e.preventDefault(); const o = formToObject(e.target);
  const { error } = await sb.from("ca_contatos").insert({ ...o, centro_id: cid });
  if (error) return toast(errMsg(error)); openCA(cid, "contatos");
}
async function delContato(id, cid) { if (!confirm("Remover contato?")) return; await sb.from("ca_contatos").delete().eq("id", id); openCA(cid, "contatos"); }
Object.assign(window, { addContato, delContato });

async function tabHistorico(c, body) {
  const { data } = await sb.from("ca_atividades").select("*").eq("centro_id", c.id).order("created_at", { ascending: false }).limit(200);
  body.innerHTML = `${canWrite() ? `<div class="row" style="margin-bottom:14px"><select id="ativTipo" style="width:auto">${Object.entries({ nota: "Nota", whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", reuniao: "Reunião" }).map(([k, l]) => `<option value="${k}">${TIPOS_ATIV[k]} ${l}</option>`).join("")}</select><input id="ativTxt" placeholder="Registrar interação…" style="flex:1;min-width:180px"><button class="btn" onclick="addAtividade('${c.id}')">Adicionar</button></div>` : ""}
  <div class="timeline">${(data || []).map((a) => `<div class="tl"><div class="dot">${TIPOS_ATIV[a.tipo] || "•"}</div><div class="body"><div>${esc(a.descricao)}</div><div class="meta">${fmtDateTime(a.created_at)} · ${a.autor_id ? esc(memberName(a.autor_id)) : "sistema"}</div></div></div>`).join("") || `<div class="empty">Sem histórico</div>`}</div>`;
}

/* ================= NOVO CA ================= */
function openNewCA() {
  $("#modalRoot").innerHTML = `<div class="modal" onclick="if(event.target===this)this.remove()"><div class="card"><h2 style="font-size:18px">Novo centro acadêmico</h2>
  <p class="small muted" style="margin-top:-6px">Cadastro rápido feito pela equipe. O CA pode completar o resto na Área do CA, entrando com o e-mail do representante.</p>
  <form id="newCA"><div class="grid g2">
    <div><label>Sigla *</label><input name="sigla" required></div><div><label>Tipo</label><select name="tipo"><option>CA</option><option>DA</option><option>Diretório Científico</option><option>Atlética</option><option>Liga</option><option>Outro</option></select></div>
    <div style="grid-column:span 2"><label>Nome *</label><input name="nome" required></div>
    <div style="grid-column:span 2"><label>Faculdade *</label><input name="faculdade" required></div>
    <div><label>Cidade *</label><input name="cidade" required></div><div><label>UF *</label><select name="uf" required class="uf"></select></div>
    <div><label>Representante *</label><input name="rep_nome" required></div><div><label>Cargo</label><input name="rep_cargo"></div>
    <div><label>E-mail *</label><input name="rep_email" type="email" required></div><div><label>WhatsApp *</label><input name="rep_whatsapp" required class="phone"></div>
    <div><label>Status</label><select name="status">${Object.entries(STATUS_CA).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div><div><label>Origem</label><select name="origem"><option>Indicação</option><option>Embaixador</option><option>Evento/Jantar</option><option>Instagram</option><option>Prospecção</option></select></div>
  </div><div class="row" style="margin-top:14px"><button class="btn primary">Criar</button><button type="button" class="btn ghost" onclick="this.closest('.modal').remove()">Cancelar</button></div></form></div></div>`;
  fillUF($("#newCA .uf")); maskPhone($("#newCA .phone"));
  $("#newCA").addEventListener("submit", async (e) => {
    e.preventDefault(); const o = formToObject(e.target); o.sigla = o.sigla.toUpperCase(); o.responsavel_id = S.user.id;
    const { data, error } = await sb.from("ca_centros").insert(o).select().single();
    if (error) return toast(errMsg(error));
    await sb.from("ca_contatos").insert({ centro_id: data.id, nome: o.rep_nome, cargo: o.rep_cargo, email: o.rep_email, whatsapp: o.rep_whatsapp, principal: true });
    await sb.from("ca_atividades").insert({ centro_id: data.id, tipo: "nota", descricao: "CA cadastrado manualmente pela equipe", autor_id: S.user.id });
    $("#modalRoot").innerHTML = ""; await loadAll(); go(S.view); openCA(data.id, "resumo");
  });
}
window.openNewCA = openNewCA;

/* ================= EVENTOS ================= */
function filteredEventos() {
  const f = S.evFilters, q = (f.q || "").toLowerCase();
  return S.eventos.filter((e) => {
    const c = caById(e.centro_id) || {}; const d = daysUntil(e.data_fim || e.data_inicio);
    return (!f.status || e.status === f.status) &&
      (f.periodo === "todos" || (f.periodo === "futuros" ? d === null || d >= 0 : d !== null && d < 0)) &&
      (!q || [e.nome, c.sigla, c.faculdade].join(" ").toLowerCase().includes(q));
  }).sort((a, b) => f.periodo === "passados" ? (b.data_inicio || "").localeCompare(a.data_inicio || "") : (a.data_inicio || "").localeCompare(b.data_inicio || ""));
}
function renderEventos() {
  const f = S.evFilters;
  const counts = Object.fromEntries(Object.keys(STATUS_EV).map((k) => [k, S.eventos.filter((e) => e.status === k).length]));
  $("#main").innerHTML = `<div class="topbar"><h1>Eventos</h1><span class="spacer"></span><button class="btn" onclick="exportEvCSV()">⬇ CSV</button>${canWrite() ? `<button class="btn primary" onclick="openEvento(null)">＋ Evento</button>` : ""}</div>
  <div class="chips" style="margin-bottom:12px"><span class="chip ${!f.status ? "on" : ""}" onclick="S.evFilters.status='';renderEventos()" style="${!f.status ? "border-color:var(--brand)" : ""}">Todos · ${S.eventos.length}</span>
    ${Object.entries(STATUS_EV).map(([k, l]) => `<span class="chip" onclick="S.evFilters.status='${k}';renderEventos()" style="${f.status === k ? "border-color:var(--brand);background:color-mix(in srgb,var(--brand) 10%,var(--surface))" : ""}">${l} · ${counts[k]}</span>`).join("")}</div>
  <div class="filters"><input type="search" placeholder="Buscar evento ou CA…" value="${esc(f.q)}" oninput="S.evFilters.q=this.value;renderEvList()">
    <select onchange="S.evFilters.periodo=this.value;renderEvList()"><option value="futuros" ${f.periodo === "futuros" ? "selected" : ""}>Próximos</option><option value="passados" ${f.periodo === "passados" ? "selected" : ""}>Passados</option><option value="todos" ${f.periodo === "todos" ? "selected" : ""}>Todos</option></select></div>
  <div id="evList"></div>`;
  renderEvList();
}
function renderEvList() {
  const list = filteredEventos();
  const byMonth = {};
  list.forEach((e) => { const k = e.data_inicio ? e.data_inicio.slice(0, 7) : "sem data"; (byMonth[k] ||= []).push(e); });
  const mname = (k) => { if (k === "sem data") return "Sem data"; const [y, m] = k.split("-"); return ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][+m - 1] + " " + y; };
  $("#evList").innerHTML = Object.entries(byMonth).map(([k, evs]) => `<h3 style="font-size:14px;color:var(--ink-2);margin:18px 0 8px;text-transform:uppercase;letter-spacing:.04em">${mname(k)} <span class="muted">· ${evs.length} · ${evs.reduce((a, e) => a + (e.publico_estimado || 0), 0).toLocaleString("pt-BR")} pessoas</span></h3>
    <div class="card" style="padding:4px 14px"><div class="list">${evs.map(evLine).join("")}</div></div>`).join("") || `<div class="empty card">Nenhum evento com esses filtros</div>`;
}
function exportEvCSV() {
  const rows = [["CA", "Evento", "Início", "Fim", "Status", "Público estimado", "Público majoritário", "Brindes", "Motivo recusa", "Público real", "Leads", "Enviado por"],
    ...filteredEventos().map((e) => [caById(e.centro_id)?.sigla, e.nome, fmtDate(e.data_inicio), fmtDate(e.data_fim), STATUS_EV[e.status], e.publico_estimado, e.publico_majoritario, e.brindes, e.motivo_recusa, e.publico_real, e.leads, e.enviado_por])];
  csvDownload("eventos-cas.csv", rows);
}
Object.assign(window, { renderEventos, renderEvList, exportEvCSV, exportCasCSV, renderCasTable, refresh, go, S });

function openEvento(id, centroId) {
  const e = id ? S.eventos.find((x) => x.id === id) : { centro_id: centroId || "", status: "pendente", origem: "Equipe" };
  if (!e) return;
  const c = caById(e.centro_id);
  const dis = canWrite() ? "" : "disabled";
  $("#modalRoot").innerHTML = `<div class="modal" onclick="if(event.target===this)this.remove()"><div class="card" style="width:min(680px,100%)">
  <div class="row"><h2 style="font-size:18px;margin:0;flex:1">${id ? esc(e.nome) : "Novo evento"}</h2>${c ? `<button class="btn sm" onclick="document.getElementById('modalRoot').innerHTML='';openCA('${c.id}','eventos')">${esc(c.sigla)} ↗</button>` : ""}<button class="btn ghost" onclick="this.closest('.modal').remove()">✕</button></div>
  ${id && e.enviado_por ? `<p class="small muted">Enviado por ${esc(e.enviado_por)} em ${fmtDateTime(e.created_at)} · origem: ${esc(e.origem)}</p>` : ""}
  <form id="evEdit" style="margin-top:10px"><div class="grid g2">
    ${id ? "" : `<div style="grid-column:span 2"><label>CA *</label><select name="centro_id" required><option value="">Escolha…</option>${S.cas.map((x) => `<option value="${x.id}" ${x.id === e.centro_id ? "selected" : ""}>${esc(x.sigla)} · ${esc(x.faculdade)}</option>`).join("")}</select></div>`}
    <div style="grid-column:span 2"><label>Nome *</label><input name="nome" required value="${esc(e.nome || "")}" ${dis}></div>
    <div><label>Início</label><input type="date" name="data_inicio" value="${e.data_inicio || ""}" ${dis}></div><div><label>Fim</label><input type="date" name="data_fim" value="${e.data_fim || ""}" ${dis}></div>
    <div><label>Público estimado</label><input name="publico_estimado" inputmode="numeric" value="${e.publico_estimado ?? ""}" ${dis}></div>
    <div><label>Público majoritário</label><select name="publico_majoritario" ${dis}><option value=""></option>${["Ciclo Básico", "Ciclo Clínico", "Internato", "Mesclado"].map((o) => `<option ${e.publico_majoritario === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
  </div>
  ${id ? `<div class="card small" style="padding:12px;margin:12px 0;box-shadow:none"><b>Anos presentes:</b> ${esc((e.ciclos || []).join(", ") || "—")}<br><b>Inscritos:</b> ${e.link_inscritos ? `<b>${e.inscritos_atual ?? "?"}</b>${e.inscritos_atualizado_em ? " (" + fmtDateTime(e.inscritos_atualizado_em) + ")" : ""} · <a href="${esc(e.link_inscritos)}" target="_blank">planilha</a> · <a href="#" onclick="atualizarInscritosAdm('${e.id}');return false">atualizar contagem</a>` : "sem link"}</div>` : ""}
  ${e.base_publico || e.base_majoritario ? `<div class="card small" style="padding:12px;margin:12px 0;background:var(--surface-2);box-shadow:none"><b>Base do público:</b> ${esc(e.base_publico || "—")}<br><b>Base do público majoritário:</b> ${esc(e.base_majoritario || "—")}</div>` : ""}
  <div class="field" style="margin-top:12px"><label>Informações do evento</label><textarea name="info" ${dis}>${esc(e.info || "")}</textarea></div>
  <h3 style="font-size:15px">Análise MedCof</h3>
  <div class="grid g2">
    <div><label>Status</label><select name="status" id="evStatus" ${dis}>${Object.entries(STATUS_EV).map(([k, l]) => `<option value="${k}" ${e.status === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
    <div><label>Responsável</label><select name="responsavel_id" ${dis}><option value="">—</option>${S.team.filter((t) => t.role !== "pending").map((t) => `<option value="${t.user_id}" ${e.responsavel_id === t.user_id ? "selected" : ""}>${esc(t.nome || t.email)}</option>`).join("")}</select></div>
    <div id="motivoWrap" style="grid-column:span 2" class="${e.status === "recusado" ? "" : "hidden"}"><label>Motivo da recusa</label><select name="motivo_recusa" ${dis}><option value=""></option>${["Público não qualificado", "Público pequeno", "Prazo curto", "Conflito de agenda", "Sem orçamento", "Outro"].map((o) => `<option ${e.motivo_recusa === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
    <div style="grid-column:span 2"><label>Brindes / contrapartidas combinadas</label><textarea name="brindes" rows="2" ${dis}>${esc(e.brindes || "")}</textarea></div>
  </div>
  <h3 style="font-size:15px;margin-top:12px">Resultado <span class="muted small">(depois do evento)</span></h3>
  <div class="grid g3"><div><label>Público real</label><input name="publico_real" inputmode="numeric" value="${e.publico_real ?? ""}" ${dis}></div><div><label>Leads</label><input name="leads" inputmode="numeric" value="${e.leads ?? ""}" ${dis}></div><div></div></div>
  <div class="field" style="margin-top:10px"><label>Avaliação</label><textarea name="avaliacao" rows="2" ${dis}>${esc(e.avaliacao || "")}</textarea></div>
  ${canWrite() ? `<div class="row"><button class="btn primary">Salvar</button>
    ${id && c && waLink(c.rep_whatsapp) ? `<a class="btn" target="_blank" id="waEv">💬 Avisar ${esc((c.rep_nome || "").split(" ")[0])}</a>` : ""}
    <span class="spacer"></span>${id ? `<button type="button" class="btn danger sm" onclick="delEvento('${id}')">Excluir</button>` : ""}</div>` : ""}
  </form></div></div>`;
  const st = $("#evStatus");
  const updWa = () => {
    const a = $("#waEv"); if (!a || !c) return;
    const nome = (c.rep_nome || "").split(" ")[0];
    const msgs = {
      pendente: `Oi, ${nome}! Recebemos o evento "${e.nome}" do ${c.sigla} e já estamos analisando.`,
      solicitado: `Oi, ${nome}! O evento "${e.nome}" do ${c.sigla} foi aprovado pela MedCof 🎉 Vamos alinhar os detalhes?`,
      recusado: `Oi, ${nome}! Analisamos o evento "${e.nome}" e, desta vez, não vamos conseguir participar. Seguimos juntos nos próximos!`,
      realizado: `Oi, ${nome}! Obrigado pela parceria no "${e.nome}"! Consegue nos mandar fotos e o público final?`,
      cancelado: `Oi, ${nome}! Sobre o evento "${e.nome}": vimos que foi cancelado. Qualquer novidade, é só avisar.`,
    };
    a.href = waLink(c.rep_whatsapp, msgs[st.value]);
  };
  st?.addEventListener("change", () => { $("#motivoWrap").classList.toggle("hidden", st.value !== "recusado"); updWa(); });
  updWa();
  $("#evEdit").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const o = formToObject(ev.target);
    ["publico_estimado", "publico_real", "leads"].forEach((k) => (o[k] = o[k] ? parseInt(onlyDigits(o[k])) || null : null));
    ["data_inicio", "data_fim", "responsavel_id", "publico_majoritario", "motivo_recusa"].forEach((k) => (o[k] = o[k] || null));
    if (o.status !== "recusado") o.motivo_recusa = null;
    const q = id ? sb.from("ca_eventos").update(o).eq("id", id) : sb.from("ca_eventos").insert({ ...o, origem: "Equipe" });
    const { error } = await q;
    if (error) return toast(errMsg(error));
    toast("Evento salvo"); $("#modalRoot").innerHTML = ""; await loadAll(); go(S.view);
  });
}
async function delEvento(id) {
  if (!confirm("Excluir este evento?")) return;
  const { error } = await sb.from("ca_eventos").delete().eq("id", id);
  if (error) return toast(errMsg(error));
  $("#modalRoot").innerHTML = ""; await loadAll(); go(S.view);
}
Object.assign(window, { openEvento, delEvento });

/* ================= EQUIPE ================= */
function renderEquipe() {
  if (!isOwner()) return renderHome();
  const roleL = { owner: "Admin", editor: "Editor", viewer: "Somente leitura", pending: "Aguardando" };
  $("#main").innerHTML = `<div class="topbar"><h1>Equipe</h1></div>
  <p class="muted">Quem cria conta em <b>/painel</b> aparece aqui como “Aguardando”. Libere como <b>Editor</b> (edita tudo) ou <b>Somente leitura</b>.</p>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Desde</th><th>Acesso</th><th></th></tr></thead><tbody>
  ${S.team.map((t) => `<tr><td><b>${esc(t.nome || "—")}</b><div class="small muted">${esc(t.email)}</div></td><td class="small">${fmtDate(t.created_at)}</td>
    <td>${t.role === "owner" ? `<span class="badge b-ativa">Admin</span>` : `<select onchange="setRole('${t.user_id}',this.value)" style="width:auto">${["pending", "viewer", "editor"].map((r) => `<option value="${r}" ${t.role === r ? "selected" : ""}>${roleL[r]}</option>`).join("")}</select>`}</td>
    <td>${t.role !== "owner" ? `<button class="btn sm ghost danger" onclick="removeMember('${t.user_id}')">Remover</button>` : ""}</td></tr>`).join("")}
  </tbody></table></div>`;
}
async function setRole(uid, role) {
  const { error } = await sb.from("team_members").update({ role }).eq("user_id", uid);
  if (error) return toast(errMsg(error)); toast("Acesso atualizado"); await loadAll(); renderEquipe();
}
async function removeMember(uid) {
  if (!confirm("Remover esta pessoa do painel?")) return;
  const { error } = await sb.from("team_members").delete().eq("user_id", uid);
  if (error) return toast(errMsg(error)); await loadAll(); renderEquipe();
}
Object.assign(window, { setRole, removeMember });

document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if ($("#modalRoot").innerHTML) $("#modalRoot").innerHTML = ""; else if ($("#drawerRoot").innerHTML) closeDrawer(); } });

async function atualizarInscritosAdm(id) {
  const e = S.eventos.find((x) => x.id === id);
  try { const n = await contarInscritos(e.link_inscritos); await sb.rpc("ca_evento_inscritos", { p_evento: id, p_link: null, p_qtd: n }); toast(n + " inscritos"); await refresh(); openEvento(id); }
  catch (err) { toast(errMsg(err), 5000); }
}
window.atualizarInscritosAdm = atualizarInscritosAdm;
