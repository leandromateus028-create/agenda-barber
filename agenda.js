// agenda.js
// Marco 1 - Lógica básica de agenda para barbearia (interface via terminal)
// Evolução: persistência em arquivo JSON (agenda.json), validação de data
// no formato DD/MM/AAAA, nome do cliente obrigatório, horário no formato HH:MM
// e comando "volte" para desistir de uma operação e voltar ao menu.

const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

// Caminho do arquivo onde a agenda será gravada (na mesma pasta do agenda.js)
const ARQUIVO_AGENDA = path.join(__dirname, "agenda.json");

// Lista padrão de horários que existem em qualquer dia
const HORARIOS_PADRAO = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

// Lê a agenda do arquivo JSON. Se o arquivo ainda não existe (primeira
// execução), começa com uma agenda vazia. Se o arquivo existir mas estiver
// com defeito, o programa para, para não apagar dados por engano.
function carregarAgenda() {
  if (!fs.existsSync(ARQUIVO_AGENDA)) {
    return {};
  }

  try {
    const conteudo = fs.readFileSync(ARQUIVO_AGENDA, "utf-8");
    return JSON.parse(conteudo);
  } catch (erro) {
    console.log("Erro ao ler o arquivo agenda.json. Ele pode estar corrompido.");
    console.log("Corrija o arquivo ou apague-o para começar uma agenda nova.");
    console.log(`Detalhe do erro: ${erro.message}`);
    process.exit(1);
  }
}

// Grava a agenda inteira no arquivo JSON
function salvarAgenda(agenda) {
  try {
    fs.writeFileSync(ARQUIVO_AGENDA, JSON.stringify(agenda, null, 2), "utf-8");
  } catch (erro) {
    console.log(`Atenção: não foi possível salvar a agenda no arquivo. ${erro.message}`);
  }
}

// Estrutura de dados: um objeto onde cada chave é uma data (ex: "26/09/2026")
// e o valor é o array de horários daquele dia específico.
// Ao iniciar, carrega do arquivo o que já foi agendado antes.
const agenda = carregarAgenda();

// Retorna o array de horários de uma data. Se a data ainda não existe na
// agenda, cria os horários padrão (todos disponíveis) para ela na hora.
function obterHorariosDoDia(agenda, data) {
  if (!agenda[data]) {
    agenda[data] = HORARIOS_PADRAO.map((horario) => ({
      horario,
      cliente: null,
      disponivel: true,
    }));
  }
  return agenda[data];
}

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
  const disponiveis = horariosDoDia.filter((item) => item.disponivel);

  if (disponiveis.length === 0) {
    console.log("Nenhum horário disponível nesse dia.");
    return;
  }

  disponiveis.forEach((item) => console.log(`- ${item.horario}`));
}

// Procura um horário específico dentro dos horários de um dia
function buscarHorario(horariosDoDia, horarioDesejado) {
  return horariosDoDia.find((item) => item.horario === horarioDesejado);
}

// Tenta realizar o agendamento em um dia específico.
// Retorna um objeto { sucesso, mensagem } para o programa saber se
// houve mudança na agenda (e, portanto, se precisa salvar o arquivo).
function agendarHorario(horariosDoDia, horarioDesejado, nomeCliente) {
  const item = buscarHorario(horariosDoDia, horarioDesejado);

  if (!item) {
    return {
      sucesso: false,
      mensagem: `O horário ${horarioDesejado} não existe na agenda.`,
    };
  }

  if (!item.disponivel) {
    return {
      sucesso: false,
      mensagem: `O horário ${horarioDesejado} já está ocupado nesse dia. Por favor, escolha outro horário.`,
    };
  }

  item.disponivel = false;
  item.cliente = nomeCliente;
  return {
    sucesso: true,
    mensagem: `Agendamento realizado com sucesso! ${nomeCliente} às ${horarioDesejado}.`,
  };
}

