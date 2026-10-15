// src/api.js
// O servidor web da agenda. Recebe requisições HTTP e decide:
//   - endereços que começam com /api  -> responde em JSON (a API da agenda)
//   - qualquer outro endereço         -> entrega a página do site (pasta public)
//
// A API usa as MESMAS regras do terminal (regrasAgenda.js, validacoes.js e
// armazenamento.js). Aqui só existe a "tradução" entre HTTP e essas regras.
//
// Rotas da API:
//   GET    /api                        -> lista das rotas disponíveis
//   GET    /api/horarios?data=...      -> todos os horários de um dia, com status
//   GET    /api/horarios/disponiveis?data=...  -> só os horários livres de um dia
//   GET    /api/agendamentos           -> todos os agendamentos de todas as datas
//   POST   /api/agendamentos           -> cria um agendamento (corpo em JSON)
//   DELETE /api/agendamentos?data=...&horario=...  -> cancela um agendamento
//
// Códigos de status usados:
//   200 OK | 201 Criado | 400 Dados inválidos | 404 Não encontrado
//   405 Método não permitido | 409 Conflito (horário ocupado)
//   413 Corpo muito grande | 500 Erro interno

const http = require("http");

const { salvarAgenda } = require("./armazenamento");
const { servirArquivoEstatico } = require("./estaticos");
const {
  validarData,
  validarFormatoHorario,
  normalizarNome,
} = require("./validacoes");
const {
  HORARIOS_PADRAO,
  obterHorariosDoDia,
  obterHorariosDisponiveis,
  buscarHorario,
  agendarHorario,
  cancelarHorario,
  listarAgendamentos,
} = require("./regrasAgenda");

// Limites simples para o servidor não aceitar dados exagerados
const TAMANHO_MAXIMO_CORPO = 10 * 1024; // 10 KB
const TAMANHO_MAXIMO_NOME = 100; // caracteres

// Todos os endereços da API começam com este prefixo
const PREFIXO_API = "/api";

const MENSAGEM_DATA_INVALIDA =
  "Data inválida. Informe uma data válida no formato DD/MM/AAAA " +
  "no parâmetro 'data' (ex: ?data=26/09/2026).";

// ---------------------------------------------------------------------------
// Funções de apoio
// ---------------------------------------------------------------------------

// Envia uma resposta em JSON com o status HTTP informado
function responder(res, status, corpo, cabecalhosExtras = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    // A disponibilidade muda a todo momento: o navegador não deve guardar cópia
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...cabecalhosExtras,
  });
  res.end(JSON.stringify(corpo, null, 2));
}

// Cria um erro que carrega o status HTTP que deve ser devolvido
function criarErroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

// Lê o corpo da requisição e converte de JSON para objeto.
// Rejeita (com erro HTTP) se o corpo for grande demais ou não for um JSON
// do tipo objeto, como {"data": "..."}.
function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let texto = "";
    let tamanho = 0;
    let grandeDemais = false;

    // Com setEncoding, os pedaços já chegam como texto UTF-8 correto
    // (acentos como "ã" não são cortados no meio).
    req.setEncoding("utf8");

    req.on("data", (pedaco) => {
      tamanho += Buffer.byteLength(pedaco);

      if (tamanho > TAMANHO_MAXIMO_CORPO) {
        grandeDemais = true; // para de guardar, mas termina de receber
        return;
      }

      texto += pedaco;
    });

    req.on("end", () => {
      if (grandeDemais) {
        reject(criarErroHttp(413, "Corpo da requisição grande demais."));
        return;
      }

      try {
        const dados = JSON.parse(texto);
        const ehObjeto =
          typeof dados === "object" && dados !== null && !Array.isArray(dados);

        if (!ehObjeto) {
          throw new Error("não é um objeto");
        }

        resolve(dados);
      } catch (erro) {
        reject(
          criarErroHttp(
            400,
            'Corpo inválido. Envie um JSON como {"data":"26/09/2026","horario":"09:00","cliente":"Ana"}.'
          )
        );
      }
    });

    req.on("error", reject);
  });
}

// Lê o parâmetro "data" da URL (ex: ?data=26/09/2026).
// Retorna a data se for válida, ou null se faltar ou estiver inválida.
function lerDataDaUrl(url) {
  const data = (url.searchParams.get("data") || "").trim();
  return validarData(data) ? data : null;
}

