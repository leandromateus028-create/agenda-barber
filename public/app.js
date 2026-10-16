// public/app.js
// O comportamento da página de agendamento do cliente.
// Fluxo: escolher o dia -> escolher o horário -> informar o nome -> confirmar.
// A página conversa com o servidor pela API (endereços que começam com /api).

"use strict";

// ---------------------------------------------------------------------------
// Configurações e textos
// ---------------------------------------------------------------------------

const QUANTIDADE_DE_DIAS = 14;

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MESES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ---------------------------------------------------------------------------
// Elementos da página (buscados uma vez só)
// ---------------------------------------------------------------------------

const instrucao = document.getElementById("instrucao");
const listaDias = document.getElementById("lista-dias");
const secaoHorarios = document.getElementById("secao-horarios");
const diaEscolhido = document.getElementById("dia-escolhido");
const alertaHorarios = document.getElementById("alerta-horarios");
const estadoHorarios = document.getElementById("estado-horarios");
const listaHorarios = document.getElementById("lista-horarios");
const secaoFormulario = document.getElementById("secao-formulario");
const resumoEscolha = document.getElementById("resumo-escolha");
const formulario = document.getElementById("formulario");
const campoNome = document.getElementById("campo-nome");
const erroFormulario = document.getElementById("erro-formulario");
const botaoConfirmar = document.getElementById("botao-confirmar");
const secaoDia = document.getElementById("secao-dia");
const secaoConfirmacao = document.getElementById("secao-confirmacao");
const tituloConfirmacao = document.getElementById("titulo-confirmacao");
const textoConfirmacao = document.getElementById("texto-confirmacao");
const botaoNovo = document.getElementById("botao-novo");

// O que o cliente já escolheu
const estado = {
  dia: null, // objeto do dia escolhido (veja gerarProximosDias)
  horario: null, // ex: "09:00"
  enviando: false,
};

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

// Transforma uma data do JavaScript em texto DD/MM/AAAA (o formato da API)
function formatarData(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// Monta a lista dos próximos dias, começando por hoje.
// Usa a data local do aparelho (new Date(ano, mês, dia + i) já cuida da
// virada de mês e de ano).
function gerarProximosDias(quantidade) {
  const hoje = new Date();
  const dias = [];

  for (let i = 0; i < quantidade; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);

    dias.push({
      texto: formatarData(data), // "14/10/2026"
      diaDaSemana: data.getDay(),
      numero: data.getDate(),
      mes: data.getMonth(),
      ehHoje: i === 0,
    });
  }

  return dias;
}

// Descreve o dia por extenso. Ex: "quarta-feira, 14 de outubro"
function descreverDia(dia) {
  return `${DIAS_SEMANA_LONGO[dia.diaDaSemana]}, ${dia.numero} de ${MESES_LONGO[dia.mes]}`;
}

// ---------------------------------------------------------------------------
// Conversa com a API
// ---------------------------------------------------------------------------

// Faz a requisição e devolve sempre { ok, status, dados }.
// status 0 significa que não foi possível falar com o servidor.
async function chamarApi(caminho, opcoes) {
  try {
    const resposta = await fetch(caminho, opcoes);

    let dados = null;
    try {
      dados = await resposta.json();
    } catch (erro) {
      dados = null;
    }

    return { ok: resposta.ok, status: resposta.status, dados };
  } catch (erro) {
    return { ok: false, status: 0, dados: null };
  }
}

// Escolhe a mensagem de erro que o cliente vai ler
function mensagemDeErro(resultado) {
  if (resultado.status === 0) {
    return "Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.";
  }

  if (resultado.dados && resultado.dados.erro) {
    return resultado.dados.erro;
  }

  return "Algo deu errado. Tente de novo em instantes.";
}

// ---------------------------------------------------------------------------
// Desenho da tela
// ---------------------------------------------------------------------------

// Cria um <span> com texto e classe
function criarSpan(classe, texto) {
  const span = document.createElement("span");
  span.className = classe;
  span.textContent = texto;
  return span;
}

// Marca visualmente (e para leitores de tela) qual botão do grupo está escolhido
function marcarSelecionado(container, botaoEscolhido) {
  container.querySelectorAll("button").forEach((botao) => {
    botao.setAttribute("aria-pressed", botao === botaoEscolhido ? "true" : "false");
  });
}

// Desenha os botões dos próximos dias
function desenharDias() {
  const dias = gerarProximosDias(QUANTIDADE_DE_DIAS);

  dias.forEach((dia) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "dia";
    botao.setAttribute("aria-pressed", "false");

    const descricao = descreverDia(dia);
    botao.setAttribute("aria-label", dia.ehHoje ? `Hoje, ${descricao}` : descricao);

    botao.append(
      criarSpan("dia-semana", dia.ehHoje ? "Hoje" : DIAS_SEMANA_CURTO[dia.diaDaSemana]),
      criarSpan("dia-numero", String(dia.numero)),
      criarSpan("dia-mes", MESES_CURTO[dia.mes])
    );

    botao.addEventListener("click", () => escolherDia(dia, botao));
    listaDias.appendChild(botao);
  });
}

// Desenha os botões de horário
function desenharHorarios(horarios) {
  listaHorarios.replaceChildren();

  horarios.forEach((horario) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "horario";
    botao.textContent = horario;
    botao.setAttribute("aria-pressed", "false");
    botao.addEventListener("click", () => escolherHorario(horario, botao));
    listaHorarios.appendChild(botao);
  });
}

