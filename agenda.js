// agenda.js
// Marco 1 - Lógica básica de agenda para barbearia (interface via terminal)
// Evolução: suporte a múltiplos dias. Cada data tem sua própria lista de
// horários e disponibilidades, independentes entre si.

const readline = require("readline/promises");
const { stdin: input, stdout: output } = require("process");

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

// Estrutura de dados: um objeto onde cada chave é uma data (ex: "26/09/2026")
// e o valor é o array de horários daquele dia específico.
// Exemplo depois de uso:
// {
//   "26/09/2026": [ { horario: "09:00", cliente: null, disponivel: true }, ... ],
//   "27/09/2026": [ { horario: "09:00", cliente: "João", disponivel: false }, ... ]
// }
const agenda = {};

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

// Tenta realizar o agendamento em um dia específico e retorna uma mensagem de resultado
function agendarHorario(horariosDoDia, horarioDesejado, nomeCliente) {
  const item = buscarHorario(horariosDoDia, horarioDesejado);

  if (!item) {
    return `O horário ${horarioDesejado} não existe na agenda.`;
  }

  if (!item.disponivel) {
    return `O horário ${horarioDesejado} já está ocupado nesse dia. Por favor, escolha outro horário.`;
  }

  item.disponivel = false;
  item.cliente = nomeCliente;
  return `Agendamento realizado com sucesso! ${nomeCliente} às ${horarioDesejado}.`;
}

// Tenta cancelar um agendamento existente em um dia específico
function cancelarHorario(horariosDoDia, horarioDesejado) {
  const item = buscarHorario(horariosDoDia, horarioDesejado);

  if (!item) {
    return `O horário ${horarioDesejado} não existe na agenda.`;
  }

  if (item.disponivel) {
    return `O horário ${horarioDesejado} já está livre nesse dia, não há agendamento para cancelar.`;
  }

  const nomeAnterior = item.cliente;
  item.disponivel = true;
  item.cliente = null;
  return `Agendamento de ${nomeAnterior} às ${horarioDesejado} foi cancelado. O horário está livre novamente.`;
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

// Pergunta a data que o usuário quer usar (agendar, cancelar ou visualizar)
async function perguntarData(rl) {
  const data = await rl.question("Informe a data (ex: 26/09/2026): ");
  return data.trim();
}

// Fluxo de visualizar a agenda de um dia específico
async function fluxoVisualizar(rl, agenda) {
  const data = await perguntarData(rl);
  const horariosDoDia = obterHorariosDoDia(agenda, data);
  mostrarAgendaDoDia(data, horariosDoDia);
}

// Fluxo de agendar um novo cliente em um dia específico
async function fluxoAgendar(rl, agenda) {
  const data = await perguntarData(rl);
  const horariosDoDia = obterHorariosDoDia(agenda, data);

  mostrarHorariosDisponiveis(data, horariosDoDia);

  const horarioDesejado = await rl.question(
    "\nQual horário deseja agendar? (ex: 09:00) "
  );
  const nomeCliente = await rl.question("Qual o nome do cliente? ");

  const resultado = agendarHorario(
    horariosDoDia,
    horarioDesejado.trim(),
    nomeCliente.trim()
  );
  console.log(`\n${resultado}`);
}

// Fluxo de cancelar um agendamento existente em um dia específico
async function fluxoCancelar(rl, agenda) {
  const data = await perguntarData(rl);
  const horariosDoDia = obterHorariosDoDia(agenda, data);

  mostrarAgendaDoDia(data, horariosDoDia);

  const horarioDesejado = await rl.question(
    "Qual horário deseja cancelar? (ex: 09:00) "
  );

  const resultado = cancelarHorario(horariosDoDia, horarioDesejado.trim());
  console.log(`\n${resultado}`);
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