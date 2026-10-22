/* Área do CA — CAs parceiros: eventos, inscritos, postagens, reuniões e dados */
const STATUS_CA_L = { interesse: "Interesse", novo: "Cadastro completo", contato: "Em contato", reuniao: "Reunião", proposta: "Proposta", ativa: "Parceria ativa", pausada: "Pausada", perdida: "Perdida", encerrada: "Contrato encerrado" };
const STATUS_EV_L = { pendente: "Em análise", solicitado: "Aprovado", recusado: "Não aprovado", realizado: "Realizado", cancelado: "Cancelado" };
const EV_B = { pendente: "b-proposta", solicitado: "b-novo", recusado: "b-perdida", realizado: "b-ativa", cancelado: "b-pausada" };
const R = { user: null, centro: null, eventos: [], posts: [], metas: [], reunioes: [], tab: "inicio" };

/* ---------- auth ---------- */
let signup = false;
$("#toggleAuth").addEventListener("click", (e) => {
  e.preventDefault(); signup = !signup;
  $("#signupFields").classList.toggle("hidden", !signup);
  $("#authBtn").textContent = signup ? "Criar acesso" : "Entrar";
  e.target.textContent = signup ? "Já tenho conta" : "Primeiro acesso? Criar minha senha";
});
{ const qe = new URLSearchParams(location.search).get("email"); if (qe) $("#authForm").email.value = qe; if (location.hash === "#criar") $("#toggleAuth").click(); }
const authMsg = (m, ok) => { $("#authErr").classList.toggle("hidden", !!ok); $("#authOk").classList.toggle("hidden", !ok); $(ok ? "#authOk" : "#authErr").textContent = m; };
$("#forgot").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = $("#authForm").email.value.trim();
  if (!email) return authMsg("Digite seu e-mail acima e clique de novo em “Esqueci a senha”.");
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/ca" });
  authMsg(error ? errMsg(error) : "Enviamos um link para redefinir a senha.", !error);
});
$("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; $("#authBtn").disabled = true;
  try {
    if (signup) {
      const email = f.email.value.trim();
      const { data: ok } = await sb.rpc("ca_email_tem_acesso", { p_email: email });
      if (!ok?.ok) throw new Error("Este e-mail não está cadastrado em nenhum CA. Use o e-mail do formulário de interesse ou peça para a MedCof incluir você nos contatos do CA.");
      const { data, error } = await sb.auth.signUp({ email, password: f.senha.value,
        options: { data: { tipo: "ca", nome: f.nome.value.trim(), cargo: f.cargo.value.trim() }, emailRedirectTo: location.origin + "/ca" } });
      if (error) throw error;
      if (!data.session) authMsg("Acesso criado! Confirme pelo link que enviamos ao seu e-mail e depois entre.", true);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value });
      if (error) throw error;
    }
  } catch (err) { authMsg(errMsg(err)); }
  finally { $("#authBtn").disabled = false; }
});
async function logout() { await sb.auth.signOut(); location.reload(); }
window.logout = logout;
function show(id) { ["authView", "teamView", "appView"].forEach((v) => $("#" + v).classList.toggle("hidden", v !== id)); }

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
  if (booted && R.user?.id === session.user.id) return;
  booted = true; R.user = session.user;
  const { data: link } = await sb.from("ca_usuarios").select("*").eq("user_id", R.user.id).maybeSingle();
  if (!link) {
    const { data: tm } = await sb.from("team_members").select("role").eq("user_id", R.user.id).maybeSingle();
    if (tm) return show("teamView");
    show("authView"); return authMsg("Esta conta não está ligada a nenhum CA. Fale com a equipe MedCof.");
  }
  show("appView");
  await load(link.centro_id);
  const h = location.hash.replace("#", "");
  go(["inicio", "eventos", "postagens", "reunioes", "dados", "manual"].includes(h) ? h : (R.centro.cadastro_completo ? "inicio" : "dados"));
}