// Devolve os horários de um dia SEM criar o dia na agenda real.
// Se o dia ainda não existe, monta os horários padrão em uma agenda
// temporária ({}), que é descartada. Assim, apenas consultar uma data
// não suja o agenda.json com dias vazios.
function obterDiaSemCriar(agenda, data) {
  return agenda[data] || obterHorariosDoDia({}, data);
}

// ---------------------------------------------------------------------------
// Tratamento de cada rota
// ---------------------------------------------------------------------------

function tratarInicio({ res }) {
  responder(res, 200, {
    mensagem: "API da agenda da barbearia",
    rotas: [
      "GET /api/horarios?data=26/09/2026",
      "GET /api/horarios/disponiveis?data=26/09/2026",
      "GET /api/agendamentos",
      'POST /api/agendamentos  (corpo JSON: {"data","horario","cliente"})',
      "DELETE /api/agendamentos?data=26/09/2026&horario=09:00",
    ],
  });
}

// GET /horarios?data=... -> dia completo, com status de cada horário
function tratarHorarios({ res, url, agenda }) {
  const data = lerDataDaUrl(url);
  if (data === null) {
    return responder(res, 400, { erro: MENSAGEM_DATA_INVALIDA });
  }

  responder(res, 200, { data, horarios: obterDiaSemCriar(agenda, data) });
}

// GET /horarios/disponiveis?data=... -> só os horários livres
function tratarHorariosDisponiveis({ res, url, agenda }) {
  const data = lerDataDaUrl(url);
  if (data === null) {
    return responder(res, 400, { erro: MENSAGEM_DATA_INVALIDA });
  }

  const livres = obterHorariosDisponiveis(obterDiaSemCriar(agenda, data));
  responder(res, 200, { data, horarios: livres.map((item) => item.horario) });
}

// GET /agendamentos -> todos os agendamentos
function tratarListarAgendamentos({ res, agenda }) {
  responder(res, 200, { agendamentos: listarAgendamentos(agenda) });
}

// POST /agendamentos -> cria um agendamento
async function tratarAgendar({ req, res, agenda }) {
  const corpo = await lerCorpoJson(req);

  const data = typeof corpo.data === "string" ? corpo.data.trim() : "";
  const horario = typeof corpo.horario === "string" ? corpo.horario.trim() : "";
  const cliente =
    typeof corpo.cliente === "string" ? normalizarNome(corpo.cliente) : "";

  if (!validarData(data)) {
    return responder(res, 400, {
      erro: "Data inválida. Use o formato DD/MM/AAAA (ex: 26/09/2026).",
    });
  }

  if (!validarFormatoHorario(horario)) {
    return responder(res, 400, {
      erro: "Horário inválido. Use o formato HH:MM (ex: 09:00).",
    });
  }

  if (cliente === "") {
    return responder(res, 400, {
      erro: "Nome inválido. Informe o nome do cliente.",
    });
  }

  if (cliente.length > TAMANHO_MAXIMO_NOME) {
    return responder(res, 400, {
      erro: `Nome muito longo. Use no máximo ${TAMANHO_MAXIMO_NOME} caracteres.`,
    });
  }

  // Confere se o horário existe ANTES de criar o dia na agenda,
  // para um pedido inválido não deixar um dia vazio gravado.
  if (!HORARIOS_PADRAO.includes(horario)) {
    return responder(res, 400, {
      erro: `O horário ${horario} não existe na agenda.`,
    });
  }

  const horariosDoDia = obterHorariosDoDia(agenda, data);
  const item = buscarHorario(horariosDoDia, horario);

  if (!item.disponivel) {
    return responder(res, 409, {
      erro: `O horário ${horario} já está ocupado nesse dia. Escolha outro horário.`,
    });
  }

  const resultado = agendarHorario(horariosDoDia, horario, cliente);

  if (!resultado.sucesso) {
    return responder(res, 409, { erro: resultado.mensagem });
  }

  try {
    salvarAgenda(agenda);
  } catch (erro) {
    // Não conseguiu gravar: desfaz a mudança na memória, para a agenda
    // em memória continuar igual ao que está no arquivo.
    item.disponivel = true;
    item.cliente = null;
    console.error("Erro ao salvar a agenda:", erro.message);
    return responder(res, 500, {
      erro: "Não foi possível salvar o agendamento. Tente novamente.",
    });
  }

  responder(res, 201, {
    mensagem: resultado.mensagem,
    agendamento: { data, horario, cliente },
  });
}

