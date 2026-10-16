// servidor.js
// Ponto de entrada do site e da API web do sistema de agendamento da barbearia.
// Para executar:  node servidor.js
// Depois, abra no navegador o endereço da porta (ex: http://localhost:3000/).
//
// Área do barbeiro: defina a senha na variável de ambiente SENHA_BARBEIRO
// (mínimo de 10 caracteres). O usuário é sempre "barbeiro". Exemplo:
//   SENHA_BARBEIRO='uma-senha-bem-grande' node servidor.js
// Sem a senha, as rotas do barbeiro ficam desativadas (a página do cliente
// continua funcionando normalmente).
//
// ATENÇÃO: não rode o servidor e o terminal (node index.js) ao mesmo tempo.
// Os dois guardam a agenda na memória e gravam no mesmo agenda.json, então
// um poderia sobrescrever o que o outro gravou.
//
// Organização do projeto:
//   index.js                 -> versão de terminal (Marco 1)
//   servidor.js              -> este arquivo: carrega a agenda e liga o servidor
//   src/api.js               -> rotas da API web (Marco 2) e divisão API x página
//   src/autenticacao.js      -> usuário e senha da área do barbeiro
//   src/tempo.js             -> regras de prazo (passado, hoje, limite de dias)
//   src/estaticos.js         -> entrega os arquivos da pasta public
//   public/index.html        -> página de agendamento do cliente
//   public/estilo.css        -> aparência da página
//   public/app.js            -> comportamento da página (escolher dia, horário...)
//   src/armazenamento.js     -> ler/gravar o arquivo agenda.json
//   src/regrasAgenda.js      -> regras da agenda (agendar, cancelar, listar...)
//   src/validacoes.js        -> validação de data, horário e nome
//   src/terminal.js          -> menu, perguntas e mensagens no terminal

const { carregarAgenda } = require("./src/armazenamento");
const { criarServidor } = require("./src/api");
const { TAMANHO_MINIMO_DA_SENHA } = require("./src/autenticacao");

// Porta onde o servidor vai escutar. Para usar outra: PORT=3001 node servidor.js
const PORTA = Number(process.env.PORT) || 3000;

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

  const senhaBarbeiro = process.env.SENHA_BARBEIRO;
  const servidor = criarServidor(agenda, { senhaBarbeiro });

  servidor.on("error", (erro) => {
    if (erro.code === "EADDRINUSE") {
      console.log(`A porta ${PORTA} já está em uso.`);
      console.log("Feche o outro servidor ou use outra porta, por exemplo:");
      console.log(`  PORT=${PORTA + 1} node servidor.js`);
    } else {
      console.log(`Erro ao iniciar o servidor: ${erro.message}`);
    }
    process.exit(1);
  });

  servidor.listen(PORTA, () => {
    console.log(`Servidor da agenda rodando na porta ${PORTA}.`);
    console.log(`Página do cliente: http://localhost:${PORTA}/`);
    console.log(`API (JSON):        http://localhost:${PORTA}/api`);
    if (servidor.areaDoBarbeiroAtiva) {
      console.log('Área do barbeiro: ATIVADA (usuário "barbeiro").');
    } else if (senhaBarbeiro) {
      console.log(
        `Área do barbeiro: DESATIVADA. A SENHA_BARBEIRO precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`
      );
    } else {
      console.log("Área do barbeiro: DESATIVADA. Defina a variável SENHA_BARBEIRO para ativar.");
    }
    console.log("Pressione Ctrl+C para parar.");
  });
}

main();