async function load(cid) {
  const [c, e, p, m, r] = await Promise.all([
    sb.from("ca_centros").select("*").eq("id", cid).single(),
    sb.from("ca_eventos").select("*").eq("centro_id", cid).order("data_inicio"),
    sb.from("ca_posts").select("*").eq("centro_id", cid).order("data_post", { ascending: false }),
    sb.from("ca_metas_post").select("*").eq("centro_id", cid),
    sb.from("ca_reunioes").select("*").eq("centro_id", cid).order("data_hora"),
  ]);
  R.centro = c.data; R.eventos = e.data || []; R.posts = p.data || []; R.metas = m.data || []; R.reunioes = r.data || [];
  $("#caTitle").textContent = R.centro.sigla + " · " + (R.centro.nome || "");
  $("#caSub").textContent = `${R.centro.faculdade || ""} · ${R.centro.cidade || ""}/${R.centro.uf || ""}`;
  $("#caBadge").innerHTML = `<span class="badge b-${R.centro.status}">${STATUS_CA_L[R.centro.status] || R.centro.status}</span>`;
}

const TABS = [["inicio", "Início"], ["eventos", "Eventos"], ["postagens", "Postagens"], ["reunioes", "Reuniões"], ["dados", "Cadastro do CA"], ["manual", "Manual do CA"]];
function go(t) {
  R.tab = t; location.hash = t;
  $("#tabs").innerHTML = TABS.map(([k, l]) => `<button class="${k === t ? "on" : ""}" onclick="go('${k}')">${l}</button>`).join("");
  ({ inicio: vInicio, eventos: vEventos, postagens: vPostagens, reunioes: vReunioes, dados: vDados, manual: vManual }[t])();
}
window.go = go;
const reload = async (t) => { await load(R.centro.id); go(t || R.tab); };