function mostrarErroDoFormulario(texto, marcarCampo) {
  erroFormulario.textContent = texto;
  erroFormulario.hidden = false;

  if (marcarCampo) {
    campoNome.setAttribute("aria-invalid", "true");
  }
}

function limparErroDoFormulario() {
  erroFormulario.textContent = "";
  erroFormulario.hidden = true;
  campoNome.removeAttribute("aria-invalid");
}

function mostrarAlertaDeHorarios(texto) {
  alertaHorarios.textContent = texto;
  alertaHorarios.hidden = texto === "";
}

// Esconde o formulário do nome e esquece o horário escolhido
function esconderFormulario() {
  estado.horario = null;
  secaoFormulario.hidden = true;
  limparErroDoFormulario();
  marcarSelecionado(listaHorarios, null);
}

// ---------------------------------------------------------------------------
// Ações do cliente
// ---------------------------------------------------------------------------

// O cliente tocou em um dia
async function escolherDia(dia, botao) {
  estado.dia = dia;
  marcarSelecionado(listaDias, botao);
  esconderFormulario();
  mostrarAlertaDeHorarios("");

  diaEscolhido.textContent = descreverDia(dia);
  secaoHorarios.hidden = false;

  await carregarHorarios();
}

// Busca na API os horários livres do dia escolhido e mostra na tela
async function carregarHorarios() {
  const dia = estado.dia;

  listaHorarios.replaceChildren();
  estadoHorarios.textContent = "Carregando horários...";

  const resultado = await chamarApi(
    `/api/horarios/disponiveis?data=${encodeURIComponent(dia.texto)}`
  );

  // Se o cliente escolheu outro dia enquanto esperava, ignora esta resposta
  if (estado.dia !== dia) {
    return;
  }

  if (!resultado.ok) {
    estadoHorarios.textContent = mensagemDeErro(resultado);
    return;
  }

  // O servidor já entrega só os horários que ainda podem ser agendados
  // (ele sabe a hora certa em São Paulo e quais horários já passaram).
  const horarios = resultado.dados.horarios;

  if (horarios.length === 0) {
    estadoHorarios.textContent = "Não há horários livres neste dia. Escolha outro dia.";
    return;
  }

  estadoHorarios.textContent = "";
  desenharHorarios(horarios);
}

// O cliente tocou em um horário
function escolherHorario(horario, botao) {
  estado.horario = horario;
  marcarSelecionado(listaHorarios, botao);
  limparErroDoFormulario();

  resumoEscolha.textContent = `${descreverDia(estado.dia)}, às ${horario}`;
  secaoFormulario.hidden = false;
  campoNome.focus();
}

// O cliente confirmou o agendamento
async function enviarAgendamento(evento) {
  evento.preventDefault();

  if (estado.enviando) {
    return;
  }

  // Mesma limpeza que o servidor faz: tira espaços sobrando
  const nome = campoNome.value.trim().replace(/\s+/g, " ");

  if (nome === "") {
    mostrarErroDoFormulario("Informe seu nome para confirmar.", true);
    campoNome.focus();
    return;
  }

  limparErroDoFormulario();
  estado.enviando = true;
  botaoConfirmar.disabled = true;
  botaoConfirmar.textContent = "Confirmando...";

  const resultado = await chamarApi("/api/agendamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: estado.dia.texto,
      horario: estado.horario,
      cliente: nome,
    }),
  });

  estado.enviando = false;
  botaoConfirmar.disabled = false;
  botaoConfirmar.textContent = "Confirmar agendamento";

  if (resultado.ok) {
    mostrarConfirmacao(resultado.dados.agendamento);
    return;
  }

  // 409: o horário não está mais disponível (alguém ocupou antes, ou a hora
  // dele já passou). Mostra o motivo e atualiza a lista de horários.
  if (resultado.status === 409) {
    esconderFormulario();
    await carregarHorarios();
    mostrarAlertaDeHorarios(mensagemDeErro(resultado));
    return;
  }

  mostrarErroDoFormulario(mensagemDeErro(resultado), false);
}

// Troca a tela pelo aviso de agendamento confirmado
function mostrarConfirmacao(agendamento) {
  textoConfirmacao.textContent =
    `${agendamento.cliente}, seu horário está confirmado: ` +
    `${descreverDia(estado.dia)} (${agendamento.data}), às ${agendamento.horario}.`;

  instrucao.hidden = true;
  secaoDia.hidden = true;
  secaoHorarios.hidden = true;
  secaoFormulario.hidden = true;
  secaoConfirmacao.hidden = false;

  // Leva o foco para o título, para leitores de tela anunciarem o resultado
  tituloConfirmacao.focus();
}

// O cliente quer agendar outro horário
async function recomecar() {
  secaoConfirmacao.hidden = true;
  instrucao.hidden = false;
  secaoDia.hidden = false;
  secaoHorarios.hidden = false;

  campoNome.value = "";
  esconderFormulario();
  mostrarAlertaDeHorarios("");

  // Recarrega os horários do mesmo dia, já sem o que acabou de ser agendado
  await carregarHorarios();
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

formulario.addEventListener("submit", enviarAgendamento);
botaoNovo.addEventListener("click", recomecar);

desenharDias();