// DELETE /agendamentos?data=...&horario=... -> cancela um agendamento
function tratarCancelar({ res, url, agenda }) {
  const data = lerDataDaUrl(url);
  if (data === null) {
    return responder(res, 400, { erro: MENSAGEM_DATA_INVALIDA });
  }

  const horario = (url.searchParams.get("horario") || "").trim();
  if (!validarFormatoHorario(horario)) {
    return responder(res, 400, {
      erro: "Horário inválido. Informe no parâmetro 'horario' o formato HH:MM (ex: ?horario=09:00).",
    });
  }

  const horariosDoDia = obterDiaSemCriar(agenda, data);
  const item = buscarHorario(horariosDoDia, horario);
  const clienteAnterior = item ? item.cliente : null;

  const resultado = cancelarHorario(horariosDoDia, horario);

  // Horário inexistente ou já livre: não há o que cancelar
  if (!resultado.sucesso) {
    return responder(res, 404, { erro: resultado.mensagem });
  }

  try {
    salvarAgenda(agenda);
  } catch (erro) {
    // Não conseguiu gravar: desfaz o cancelamento na memória
    item.disponivel = false;
    item.cliente = clienteAnterior;
    console.error("Erro ao salvar a agenda:", erro.message);
    return responder(res, 500, {
      erro: "Não foi possível salvar o cancelamento. Tente novamente.",
    });
  }

  responder(res, 200, {
    mensagem: resultado.mensagem,
    cancelado: { data, horario, cliente: clienteAnterior },
  });
}

// ---------------------------------------------------------------------------
// Tabela de rotas e servidor
// ---------------------------------------------------------------------------

// Para cada caminho, quais métodos HTTP são aceitos e qual função trata cada um
const rotas = {
  "/": { GET: tratarInicio },
  "/horarios": { GET: tratarHorarios },
  "/horarios/disponiveis": { GET: tratarHorariosDisponiveis },
  "/agendamentos": {
    GET: tratarListarAgendamentos,
    POST: tratarAgendar,
    DELETE: tratarCancelar,
  },
};

// Descobre quem deve tratar a requisição (a API ou a página) e a executa
async function tratarRequisicao(req, res, agenda) {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch (erro) {
    return responder(res, 400, { erro: "Endereço inválido." });
  }

  let caminho = url.pathname;

  // Endereço que não é da API: é a página (HTML, CSS, JavaScript)
  const ehRotaDaApi =
    caminho === PREFIXO_API || caminho.startsWith(PREFIXO_API + "/");

  if (!ehRotaDaApi) {
    return servirArquivoEstatico(req, res, caminho);
  }

  // Tira o prefixo: "/api/agendamentos" vira "/agendamentos" na tabela de rotas
  caminho = caminho.slice(PREFIXO_API.length);

  // Aceita "/agendamentos/" do mesmo jeito que "/agendamentos"
  if (caminho.length > 1 && caminho.endsWith("/")) {
    caminho = caminho.slice(0, -1);
  }

  if (caminho === "") {
    caminho = "/";
  }

  if (!Object.hasOwn(rotas, caminho)) {
    return responder(res, 404, { erro: "Rota não encontrada." });
  }

  const metodosDaRota = rotas[caminho];
  const funcaoDaRota = Object.hasOwn(metodosDaRota, req.method)
    ? metodosDaRota[req.method]
    : null;

  if (!funcaoDaRota) {
    return responder(
      res,
      405,
      { erro: `Método ${req.method} não permitido nesta rota.` },
      { Allow: Object.keys(metodosDaRota).join(", ") }
    );
  }

  await funcaoDaRota({ req, res, url, agenda });
}

// Cria o servidor HTTP (ainda sem "ligar" em nenhuma porta)
function criarServidor(agenda) {
  return http.createServer((req, res) => {
    tratarRequisicao(req, res, agenda).catch((erro) => {
      if (res.headersSent) {
        res.end();
        return;
      }

      if (erro.status) {
        return responder(res, erro.status, { erro: erro.message });
      }

      console.error("Erro inesperado:", erro);
      responder(res, 500, { erro: "Erro interno do servidor." });
    });
  });
}

module.exports = { criarServidor };