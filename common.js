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
