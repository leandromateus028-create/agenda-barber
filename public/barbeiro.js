// public/barbeiro.js
// O comportamento do painel do barbeiro: ver a agenda de um dia e cancelar
// agendamentos.
//
// Login: este arquivo NÃO sabe a senha e não a guarda em lugar nenhum. Quem
// pede usuário e senha é o próprio navegador (autenticação HTTP Basic), quando
// a página é aberta. Depois disso o navegador envia o login sozinho em cada
// requisição para o mesmo servidor.
//
// Regras: o painel só mostra e pede. Quem decide o que pode ou não (inclusive
// o que já passou do prazo) é o servidor.

"use strict";

// ---------------------------------------------------------------------------
// Configurações e textos
// ---------------------------------------------------------------------------

const INTERVALO_DE_ATUALIZACAO_MS = 60 * 1000; // atualização automática
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2099;

const DIAS_SEMANA_LONGO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ---------------------------------------------------------------------------
// Elementos da página (buscados uma vez só)
// ---------------------------------------------------------------------------

const linkSemana = document.getElementById("link-semana");
const botaoAtualizar = document.getElementById("botao-atualizar");
const botaoAnterior = document.getElementById("botao-anterior");
const botaoHoje = document.getElementById("botao-hoje");
const botaoProximo = document.getElementById("botao-proximo");
const textoDia = document.getElementById("texto-dia");
const seloHoje = document.getElementById("selo-hoje");
const campoData = document.getElementById("campo-data");
const resumoDia = document.getElementById("resumo-dia");
const mensagem = document.getElementById("mensagem");
const aviso = document.getElementById("aviso");
const avisoTexto = document.getElementById("aviso-texto");
const avisoAcao = document.getElementById("aviso-acao");
const listaHorarios = document.getElementById("lista-horarios");
const legenda = document.getElementById("legenda");
const dialogo = document.getElementById("dialogo-cancelar");
const dialogoTexto = document.getElementById("dialogo-texto");
const dialogoErro = document.getElementById("dialogo-erro");
const dialogoManter = document.getElementById("dialogo-manter");
const dialogoConfirmar = document.getElementById("dialogo-confirmar");

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const estado = {
  data: dataInicial(), // dia mostrado (data local, à meia-noite)
  linhasBase: [], // horários do servidor: { horario, cliente, disponivel }
  agendaveis: null, // Set com os horários que clientes ainda podem agendar (ou null)
  linhas: [], // linhasBase + situação: "ocupado", "livre" ou "encerrado"
  assinatura: "", // texto que resume a tela, para só redesenhar se mudou
  sequencia: 0, // número da última consulta (descarta respostas antigas)
  carregando: false,
  cancelando: false,
  alvo: null, // agendamento do diálogo: { horario, cliente, dataApi }
  focoPendente: null, // horário da linha que deve receber o foco
  acaoDoAviso: "recarregar", // o que o botão do aviso faz
};

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

// Zera a hora: só importa o dia
function inicioDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

// Soma (ou subtrai) dias, cuidando da virada de mês e de ano
function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function mesmoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dentroDoIntervalo(data) {
  return data.getFullYear() >= ANO_MINIMO && data.getFullYear() <= ANO_MAXIMO;
}

// Converte "AAAA-MM-DD" em data local. Devolve null se o texto estiver mal
// formado, se a data não existir ou se estiver fora do intervalo aceito.
function lerDataIso(texto) {
  const correspondencia = String(texto || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!correspondencia) {
    return null;
  }

  const [, ano, mes, dia] = correspondencia.map(Number);
  const data = new Date(ano, mes - 1, dia);

  // Descarta datas que não existem (o JavaScript "corrigiria" 31/02 para março)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }

  return dentroDoIntervalo(data) ? data : null;
}

// O dia que o painel mostra ao abrir: o do endereço (?data=AAAA-MM-DD, usado
// pelo resumo da semana) ou, sem ele, hoje
function dataInicial() {
  const doEndereco = lerDataIso(new URLSearchParams(window.location.search).get("data"));
  return doEndereco || inicioDoDia(new Date());
}

