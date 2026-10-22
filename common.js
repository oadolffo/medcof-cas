/* Utilidades compartilhadas — MedCof Parcerias com CAs */
(function () {
  const cfg = window.MEDCOF_CONFIG;
  window.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg, ms = 2600) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function fmtDate(d) {
    if (!d) return "—";
    const [y, m, day] = String(d).slice(0, 10).split("-");
    return `${day}/${m}/${y}`;
  }
  function fmtDateTime(d) {
    if (!d) return "—";
    const x = new Date(d);
    return x.toLocaleDateString("pt-BR") + " " + x.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function daysUntil(d) {
    if (!d) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const x = new Date(String(d).slice(0, 10) + "T00:00:00");
    return Math.round((x - t) / 86400000);
  }
  function onlyDigits(s) { return String(s || "").replace(/\D/g, ""); }
  function waLink(phone, text) {
    let d = onlyDigits(phone);
    if (!d) return null;
    if (!d.startsWith("55")) d = "55" + d;
    return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function maskPhone(el) {
    el.addEventListener("input", () => {
      let d = onlyDigits(el.value).slice(0, 11);
      if (d.length > 10) el.value = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      else if (d.length > 6) el.value = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      else if (d.length > 2) el.value = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      else el.value = d;
    });
  }
  function errMsg(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão. Verifique a internet e tente novamente.";
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
    if (/User already registered/i.test(m)) return "Este e-mail já tem conta. Use “Entrar”.";
    if (/Password should be/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
    return m;
  }
  function formToObject(form) {
    const o = {};
    new FormData(form).forEach((v, k) => {
      if (k.endsWith("[]")) { (o[k.slice(0, -2)] ||= []).push(v); }
      else o[k] = typeof v === "string" ? v.trim() : v;
    });
    $$("input[type=checkbox][data-bool]", form).forEach((c) => (o[c.name] = c.checked));
    return o;
  }
  function initTheme() {
    let t = null;
    try { t = localStorage.getItem("mc-theme"); } catch (e) {}
    if (t) document.documentElement.dataset.theme = t;
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mc-theme", next); } catch (e) {}
  }
  initTheme();

  const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
  function fillUF(sel, placeholder = "UF") {
    sel.innerHTML = `<option value="">${placeholder}</option>` + UFS.map((u) => `<option>${u}</option>`).join("");
  }

  Object.assign(window, { $, $$, esc, toast, fmtDate, fmtDateTime, daysUntil, onlyDigits, waLink, maskPhone, errMsg, formToObject, toggleTheme, fillUF, UFS });
})();

/* ===== v2: helpers compartilhados (escolas, ciclos, prazos de postagem, inscritos) ===== */
(function () {
  const CICLOS = ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano", "6º ano"];
  const TIPOS_POST = { feed: "Post no feed", story: "Story", reels: "Reels", destaque: "Destaque", video: "Vídeo", "feed/story": "Feed ou story", "feed/reels": "Feed ou reels", "reels/video": "Reels/vídeo" };
  const fmtBRL = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  let escolasP = null;
  function loadEscolas() {
    if (!escolasP) escolasP = fetch("/data/escolas.json").then((r) => r.json()).catch(() => []);
    return escolasP;
  }
  /* Acha a escola mais provável para um CA (faculdade + cidade + UF) */
  function matchEscola(escolas, c) {
    if (!c) return null;
    if (c.escola_ref) { const e = escolas.find((x) => String(x.id) === String(c.escola_ref)); if (e) return e; }
    const cid = norm(c.cidade), uf = (c.uf || "").toUpperCase(), fac = norm(c.faculdade);
    const pool = escolas.filter((e) => e.uf === uf && norm(e.cidade) === cid);
    if (!pool.length) return null;
    if (pool.length === 1) return pool[0];
    let best = null, bestScore = -1;
    for (const e of pool) {
      const words = new Set(norm(e.nome + " " + (e.sigla || "")).split(" ").filter((w) => w.length > 2));
      const score = fac.split(" ").filter((w) => words.has(w)).length + (e.sigla && fac.includes(norm(e.sigla)) ? 3 : 0);
      if (score > bestScore) { best = e; bestScore = score; }
    }
    return best;
  }
  /* Autocomplete de faculdade num input + preenche cidade/UF/escola_ref */
  async function attachEscolaPicker(input, { cidade, uf, ref, lat, lng } = {}) {
    const escolas = await loadEscolas();
    const box = document.createElement("div"); box.className = "ac-box hidden"; input.parentElement.style.position = "relative"; input.parentElement.appendChild(box);
    input.setAttribute("autocomplete", "off");
    const pick = (e) => {
      input.value = e.nome; box.classList.add("hidden");
      if (cidade) cidade.value = e.cidade; if (uf) uf.value = e.uf; if (ref) ref.value = e.id; if (lat) lat.value = e.lat; if (lng) lng.value = e.lng;
    };
    input.addEventListener("input", () => {
      if (ref) ref.value = "";
      const q = norm(input.value); if (q.length < 2) return box.classList.add("hidden");
      const hits = escolas.filter((e) => norm(`${e.nome} ${e.sigla || ""} ${e.cidade} ${e.uf}`).includes(q)).slice(0, 8);
      box.innerHTML = hits.map((e, i) => `<button type="button" data-i="${i}"><b>${esc(e.sigla || "")}</b> ${esc(e.nome)}<span class="muted small"> · ${esc(e.cidade)}/${e.uf}</span></button>`).join("") + `<div class="muted small" style="padding:6px 10px">Não achou? Digite o nome completo.</div>`;
      box.classList.remove("hidden");
      box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => pick(hits[+b.dataset.i])));
    });
    input.addEventListener("blur", () => setTimeout(() => box.classList.add("hidden"), 200));
  }

  /* Conta inscritos de uma planilha Google pública ("qualquer pessoa com o link") */
  async function contarInscritos(link) {
    const m = String(link || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) throw new Error("O link precisa ser de uma planilha Google (docs.google.com/spreadsheets/…).");
    const gid = (String(link).match(/[#&?]gid=(\d+)/) || [])[1];
    const url = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${gid ? "&gid=" + gid : ""}`;
    const r = await fetch(url);
    const t = await r.text();
    if (!r.ok || /<html/i.test(t.slice(0, 200))) throw new Error("Não consegui ler a planilha. Deixe o compartilhamento como “Qualquer pessoa com o link pode ver”.");
    const linhas = t.split(/\r?\n/).filter((l) => l.replace(/[",\s]/g, "").length > 0);
    return Math.max(0, linhas.length - 1);
  }

  /* Prazos de postagem: para cada meta, quanto falta no período atual */
  function statusMetas(metas, posts, hoje = new Date()) {
    const d0 = new Date(hoje); d0.setHours(0, 0, 0, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    const casa = (tipoMeta, tipoPost) => tipoMeta.split("/").some((t) => tipoPost === t || (t === "video" && tipoPost === "reels")) || tipoMeta === tipoPost;
    return (metas || []).map((m) => {
      let ini, fim, label;
      if (m.periodicidade === "mensal") { ini = new Date(d0.getFullYear(), d0.getMonth(), 1); fim = new Date(d0.getFullYear(), d0.getMonth() + 1, 0); label = "este mês"; }
      else if (m.periodicidade === "semanal") { const dow = (d0.getDay() + 6) % 7; ini = new Date(d0); ini.setDate(d0.getDate() - dow); fim = new Date(ini); fim.setDate(ini.getDate() + 6); label = "esta semana"; }
      else { ini = m.inicio ? new Date(m.inicio + "T00:00:00") : new Date(2000, 0, 1); fim = m.fim ? new Date(m.fim + "T00:00:00") : null; label = "no contrato"; }
      if (m.inicio && new Date(m.inicio + "T00:00:00") > ini) ini = new Date(m.inicio + "T00:00:00");
      const vigente = !(m.fim && new Date(m.fim + "T00:00:00") < d0) && !(m.inicio && new Date(m.inicio + "T00:00:00") > d0);
      const feitos = (posts || []).filter((p) => p.status !== "recusado" && casa(m.tipo, p.tipo) && p.data_post >= iso(ini) && (!fim || p.data_post <= iso(fim))).length;
      const falta = Math.max(0, (m.quantidade || 1) - feitos);
      const dias = fim ? Math.round((fim - d0) / 86400000) : null;
      const nivel = !vigente ? "ok" : falta === 0 ? "ok" : dias !== null && dias <= 3 ? "urgente" : dias !== null && dias <= 7 ? "atencao" : "normal";
      return { ...m, feitos, falta, dias, label, fim: fim ? iso(fim) : null, vigente, nivel };
    });
  }

  /* Score de engajamento 0–100 */
  function engajamento(c, { eventos = [], posts = [], metas = [], reunioes = [] } = {}) {
    const st = statusMetas(metas.filter((m) => m.centro_id === c.id), posts.filter((p) => p.centro_id === c.id));
    const reqTot = metas.filter((m) => m.centro_id === c.id && m.periodicidade === "total").reduce((a, m) => a + (m.quantidade || 1), 0);
    const pc = posts.filter((p) => p.centro_id === c.id && p.status !== "recusado").length;
    const contrap = metas.some((m) => m.centro_id === c.id) ? Math.min(1, reqTot ? pc / reqTot : st.every((s) => s.falta === 0) ? 1 : 0.5) : (pc ? 1 : 0.3);
    const evs = eventos.filter((e) => e.centro_id === c.id);
    const evOk = evs.filter((e) => ["solicitado", "realizado"].includes(e.status)).length;
    const pont = evs.length ? evs.filter((e) => e.created_at && e.data_inicio && (new Date(e.data_inicio) - new Date(e.created_at)) / 86400000 >= 45).length / evs.length : 0;
    const reun = reunioes.filter((r) => r.centro_id === c.id && r.status === "realizada").length;
    const dados = ["gestao_fim", "instagram", "alunos_cobertos", "entrega_cep", "rep_whatsapp"].filter((k) => c[k]).length / 5;
    const score = 35 * contrap + 20 * Math.min(1, evOk / 3) + 15 * pont + 15 * Math.min(1, reun / 2) + 15 * dados;
    return Math.round(score);
  }

  function gcalLink(r, sigla) {
    const s = new Date(r.data_hora), e = new Date(s.getTime() + (r.duracao_min || 45) * 60000);
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent((r.titulo || "Reunião") + " · MedCof × " + (sigla || "CA"))}&dates=${f(s)}/${f(e)}&details=${encodeURIComponent((r.pauta || "") + (r.link ? "\n\nLink: " + r.link : ""))}&location=${encodeURIComponent(r.link || r.local || "")}`;
  }

  Object.assign(window, { CICLOS, TIPOS_POST, fmtBRL, norm, loadEscolas, matchEscola, attachEscolaPicker, contarInscritos, statusMetas, engajamento, gcalLink });
})();
