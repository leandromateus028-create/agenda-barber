// index.js
// Ponto de entrada do sistema de agendamento da barbearia.
// Para executar:  node index.js
//
// Organização do projeto:
//   index.js                 -> este arquivo: carrega a agenda e inicia o programa
//   src/armazenamento.js     -> ler/gravar o arquivo agenda.json
//   src/regrasAgenda.js      -> regras da agenda (agendar, cancelar, listar...)
//   src/validacoes.js        -> validação de data, horário e nome
//   src/terminal.js          -> menu, perguntas e mensagens no terminal

const { carregarAgenda } = require("./src/armazenamento");
const { iniciarTerminal } = require("./src/terminal");

function main() {
  let agenda;

  try {
    agenda = carregarAgenda();
  } catch (erro) {
    // Arquivo corrompido: o programa para, para não apagar dados por engano.
    console.log("Erro ao ler o arquivo agenda.json. Ele pode estar corrompido.");
    console.log("Corrija o arquivo ou apague-o para começar uma agenda nova.");
    console.log(`Detalhe do erro: ${erro.message}`);
    process.exit(1);
  }

  iniciarTerminal(agenda);
}

main();