/* ---------- Início ---------- */
function metaLine(s) {
  const pct = Math.min(100, Math.round((s.feitos / (s.quantidade || 1)) * 100));
  return `<div class="li"><div style="flex:1;min-width:0"><div class="t">${s.quantidade}× ${esc(TIPOS_POST[s.tipo] || s.tipo)} <span class="muted small">${s.label}</span></div>
    <div class="prog" style="margin:6px 0"><span style="width:${pct}%"></span></div>
    <div class="small muted">${s.feitos} de ${s.quantidade}${s.descricao ? " · " + esc(s.descricao) : ""}</div></div>
    <span class="small lvl-${s.nivel}">${!s.vigente ? "fora da vigência" : s.falta === 0 ? "✔ em dia" : s.dias !== null ? `faltam ${s.falta} · ${s.dias < 0 ? "vencido" : s.dias === 0 ? "vence hoje" : "vence em " + s.dias + "d"}` : `faltam ${s.falta}`}</span></div>`;
}
function reuniaoLine(r) {
  const d = new Date(r.data_hora);
  return `<div class="cal-item"><div class="cal-date"><b>${String(d.getDate()).padStart(2, "0")}</b><span class="small muted">${["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][d.getMonth()]}</span></div>
    <div style="flex:1;min-width:0"><div class="t" style="font-weight:600">${esc(r.titulo)}</div><div class="small muted">${d.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · ${r.status === "solicitada" ? "solicitada pelo CA (aguardando confirmação)" : r.status}${r.pauta ? " · " + esc(r.pauta.slice(0, 80)) : ""}</div></div>
    ${r.link ? `<a class="btn sm" target="_blank" href="${esc(r.link)}">Entrar</a>` : ""}${r.status !== "cancelada" ? `<a class="btn sm ghost" target="_blank" href="${gcalLink(r, R.centro.sigla)}" title="Adicionar ao Google Agenda">📅</a>` : ""}</div>`;
}
function vInicio() {
  const st = statusMetas(R.metas, R.posts).filter((s) => s.vigente);
  const alertas = st.filter((s) => s.falta > 0).sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));
  const prox = R.reunioes.filter((r) => new Date(r.data_hora) >= new Date(Date.now() - 3600e3) && r.status !== "cancelada");
  const evFut = R.eventos.filter((e) => daysUntil(e.data_fim || e.data_inicio) >= 0 && !["cancelado", "recusado"].includes(e.status));
  const gest = daysUntil(R.centro.gestao_fim);
  $("#view").innerHTML = `
  ${gest !== null && gest <= 45 ? `<div class="alert info" style="margin-bottom:14px">🔄 A gestão termina em ${gest < 0 ? "breve (data já passou)" : gest + " dias"} (${fmtDate(R.centro.gestao_fim)}). Combine com a MedCof a passagem de bastão para a nova diretoria e atualize os dados do CA.</div>` : ""}
  ${R.centro.status === "interesse" || !R.centro.cadastro_completo ? `<div class="alert info" style="margin-bottom:14px">📝 Falta completar o cadastro do CA (gestão, canais e endereço para brindes). <a href="#" onclick="go('dados');return false">Completar agora</a></div>` : ""}
  <div class="kpis">
    <div class="kpi"><div class="v">${evFut.length}</div><div class="l">Eventos futuros</div></div>
    <div class="kpi"><div class="v">${R.posts.filter((p) => p.status !== "recusado").length}</div><div class="l">Postagens registradas</div></div>
    <div class="kpi"><div class="v" style="color:${alertas.some((a) => a.nivel === "urgente") ? "var(--bad)" : "var(--ink)"}">${alertas.reduce((a, s) => a + s.falta, 0)}</div><div class="l">Postagens pendentes</div></div>
    <div class="kpi"><div class="v">${prox.length}</div><div class="l">Reuniões agendadas</div></div>
  </div>
  <div class="two">
    <div class="card"><div class="row"><h3 style="margin:0;font-size:16px">Prazos de postagem</h3><span class="spacer"></span><button class="btn sm primary" onclick="go('postagens')">＋ Registrar post</button></div>
      <div class="list alerts">${st.length ? st.sort((a, b) => b.falta - a.falta).map(metaLine).join("") : `<div class="empty">Sem metas de postagem cadastradas no momento.</div>`}</div></div>
    <div class="card"><h3 style="font-size:16px">Próximas reuniões</h3>
      ${prox.length ? prox.slice(0, 5).map(reuniaoLine).join("") : `<div class="empty">Nenhuma reunião agendada. <a href="#" onclick="go('reunioes');return false">Solicitar reunião</a></div>`}</div>
  </div>
  <div class="card" style="margin-top:14px"><div class="row"><h3 style="margin:0;font-size:16px">Próximos eventos</h3><span class="spacer"></span><button class="btn sm primary" onclick="go('eventos')">＋ Cadastrar evento</button></div>
    <div class="list">${evFut.length ? evFut.map(evLineCA).join("") : `<div class="empty">Nenhum evento futuro. Cadastre com pelo menos 45 dias de antecedência.</div>`}</div></div>`;
}
function evLineCA(e) {
  const d = daysUntil(e.data_inicio);
  return `<div class="li" style="cursor:default"><div style="width:46px;text-align:center"><div style="font-weight:800;font-size:18px;line-height:1">${e.data_inicio ? e.data_inicio.slice(8, 10) : "—"}</div><div class="small muted">${e.data_inicio ? ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][+e.data_inicio.slice(5, 7) - 1] : ""}</div></div>
    <div style="flex:1;min-width:0"><div class="t">${esc(e.nome)}</div><div class="small muted">${e.publico_estimado ?? "?"} pessoas estimadas · ${esc((e.ciclos || []).join(", ") || e.publico_majoritario || "")}${d !== null && d >= 0 ? ` · em ${d}d` : ""}</div>
    <div class="small">${e.link_inscritos ? `👥 <b>${e.inscritos_atual ?? "?"}</b> inscritos${e.inscritos_atualizado_em ? ` <span class="muted">(${fmtDateTime(e.inscritos_atualizado_em)})</span>` : ""} · <a href="#" onclick="atualizarInscritos('${e.id}');return false">atualizar</a>` : `<a href="#" onclick="linkInscritos('${e.id}');return false">＋ link da planilha de inscritos</a>`}</div></div>
    <span class="badge ${EV_B[e.status]}">${STATUS_EV_L[e.status] || e.status}</span></div>`;
}

