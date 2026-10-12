// src/regrasAgenda.js
// As regras da agenda: quais horários existem, quem pode agendar, cancelar...
// REGRA DESTE ARQUIVO: aqui não existe console.log, readline nem leitura de
// arquivo. As funções recebem dados e devolvem dados. Por isso o mesmo código
// poderá ser usado no terminal, no ambiente do barbeiro e no bot do WhatsApp.
//
// Estrutura de dados: um objeto onde cada chave é uma data (ex: "26/09/2026")
// e o valor é o array de horários daquele dia específico:
// {
//   "26/09/2026": [ { horario: "09:00", cliente: null, disponivel: true }, ... ],
//   "27/09/2026": [ { horario: "09:00", cliente: "João", disponivel: false }, ... ]
// }

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

// Devolve apenas os horários livres de um dia
function obterHorariosDisponiveis(horariosDoDia) {
  return horariosDoDia.filter((item) => item.disponivel);
}

// Diz se ainda existe pelo menos um horário livre em um dia
function existeHorarioDisponivel(horariosDoDia) {
  return horariosDoDia.some((item) => item.disponivel);
}

// Procura um horário específico dentro dos horários de um dia
function buscarHorario(horariosDoDia, horarioDesejado) {
  return horariosDoDia.find((item) => item.horario === horarioDesejado);
}

// Tenta realizar o agendamento em um dia específico.
// Retorna um objeto { sucesso, mensagem } para quem chamou saber se
// houve mudança na agenda (e, portanto, se precisa salvar).
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

// Percorre todas as datas da agenda e devolve uma lista só com os horários
// ocupados, no formato [{ data, horario, cliente }, ...].
// Não ordena as datas: seguem a ordem em que foram criadas.
function listarAgendamentos(agenda) {
  const agendamentos = [];

  Object.keys(agenda).forEach((data) => {
    agenda[data]
      .filter((item) => !item.disponivel)
      .forEach((item) => {
        agendamentos.push({
          data,
          horario: item.horario,
          cliente: item.cliente,
        });
      });
  });

  return agendamentos;
}

module.exports = {
  HORARIOS_PADRAO,
  obterHorariosDoDia,
  obterHorariosDisponiveis,
  existeHorarioDisponivel,
  buscarHorario,
  agendarHorario,
  cancelarHorario,
  listarAgendamentos,
};