// ============================================================
// Despesas Complementares · Molicenter — app web 1.0.0
// Grava na MESMA tabela do Streamlit (desp_comp) pelas funções desp_web_* do Supabase.
// ============================================================
const CFG = window.CONFIG;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const p2 = (n) => String(n).padStart(2, "0");
const brl = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nomeLoja = (l) => `Loja ${p2(l)}`;
const brParaISO = (txt) => { const m = String(txt).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null; const [, d, mo, a] = m; const dt = new Date(+a, +mo - 1, +d); return dt.getFullYear() === +a && dt.getMonth() === +mo - 1 && dt.getDate() === +d ? `${a}-${mo}-${d}` : null; };
const ligarDataBR = (raiz) => raiz.querySelectorAll(".data-br").forEach((w) => {
  const txt = w.querySelector('input[type="text"]'), nat = w.querySelector(".data-br-nativo");
  txt.addEventListener("input", () => { const n = txt.value.replace(/\D/g, "").slice(0, 8); txt.value = n.length > 4 ? `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}` : n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n; const iso = brParaISO(txt.value); if (iso) nat.value = iso; });
  w.querySelector(".data-br-btn").addEventListener("click", () => { const iso = brParaISO(txt.value); if (iso) nat.value = iso; try { nat.showPicker(); } catch { nat.focus(); nat.click(); } });
  nat.addEventListener("change", () => { if (nat.value) txt.value = dataBR(nat.value); });
});
const dataBR = (iso) => { if (!iso) return "-"; const [a, m, d] = String(iso).slice(0, 10).split("-"); return d ? `${d}/${m}/${a}` : iso; };
const carimbo = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "-");
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const ROTULO_PERFIL = { admin: "Administrador", supervisor: "Supervisor · aprovação", loja: "Lançamentos da loja" };
const MOTIVO_DESPESA = "Despesas (Justificar)";

function toast(msg, tipo = "") {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast " + tipo; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), tipo === "erro" ? 6500 : 3200);
}
function carregando(sim) { $("#carregando").hidden = !sim; }
function lerLocal(k) { try { return localStorage.getItem(k); } catch { return null; } }
function gravarLocal(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

const IC = {
  lancar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  aprovar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>',
  lixo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
};

// ---------- sessão + Supabase ----------
const CHAVE_SESSAO = "desp_web_sessao";
let sessao = (() => { try { return JSON.parse(lerLocal(CHAVE_SESSAO)) || null; } catch { return null; } })();
const MENSAGENS = {
  SENHA_INCORRETA: "Senha incorreta. Tente de novo.",
  SENHA_NAO_CONFIGURADA: "A senha deste usuário ainda não foi cadastrada. Peça ao administrador.",
  MUITAS_TENTATIVAS: "Muitas tentativas erradas. Espere 10 minutos e tente de novo.",
  USUARIO_INVALIDO: "Escolha um usuário da lista.",
  SESSAO_INVALIDA: "Sua sessão expirou. Entre de novo.",
  SEM_PERMISSAO: "Seu login não tem permissão para isso.",
  SO_LOJA: "Só o login da loja lança e cancela despesas.",
  NOME_VAZIO: "O campo Nome é obrigatório.",
  MOTIVO_INVALIDO: "Escolha o motivo.", DEPTO_INVALIDO: "Escolha o departamento.",
  DATA_INVALIDA: "Data trabalhada inválida.", VALOR_INVALIDO: "O valor deve ser maior que zero.",
  NOME_INVALIDO: "O nome do usuário precisa ter de 3 a 40 letras.", PERFIL_INVALIDO: "Escolha o perfil.", LOJA_INVALIDA: "Escolha a loja.",
  NAO_PODE_SI_MESMO: "Você não pode desativar nem tirar o perfil de administrador do seu próprio login.",
  SENHA_CURTA: "A senha precisa ter pelo menos 6 caracteres.", SENHA_OBRIGATORIA: "Defina uma senha para o login novo.",
  IMAGEM_INVALIDA: "Envie uma imagem PNG ou JPG de até 500 KB.",
  "Could not find the function": "O banco ainda não tem as funções do app web (falta rodar o SQL 01).",
};
const traduzir = (m) => { for (const k in MENSAGENS) if (String(m).includes(k)) return MENSAGENS[k]; return m; };
async function rpc(fn, args = {}) {
  let resp;
  try {
    resp = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: CFG.SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  } catch { throw new Error("Sem conexão com a internet. Tente de novo."); }
  const texto = await resp.text();
  let corpo = null; try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  if (!resp.ok) {
    const msg = (corpo && (corpo.message || corpo.hint)) || `Erro ${resp.status}`;
    if (String(msg).includes("SESSAO_INVALIDA")) { sair(true); throw new Error(MENSAGENS.SESSAO_INVALIDA); }
    throw new Error(traduzir(msg));
  }
  return corpo;
}

// ============================================================
// LOGIN
// ============================================================
async function telaLogin() {
  $("#app").hidden = true; $("#tela-login").hidden = false;
  $("#versao-login").textContent = "versão " + CFG.VERSAO;
  const sel = $("#login-usuario");
  sel.innerHTML = '<option value="">Carregando…</option>';
  try {
    const lista = await rpc("desp_web_lista_usuarios");
    const ultimo = lerLocal("desp_web_ultimo_usuario");
    sel.innerHTML = '<option value="">Selecione…</option>' + lista.map((u) => `<option${u === ultimo ? " selected" : ""}>${esc(u)}</option>`).join("");
  } catch (e) { sel.innerHTML = '<option value="">—</option>'; erroLogin(e.message); }
  (sel.value ? $("#login-senha") : sel).focus();
}
function erroLogin(m) { const el = $("#login-erro"); el.textContent = m || ""; el.hidden = !m; }
$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const u = $("#login-usuario").value, s = $("#login-senha").value;
  if (!u) return erroLogin("Selecione um usuário.");
  erroLogin("");
  const b = $("#btn-entrar"); b.disabled = true; b.textContent = "Entrando…";
  try {
    sessao = await rpc("desp_web_login", { p_usuario: u, p_senha: s.trim() });
    gravarLocal(CHAVE_SESSAO, JSON.stringify(sessao)); gravarLocal("desp_web_ultimo_usuario", u);
    $("#login-senha").value = "";
    iniciarApp();
  } catch (err) { erroLogin(err.message); }
  finally { b.disabled = false; b.textContent = "Entrar"; }
});
function sair(silencioso) {
  const tok = sessao?.token;
  sessao = null; dados = null; gravarLocal(CHAVE_SESSAO, null); fecharJanela();
  if (tok && !silencioso) rpc("desp_web_sair", { p_token: tok }).catch(() => {});
  telaLogin();
}
$("#btn-sair").addEventListener("click", () => sair(false));

