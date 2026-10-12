// src/armazenamento.js
// Responsável por ler e gravar a agenda no arquivo agenda.json.
// Se algo der errado, as funções lançam um erro (throw) e quem chamou
// decide o que mostrar ao usuário.

const fs = require("fs");
const path = require("path");

// O arquivo fica na pasta principal do projeto (uma pasta acima de "src").
const ARQUIVO_AGENDA = path.join(__dirname, "..", "agenda.json");

// Lê a agenda do arquivo JSON. Se o arquivo ainda não existe (primeira
// execução), devolve uma agenda vazia. Se o arquivo existir mas estiver
// com defeito, lança um erro, para não apagar dados por engano depois.
function carregarAgenda() {
  if (!fs.existsSync(ARQUIVO_AGENDA)) {
    return {};
  }

  const conteudo = fs.readFileSync(ARQUIVO_AGENDA, "utf-8");
  return JSON.parse(conteudo);
}

// Grava a agenda inteira no arquivo JSON.
function salvarAgenda(agenda) {
  fs.writeFileSync(ARQUIVO_AGENDA, JSON.stringify(agenda, null, 2), "utf-8");
}

module.exports = {
  carregarAgenda,
  salvarAgenda,
};