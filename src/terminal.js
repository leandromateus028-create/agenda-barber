// src/terminal.js
// Tudo que envolve conversar com o usuário pelo terminal: menu, perguntas,
// mensagens (console.log) e os fluxos de cada opção do menu.
// As regras da agenda vêm de regrasAgenda.js; a gravação vem de armazenamento.js.

const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

const { salvarAgenda } = require("./armazenamento");
const {
  validarData,
  validarFormatoHorario,
  normalizarNome,
} = require("./validacoes");
const {
  obterHorariosDoDia,
  obterHorariosDisponiveis,
  existeHorarioDisponivel,
  buscarHorario,
  agendarHorario,
  cancelarHorario,
  listarAgendamentos,
} = require("./regrasAgenda");

// Palavra que o usuário pode digitar, em qualquer pergunta, para desistir da
// operação atual e voltar ao menu principal.
const PALAVRA_VOLTAR = "volte";
const DICA_VOLTAR = `(digite "${PALAVRA_VOLTAR}" para cancelar)`;

// ---------------------------------------------------------------------------
// Exibição (só imprime na tela)
// ---------------------------------------------------------------------------

// Mostra todos os horários de um dia específico e seu status atual
function mostrarAgendaDoDia(data, horariosDoDia) {
  console.log(`\n===== AGENDA DO DIA ${data} =====`);
  horariosDoDia.forEach((item) => {
    const status = item.disponivel
      ? "Disponível"
      : `Ocupado (${item.cliente})`;
    console.log(`${item.horario} - ${status}`);
  });
  console.log("==============================\n");
}

// Mostra apenas os horários que ainda estão livres em um dia específico
function mostrarHorariosDisponiveis(data, horariosDoDia) {
  console.log(`\nHorários disponíveis no dia ${data}:`);
  const disponiveis = obterHorariosDisponiveis(horariosDoDia);

  if (disponiveis.length === 0) {
    console.log("Nenhum horário disponível nesse dia.");
    return;
  }

  disponiveis.forEach((item) => console.log(`- ${item.horario}`));
}

// Mostra todos os agendamentos de todas as datas (data, horário e cliente)
function mostrarTodosAgendamentos(agenda) {
  const agendamentos = listarAgendamentos(agenda);

  console.log("\n===== TODOS OS AGENDAMENTOS =====");

  if (agendamentos.length === 0) {
    console.log("Nenhum agendamento encontrado.");
  } else {
    agendamentos.forEach((item) => {
      console.log(`${item.data} - ${item.horario} - ${item.cliente}`);
    });
  }

  console.log("==================================\n");
}

// Exibe o menu principal e retorna a opção escolhida pelo usuário
async function mostrarMenu(rl) {
  console.log("\n===== MENU PRINCIPAL =====");
  console.log("1 - Visualizar agenda");
  console.log("2 - Agendar cliente");
  console.log("3 - Cancelar agendamento");
  console.log("4 - Listar todos os agendamentos");
  console.log("5 - Sair");
  const opcao = await rl.question("Escolha uma opção: ");
  return opcao.trim();
}

// ---------------------------------------------------------------------------
// Perguntas (pedem um dado e repetem até receber algo válido)
// Todas devolvem null se o usuário digitar "volte".
// ---------------------------------------------------------------------------

// Verifica se o texto digitado é o comando de voltar (ignora maiúsculas,
// minúsculas e espaços extras: "volte", "VOLTE", " Volte " funcionam).
function ehComandoVoltar(texto) {
  return texto.trim().toLowerCase() === PALAVRA_VOLTAR;
}

// Avisa que a operação foi cancelada. Os fluxos chamam esta função quando
// uma pergunta devolve null (ou seja, o usuário digitou "volte").
function avisarVoltaAoMenu() {
  console.log("\nOperação cancelada. Voltando ao menu.");
}

// Grava a agenda no arquivo. Se falhar, avisa o usuário em vez de travar.
function salvarAgendaComAviso(agenda) {
  try {
    salvarAgenda(agenda);
  } catch (erro) {
    console.log(
      `Atenção: não foi possível salvar a agenda no arquivo. ${erro.message}`
    );
  }
}

// Pergunta a data que o usuário quer usar (agendar, cancelar ou visualizar).
// Repete a pergunta até o usuário digitar uma data válida.
async function perguntarData(rl) {
  while (true) {
    const resposta = await rl.question(
      `Informe a data (ex: 26/09/2026) ${DICA_VOLTAR}: `
    );

    if (ehComandoVoltar(resposta)) {
      return null;
    }

    const data = resposta.trim();

    if (validarData(data)) {
      return data;
    }

    console.log("Data inválida. Digite uma data válida.\n");
  }
}

// Pergunta o nome do cliente e repete até receber um nome preenchido.
// Recusa Enter vazio e só espaços; aceita nomes compostos ("Ana Paula").
async function perguntarNome(rl) {
  while (true) {
    const resposta = await rl.question(
      `Qual o nome do cliente? ${DICA_VOLTAR}: `
    );

    if (ehComandoVoltar(resposta)) {
      return null;
    }

    const nome = normalizarNome(resposta);

    if (nome !== "") {
      return nome;
    }

    console.log("Nome inválido. Digite o nome do cliente.\n");
  }
}