// Tenta cancelar um agendamento existente em um dia específico.
// Também retorna { sucesso, mensagem }.
function cancelarHorario(horariosDoDia, horarioDesejado) {
  const item = buscarHorario(horariosDoDia, horarioDesejado);

  if (!item) {
    return {
      sucesso: false,
      mensagem: `O horário ${horarioDesejado} não existe na agenda.`,
    };
  }

  if (item.disponivel) {
    return {
      sucesso: false,
      mensagem: `O horário ${horarioDesejado} já está livre nesse dia, não há agendamento para cancelar.`,
    };
  }

  const nomeAnterior = item.cliente;
  item.disponivel = true;
  item.cliente = null;
  return {
    sucesso: true,
    mensagem: `Agendamento de ${nomeAnterior} às ${horarioDesejado} foi cancelado. O horário está livre novamente.`,
  };
}

// Percorre todas as datas cadastradas na agenda e lista apenas os horários
// ocupados (data, horário e nome do cliente). Não mostra horários livres.
function listarTodosAgendamentos(agenda) {
  const datas = Object.keys(agenda);
  let encontrouAgendamento = false;

  console.log("\n===== TODOS OS AGENDAMENTOS =====");

  datas.forEach((data) => {
    const horariosDoDia = agenda[data];
    const ocupados = horariosDoDia.filter((item) => !item.disponivel);

    ocupados.forEach((item) => {
      encontrouAgendamento = true;
      console.log(`${data} - ${item.horario} - ${item.cliente}`);
    });
  });

  if (!encontrouAgendamento) {
    console.log("Nenhum agendamento encontrado.");
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

// Verifica se o texto é uma data válida no formato DD/MM/AAAA.
// Exige o formato exato (2 dígitos para dia e mês, 4 para o ano) e também
// confere se a data existe de verdade (ex: 31/02/2026 não existe).
function validarData(texto) {
  const formato = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const partes = texto.match(formato);

  if (!partes) {
    return false;
  }

  const dia = Number(partes[1]);
  const mes = Number(partes[2]);
  const ano = Number(partes[3]);

  // O JavaScript "corrige" datas impossíveis (31/02 vira 03/03).
  // Por isso criamos a data e conferimos se dia, mês e ano continuam iguais.
  const data = new Date(ano, mes - 1, dia);

  return (
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia
  );
}

// Palavra que o usuário pode digitar, em qualquer pergunta, para desistir da
// operação atual e voltar ao menu principal.
const PALAVRA_VOLTAR = "volte";
const DICA_VOLTAR = `(digite "${PALAVRA_VOLTAR}" para cancelar)`;

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

// Pergunta a data que o usuário quer usar (agendar, cancelar ou visualizar).
// Repete a pergunta até o usuário digitar uma data válida.
// Devolve null se o usuário digitar "volte".
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
// - Recusa Enter sem digitar nada e entradas só com espaços (ex: "   ").
// - Aceita nomes com espaços no meio (ex: "Ana Paula", "João da Silva").
// - Remove espaços do começo/fim e junta espaços repetidos em um só.
// Devolve null se o usuário digitar "volte".
async function perguntarNome(rl) {
  while (true) {
    const resposta = await rl.question(
      `Qual o nome do cliente? ${DICA_VOLTAR}: `
    );

    if (ehComandoVoltar(resposta)) {
      return null;
    }

    const nome = resposta.trim().replace(/\s+/g, " ");

    if (nome !== "") {
      return nome;
    }

    console.log("Nome inválido. Digite o nome do cliente.\n");
  }
}

// Verifica se o texto está no formato HH:MM (sempre 2 dígitos, dois pontos,
// 2 dígitos). Ex: "09:00" é aceito; "9:00", "9h" e "0900" não são.
function validarFormatoHorario(texto) {
  return /^\d{2}:\d{2}$/.test(texto);
}

// Pergunta um horário e repete até ele estar no formato HH:MM.
// "pergunta" é o texto exibido ao usuário (muda entre agendar e cancelar).
// Devolve null se o usuário digitar "volte".
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
// Devolve null se o usuário digitar "volte".
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
  const temHorarioLivre = horariosDoDia.some((item) => item.disponivel);
  if (!temHorarioLivre) {
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
    salvarAgenda(agenda);
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
    salvarAgenda(agenda);
  }
}

// Função principal: exibe o menu em loop até o usuário escolher sair
async function main() {
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
        listarTodosAgendamentos(agenda);
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

main();