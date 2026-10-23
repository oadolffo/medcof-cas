/* Proposta de parceria MedCof — modelo 2026 (identidade visual nova)
   Usado pelo painel (pré-visualização) e por /proposta (versão para PDF). */
(function () {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (n) => "R$ " + Math.round(Number(n) || 0).toLocaleString("pt-BR");
  const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  /* Quanto mais tempo, maior o valor anual (padrão da proposta Unirg: 4k → 5k → 6k → 6,5k) */
  const DURACOES = [
    { meses: 12, fator: 1 },
    { meses: 18, fator: 1.25 },
    { meses: 24, fator: 1.5 },
    { meses: 30, fator: 1.625 },
  ];
  const fatorDe = (m) => { const d = DURACOES.find((x) => x.meses === Number(m)); return d ? d.fator : Math.max(0.5, 1 + ((Number(m) || 12) - 12) * 0.5 / 12); };
  const arred = (v, passo = 50) => Math.round(v / passo) * passo;

  function addMeses(iso, m) {
    const d = new Date((iso || new Date().toISOString().slice(0, 10)) + "T12:00:00");
    d.setMonth(d.getMonth() + m);
    return d.toISOString().slice(0, 10);
  }
  function mesAno(iso) { const d = new Date(iso + "T12:00:00"); return `${MES[d.getMonth()]} de ${d.getFullYear()}`; }
  function anosTxt(m) { const a = m / 12; return a === 1 ? "1 ano" : (Number.isInteger(a) ? a : a.toLocaleString("pt-BR", { maximumFractionDigits: 1 })) + " anos"; }

  function gerarOpcoes(anualBase, inicio, duracoes = DURACOES) {
    return duracoes.map((d) => {
      const anual = arred(anualBase * d.fator, 100);
      return { meses: d.meses, anual, total: arred((anual * d.meses) / 12, 50) };
    });
  }
  function recalcula(op) { return { ...op, total: arred(((Number(op.anual) || 0) * (Number(op.meses) || 12)) / 12, 50) }; }

  const ENTREGA_MEDCOF = [
    "Brindes para todos os eventos do CA durante o contrato (aviso com 45 dias de antecedência)",
    "Sorteio de bolsas do curso PS no Instagram do CA",
    "Simulados MedCof para os alunos da faculdade",
    "Palestra ou ativação da MedCof em eventos do CA",
  ];
  const ENTREGA_MEDCOF_EXTRAS = [
    "Acesso à plataforma MedCof para a gestão do CA",
    "1 bolsa integral no Extensivo R1 por ano de contrato",
    "Acesso ao curso PS para a gestão do CA",
    "Banner e vídeo institucional da MedCof para os eventos",
    "Kits e Cofcards para sorteios nos eventos",
  ];
  const ENTREGA_CA = [
    "Logo da MedCof nos itens confeccionados pelo CA",
    "Divulgação no Instagram do CA: 2 stories e 1 reels a cada 60 dias",
    "Espaço para ativação da MedCof nos eventos do CA",
  ];
  const ENTREGA_CA_EXTRAS = [
    "@grupomedcof na bio e destaque MedCof nos stories",
    "Agenda de eventos enviada com 45 dias de antecedência",
    "Logo da MedCof nas publicações oficiais dos eventos",
    "Exclusividade no segmento de preparatórios durante o contrato",
  ];

  function defaults(c = {}) {
    const inicio = new Date(); inicio.setDate(1); inicio.setMonth(inicio.getMonth() + 1);
    const ini = inicio.toISOString().slice(0, 10);
    return {
      centro_id: c.id || null,
      sigla: c.sigla || "",
      nome_ca: c.nome || "",
      faculdade: c.faculdade || "",
      cidade: c.cidade ? `${c.cidade}${c.uf ? "/" + c.uf : ""}` : "",
      inicio: ini,
      anual_base: "",
      opcoes: [{ meses: 12, anual: "", total: "" }, { meses: 24, anual: "", total: "" }],
      destaque: 1,
      pagamento: "Parcelas semestrais; a 1ª em até 30 dias após a assinatura.",
      medcof: [...ENTREGA_MEDCOF],
      ca: [...ENTREGA_CA],
      eventos: [],
      contato: "Adolffo · Coordenação de Parcerias Acadêmicas · Grupo MedCof",
      validade: 15,
    };
  }

  /* ---------- render ---------- */
  const IMG = "/img/";
  function slide(cls, inner) { return `<section class="pz-slide ${cls}"><div class="pz-in">${inner}</div></section>`; }
  function lista(items) { return `<ul class="pz-list">${items.filter((x) => String(x).trim()).map((x) => `<li><span class="pz-dot"></span><span>${esc(x)}</span></li>`).join("")}</ul>`; }

  function render(d) {
    const sigla = (d.sigla || "SEU CA").toUpperCase();
    const ops = (d.opcoes || []).filter((o) => Number(o.meses) > 0);
    const dest = Math.min(Math.max(Number(d.destaque) || 0, 0), ops.length - 1);
    const hoje = new Date();
    const validade = new Date(hoje.getTime() + (Number(d.validade) || 15) * 864e5);

    const capa = slide("pz-capa", `
      <img class="pz-hurr" src="${IMG}furacao-vermelho.png" alt="">
      <img class="pz-logo" src="${IMG}grupo-medcof-escuro.png" alt="Grupo MedCof">
      <div class="pz-capa-txt">
        <p class="pz-kicker">Proposta de parceria ${hoje.getFullYear()}</p>
        <h1>MedCof <span>&amp;</span> ${esc(sigla)}</h1>
        <p class="pz-sub">${esc([d.nome_ca, d.faculdade].filter(Boolean).join(" · "))}</p>
      </div>
      <p class="pz-slogan">a medicina merece o melhor</p>`);

    const parceria = slide("pz-light", `
      <header class="pz-h"><span class="pz-tag">Por que juntos</span><img src="${IMG}grupo-medcof-claro.png" alt=""></header>
      <h2>Uma parceria para a sua gestão inteira.</h2>
      <div class="pz-cols3">
        <div class="pz-card"><b>Eventos mais fortes</b><p>Brindes, sorteios e presença da MedCof para dar mais valor a cada evento do CA.</p></div>
        <div class="pz-card"><b>Conteúdo para os alunos</b><p>Simulados, aulas e bolsas para quem vai encarar internato, residência e provas.</p></div>
        <div class="pz-card"><b>Recurso para o CA</b><p>Investimento direto no caixa do CA, previsível e com cronograma definido.</p></div>
      </div>`);

    const medcof = slide("pz-light", `
      <header class="pz-h"><span class="pz-tag">A MedCof entrega</span><img src="${IMG}grupo-medcof-claro.png" alt=""></header>
      <h2>O que o ${esc(sigla)} recebe</h2>
      ${lista(d.medcof || [])}`);

    const ca = slide("pz-light", `
      <header class="pz-h"><span class="pz-tag">Contrapartidas</span><img src="${IMG}grupo-medcof-claro.png" alt=""></header>
      <h2>O que o ${esc(sigla)} entrega</h2>
      ${lista(d.ca || [])}`);

    const evs = (d.eventos || []).filter((e) => e && e.nome);
    const eventos = evs.length ? slide("pz-light", `
      <header class="pz-h"><span class="pz-tag">Eventos</span><img src="${IMG}grupo-medcof-claro.png" alt=""></header>
      <h2>Onde a MedCof aparece</h2>
      <div class="pz-evs" style="--n:${Math.min(evs.length, 4)}">${evs.slice(0, 8).map((e) => `<div class="pz-ev">
        <p class="pz-ev-n">${e.publico ? Number(e.publico).toLocaleString("pt-BR") : "—"}</p><p class="pz-ev-l">${e.publico ? "participantes" : "público a definir"}</p>
        <b>${esc(e.nome)}</b>${e.data ? `<small>${esc(e.data)}</small>` : ""}</div>`).join("")}</div>
      ${evs.reduce((a, e) => a + (Number(e.publico) || 0), 0) ? `<p class="pz-evt">${evs.reduce((a, e) => a + (Number(e.publico) || 0), 0).toLocaleString("pt-BR")}+ participantes só nesses eventos.</p>` : ""}`) : "";

    const invest = slide("pz-invest", `
      <header class="pz-h"><span class="pz-tag pz-tag-w">Investimento</span><img src="${IMG}grupo-medcof-branco.png" alt=""></header>
      <h2>Quanto mais tempo juntos, maior o investimento.</h2>
      <div class="pz-ops" style="--n:${Math.max(ops.length, 1)}">
        ${ops.map((o, i) => {
          const fim = addMeses(d.inicio, Number(o.meses));
          return `<div class="pz-op ${i === dest ? "on" : ""}">
            ${i === dest ? `<span class="pz-best">Recomendado</span>` : ""}
            <p class="pz-dur">${anosTxt(Number(o.meses))}</p>
            <p class="pz-per">${mesAno(d.inicio)} a ${mesAno(fim)}</p>
            <p class="pz-tot">${brl(o.total)}</p>
            <p class="pz-an">total · ${brl(o.anual)} por ano</p>
          </div>`; }).join("")}
      </div>
      <p class="pz-foot">${esc(d.pagamento || "")} Proposta válida até ${validade.toLocaleDateString("pt-BR")}.</p>`);

    const fim = slide("pz-capa pz-end", `
      <img class="pz-hurr" src="${IMG}furacao-vermelho.png" alt="">
      <img class="pz-logo" src="${IMG}grupo-medcof-escuro.png" alt="Grupo MedCof">
      <div class="pz-capa-txt"><h1>Vamos juntos?</h1><p class="pz-sub">${esc(d.contato || "")}</p></div>
      <p class="pz-slogan">a medicina merece o melhor</p>`);

    return `<div class="pz">${capa}${parceria}${medcof}${ca}${eventos}${invest}${fim}</div>`;
  }

  window.Proposta = { DURACOES, fatorDe, gerarOpcoes, recalcula, defaults, render, addMeses, mesAno, anosTxt, brl,
    ENTREGA_MEDCOF, ENTREGA_MEDCOF_EXTRAS, ENTREGA_CA, ENTREGA_CA_EXTRAS };
})();
