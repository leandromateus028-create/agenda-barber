// src/validacoes.js
// Funções que apenas conferem (ou limpam) o que o usuário digitou.
// Não imprimem nada e não conversam com o terminal.

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

// Verifica se o texto está no formato HH:MM (sempre 2 dígitos, dois pontos,
// 2 dígitos). Ex: "09:00" é aceito; "9:00", "9h" e "0900" não são.
function validarFormatoHorario(texto) {
  return /^\d{2}:\d{2}$/.test(texto);
}

// Limpa o nome digitado: remove espaços do começo/fim e junta espaços
// repetidos em um só. Retorna "" se não sobrou nada (nome vazio).
// Ex: "  Maria    de   Souza  " vira "Maria de Souza".
function normalizarNome(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

module.exports = {
  validarData,
  validarFormatoHorario,
  normalizarNome,
};