// Pergunta um horário e repete até ele estar no formato HH:MM.
// "pergunta" é o texto exibido ao usuário (muda entre agendar e cancelar).
async function perguntarHorarioFormatado(rl, pergunta) {
  while (true) {
    const resposta = await rl.question(`${pergunta} ${DICA_VOLTAR}: `);

    if (ehComandoVoltar(resposta)) {
      return null;
    }

    const horario = resposta.trim();

    if (validarFormatoHorario(horario)) {
      return horario;
    }

    console.log("Horário inválido. Digite no formato HH:MM (ex: 09:00).\n");
  }
}

// Pergunta o horário para um novo agendamento e repete até o usuário
// informar um horário que existe na agenda E está livre naquele dia.
// Assim, o nome do cliente só é pedido depois de um horário válido.
async function perguntarHorarioParaAgendar(rl, horariosDoDia) {
  while (true) {
    const horario = await perguntarHorarioFormatado(
      rl,
      "\nQual horário deseja agendar? (ex: 09:00)"
    );

    if (horario === null) {
      return null;
    }

    const item = buscarHorario(horariosDoDia, horario);

    if (!item) {
      console.log(
        `O horário ${horario} não existe na agenda. Escolha um dos horários listados.`
      );
    } else if (!item.disponivel) {
      console.log(
        `O horário ${horario} já está ocupado nesse dia. Escolha outro horário.`
      );
    } else {
      return horario;
    }
  }
}

// ---------------------------------------------------------------------------
// Fluxos (o passo a passo de cada opção do menu)
// ---------------------------------------------------------------------------

// Fluxo de visualizar a agenda de um dia específico
async function fluxoVisualizar(rl, agenda) {
  const data = await perguntarData(rl);
  if (data === null) {
    return avisarVoltaAoMenu();
  }

  const horariosDoDia = obterHorariosDoDia(agenda, data);
  mostrarAgendaDoDia(data, horariosDoDia);
}

// Fluxo de agendar um novo cliente em um dia específico
async function fluxoAgendar(rl, agenda) {
  const data = await perguntarData(rl);
  if (data === null) {
    return avisarVoltaAoMenu();
  }

  const horariosDoDia = obterHorariosDoDia(agenda, data);

  mostrarHorariosDisponiveis(data, horariosDoDia);

  // Se o dia está lotado, não há o que perguntar: volta ao menu
  if (!existeHorarioDisponivel(horariosDoDia)) {
    return;
  }

  const horarioDesejado = await perguntarHorarioParaAgendar(rl, horariosDoDia);
  if (horarioDesejado === null) {
    return avisarVoltaAoMenu();
  }

  const nomeCliente = await perguntarNome(rl);
  if (nomeCliente === null) {
    return avisarVoltaAoMenu();
  }

  const resultado = agendarHorario(horariosDoDia, horarioDesejado, nomeCliente);
  console.log(`\n${resultado.mensagem}`);

  // Só grava no arquivo se o agendamento realmente aconteceu
  if (resultado.sucesso) {
    salvarAgendaComAviso(agenda);
  }
}

// Fluxo de cancelar um agendamento existente em um dia específico
async function fluxoCancelar(rl, agenda) {
  const data = await perguntarData(rl);
  if (data === null) {
    return avisarVoltaAoMenu();
  }

  const horariosDoDia = obterHorariosDoDia(agenda, data);

  mostrarAgendaDoDia(data, horariosDoDia);

  const horarioDesejado = await perguntarHorarioFormatado(
    rl,
    "Qual horário deseja cancelar? (ex: 09:00)"
  );
  if (horarioDesejado === null) {
    return avisarVoltaAoMenu();
  }

  const resultado = cancelarHorario(horariosDoDia, horarioDesejado);
  console.log(`\n${resultado.mensagem}`);

  // Só grava no arquivo se o cancelamento realmente aconteceu
  if (resultado.sucesso) {
    salvarAgendaComAviso(agenda);
  }
}

// ---------------------------------------------------------------------------
// Ponto de entrada do terminal
// ---------------------------------------------------------------------------

// Exibe o menu em loop até o usuário escolher sair
async function iniciarTerminal(agenda) {
  const rl = readline.createInterface({ input, output });

  console.log("Bem-vindo ao sistema de agendamento da barbearia!");

  let sair = false;

  while (!sair) {
    const opcao = await mostrarMenu(rl);

    switch (opcao) {
      case "1":
        await fluxoVisualizar(rl, agenda);
        break;
      case "2":
        await fluxoAgendar(rl, agenda);
        break;
      case "3":
        await fluxoCancelar(rl, agenda);
        break;
      case "4":
        mostrarTodosAgendamentos(agenda);
        break;
      case "5":
        console.log("\nEncerrando o sistema. Até logo!");
        sair = true;
        break;
      default:
        console.log("\nOpção inválida. Escolha um número de 1 a 5.");
    }
  }

  rl.close();
}

module.exports = { iniciarTerminal };