/* ---------- Eventos ---------- */
function vEventos() {
  const evs = [...R.eventos].sort((a, b) => (b.data_inicio || "").localeCompare(a.data_inicio || ""));
  $("#view").innerHTML = `<div class="two">
  <form class="card" id="evForm" novalidate><h3 style="font-size:16px">Cadastrar evento</h3>
    <p class="small muted" style="margin-top:-6px">Um evento por envio, de preferência com 45 dias de antecedência.</p>
    <div class="field"><label>Nome do evento *</label><input name="nome" required maxlength="200"></div>
    <div class="grid g2"><div class="field"><label>Início *</label><input name="data_inicio" type="date" required></div><div class="field"><label>Fim</label><input name="data_fim" type="date"></div></div>
    <div class="grid g2"><div class="field"><label>Público estimado *</label><input name="publico_estimado" required inputmode="numeric" placeholder="Ex.: 150"></div>
      <div class="field"><label>Base do público estimado</label><input name="base_publico" maxlength="600" placeholder="Ex.: edição anterior, inscritos…"></div></div>
    <div class="field"><label>Quais anos vão estar mais presentes? *</label><div class="chips">${CICLOS.map((c) => `<label class="chip"><input type="checkbox" name="ciclos[]" value="${c}"> ${c}</label>`).join("")}</div></div>
    <div class="field"><label>Link da planilha de inscritos</label><input name="link_inscritos" type="url" placeholder="docs.google.com/spreadsheets/…"><div class="small muted">Compartilhe como “qualquer pessoa com o link pode ver”. A contagem é automática.</div></div>
    <div class="field"><label>O que esperam da MedCof?</label><textarea name="info" maxlength="3000" placeholder="Stand, palestrante, brindes, simulado, programação, local…"></textarea></div>
    <div id="evErr" class="alert err hidden"></div>
    <button class="btn primary" id="evBtn">Enviar evento</button></form>
  <div class="card"><h3 style="font-size:16px">Eventos do CA</h3><div class="list">${evs.map(evLineCA).join("") || `<div class="empty">Nenhum evento ainda</div>`}</div></div></div>`;
  $("#evForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target, err = $("#evErr"); err.classList.add("hidden");
    const p = formToObject(f);
    if (!p.nome || !p.data_inicio || !p.publico_estimado) { err.textContent = "Preencha nome, data e público estimado."; return err.classList.remove("hidden"); }
    if (!p.ciclos || !p.ciclos.length) { err.textContent = "Marque quais anos vão estar mais presentes."; return err.classList.remove("hidden"); }
    $("#evBtn").disabled = true;
    try {
      const { data, error } = await sb.rpc("ca_registrar_evento", { p }); if (error) throw error;
      if (p.link_inscritos && data?.id) { try { const n = await contarInscritos(p.link_inscritos); await sb.rpc("ca_evento_inscritos", { p_evento: data.id, p_link: p.link_inscritos, p_qtd: n }); } catch (_) {} }
      toast("Evento enviado! A MedCof vai analisar."); reload("eventos");
    } catch (e) { err.textContent = errMsg(e); err.classList.remove("hidden"); }
    finally { $("#evBtn").disabled = false; }
  });
}
async function atualizarInscritos(id) {
  const e = R.eventos.find((x) => x.id === id);
  try { const n = await contarInscritos(e.link_inscritos); const { error } = await sb.rpc("ca_evento_inscritos", { p_evento: id, p_link: null, p_qtd: n }); if (error) throw error; toast(`${n} inscritos`); reload(); }
  catch (err) { const n = prompt(errMsg(err) + "\n\nSe preferir, digite o número de inscritos:"); if (n && /^\d+$/.test(n)) { await sb.rpc("ca_evento_inscritos", { p_evento: id, p_link: null, p_qtd: +n }); reload(); } }
}
async function linkInscritos(id) {
  const link = prompt("Cole o link da planilha de inscritos (Google Planilhas, compartilhada como “qualquer pessoa com o link pode ver”):");
  if (!link) return;
  let n = null; try { n = await contarInscritos(link); } catch (e) { toast(errMsg(e), 5000); }
  const { error } = await sb.rpc("ca_evento_inscritos", { p_evento: id, p_link: link, p_qtd: n });
  if (error) return toast(errMsg(error)); toast(n !== null ? `${n} inscritos` : "Link salvo"); reload();
}
Object.assign(window, { atualizarInscritos, linkInscritos });

