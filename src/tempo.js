// src/tempo.js
// Regras de prazo dos agendamentos feitos pelos clientes:
//   - não dá para agendar em dia que já passou;
//   - não dá para agendar um horário de hoje que já passou;
//   - não dá para agendar com muita antecedência (limite de dias à frente).
//
// "Agora" é sempre calculado no fuso de São Paulo, e não no fuso do servidor
// (o servidor do Codespaces costuma estar em UTC, 3 horas à frente do Brasil).
//
// Estas funções NÃO leem o relógio sozinhas: quem chama entrega o "agora".
// Assim dá para testá-las com qualquer data e hora.
//
// Importante: as datas recebidas aqui já devem ter passado por validarData().

const FUSO_HORARIO = "America/Sao_Paulo";

// Quantos dias à frente o cliente pode agendar. Também evita que alguém
// encha o agenda.json criando milhares de dias inventados.
const DIAS_MAXIMOS_NA_FRENTE = 60;

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

// Pergunta ao JavaScript "que dia e hora são em São Paulo neste instante?"
const formatadorDoFuso = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_HORARIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23", // horas de 00 a 23 (evita o "24" da meia-noite)
});

// Transforma um instante (objeto Date) em { diaNumero, minutosDoDia }
// no horário de São Paulo.
//   diaNumero:    número do dia (para comparar dias e contar a diferença)
//   minutosDoDia: minutos desde a meia-noite (ex: 10:30 vira 630)
function obterAgoraLocal(instante) {
  const partes = {};
  formatadorDoFuso.formatToParts(instante).forEach((parte) => {
    partes[parte.type] = parte.value;
  });

  return {
    diaNumero:
      Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day)) /
      MILISSEGUNDOS_POR_DIA,
    minutosDoDia: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

// Converte "DD/MM/AAAA" no mesmo tipo de número de dia usado acima
function numeroDoDia(dataTexto) {
  const [dia, mes, ano] = dataTexto.split("/").map(Number);
  return Date.UTC(ano, mes - 1, dia) / MILISSEGUNDOS_POR_DIA;
}

// Converte "HH:MM" em minutos desde a meia-noite
function minutosDoHorario(horario) {
  const [horas, minutos] = horario.split(":").map(Number);
  return horas * 60 + minutos;
}

// Confere se dá para agendar esta data e horário neste momento.
// Retorna { permitido: true } ou { permitido: false, motivo, mensagem }.
// Motivos: "data_passada", "horario_passou", "muito_longe".
function verificarPrazo(data, horario, agoraLocal) {
  const diferencaEmDias = numeroDoDia(data) - agoraLocal.diaNumero;

  if (diferencaEmDias < 0) {
    return {
      permitido: false,
      motivo: "data_passada",
      mensagem: "Não é possível agendar em uma data que já passou.",
    };
  }

  if (diferencaEmDias > DIAS_MAXIMOS_NA_FRENTE) {
    return {
      permitido: false,
      motivo: "muito_longe",
      mensagem: `Só é possível agendar com até ${DIAS_MAXIMOS_NA_FRENTE} dias de antecedência.`,
    };
  }

  // Hoje: o horário precisa ser depois do momento atual
  if (diferencaEmDias === 0 && minutosDoHorario(horario) <= agoraLocal.minutosDoDia) {
    return {
      permitido: false,
      motivo: "horario_passou",
      mensagem: `O horário ${horario} de hoje já passou. Escolha um horário mais tarde.`,
    };
  }

  return { permitido: true };
}

// Devolve só os horários que ainda podem ser agendados naquela data
function filtrarHorariosAgendaveis(data, horarios, agoraLocal) {
  return horarios.filter(
    (horario) => verificarPrazo(data, horario, agoraLocal).permitido
  );
}

module.exports = {
  FUSO_HORARIO,
  DIAS_MAXIMOS_NA_FRENTE,
  obterAgoraLocal,
  verificarPrazo,
  filtrarHorariosAgendaveis,
};