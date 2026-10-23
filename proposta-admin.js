/* Painel — gerador de propostas + patrocínios das atléticas */
(function () {
  const P = window.Proposta;
  const PASTA_ATLETICAS = "https://drive.google.com/drive/folders/1jqgMJcH9wkCjVDsSXyaYqKr3T-6yLNDZ";
  const PLANO_B = { PREMIUM: "b-ativa", ELITE: "b-novo", REGULAR: "b-contato" };

  /* carrega atléticas e propostas junto com o resto */
  const baseLoad = window.loadExtra;
  window.loadExtra = async function () {
    await baseLoad();
    const [a, p] = await Promise.all([
      sb.from("ca_atleticas").select("*").order("vigencia_fim", { ascending: false }),
      sb.from("ca_propostas").select("id,centro_id,titulo,status,created_at,updated_at,dados").order("updated_at", { ascending: false }),
    ]);
    S.atleticas = a.data || []; S.propostas = p.data || [];
  };

  /* ---------- botão flutuante ---------- */
  function fab() {
    if (document.getElementById("pbFab")) return;
    const b = document.createElement("button");
    b.id = "pbFab"; b.className = "pb-fab";
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/></svg>Criar proposta`;
    b.onclick = () => openProposta();
    document.getElementById("appView").appendChild(b);
  }
  document.addEventListener("DOMContentLoaded", fab);
  if (document.readyState !== "loading") fab();

  /* ---------- gerador ---------- */
  let D = null, PID = null;
  const atlDe = (cid) => (S.atleticas || []).filter((x) => x.centro_id === cid);
  const ctDe = (cid) => (S.contratos || []).filter((x) => x.centro_id === cid);

  function refBox() {
    if (!D.centro_id) return `<div class="pb-ref muted small">Escolha um CA cadastrado para ver os contratos e o patrocínio da atlética da mesma faculdade.</div>`;
    const c = caById(D.centro_id) || {};
    const at = atlDe(D.centro_id), ks = ctDe(D.centro_id);
    const linha = (t, v, s) => `<div class="pb-rl"><span>${t}</span><b>${v}</b><small>${s}</small></div>`;
    return `<div class="pb-ref"><div class="pb-ref-h">Referências (não aparece na proposta)</div>
      ${linha("Alunos cobertos", c.alunos_cobertos ? c.alunos_cobertos.toLocaleString("pt-BR") : "—", `sugere ${P.porteDe(c.alunos_cobertos).nome}`)}
      ${at.map((a) => linha(`Atlética${a.vigente ? "" : " (encerrado)"}`, `${fmtBRL(a.valor_total)} · ${esc(a.plano || a.tipo || "")}`, `${esc(a.atletica_nome)} · ${a.duracao_meses || "?"} meses · até ${fmtDate(a.vigencia_fim)}`)).join("") || linha("Atlética", "—", "nenhum contrato encontrado")}
      ${ks.map((k) => linha("Contrato do CA", fmtBRL(k.valor_total), `${esc(k.titulo || "")} · até ${fmtDate(k.vigencia_fim)}`)).join("")}
    </div>`;
  }

  function checks(name, padrao, extras, atual) {
    const todos = [...new Set([...padrao, ...extras, ...atual])];
    const outros = atual.filter((x) => !padrao.includes(x) && !extras.includes(x));
    return `<div class="pb-checks">${todos.filter((x) => !outros.includes(x)).map((x) => `<label class="pb-ck"><input type="checkbox" name="${name}" value="${esc(x)}" ${atual.includes(x) ? "checked" : ""}><span>${esc(x)}</span></label>`).join("")}</div>
      <label class="small muted" style="margin-top:8px;display:block">Itens personalizados (um por linha)</label>
      <textarea name="${name}_extra" rows="2" placeholder="Ex.: Bolsa integral para o presidente do CA">${esc(outros.join("\n"))}</textarea>`;
  }

  function opRows() {
    return D.opcoes.map((o, i) => `<div class="pb-op" data-i="${i}">
      <label class="pb-radio" title="Recomendado"><input type="radio" name="dest" value="${i}" ${Number(D.destaque) === i ? "checked" : ""}><span>★</span></label>
      <div><small>Duração</small><div class="pb-in"><input name="meses" type="number" min="1" max="60" value="${o.meses}"><span>meses</span></div></div>
      <div><small>Valor anual</small><div class="pb-in"><span>R$</span><input name="anual" inputmode="numeric" value="${o.anual}"></div></div>
      <div><small>Total</small><div class="pb-in"><span>R$</span><input name="total" inputmode="numeric" value="${o.total}"></div></div>
      <button type="button" class="btn sm ghost" data-del="${i}" aria-label="Remover">✕</button>
    </div>`).join("");
  }

  function form() {
    const cas = [...S.cas].sort((a, b) => a.sigla.localeCompare(b.sigla));
    return `<form id="pbForm" class="pb-form" onsubmit="return false">
      <section><h3>Para quem</h3>
        <label>Centro acadêmico</label>
        <select name="centro_id"><option value="">— CA não cadastrado —</option>${cas.map((c) => `<option value="${c.id}" ${D.centro_id === c.id ? "selected" : ""}>${esc(c.sigla)} · ${esc(c.faculdade || "")}</option>`).join("")}</select>
        <div class="grid g2" style="margin-top:10px"><div><label>Sigla</label><input name="sigla" value="${esc(D.sigla)}"></div><div><label>Cidade</label><input name="cidade" value="${esc(D.cidade)}"></div></div>
        <label>Nome do CA</label><input name="nome_ca" value="${esc(D.nome_ca)}">
        <label>Faculdade</label><input name="faculdade" value="${esc(D.faculdade)}">
        <div id="pbRef">${refBox()}</div>
      </section>
      <section><h3>Valor e duração <small class="muted">— página final</small></h3>
        <label>Porte do CA (define o valor anual base)</label>
        <div class="seg">${P.PORTES.map((p) => `<button type="button" data-porte="${p.id}" class="${D.porte === p.id ? "on" : ""}">${p.id}<small>${fmtBRL(p.anual)}/ano</small></button>`).join("")}</div>
        <div class="grid g2" style="margin-top:10px">
          <div><label>Valor anual base (12 meses)</label><div class="pb-in big"><span>R$</span><input name="anual_base" inputmode="numeric" value="${D.anual_base}"></div></div>
          <div><label>Início do contrato</label><input type="date" name="inicio" value="${D.inicio}"></div>
        </div>
        <p class="small muted">Quanto mais tempo, maior o valor anual: 12m ×1 · 18m ×1,25 · 24m ×1,5 · 30m ×1,625. Edite qualquer número à mão.</p>
        <div id="pbOps">${opRows()}</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn sm" id="pbAddOp">＋ Opção</button><button type="button" class="btn sm ghost" id="pbRegen">Recalcular pela tabela</button></div>
        <label style="margin-top:12px">Pagamento</label><input name="pagamento" value="${esc(D.pagamento)}">
        <div class="grid g2"><div><label>Validade (dias)</label><input name="validade" type="number" min="1" value="${D.validade}"></div><div><label>Contato na última página</label><input name="contato" value="${esc(D.contato)}"></div></div>
      </section>
      <section><h3>A MedCof entrega</h3>${checks("medcof", P.ENTREGA_MEDCOF, P.ENTREGA_MEDCOF_EXTRAS, D.medcof)}</section>
      <section><h3>O CA entrega</h3>${checks("ca", P.ENTREGA_CA, P.ENTREGA_CA_EXTRAS, D.ca)}</section>
      <section><h3>Eventos <small class="muted">— página “Onde a MedCof aparece”</small></h3>
        <p class="small muted" style="margin-top:-6px">Um por linha: nome | público | quando. Vem preenchido pelo roteiro da última reunião. Deixe vazio para não mostrar a página.</p>
        <textarea name="eventos_txt" rows="4" placeholder="CONCAM | 250 | maio">${esc((D.eventos || []).map((e) => [e.nome, e.publico ?? "", e.data || ""].join(" | ").replace(/( \| )+$/, "")).join("\n"))}</textarea></section>
    </form>`;
  }

  function readForm() {
    const f = document.getElementById("pbForm");
    const v = (n) => f.elements[n]?.value ?? "";
    const num = (s) => Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    D.centro_id = v("centro_id") || null; D.sigla = v("sigla").trim(); D.cidade = v("cidade").trim(); D.nome_ca = v("nome_ca").trim(); D.faculdade = v("faculdade").trim();
    D.anual_base = num(v("anual_base")); D.inicio = v("inicio") || D.inicio; D.pagamento = v("pagamento"); D.validade = Number(v("validade")) || 15; D.contato = v("contato");
    D.opcoes = [...f.querySelectorAll(".pb-op")].map((r) => ({ meses: Number(r.querySelector('[name="meses"]').value) || 12, anual: num(r.querySelector('[name="anual"]').value), total: num(r.querySelector('[name="total"]').value) }));
    const d = f.querySelector('[name="dest"]:checked'); D.destaque = d ? Number(d.value) : 0;
    D.eventos = v("eventos_txt").split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((a) => a[0]).map(([nome, pub, data]) => ({ nome, publico: pub ? Number(String(pub).replace(/\D/g, "")) || null : null, data: data || "" }));
    for (const k of ["medcof", "ca"]) {
      const marc = [...f.querySelectorAll(`[name="${k}"]:checked`)].map((x) => x.value);
      const extra = v(k + "_extra").split("\n").map((s) => s.trim()).filter(Boolean);
      D[k] = [...marc, ...extra];
    }
  }

  function preview() { document.getElementById("pbPrev").innerHTML = P.render(D); }
  function redrawOps() { document.getElementById("pbOps").innerHTML = opRows(); }

  function bind() {
    const f = document.getElementById("pbForm");
    f.addEventListener("input", (e) => {
      const n = e.target.name;
      if (n === "anual" || n === "meses") { // total acompanha anual × meses
        const row = e.target.closest(".pb-op");
        const m = Number(row.querySelector('[name="meses"]').value) || 12;
        const a = Number(String(row.querySelector('[name="anual"]').value).replace(/\D/g, "")) || 0;
        row.querySelector('[name="total"]').value = P.recalcula({ meses: m, anual: a }).total;
      }
      readForm();
      if (n === "anual_base") { D.opcoes = P.gerarOpcoes(D.anual_base, D.inicio, D.opcoes.map((o, i) => ({ meses: o.meses, fator: (P.DURACOES[i] || P.DURACOES[P.DURACOES.length - 1]).fator }))); redrawOps(); }
      preview();
    });
    f.addEventListener("change", (e) => {
      if (e.target.name !== "centro_id") return;
      const c = caById(e.target.value);
      if (c) { const n = P.defaults(c); Object.assign(D, { centro_id: c.id, sigla: n.sigla, nome_ca: n.nome_ca, faculdade: n.faculdade, cidade: n.cidade, porte: n.porte, anual_base: n.anual_base, opcoes: n.opcoes }); aplicarRoteiro(c.id); }
      else D.centro_id = null;
      rerender();
    });
    f.addEventListener("click", (e) => {
      const p = e.target.closest("[data-porte]");
      if (p) { const po = P.PORTES.find((x) => x.id === p.dataset.porte); readForm(); D.porte = po.id; D.anual_base = po.anual; D.opcoes = P.gerarOpcoes(po.anual, D.inicio); rerender(); return; }
      const del = e.target.closest("[data-del]");
      if (del) { readForm(); D.opcoes.splice(Number(del.dataset.del), 1); if (D.destaque >= D.opcoes.length) D.destaque = Math.max(0, D.opcoes.length - 1); redrawOps(); preview(); return; }
      if (e.target.id === "pbAddOp") { readForm(); const last = D.opcoes[D.opcoes.length - 1] || { meses: 6, anual: D.anual_base }; const m = last.meses + 6; D.opcoes.push(P.recalcula({ meses: m, anual: Math.round(last.anual * 1.08 / 100) * 100 })); redrawOps(); preview(); }
      if (e.target.id === "pbRegen") { readForm(); D.opcoes = P.gerarOpcoes(D.anual_base, D.inicio); D.destaque = 2; redrawOps(); preview(); }
    });
  }

  /* puxa o roteiro da última reunião: alunos (porte), eventos e necessidades */
  async function aplicarRoteiro(cid) {
    const { data } = await sb.from("ca_reuniao_roteiro").select("dados,updated_at").eq("centro_id", cid).order("updated_at", { ascending: false }).limit(1);
    const r = data && data[0] && data[0].dados; if (!r || D.centro_id !== cid) return;
    readForm();
    const alunos = r.faculdade && r.faculdade.alunos;
    if (alunos) { const po = P.porteDe(alunos); D.porte = po.id; D.anual_base = po.anual; D.opcoes = P.gerarOpcoes(po.anual, D.inicio); }
    if ((r.eventos || []).length) D.eventos = r.eventos.map((e) => ({ nome: e.nome, publico: e.publico, data: e.data || "" }));
    const plat = "Acesso à plataforma MedCof para a gestão do CA";
    if ((r.necessidades || []).some((n) => /plataforma/i.test(n)) && !D.medcof.includes(plat)) D.medcof.push(plat);
    rerender(); toast("Dados da última reunião aplicados");
  }
  window.__aplicarRoteiro = aplicarRoteiro;

  function rerender() {
    document.getElementById("pbLeft").innerHTML = form();
    bind(); preview();
  }

  function savedOptions() {
    return (S.propostas || []).slice(0, 40).map((p) => `<option value="${p.id}" ${p.id === PID ? "selected" : ""}>${esc(p.titulo)} · ${fmtDate(p.updated_at)}</option>`).join("");
  }

  window.openProposta = function (centroId, propostaId) {
    const saved = propostaId && (S.propostas || []).find((p) => p.id === propostaId);
    PID = saved ? saved.id : null;
    D = saved ? JSON.parse(JSON.stringify(saved.dados)) : P.defaults(caById(centroId) || {});
    if (!saved && centroId) setTimeout(() => aplicarRoteiro(centroId), 0);
    document.getElementById("modalRoot").innerHTML = `<div class="pb" role="dialog" aria-label="Criar proposta">
      <header class="pb-top"><b>Proposta de parceria</b>
        <select id="pbSaved" aria-label="Propostas salvas"><option value="">Nova proposta</option>${savedOptions()}</select>
        <span class="spacer"></span>
        <button class="btn" id="pbSave">Salvar</button>
        <button class="btn primary" id="pbPdf">Gerar PDF</button>
        <button class="btn ghost" id="pbClose" aria-label="Fechar">✕</button></header>
      <div class="pb-body"><div class="pb-left" id="pbLeft"></div><div class="pb-right"><div id="pbPrev"></div></div></div></div>`;
    rerender();
    document.getElementById("pbClose").onclick = () => { document.getElementById("modalRoot").innerHTML = ""; };
    document.getElementById("pbSaved").onchange = (e) => openProposta(null, e.target.value || null);
    document.getElementById("pbSave").onclick = () => salvar().then((id) => id && toast("Proposta salva"));
    document.getElementById("pbPdf").onclick = async () => {
      const w = window.open("about:blank", "_blank");
      const id = await salvar();
      if (id && w) w.location = `/proposta?id=${id}&print=1`; else if (w) w.close();
    };
  };

  async function salvar() {
    readForm();
    if (!D.sigla) { toast("Informe a sigla do CA"); return null; }
    if (!D.opcoes.length) { toast("Inclua ao menos uma opção de valor"); return null; }
    const row = { centro_id: D.centro_id, titulo: `MedCof & ${D.sigla}`, dados: D, updated_at: new Date().toISOString() };
    const q = PID ? sb.from("ca_propostas").update(row).eq("id", PID).select().single() : sb.from("ca_propostas").insert({ ...row, status: "enviada" }).select().single();
    const { data, error } = await q;
    if (error) { toast("Erro ao salvar: " + error.message); return null; }
    PID = data.id;
    const i = (S.propostas || []).findIndex((p) => p.id === data.id);
    if (i >= 0) S.propostas[i] = data; else (S.propostas = S.propostas || []).unshift(data);
    const c = D.centro_id && caById(D.centro_id);
    if (c && ["interesse", "novo", "contato", "reuniao"].includes(c.status)) {
      await sb.from("ca_centros").update({ status: "proposta" }).eq("id", c.id); c.status = "proposta";
    }
    const sel = document.getElementById("pbSaved"); if (sel) sel.innerHTML = `<option value="">Nova proposta</option>${savedOptions()}`;
    return data.id;
  }

  /* ---------- ATLÉTICAS ---------- */
  let ATF = { vig: "vigentes", q: "" };
  function renderAtleticas() {
    const rows = (S.atleticas || []).filter((a) => (ATF.vig === "todos" || a.vigente) && (!ATF.q || norm(`${a.atletica_nome} ${a.faculdade} ${a.cidade} ${(caById(a.centro_id) || {}).sigla || ""}`).includes(norm(ATF.q))));
    const vig = (S.atleticas || []).filter((a) => a.vigente);
    const total = vig.reduce((s, a) => s + (Number(a.valor_total) || 0), 0);
    $("#main").innerHTML = `<div class="topbar"><h1>Atléticas</h1><span class="spacer"></span><a class="btn" target="_blank" href="${PASTA_ATLETICAS}">Pasta dos contratos</a></div>
      <p class="muted small" style="margin-top:-8px">Patrocínio das atléticas das mesmas faculdades dos CAs. Serve de referência para propor valores ao CA.</p>
      <div class="stats" style="margin-bottom:14px"><div class="stat"><span class="l">Atléticas vinculadas</span><span class="v">${vig.length}</span></div><div class="stat"><span class="l">Valor contratado (vigentes)</span><span class="v">${fmtBRL(total)}</span></div></div>
      <div class="row" style="margin-bottom:10px"><input placeholder="Buscar atlética, faculdade ou CA" value="${esc(ATF.q)}" oninput="ATF_set('q',this.value)" style="max-width:320px">
        <div class="seg sm">${[["vigentes", "Vigentes"], ["todos", "Todos"]].map(([v, l]) => `<button class="${ATF.vig === v ? "on" : ""}" onclick="ATF_set('vig','${v}')">${l}</button>`).join("")}</div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>CA</th><th>Atlética</th><th>Plano</th><th>Valor total</th><th>Vigência</th><th>Parcelas</th><th></th></tr></thead><tbody>
      ${rows.map((a) => { const c = caById(a.centro_id) || {}; const d = daysUntil(a.vigencia_fim);
        return `<tr><td>${c.id ? `<a href="#" onclick="openCA('${c.id}','atletica');return false"><b>${esc(c.sigla)}</b></a>` : "—"}<div class="small muted">${esc(a.faculdade || "")}</div></td>
          <td>${esc(a.atletica_nome)}<div class="small muted">${esc(a.tipo || "")}${a.cnpj ? " · " + esc(a.cnpj) : ""}</div></td>
          <td>${a.plano ? `<span class="badge ${PLANO_B[a.plano] || ""}">${esc(a.plano)}</span>` : "—"}</td>
          <td><b>${fmtBRL(a.valor_total)}</b>${a.duracao_meses ? `<div class="small muted">${fmtBRL(a.valor_total / a.duracao_meses)}/mês</div>` : ""}</td>
          <td>${fmtDate(a.vigencia_inicio)} → ${fmtDate(a.vigencia_fim)}<div class="small ${d !== null && d >= 0 && d <= 60 ? "late" : "muted"}">${d === null ? "" : d < 0 ? "encerrado" : `faltam ${d} dias`}</div></td>
          <td class="small">${(a.parcelas || []).map((p) => fmtBRL(p.valor)).join(" · ") || "—"}</td>
          <td>${a.drive_url ? `<a class="btn sm" target="_blank" href="${esc(a.drive_url)}">PDF</a>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Nenhuma atlética</td></tr>`}
      </tbody></table></div>`;
  }
  window.ATF_set = (k, v) => { ATF[k] = v; renderAtleticas(); if (k === "q") { const i = document.querySelector('#main input'); i.focus(); i.setSelectionRange(v.length, v.length); } };
  window.EXTRA_VIEWS.atleticas = renderAtleticas;

  /* aba no CA */
  window.EXTRA_TABS_LIST.push(["atletica", "Atlética"], ["propostas", "Propostas"]);
  window.EXTRA_TABS.atletica = function (c, body) {
    const at = atlDe(c.id);
    body.innerHTML = at.map((a) => `<div class="card" style="padding:14px;margin-bottom:12px">
      <div class="row"><b>${esc(a.atletica_nome)}</b><span class="spacer"></span><b>${fmtBRL(a.valor_total)}</b></div>
      <div class="small muted">${esc(a.plano || "")} · ${esc(a.tipo || "")} · ${fmtDate(a.vigencia_inicio)} → ${fmtDate(a.vigencia_fim)}${a.vigente ? "" : " · encerrado"}</div>
      ${(a.parcelas || []).length ? `<div class="small" style="margin-top:6px"><b>Parcelas:</b> ${a.parcelas.map((p) => `${fmtBRL(p.valor)} (${esc(p.quando)})`).join(" · ")}</div>` : ""}
      ${(a.entregaveis || []).length ? `<div class="small" style="margin-top:6px"><b>Entregáveis:</b> ${a.entregaveis.map(esc).join(" · ")}</div>` : ""}
      ${a.observacoes ? `<div class="small muted" style="margin-top:6px">${esc(a.observacoes)}</div>` : ""}
      <div class="row" style="margin-top:10px">${a.drive_url ? `<a class="btn sm" target="_blank" href="${esc(a.drive_url)}">PDF do contrato</a>` : ""}</div></div>`).join("")
      || `<div class="empty">Nenhum contrato de atlética encontrado para esta faculdade. <a href="${PASTA_ATLETICAS}" target="_blank">Pasta das atléticas</a></div>`;
  };
  window.EXTRA_TABS.propostas = function (c, body) {
    const ps = (S.propostas || []).filter((p) => p.centro_id === c.id);
    body.innerHTML = `<div class="row" style="margin-bottom:10px"><span class="spacer"></span><button class="btn sm primary" onclick="openProposta('${c.id}')">Criar proposta</button></div>
      <div class="list card" style="padding:6px 14px">${ps.map((p) => `<div class="li" onclick="openProposta(null,'${p.id}')"><div style="flex:1"><div class="t">${esc(p.titulo)}</div><div class="small muted">${fmtDate(p.updated_at)} · ${(p.dados?.opcoes || []).map((o) => `${o.meses}m ${fmtBRL(o.total)}`).join(" · ")}</div></div><a class="btn sm" target="_blank" href="/proposta?id=${p.id}" onclick="event.stopPropagation()">Abrir</a></div>`).join("") || `<div class="empty">Nenhuma proposta ainda</div>`}</div>`;
  };
})();