/* ---------- Postagens ---------- */
function vPostagens() {
  const st = statusMetas(R.metas, R.posts);
  $("#view").innerHTML = `<div class="two">
  <div>
    <form class="card" id="postForm"><h3 style="font-size:16px">Registrar postagem com a MedCof</h3>
      <div class="grid g2"><div class="field"><label>Tipo *</label><select name="tipo">${["feed", "story", "reels", "destaque", "video"].map((t) => `<option value="${t}">${TIPOS_POST[t]}</option>`).join("")}</select></div>
        <div class="field"><label>Data da postagem *</label><input name="data_post" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div></div>
      <div class="field"><label>Link do post *</label><input name="link" type="url" required placeholder="https://www.instagram.com/p/…"><div class="small muted">Para stories, mande o link do destaque ou de um print salvo no Drive.</div></div>
      <div class="field"><label>Evento relacionado</label><select name="evento_id"><option value="">—</option>${R.eventos.map((e) => `<option value="${e.id}">${esc(e.nome)} (${fmtDate(e.data_inicio)})</option>`).join("")}</select></div>
      <div class="field"><label>Observação</label><input name="descricao" maxlength="300"></div>
      <button class="btn primary">Registrar</button></form>
    <div class="card" style="margin-top:14px"><h3 style="font-size:16px">Combinado no contrato</h3><div class="list">${st.map(metaLine).join("") || `<div class="empty">Sem metas cadastradas.</div>`}</div></div>
  </div>
  <div class="card"><h3 style="font-size:16px">Postagens registradas</h3><div class="list">${R.posts.map((p) => `<div class="li" style="cursor:default"><span>${{ feed: "🖼", story: "⏱", reels: "🎬", destaque: "⭐", video: "🎬" }[p.tipo] || "•"}</span>
    <div style="flex:1;min-width:0"><div class="t">${esc(TIPOS_POST[p.tipo] || p.tipo)} · ${fmtDate(p.data_post)}</div><div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(p.link)}" target="_blank">${esc(p.link)}</a></div></div>
    <span class="badge ${p.status === "validado" ? "b-ativa" : p.status === "recusado" ? "b-perdida" : "b-novo"}">${{ enviado: "enviado", validado: "validado", recusado: "recusado" }[p.status]}</span>
    ${p.status === "enviado" ? `<button class="btn sm ghost danger" onclick="delPost('${p.id}')" aria-label="Remover">✕</button>` : ""}</div>`).join("") || `<div class="empty">Nenhuma postagem registrada</div>`}</div></div></div>`;
  $("#postForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const o = formToObject(ev.target);
    if (!/^https?:\/\//.test(o.link)) return toast("Cole o link completo do post.");
    const { error } = await sb.from("ca_posts").insert({ ...o, evento_id: o.evento_id || null, centro_id: R.centro.id });
    if (error) return toast(errMsg(error)); toast("Postagem registrada"); reload("postagens");
  });
}
async function delPost(id) { if (!confirm("Remover esta postagem?")) return; await sb.from("ca_posts").delete().eq("id", id); reload("postagens"); }
window.delPost = delPost;

/* ---------- Reuniões ---------- */
function vReunioes() {
  const fut = R.reunioes.filter((r) => new Date(r.data_hora) >= new Date(Date.now() - 3600e3));
  const pas = R.reunioes.filter((r) => new Date(r.data_hora) < new Date(Date.now() - 3600e3)).reverse();
  $("#view").innerHTML = `<div class="two">
  <div class="card"><h3 style="font-size:16px">Próximas</h3>${fut.map(reuniaoLine).join("") || `<div class="empty">Nenhuma reunião agendada</div>`}
    <h3 style="font-size:16px;margin-top:18px">Anteriores</h3>${pas.map(reuniaoLine).join("") || `<div class="empty">—</div>`}</div>
  <form class="card" id="reuForm"><h3 style="font-size:16px">Solicitar reunião</h3>
    <p class="small muted" style="margin-top:-6px">Sugira um horário. A MedCof confirma e manda o link.</p>
    <div class="field"><label>Data e hora sugeridas *</label><input name="data_hora" type="datetime-local" required></div>
    <div class="field"><label>Assunto *</label><input name="titulo" required maxlength="120" placeholder="Ex.: alinhar o congresso de maio"></div>
    <div class="field"><label>Pauta</label><textarea name="pauta" maxlength="1000"></textarea></div>
    <button class="btn primary">Solicitar</button></form></div>`;
  $("#reuForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const o = formToObject(ev.target);
    const { error } = await sb.from("ca_reunioes").insert({ centro_id: R.centro.id, titulo: o.titulo, pauta: o.pauta, data_hora: new Date(o.data_hora).toISOString(), status: "solicitada", solicitada_pelo_ca: true });
    if (error) return toast(errMsg(error)); toast("Reunião solicitada"); reload("reunioes");
  });
}