// "DD/MM/AAAA": o formato que a API entende
function formatarDataApi(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// "AAAA-MM-DD": o formato do campo de data do navegador
function formatarDataCampo(data) {
  const ano = String(data.getFullYear()).padStart(4, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Ex: "quarta-feira, 14 de outubro de 2026"
function descreverData(data) {
  return `${DIAS_SEMANA_LONGO[data.getDay()]}, ${data.getDate()} de ${MESES_LONGO[data.getMonth()]} de ${data.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Conversa com a API
// ---------------------------------------------------------------------------

// Faz a requisição e devolve sempre { ok, status, dados, esperar }.
// status 0 significa que não foi possível falar com o servidor.
async function chamarApi(caminho, opcoes) {
  try {
    const resposta = await fetch(caminho, {
      credentials: "same-origin",
      cache: "no-store",
      ...opcoes,
    });

    let dados = null;
    try {
      dados = await resposta.json();
    } catch (erro) {
      dados = null;
    }

    return {
      ok: resposta.ok,
      status: resposta.status,
      dados,
      esperar: Number(resposta.headers.get("Retry-After")) || 0,
    };
  } catch (erro) {
    return { ok: false, status: 0, dados: null, esperar: 0 };
  }
}

// Transforma uma resposta com problema em um texto claro para o barbeiro
function descreverFalha(resultado) {
  if (resultado.status === 0) {
    return {
      tipo: "conexao",
      texto: "Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.",
    };
  }

  if (resultado.status === 401) {
    return {
      tipo: "autenticacao",
      texto:
        "Não foi possível confirmar o seu acesso. Entre de novo com o usuário e a senha do barbeiro.",
    };
  }

  if (resultado.status === 429) {
    const minutos = Math.ceil(resultado.esperar / 60);
    const quando =
      minutos > 0
        ? `Aguarde cerca de ${minutos} ${minutos === 1 ? "minuto" : "minutos"} e tente de novo.`
        : "Aguarde alguns minutos e tente de novo.";
    return { tipo: "bloqueio", texto: `Muitas tentativas incorretas de login. ${quando}` };
  }

  if (resultado.status === 503) {
    return {
      tipo: "desativada",
      texto:
        "A área do barbeiro está desativada: a senha ainda não foi configurada no servidor.",
    };
  }

  if (resultado.dados && typeof resultado.dados.erro === "string" && resultado.dados.erro !== "") {
    return { tipo: "servidor", texto: resultado.dados.erro };
  }

  return {
    tipo: "servidor",
    texto: `O servidor respondeu com um erro inesperado (código ${resultado.status}).`,
  };
}

const FALHA_RESPOSTA_INESPERADA = {
  tipo: "inesperada",
  texto:
    "O servidor enviou uma resposta que o painel não entendeu. Tente atualizar a agenda.",
};

// Confere o formato da agenda do dia e devolve os horários em ordem.
// Devolve null se a resposta não tiver o formato esperado.
function lerAgendaDoDia(dados) {
  if (!dados || !Array.isArray(dados.horarios)) {
    return null;
  }

  const linhas = [];

  for (const item of dados.horarios) {
    const valido =
      item &&
      typeof item.horario === "string" &&
      /^\d{2}:\d{2}$/.test(item.horario) &&
      typeof item.disponivel === "boolean" &&
      (item.cliente === null || item.cliente === undefined || typeof item.cliente === "string");

    if (!valido) {
      return null;
    }

    linhas.push({
      horario: item.horario,
      cliente: item.cliente || "",
      disponivel: item.disponivel,
    });
  }

  // "09:00" < "10:00" < "13:00": com 2 dígitos, a ordem do texto é a do relógio
  linhas.sort((a, b) => a.horario.localeCompare(b.horario));
  return linhas;
}

// Lê a lista de horários que clientes ainda podem agendar (rota pública).
// Se vier algo estranho, devolve null e o painel mostra tudo que está livre
// como "Livre".
function lerHorariosAgendaveis(resultado) {
  const lista = resultado.ok && resultado.dados ? resultado.dados.horarios : null;

  if (!Array.isArray(lista) || !lista.every((item) => typeof item === "string")) {
    return null;
  }

  return new Set(lista);
}

// ---------------------------------------------------------------------------
// Desenho da tela
// ---------------------------------------------------------------------------

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) {
    elemento.className = classe;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}

// Acrescenta a situação de cada horário
function classificar(linhasBase, agendaveis) {
  return linhasBase.map((linha) => {
    let situacao = "livre";

    if (!linha.disponivel) {
      situacao = "ocupado";
    } else if (agendaveis && !agendaveis.has(linha.horario)) {
      situacao = "encerrado";
    }

    return { ...linha, situacao };
  });
}

function pluralizar(quantidade, singular, plural) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

function montarResumo(linhas) {
  if (linhas.length === 0) {
    return "Nenhum horário cadastrado para este dia.";
  }

  const ocupados = linhas.filter((l) => l.situacao === "ocupado").length;
  const livres = linhas.filter((l) => l.situacao === "livre").length;
  const encerrados = linhas.filter((l) => l.situacao === "encerrado").length;

  if (ocupados === 0) {
    const partes = ["Nenhum agendamento neste dia."];
    if (livres > 0) {
      partes.push(`${pluralizar(livres, "horário livre", "horários livres")}.`);
    }
    return partes.join(" ");
  }

  const contagens = [pluralizar(ocupados, "ocupado", "ocupados"), pluralizar(livres, "livre", "livres")];
  if (encerrados > 0) {
    contagens.push(pluralizar(encerrados, "encerrado", "encerrados"));
  }
  return contagens.join(" · ");
}

// Desenha uma linha por horário
function desenharLinhas() {
  listaHorarios.replaceChildren();

  estado.linhas.forEach((linha) => {
    const item = criarElemento("li", "linha");
    item.dataset.situacao = linha.situacao;
    item.dataset.horario = linha.horario;
    item.tabIndex = -1; // permite levar o foco para a linha por programa

    const detalhe = criarElemento("div", "detalhe");

    if (linha.situacao === "ocupado") {
      const nome = linha.cliente || "Cliente sem nome";
      detalhe.append(criarElemento("span", "principal", nome), criarElemento("span", "situacao", "Ocupado"));

      const botao = criarElemento("button", "botao botao-cancelar", "Cancelar");
      botao.type = "button";
      botao.setAttribute("aria-label", `Cancelar agendamento de ${nome} às ${linha.horario}`);
      botao.addEventListener("click", () => abrirDialogoDeCancelamento(linha));

      item.append(criarElemento("span", "hora", linha.horario), detalhe, botao);
    } else {
      const rotulo = linha.situacao === "encerrado" ? "Encerrado" : "Livre";
      detalhe.append(criarElemento("span", "principal", rotulo));
      item.append(criarElemento("span", "hora", linha.horario), detalhe);
    }

    listaHorarios.appendChild(item);
  });
}

// Aplica uma agenda nova na tela. Só redesenha se algo mudou, para não tirar
// o foco do teclado a cada atualização automática.
function aplicarAgenda(linhasBase, agendaveis) {
  estado.linhasBase = linhasBase;
  estado.agendaveis = agendaveis;

  const linhas = classificar(linhasBase, agendaveis);
  const assinatura = JSON.stringify(linhas);

  if (assinatura !== estado.assinatura) {
    estado.linhas = linhas;
    estado.assinatura = assinatura;
    desenharLinhas();
    resumoDia.textContent = montarResumo(linhas);
    legenda.hidden = !linhas.some((l) => l.situacao === "encerrado");
  }

  // Depois de cancelar, o foco vai para a linha liberada. O pedido de foco só
  // termina quando a conferência com o servidor acaba (veja
  // confirmarCancelamento), porque ela pode redesenhar a linha.
  if (estado.focoPendente) {
    const linha = listaHorarios.querySelector(`[data-horario="${estado.focoPendente}"]`);
    if (linha) {
      linha.focus();
    }
  }
}

// Título, selo "Hoje", campo de data, endereço da página e link da semana
function atualizarCabecalhoDoDia() {
  const ehHoje = mesmoDia(estado.data, new Date());

  textoDia.textContent = descreverData(estado.data);
  seloHoje.hidden = !ehHoje;
  campoData.value = formatarDataCampo(estado.data);

  // Mantém o dia no endereço, para o botão "voltar" e o recarregar da página
  // continuarem no mesmo dia (em "hoje", o endereço fica limpo)
  const endereco = new URL(window.location.href);
  if (ehHoje) {
    endereco.searchParams.delete("data");
  } else {
    endereco.searchParams.set("data", formatarDataCampo(estado.data));
  }
  window.history.replaceState(null, "", endereco.pathname + endereco.search + endereco.hash);

  // O resumo da semana abre na semana do dia que está na tela
  linkSemana.href = ehHoje ? "/semana" : `/semana?data=${formatarDataCampo(estado.data)}`;
}

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function mostrarAviso(falha) {
  avisoTexto.textContent = falha.texto;

  if (falha.tipo === "autenticacao") {
    estado.acaoDoAviso = "entrar";
    avisoAcao.textContent = "Entrar de novo";
  } else {
    estado.acaoDoAviso = "recarregar";
    avisoAcao.textContent = "Tentar de novo";
  }

  aviso.hidden = false;
}

function esconderAviso() {
  aviso.hidden = true;
  avisoTexto.textContent = "";
}

// ---------------------------------------------------------------------------
// Carregar a agenda
// ---------------------------------------------------------------------------

// Busca a agenda do dia mostrado. "silencioso" é a atualização automática:
// não apaga a lista nem mostra "carregando" (mas mostra erros).
async function carregarAgenda({ silencioso = false } = {}) {
  const sequencia = ++estado.sequencia;
  const dataApi = formatarDataApi(estado.data);
  const consulta = `?data=${encodeURIComponent(dataApi)}`;

  estado.carregando = true;

  if (!silencioso) {
    esconderAviso();
    estado.linhasBase = [];
    estado.agendaveis = null;
    estado.linhas = [];
    estado.assinatura = "";
    listaHorarios.replaceChildren();
    legenda.hidden = true;
    resumoDia.textContent = "Carregando agenda…";
    listaHorarios.setAttribute("aria-busy", "true");
  }

  // Duas consultas ao mesmo tempo:
  //  1) a agenda completa do dia (rota do barbeiro, com os nomes);
  //  2) os horários que clientes ainda podem agendar (rota pública). Servem para
  //     marcar como "Encerrado" o que já passou, sem copiar a regra do servidor.
  const [agenda, agendaveis] = await Promise.all([
    chamarApi(`/api/horarios${consulta}`),
    chamarApi(`/api/horarios/disponiveis${consulta}`),
  ]);

  // Se outra consulta começou enquanto esta esperava, ignora esta resposta
  if (sequencia !== estado.sequencia) {
    return;
  }

  estado.carregando = false;
  listaHorarios.removeAttribute("aria-busy");

  if (!agenda.ok) {
    if (!silencioso) {
      resumoDia.textContent = "";
    }
    mostrarAviso(descreverFalha(agenda));
    return;
  }

  const linhasBase = lerAgendaDoDia(agenda.dados);

  if (linhasBase === null) {
    if (!silencioso) {
      resumoDia.textContent = "";
    }
    mostrarAviso(FALHA_RESPOSTA_INESPERADA);
    return;
  }

  esconderAviso();
  aplicarAgenda(linhasBase, lerHorariosAgendaveis(agendaveis));
}

// Atualização automática: só quando a aba está visível e nada está acontecendo
function podeAtualizarSozinho() {
  return (
    document.visibilityState === "visible" &&
    !estado.carregando &&
    !estado.cancelando &&
    !dialogo.open
  );
}

function atualizarSozinho() {
  if (podeAtualizarSozinho()) {
    carregarAgenda({ silencioso: true });
  }
}

// ---------------------------------------------------------------------------
// Navegar entre os dias
// ---------------------------------------------------------------------------

function irParaData(novaData) {
  const data = inicioDoDia(novaData);

  if (!dentroDoIntervalo(data)) {
    return;
  }

  estado.data = data;
  estado.focoPendente = null;
  mostrarMensagem("");
  atualizarCabecalhoDoDia();
  carregarAgenda();
}

function aoMudarCampoData() {
  // Campo apagado, incompleto, com data que não existe ou fora do intervalo:
  // ignora (lerDataIso devolve null)
  const data = lerDataIso(campoData.value);

  if (data) {
    irParaData(data);
  }
}

// ---------------------------------------------------------------------------
// Cancelar um agendamento
// ---------------------------------------------------------------------------

function abrirDialogoDeCancelamento(linha) {
  const nome = linha.cliente || "cliente sem nome";

  estado.alvo = {
    horario: linha.horario,
    cliente: linha.cliente,
    dataApi: formatarDataApi(estado.data),
  };

  dialogoTexto.textContent =
    `Cancelar o agendamento de ${nome} às ${linha.horario}, ${descreverData(estado.data)}?`;
  dialogoErro.hidden = true;
  dialogoErro.textContent = "";

  if (typeof dialogo.showModal === "function") {
    dialogo.showModal();
  } else if (window.confirm(dialogoTexto.textContent)) {
    // Navegadores muito antigos, sem <dialog>: usa a janela de confirmação padrão
    confirmarCancelamento();
  }
}

function fecharDialogo() {
  if (dialogo.open) {
    dialogo.close();
  }
}

function definirDialogoOcupado(ocupado) {
  dialogoManter.disabled = ocupado;
  dialogoConfirmar.disabled = ocupado;
  dialogoConfirmar.textContent = ocupado ? "Cancelando…" : "Cancelar agendamento";
}

async function confirmarCancelamento() {
  if (estado.cancelando || !estado.alvo) {
    return;
  }

  const alvo = estado.alvo;

  estado.cancelando = true;
  dialogoErro.hidden = true;
  definirDialogoOcupado(true);

  const resultado = await chamarApi(
    `/api/agendamentos?data=${encodeURIComponent(alvo.dataApi)}&horario=${encodeURIComponent(alvo.horario)}`,
    { method: "DELETE" }
  );

  estado.cancelando = false;
  definirDialogoOcupado(false);

  const nome = alvo.cliente || "cliente sem nome";

  if (resultado.ok) {
    fecharDialogo();
    estado.alvo = null;
    esconderAviso();
    mostrarMensagem(`Agendamento de ${nome} às ${alvo.horario} cancelado. O horário está livre.`);

    // Libera o horário na tela na hora, sem esperar pela próxima consulta.
    // Um horário ocupado não aparece na lista de "agendáveis", por isso ele é
    // acrescentado a ela aqui; senão a linha apareceria como "Encerrado".
    estado.focoPendente = alvo.horario;
    aplicarAgenda(
      estado.linhasBase.map((linha) =>
        linha.horario === alvo.horario ? { ...linha, cliente: "", disponivel: true } : linha
      ),
      estado.agendaveis ? new Set([...estado.agendaveis, alvo.horario]) : null
    );

    // E confere com o servidor como a agenda ficou de fato (se o horário já
    // tinha passado, ele passa a "Encerrado"; o foco acompanha a linha).
    await carregarAgenda({ silencioso: true });
    estado.focoPendente = null;
    return;
  }

  // 404: o horário já estava livre (alguém cancelou antes, por exemplo)
  if (resultado.status === 404) {
    fecharDialogo();
    estado.alvo = null;
    mostrarMensagem(`O horário das ${alvo.horario} já estava livre. A agenda foi atualizada.`);
    carregarAgenda({ silencioso: true });
    return;
  }

  // Sem permissão: fecha o diálogo e mostra o aviso de login
  if (resultado.status === 401) {
    fecharDialogo();
    estado.alvo = null;
    mostrarAviso(descreverFalha(resultado));
    return;
  }

  // Outros problemas: o diálogo continua aberto, para tentar de novo
  dialogoErro.textContent = `${descreverFalha(resultado).texto} O agendamento NÃO foi cancelado.`;
  dialogoErro.hidden = false;
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

botaoAnterior.addEventListener("click", () => irParaData(somarDias(estado.data, -1)));
botaoProximo.addEventListener("click", () => irParaData(somarDias(estado.data, 1)));
botaoHoje.addEventListener("click", () => irParaData(new Date()));
botaoAtualizar.addEventListener("click", () => {
  mostrarMensagem("");
  carregarAgenda();
});
campoData.addEventListener("change", aoMudarCampoData);

avisoAcao.addEventListener("click", () => {
  if (estado.acaoDoAviso === "entrar") {
    // Recarregar a página faz o navegador pedir usuário e senha de novo
    window.location.reload();
  } else {
    carregarAgenda();
  }
});

dialogoManter.addEventListener("click", fecharDialogo);
dialogoConfirmar.addEventListener("click", confirmarCancelamento);

// A tecla Esc não pode fechar o diálogo enquanto o cancelamento está em andamento
dialogo.addEventListener("cancel", (evento) => {
  if (estado.cancelando) {
    evento.preventDefault();
  }
});

dialogo.addEventListener("close", () => {
  if (!estado.cancelando) {
    estado.alvo = null;
  }
});

// Mantém a agenda em dia sem o barbeiro precisar apertar "Atualizar"
document.addEventListener("visibilitychange", atualizarSozinho);
setInterval(atualizarSozinho, INTERVALO_DE_ATUALIZACAO_MS);

atualizarCabecalhoDoDia();
carregarAgenda();