// ============================================================
// CASCA
// ============================================================
let dados = null;
const PAGINAS = { loja: ["lancar"], supervisor: ["aprovacao"], admin: ["aprovacao", "usuarios"] };
function pagina() { const h = location.hash.replace(/^#\/?/, ""); const ok = PAGINAS[sessao?.perfil] || []; return ok.includes(h) ? h : ok[0]; }
window.addEventListener("hashchange", () => { if (sessao) render(); });

function iniciarApp() {
  $("#tela-login").hidden = true; $("#app").hidden = false;
  $("#conta-nome").textContent = sessao.usuario;
  $("#conta-perfil").textContent = ROTULO_PERFIL[sessao.perfil] || sessao.perfil;
  $("#pil-loja").textContent = sessao.perfil === "loja" ? nomeLoja(sessao.loja) : "Todas as lojas";
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  $("#pil-data").textContent = `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]}, ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
  carregar();
}
async function carregar() {
  carregando(true);
  try { dados = await rpc("desp_web_dados", { p_token: sessao.token }); render(); }
  catch (e) { toast(e.message, "erro"); }
  finally { carregando(false); }
}
function montarNav() {
  const pg = pagina();
  const itens = { lancar: ["Lançar despesas", IC.lancar], aprovacao: ["Painel de aprovação", IC.aprovar], usuarios: ["Usuários", IC.usuarios] };
  $("#nav").innerHTML = '<div class="nav-rotulo">Despesas</div>' + (PAGINAS[sessao.perfil] || []).map((p) =>
    `<button type="button" data-pg="${p}" class="${pg === p ? "ativo" : ""}">${itens[p][1]}<span>${itens[p][0]}</span></button>`).join("");
}
$("#nav").addEventListener("click", (e) => { const b = e.target.closest("[data-pg]"); if (b) location.hash = "#/" + b.dataset.pg; });
function render() {
  if (!dados) return;
  montarNav();
  const pg = pagina();
  if (pg === "lancar") return telaLoja();
  if (pg === "aprovacao") return telaAprovacao();
  if (pg === "usuarios") return telaUsuarios();
}

// ============================================================
// LOJA: lançar + seus registros
// ============================================================
const marcadosLoja = new Set();
function telaLoja() {
  $("#pg-titulo").textContent = "Módulo de Lançamentos — " + nomeLoja(sessao.loja);
  $("#pg-sub").textContent = "Registre as despesas complementares da loja. O supervisor aprova ou reprova.";
  const regs = [...dados.registros].sort((a, b) => b.id - a.id);
  const opc = (l) => l.map((x) => `<option>${esc(x)}</option>`).join("");
  let h = `<div class="pagina"><div class="cartao"><h3>Nova despesa</h3>
    <form id="form-desp" class="form-desp" autocomplete="off">
      <label class="campo cheio-2"><span>Nome completo do colaborador *</span><input name="nome" maxlength="120" required style="text-transform:uppercase"></label>
      <div class="campo"><span>Data trabalhada *</span><div class="data-br"><input name="data" type="text" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" value="${dataBR(hojeISO())}" required><button type="button" class="data-br-btn" title="Abrir calendário" aria-label="Abrir calendário"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></button><input type="date" class="data-br-nativo" tabindex="-1" aria-hidden="true" value="${hojeISO()}"></div></div>
      <label class="campo"><span>Motivo *</span><select name="motivo">${opc(dados.motivos)}</select></label>
      <label class="campo"><span>Departamento *</span><select name="depto">${opc(dados.deptos)}</select></label>
      <label class="campo"><span>Valor (R$) *</span><input name="valor" type="text" inputmode="decimal" placeholder="0,00" required></label>
      <label class="campo cheio-3"><span>Observações</span><textarea name="obs" rows="2" maxlength="500" placeholder="Justificativa ou transferência..."></textarea></label>
      <div class="cheio-3"><button type="submit" class="btn btn-primario" id="btn-registrar">Registrar despesa</button></div>
    </form></div>`;
  const pend = regs.filter((r) => r.status === "Pendente");
  h += `<div class="cartao"><h3>Seus registros<small>${regs.length} lançamento(s) · ${pend.length} pendente(s)</small></h3>
    <p class="nota" style="margin-bottom:10px">Marque um lançamento <b>Pendente</b> para cancelá-lo. Depois de avaliado pelo supervisor, não dá mais para cancelar.</p>
    <div class="barra-ferr" style="margin-bottom:10px">
      <button type="button" class="btn btn-perigo" id="btn-cancelar" ${marcadosLoja.size ? "" : "disabled"}>${IC.lixo}Cancelar ${marcadosLoja.size || ""} marcado(s)</button>
      <button type="button" class="btn btn-borda" id="btn-pdf-loja" ${regs.length ? "" : "disabled"}>${IC.pdf}Exportar PDF</button></div>
    ${regs.length ? tabelaRegistros(regs, { selecao: true, loja: false }) : '<p class="vazio-msg">Nenhum registro encontrado para a sua loja até o momento.</p>'}</div></div>`;
  $("#conteudo").innerHTML = h;

  ligarDataBR($("#form-desp"));
  $("#form-desp").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const valor = Number(String(f.valor.value).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    if (!f.nome.value.trim()) return toast(MENSAGENS.NOME_VAZIO, "erro");
    if (!(valor > 0)) return toast(MENSAGENS.VALOR_INVALIDO, "erro");
    const dataISO = brParaISO(f.data.value);
    if (!dataISO) return toast("Data inválida. Use o formato dd/mm/aaaa.", "erro");
    const b = $("#btn-registrar"); b.disabled = true; b.textContent = "Enviando…";
    try {
      await rpc("desp_web_lancar", { p_token: sessao.token, p: { nome: f.nome.value, motivo: f.motivo.value, depto: f.depto.value, data: dataISO, valor, obs: f.obs.value } });
      toast("Despesa registrada com sucesso!", "ok");
      await carregar();
      $('#form-desp [name="nome"]')?.focus();
    } catch (err) { toast(err.message, "erro"); b.disabled = false; b.textContent = "Registrar despesa"; }
  };
  $$("[data-marca]").forEach((c) => (c.onchange = () => { c.checked ? marcadosLoja.add(+c.dataset.marca) : marcadosLoja.delete(+c.dataset.marca); const b = $("#btn-cancelar"); b.disabled = !marcadosLoja.size; b.innerHTML = `${IC.lixo}Cancelar ${marcadosLoja.size || ""} marcado(s)`; }));
  $("#btn-cancelar").onclick = () => {
    const n = marcadosLoja.size;
    abrirJanela(`<h3>Cancelar ${n} lançamento(s)?</h3><p class="nota">Os lançamentos pendentes marcados serão apagados. Isso não pode ser desfeito.</p>
      <div class="acoes"><button type="button" class="btn btn-borda" data-fechar>Voltar</button><button type="button" class="btn btn-perigo" id="conf-cancelar">Sim, cancelar</button></div>`);
    $("#conf-cancelar").onclick = async () => {
      try {
        const r = await rpc("desp_web_cancelar", { p_token: sessao.token, p_ids: [...marcadosLoja] });
        marcadosLoja.clear(); fecharJanela(); toast(`${r.cancelados} registro(s) cancelado(s).`, "ok"); carregar();
      } catch (err) { toast(err.message, "erro"); }
    };
  };
  $("#btn-pdf-loja").onclick = () => imprimir(`Despesas Complementares — ${nomeLoja(sessao.loja)}`, `<section><h2>Registros da loja</h2>${tabelaRegistros(regs, { impressao: true, loja: false })}</section>`);
}

function badgeStatus(s) { return `<span class="badge ${s === "Aprovado" ? "b-ativo" : s === "Reprovado" ? "b-demitido" : "b-afastado"}">${esc(s)}</span>`; }
function tabelaRegistros(regs, o = {}) {
  const sel = o.selecao, imp = o.impressao;
  return `<div class="tabela-wrap"><table class="simples desp-tab${imp ? " imp" : ""}"><thead><tr>${sel ? "<th></th>" : ""}${o.carimbo === false ? "" : "<th>Carimbo</th>"}${o.loja === false ? "" : "<th>Loja</th>"}<th>Nome completo</th><th>Motivo</th><th>Observações</th><th>Departamento</th><th>Data trabalhada</th><th class="dir">Valor</th>${o.status === false ? "" : "<th>Status</th>"}</tr></thead><tbody>
    ${regs.map((r) => `<tr>${sel ? `<td>${r.status === "Pendente" ? `<input type="checkbox" data-marca="${r.id}"${marcadosLoja.has(r.id) ? " checked" : ""} aria-label="Marcar para cancelar">` : ""}</td>` : ""}${o.carimbo === false ? "" : `<td class="num">${esc(carimbo(r.em))}</td>`}${o.loja === false ? "" : `<td class="num"><b>${p2(r.loja)}</b></td>`}
      <td><b>${esc(r.nome)}</b></td><td>${esc(r.motivo)}</td><td class="obs">${esc(r.obs)}</td><td>${esc(r.depto)}</td><td class="num">${dataBR(r.data)}</td><td class="num dir">${brl(r.valor)}</td>${o.status === false ? "" : `<td>${imp ? `<b class="st-${r.status}">${esc(r.status)}</b>` : badgeStatus(r.status)}</td>`}</tr>`).join("")}
    </tbody></table></div>`;
}

// ============================================================
// SUPERVISOR / ADMIN: painel de aprovação
// ============================================================
const avaliacao = new Map();   // id → 'Aprovado' | 'Reprovado' (o que não está aqui fica Pendente)
const ordLoja = (a, b) => Number(a.loja) - Number(b.loja);
function telaAprovacao() {
  $("#pg-titulo").textContent = "Painel de Aprovação";
  $("#pg-sub").textContent = "Visão consolidada de todas as lojas · avalie os pendentes e confira a semana";
  const regs = dados.registros.map((r) => ({ ...r, valor: Number(r.valor || 0) }));
  const pend = regs.filter((r) => r.status === "Pendente").sort((a, b) => ordLoja(a, b) || a.id - b.id);
  for (const id of [...avaliacao.keys()]) if (!pend.some((r) => r.id === id)) avaliacao.delete(id);
  const apr = regs.filter((r) => r.status === "Aprovado"), rep = regs.filter((r) => r.status === "Reprovado");
  const hist = regs.filter((r) => r.status !== "Pendente").sort((a, b) => ordLoja(a, b) || new Date(b.em) - new Date(a.em));
  const soma = (l) => l.reduce((s, r) => s + r.valor, 0);
  const card = (cls, t, l) => `<div class="kpi ${cls}"><span>${t}</span><strong class="num">${l.length}</strong><small class="num">${brl(soma(l))}</small></div>`;
  let h = `<div class="pagina"><div class="kpis kpis-4">${card("k-AFASTADO", "Pendentes", pend)}${card("k-ATIVO", "Aprovados", apr)}${card("k-DEMITIDO", "Reprovados", rep)}${card("k-FERIAS", "Total geral", regs)}</div>`;

  h += `<div class="cartao"><h3>Avaliação em lote<small>${pend.length} pendente(s)</small></h3>`;
  if (!pend.length) h += '<p class="vazio-msg">Não há despesas pendentes de aprovação no momento.</p>';
  else {
    const nApr = [...avaliacao.values()].filter((v) => v === "Aprovado").length, nRep = [...avaliacao.values()].filter((v) => v === "Reprovado").length;
    h += `<div class="barra-ferr" style="margin-bottom:10px">
        <button type="button" class="btn btn-borda" data-lote="Aprovado">✓ Aprovar todos</button>
        <button type="button" class="btn btn-borda" data-lote="Reprovado">✕ Reprovar todos</button>
        <button type="button" class="btn btn-borda" data-lote="">Voltar todos para pendente</button>
        <span class="nota" style="margin-left:auto">${nApr} para aprovar · ${nRep} para reprovar</span>
        <button type="button" class="btn btn-primario" id="btn-salvar-aval" ${nApr + nRep ? "" : "disabled"}>Salvar avaliações</button></div>
      <div class="tabela-wrap"><table class="simples desp-tab"><thead><tr><th>Avaliação</th><th>Carimbo</th><th>Loja</th><th>Nome completo</th><th>Motivo</th><th>Observações</th><th>Departamento</th><th>Data trabalhada</th><th class="dir">Valor</th></tr></thead><tbody>
      ${pend.map((r) => { const a = avaliacao.get(r.id) || ""; return `<tr class="${a ? "av-" + a : ""}"><td><div class="seg-av" role="group" aria-label="Avaliação">
          <button type="button" data-av="${r.id}" data-st="" class="${!a ? "sel" : ""}" title="Pendente">•</button>
          <button type="button" data-av="${r.id}" data-st="Aprovado" class="ok${a === "Aprovado" ? " sel" : ""}" title="Aprovar">✓</button>
          <button type="button" data-av="${r.id}" data-st="Reprovado" class="no${a === "Reprovado" ? " sel" : ""}" title="Reprovar">✕</button></div></td>
        <td class="num">${esc(carimbo(r.em))}</td><td class="num"><b>${p2(r.loja)}</b></td><td><b>${esc(r.nome)}</b></td><td>${esc(r.motivo)}</td><td class="obs">${esc(r.obs)}</td><td>${esc(r.depto)}</td><td class="num">${dataBR(r.data)}</td><td class="num dir">${brl(r.valor)}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }
  h += "</div>";

  h += `<div class="cartao"><h3>Despesas complementares desta semana<small>${hist.length} avaliada(s)</small></h3>
    ${hist.length ? tabelaRegistros(hist, { carimbo: false }) : '<p class="vazio-msg">Nenhuma despesa foi avaliada ainda.</p>'}</div>`;
  h += `<div class="cartao"><h3>Resumo de aprovados por loja</h3>${blocoResumo(apr, false)}</div>`;
  h += `<div class="cartao barra-ferr">
    <button type="button" class="btn btn-borda" id="btn-excel" ${hist.length ? "" : "disabled"}>${IC.excel}Exportar histórico (Excel)</button>
    <button type="button" class="btn btn-borda" id="btn-imprimir">${IC.pdf}Imprimir / PDF</button>
    ${sessao.perfil === "admin" ? `<button type="button" class="btn btn-perigo" id="btn-limpar" ${apr.length + rep.length ? "" : "disabled"} style="margin-left:auto">${IC.lixo}Limpar avaliados (${apr.length + rep.length})</button>` : ""}</div></div>`;
  $("#conteudo").innerHTML = h;

  $$("[data-av]").forEach((b) => (b.onclick = () => { const id = +b.dataset.av; b.dataset.st ? avaliacao.set(id, b.dataset.st) : avaliacao.delete(id); telaAprovacao(); }));
  $$("[data-lote]").forEach((b) => (b.onclick = () => { pend.forEach((r) => (b.dataset.lote ? avaliacao.set(r.id, b.dataset.lote) : avaliacao.delete(r.id))); telaAprovacao(); }));
  const bs = $("#btn-salvar-aval");
  if (bs) bs.onclick = async () => {
    bs.disabled = true; bs.textContent = "Salvando…";
    try {
      const r = await rpc("desp_web_avaliar", { p_token: sessao.token, p_itens: [...avaliacao].map(([id, status]) => ({ id, status })) });
      avaliacao.clear(); toast(`${r.avaliados} avaliação(ões) salva(s).`, "ok"); carregar();
    } catch (err) { toast(err.message, "erro"); bs.disabled = false; bs.textContent = "Salvar avaliações"; }
  };
  $("#btn-imprimir").onclick = () => imprimir("Despesas Complementares", (pend.length ? `<section><h2>Lançamentos pendentes</h2>${tabelaRegistros(pend, { impressao: true, status: false })}</section>` : "")
    + `<section><h2>Despesas complementares desta semana</h2>${hist.length ? tabelaRegistros(hist, { impressao: true, carimbo: false }) : "<p>Nenhuma despesa avaliada.</p>"}</section>`
    + `<section class="imp-final">${blocoResumo(apr, true)}</section>`);
  const be = $("#btn-excel"); if (be) be.onclick = () => exportarExcel(hist);
  const bl = $("#btn-limpar");
  if (bl) bl.onclick = () => {
    abrirJanela(`<h3>Confirmar limpeza de registros</h3>
      <div class="aviso laranja">Serão apagados <b>${apr.length + rep.length} lançamento(s) já avaliados</b> (Aprovados e Reprovados), de forma permanente. Os <b>${pend.length} pendente(s)</b> continuam no sistema para avaliação.</div>
      <p class="nota">Esta operação não pode ser desfeita. Exporte o Excel ou imprima antes, se precisar guardar.</p>
      <div class="acoes"><button type="button" class="btn btn-borda" data-fechar>Cancelar</button><button type="button" class="btn btn-perigo" id="conf-limpar">Sim, limpar avaliados</button></div>`);
    $("#conf-limpar").onclick = async () => {
      try { const r = await rpc("desp_web_limpar", { p_token: sessao.token, p_confirmacao: "LIMPAR" }); fecharJanela(); toast(`${r.removidos} registro(s) avaliado(s) removido(s). Os pendentes continuam.`, "ok"); carregar(); }
      catch (err) { toast(err.message, "erro"); }
    };
  };
}

// resumo dos aprovados por loja (Qtde/R$ de "Despesas (Justificar)", diárias = total − despesas) com as assinaturas dos lados
function blocoResumo(apr, impressao) {
  const lojas = [...new Set(apr.map((r) => r.loja))].sort((a, b) => Number(a) - Number(b));
  const linhas = lojas.map((l) => {
    const rs = apr.filter((r) => r.loja === l), ds = rs.filter((r) => String(r.motivo).trim() === MOTIVO_DESPESA);
    const tot = rs.reduce((s, r) => s + r.valor, 0), desp = ds.reduce((s, r) => s + r.valor, 0);
    return { l, qd: ds.length, qt: rs.length, desp, diar: tot - desp, tot };
  });
  const T = linhas.reduce((a, x) => ({ qd: a.qd + x.qd, qt: a.qt + x.qt, desp: a.desp + x.desp, diar: a.diar + x.diar, tot: a.tot + x.tot }), { qd: 0, qt: 0, desp: 0, diar: 0, tot: 0 });
  const tabela = linhas.length ? `<table class="resumo num"><thead><tr><th>Loja</th><th>Qtde (Despesas)</th><th>Qtde (Total)</th><th>R$ Despesas</th><th>R$ Diárias</th><th>R$ Total</th></tr></thead><tbody>
      ${linhas.map((x) => `<tr><td>${p2(x.l)}</td><td>${x.qd}</td><td>${x.qt}</td><td>${brl(x.desp)}</td><td>${brl(x.diar)}</td><td>${brl(x.tot)}</td></tr>`).join("")}
      <tr class="total escuro"><td>TOTAL</td><td>${T.qd}</td><td>${T.qt}</td><td>${brl(T.desp)}</td><td>${brl(T.diar)}</td><td>${brl(T.tot)}</td></tr></tbody></table>`
    : '<p class="vazio-msg">Nenhuma despesa aprovada até o momento.</p>';
  const ass = dados.assinaturas || {};
  const img = (k) => (ass["assinatura_" + k] ? `<img src="${ass["assinatura_" + k]}" alt="Assinatura">` : impressao ? "" : '<span class="nota">sem assinatura cadastrada</span>');
  return `<div class="resumo-ass${impressao ? " imp" : ""}"><div class="ass">${img("esquerda")}</div><div class="resumo-meio">${impressao ? "<h3>Resumo de aprovados por loja</h3>" : ""}${tabela}</div><div class="ass">${img("direita")}</div></div>`;
}

// ---------- impressão / PDF ----------
function imprimir(titulo, corpo) {
  $("#impressao").innerHTML = `<header class="imp-cab"><img src="logo.png" alt=""><div><h1>${esc(titulo)}</h1><p>Gerado em ${esc(carimbo(new Date().toISOString()))} por ${esc(sessao.usuario)}</p></div></header>${corpo}`;
  setTimeout(() => window.print(), 80);
}

// ---------- Excel do histórico ----------
let exceljs = null;
function carregarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  exceljs ||= new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
    s.onload = () => ok(window.ExcelJS); s.onerror = () => { exceljs = null; falha(new Error("Não consegui carregar o gerador de Excel.")); };
    document.head.appendChild(s);
  });
  return exceljs;
}
async function exportarExcel(hist) {
  carregando(true);
  try {
    const ExcelJS = await carregarExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Histórico", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [["Carimbo de Data/Hora", 18], ["Loja", 7], ["Nome Completo", 34], ["Motivo", 22], ["Observações", 44], ["Departamento", 18], ["Data Trabalhada", 14], ["Valor", 13], ["Autorização Supervisor", 16]].map(([header, width]) => ({ header, width }));
    ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3D63" } }; });
    for (const r of hist) {
      const [a, m, d] = String(r.data).slice(0, 10).split("-").map(Number);
      const row = ws.addRow([carimbo(r.em), Number(r.loja), r.nome, r.motivo, r.obs, r.depto, new Date(Date.UTC(a, m - 1, d)), r.valor, r.status]);
      row.getCell(7).numFmt = "dd/mm/yyyy"; row.getCell(8).numFmt = '"R$" #,##0.00';
      row.getCell(5).alignment = { wrapText: true, vertical: "top" };
      row.getCell(9).font = { bold: true, color: { argb: r.status === "Aprovado" ? "FF047857" : "FFC62828" } };
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + hist.length, column: 9 } };
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    a.download = `historico_despesas_${hojeISO().split("-").reverse().join("")}.xlsx`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  } catch (e) { toast(e.message, "erro"); } finally { carregando(false); }
}

// ============================================================
// ADMIN: usuários + assinaturas
// ============================================================
async function telaUsuarios() {
  $("#pg-titulo").textContent = "Usuários";
  $("#pg-sub").textContent = "Logins, perfis, senhas e as assinaturas do relatório";
  $("#conteudo").innerHTML = '<div class="cartao vazio-msg">Carregando…</div>';
  let lista;
  try { lista = await rpc("desp_web_usuarios_lista", { p_token: sessao.token }); }
  catch (e) { $("#conteudo").innerHTML = `<div class="cartao"><p class="erro">${esc(e.message)}</p></div>`; return; }
  if (pagina() !== "usuarios") return;
  const quando = (v) => (v ? carimbo(v) : "—");
  const ass = dados.assinaturas || {};
  $("#conteudo").innerHTML = `<div class="pagina"><div class="cartao"><h3>Logins<small>${lista.length} usuários</small></h3>
    <p class="nota" style="margin-bottom:12px">Trocar a senha, o perfil ou desativar derruba na hora quem estiver logado com aquele usuário. A senha fica guardada só como código (hash).</p>
    <div class="barra-ferr" style="margin-bottom:12px"><button type="button" class="btn btn-primario" data-us="novo">${IC.lancar}Novo login</button></div>
    <div class="tabela-wrap"><table class="simples"><thead><tr><th>Usuário</th><th>Perfil</th><th>Loja</th><th>Situação</th><th>Senha</th><th>Último login</th><th></th></tr></thead><tbody>
    ${lista.map((u, i) => `<tr class="${u.ativo ? "" : "inativo"}"><td><b>${esc(u.usuario)}</b>${u.usuario === sessao.usuario ? ' <span class="badge b-ok">você</span>' : ""}</td>
      <td>${esc(ROTULO_PERFIL[u.perfil] || u.perfil)}</td><td>${u.loja ? nomeLoja(u.loja) : "Todas"}</td>
      <td>${u.ativo ? '<span class="badge b-ativo">Ativo</span>' : '<span class="badge b-demitido">Desativado</span>'}</td>
      <td>${u.tem_senha ? "definida" : '<span class="badge b-afastado">sem senha</span>'}</td><td class="num">${esc(quando(u.ultimo_login))}</td>
      <td><button type="button" class="btn btn-borda btn-peq" data-us="${i}">Editar</button></td></tr>`).join("")}</tbody></table></div></div>
    <div class="cartao"><h3>Assinaturas do relatório</h3>
      <p class="nota" style="margin-bottom:12px">Aparecem dos lados do resumo por loja na impressão. Ficam guardadas no banco (só quem tem login de supervisor ou administrador vê), e não no GitHub.</p>
      <div class="ass-cfg">${["esquerda", "direita"].map((l) => `<div class="ass-item"><b>Assinatura da ${l}</b><div class="ass-prev">${ass["assinatura_" + l] ? `<img src="${ass["assinatura_" + l]}" alt="">` : '<span class="nota">nenhuma</span>'}</div>
        <label class="btn btn-borda btn-peq">Enviar imagem<input type="file" accept="image/png,image/jpeg" data-ass="${l}" hidden></label>
        ${ass["assinatura_" + l] ? `<button type="button" class="btn btn-borda btn-peq" data-ass-rm="${l}">Remover</button>` : ""}</div>`).join("")}</div></div></div>`;
  $$("[data-us]").forEach((b) => (b.onclick = () => formUsuario(b.dataset.us === "novo" ? null : lista[+b.dataset.us])));
  $$("[data-ass]").forEach((inp) => (inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 500 * 1024) return toast(MENSAGENS.IMAGEM_INVALIDA, "erro");
    const rd = new FileReader();
    rd.onload = () => salvarAssinatura(inp.dataset.ass, rd.result);
    rd.readAsDataURL(f);
  }));
  $$("[data-ass-rm]").forEach((b) => (b.onclick = () => salvarAssinatura(b.dataset.assRm, "")));
}
async function salvarAssinatura(lado, img) {
  try { await rpc("desp_web_assinatura_salvar", { p_token: sessao.token, p_lado: lado, p_imagem: img }); toast(img ? "Assinatura salva." : "Assinatura removida.", "ok"); dados = await rpc("desp_web_dados", { p_token: sessao.token }); telaUsuarios(); }
  catch (e) { toast(e.message, "erro"); }
}
function formUsuario(u) {
  const novo = !u;
  const lojas = [1, 2, 3, 4, 5, 6, 7, 8, 30];
  abrirJanela(`<h3>${novo ? "Novo login" : "Editar " + esc(u.usuario)}</h3>
    <form id="form-us" class="us-form" autocomplete="off">
      <label class="campo"><span>Usuário</span><input name="usuario" maxlength="40" value="${esc(u?.usuario || "")}"${novo ? "" : " readonly"} autocapitalize="off" placeholder="ex.: loja05, supervisor2"></label>
      <label class="campo"><span>Perfil</span><select name="perfil">${["loja", "supervisor", "admin"].map((p) => `<option value="${p}"${(u?.perfil || "loja") === p ? " selected" : ""}>${ROTULO_PERFIL[p]}</option>`).join("")}</select></label>
      <label class="campo" id="campo-loja"><span>Loja</span><select name="loja">${lojas.map((l) => `<option value="${l}"${u?.loja === l ? " selected" : ""}>${nomeLoja(l)}</option>`).join("")}</select></label>
      <label class="campo"><span>${novo ? "Senha (mínimo 6)" : "Nova senha (em branco = não muda)"}</span>
        <input name="senha" type="text" class="senha" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" data-form-type="other"></label>
      <label class="check"><input type="checkbox" name="ativo"${u?.ativo === false ? "" : " checked"}> Login ativo</label>
      <p class="nota">Loja: lança e cancela os pendentes dela. Supervisor: aprova, imprime e exporta. Administrador: tudo, inclusive limpar a semana e esta tela.</p>
      <div class="acoes"><button type="button" class="btn btn-borda" data-fechar>Cancelar</button><button type="submit" class="btn btn-primario" id="us-salvar">Salvar</button></div>
    </form>`);
  const f = $("#form-us");
  const aj = () => ($("#campo-loja").hidden = f.perfil.value !== "loja");
  f.perfil.onchange = aj; aj();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const b = $("#us-salvar"); b.disabled = true;
    try {
      await rpc("desp_web_usuario_salvar", { p_token: sessao.token, p_usuario: f.usuario.value, p_perfil: f.perfil.value, p_loja: f.perfil.value === "loja" ? +f.loja.value : null, p_ativo: f.ativo.checked, p_senha: f.senha.value });
      fecharJanela(); toast(novo ? "Login criado." : "Login atualizado.", "ok"); telaUsuarios();
    } catch (err) { toast(err.message, "erro"); b.disabled = false; }
  };
}

// ---------- janela ----------
function abrirJanela(html) { const j = $("#janela"); j.innerHTML = html; j.hidden = false; $("#veu-janela").hidden = false; }
function fecharJanela() { $("#janela").hidden = true; $("#veu-janela").hidden = true; }
$("#veu-janela").addEventListener("click", fecharJanela);
$("#janela").addEventListener("click", (e) => { if (e.target.closest("[data-fechar]")) fecharJanela(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharJanela(); });

// ---------- tema + menu + início ----------
const temaAtual = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const rotuloTema = () => ($("#txt-tema").textContent = temaAtual() === "dark" ? "Claro" : "Escuro");
$("#btn-tema").addEventListener("click", () => { const n = temaAtual() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n; gravarLocal("desp_web_tema", n); rotuloTema(); });
$("#btn-menu").addEventListener("click", () => { const f = document.documentElement.classList.toggle("menu-fechado"); gravarLocal("desp_web_menu", f ? "fechado" : null); });
document.addEventListener("DOMContentLoaded", () => { rotuloTema(); if (sessao?.token) iniciarApp(); else telaLogin(); });