/* ---------- Cadastro completo do CA ---------- */
function vDados() {
  const c = R.centro;
  const I = (k, l, o = {}) => `<div class="field" ${o.span ? `style="grid-column:span ${o.span}"` : ""}><label for="d_${k}">${l}${o.req ? " *" : ""}</label><input id="d_${k}" name="${k}" type="${o.type || "text"}" value="${esc(c[k] ?? "")}" ${o.req ? "required" : ""} ${o.ph ? `placeholder="${o.ph}"` : ""} ${o.cls ? `class="${o.cls}"` : ""}></div>`;
  const S = (k, l, opts, o = {}) => `<div class="field"><label for="d_${k}">${l}</label><select id="d_${k}" name="${k}" ${o.cls ? `class="${o.cls}"` : ""}>${opts.map(([v, t]) => `<option value="${v}" ${String(c[k] ?? "") === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></div>`;
  const sn = [["", "—"], ["true", "Sim"], ["false", "Não"]];
  $("#view").innerHTML = `<form class="card" id="dadosForm" novalidate style="max-width:900px">
    ${!c.cadastro_completo ? `<div class="alert info" style="margin-bottom:14px">Complete o cadastro do CA. Leva uns 5 minutos e é com ele que a MedCof organiza eventos e brindes.</div>` : ""}
    <input type="hidden" name="escola_ref" id="d_escola_ref" value="${esc(c.escola_ref || "")}">
    <h3 style="font-size:16px">1. Entidade</h3>
    <div class="grid g3">${I("nome", "Nome completo da entidade", { req: 1, span: 2 })}${S("tipo", "Tipo", ["CA", "DA", "Diretório Científico", "DCE", "Atlética", "Liga", "Outro"].map((x) => [x, x]))}</div>
    <div class="grid g3">${I("faculdade", "Faculdade", { req: 1, span: 2 })}${I("cidade", "Cidade", { req: 1 })}</div>
    <div class="grid g3"><div class="field"><label for="d_uf">Estado *</label><select id="d_uf" name="uf" class="uf"></select></div>${I("email_entidade", "E-mail da entidade", { type: "email" })}${I("telefone_entidade", "Telefone da entidade", { cls: "phone" })}</div>
    <div class="grid g3">${S("tem_cnpj", "Possui CNPJ?", sn)}${I("cnpj", "CNPJ", { span: 2 })}</div>
    <div class="form-sec"><h3>2. Gestão atual</h3>
      <div class="grid g3">${I("gestao_inicio", "Início da gestão", { type: "date" })}${I("gestao_fim", "Término previsto", { type: "date", req: 1 })}${S("troca_gestao", "Troca de gestão", [["", "—"], ["Anualmente", "Anualmente"], ["Semestralmente", "Semestralmente"], ["A cada 2 anos", "A cada 2 anos"], ["Outra", "Outra"]])}</div>
      <div class="grid g3">${I("tamanho_gestao", "Pessoas na gestão", { ph: "Ex.: 20 diretores + 40 membros" })}${I("alunos_cobertos", "Alunos alcançados pelo CA", { req: 1 })}${I("alunos_cobertos_obs", "Obs. sobre os alunos", { ph: "Ex.: 1º ao 4º ano" })}</div></div>
    <div class="form-sec"><h3>3. Canais</h3>
      <div class="grid g3">${I("instagram", "Instagram oficial", { req: 1, ph: "@seuca" })}${I("seguidores", "Seguidores (aprox.)")}${I("outros_canais", "Outros canais (TikTok, site…)")}</div>
      <div class="grid g3">${S("tem_grupo", "Grupo de WhatsApp com alunos?", sn)}${I("alunos_grupos", "Alunos nos grupos")}${I("alunos_grupos_obs", "Obs. sobre os grupos")}</div></div>
    <div class="form-sec"><h3>4. Representante da parceria</h3>
      <div class="grid g3">${I("rep_nome", "Nome completo", { req: 1 })}${I("rep_cargo", "Cargo", { req: 1 })}${I("rep_cpf", "CPF")}</div>
      <div class="grid g2">${I("rep_email", "E-mail", { type: "email", req: 1 })}${I("rep_whatsapp", "WhatsApp", { req: 1, cls: "phone" })}</div></div>
    <div class="form-sec"><h3>5. Endereço para envio de brindes</h3>
      <div class="grid g3">${I("entrega_nome", "Destinatário", { req: 1 })}${I("entrega_telefone", "Telefone", { req: 1, cls: "phone" })}${I("entrega_cpf", "CPF do destinatário")}</div>
      <div class="grid g3">${I("entrega_cep", "CEP", { req: 1 })}${I("entrega_logradouro", "Rua/Av. + número", { req: 1, span: 2 })}</div>
      <div class="grid g3">${I("entrega_complemento", "Complemento")}${I("entrega_bairro", "Bairro", { req: 1 })}${I("entrega_cidade", "Cidade", { req: 1 })}</div>
      <div class="grid g3"><div class="field"><label for="d_entrega_uf">Estado *</label><select id="d_entrega_uf" name="entrega_uf" class="uf"></select></div>${I("entrega_email", "E-mail do destinatário", { type: "email" })}</div></div>
    <div class="form-sec"><h3>6. Observações</h3><textarea name="observacoes_ca" maxlength="2000">${esc(c.observacoes_ca || "")}</textarea>
      <label class="chip" style="display:flex;margin-top:10px"><input type="checkbox" name="declaracao" data-bool ${c.declaracao ? "checked" : ""}> Declaro que as informações são verdadeiras e que tenho autorização para responder em nome da entidade. *</label></div>
    <div id="dErr" class="alert err hidden" style="margin-top:14px"></div>
    <button class="btn primary" style="margin-top:14px" id="dBtn">Salvar cadastro</button></form>`;
  $$("#dadosForm .uf").forEach((s) => fillUF(s));
  $("#d_uf").value = c.uf || ""; $("#d_entrega_uf").value = c.entrega_uf || "";
  $$("#dadosForm .phone").forEach(maskPhone);
  attachEscolaPicker($("#d_faculdade"), { cidade: $("#d_cidade"), uf: $("#d_uf"), ref: $("#d_escola_ref") });
  $("#d_entrega_cep").addEventListener("blur", async (e) => {
    const d = onlyDigits(e.target.value); if (d.length !== 8) return;
    try { const j = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json(); if (j.erro) return;
      if (!$("#d_entrega_logradouro").value) $("#d_entrega_logradouro").value = j.logradouro ? j.logradouro + ", " : "";
      if (!$("#d_entrega_bairro").value) $("#d_entrega_bairro").value = j.bairro || ""; if (!$("#d_entrega_cidade").value) $("#d_entrega_cidade").value = j.localidade || "";
      $("#d_entrega_uf").value = j.uf || ""; } catch (_) {}
  });
  $("#dadosForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target, err = $("#dErr"); err.classList.add("hidden");
    const bad = $$("[required]", f).find((el) => !el.value.trim()) || (!f.uf.value && f.uf) || (!f.entrega_uf.value && f.entrega_uf);
    if (bad) { err.textContent = "Preencha os campos obrigatórios (*)."; err.classList.remove("hidden"); bad.focus(); return; }
    if (!f.declaracao.checked) { err.textContent = "Marque a declaração de veracidade."; err.classList.remove("hidden"); return; }
    $("#dBtn").disabled = true;
    try { const { error } = await sb.rpc("ca_cadastro", { p: formToObject(f) }); if (error) throw error; toast("Cadastro salvo"); reload("inicio"); }
    catch (e) { err.textContent = errMsg(e); err.classList.remove("hidden"); }
    finally { $("#dBtn").disabled = false; }
  });
}

/* ---------- Manual (só com login) ---------- */
async function vManual() {
  $("#view").innerHTML = `<div class="empty">Carregando o manual…</div>`;
  const { data } = await sb.from("ca_docs").select("html").eq("slug", "manual").maybeSingle();
  $("#view").innerHTML = data ? `<article class="manual card">${data.html}</article>` : `<div class="empty">Manual indisponível no momento.</div>`;
}
