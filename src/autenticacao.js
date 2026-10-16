// src/autenticacao.js
// Protege a área do barbeiro com usuário e senha (autenticação HTTP "Basic").
//
// Como funciona: o navegador (ou o curl) envia o usuário e a senha no
// cabeçalho "Authorization". Se o navegador receber um 401 com o cabeçalho
// WWW-Authenticate, ele mesmo mostra uma janelinha pedindo usuário e senha.
//
// A senha NUNCA fica escrita no código: vem da variável de ambiente
// SENHA_BARBEIRO. Se ela não existir (ou for curta demais), a área do
// barbeiro fica DESLIGADA, em vez de ficar aberta por esquecimento.
//
// Atenção: com Basic, a senha viaja em cada requisição. Use sempre por HTTPS
// (as portas do Codespaces já são HTTPS) e nunca por HTTP aberto na internet.

const crypto = require("crypto");

const USUARIO_BARBEIRO = "barbeiro";
const TAMANHO_MINIMO_DA_SENHA = 10;

// Limite de tentativas erradas: depois de 10 erros em 5 minutos, o servidor
// recusa novas tentativas até a janela esvaziar. Impede adivinhar a senha.
const LIMITE_DE_FALHAS = 10;
const JANELA_DE_FALHAS_MS = 5 * 60 * 1000;

const CABECALHO_DE_DESAFIO = {
  "WWW-Authenticate": 'Basic realm="Agenda da barbearia", charset="UTF-8"',
};

// Diz se a senha configurada é aceitável
function senhaEhAceitavel(senha) {
  return typeof senha === "string" && senha.length >= TAMANHO_MINIMO_DA_SENHA;
}

// Compara dois textos sem revelar, pelo tempo de resposta, em qual letra
// eles começam a diferir. Os dois viram um "resumo" (hash) do mesmo tamanho
// antes de serem comparados.
function textosIguais(a, b) {
  const resumoA = crypto.createHash("sha256").update(a, "utf8").digest();
  const resumoB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(resumoA, resumoB);
}

// Lê "Authorization: Basic xxxx" e devolve { usuario, senha },
// ou null se o cabeçalho não existir ou estiver mal formado.
function lerCredenciais(req) {
  const cabecalho = req.headers.authorization || "";
  const correspondencia = cabecalho.match(/^basic +(\S+)$/i);

  if (!correspondencia) {
    return null;
  }

  const decodificado = Buffer.from(correspondencia[1], "base64").toString("utf8");
  const posicaoDosDoisPontos = decodificado.indexOf(":");

  if (posicaoDosDoisPontos === -1) {
    return null;
  }

  // Só o primeiro ":" separa usuário de senha; a senha pode ter outros
  return {
    usuario: decodificado.slice(0, posicaoDosDoisPontos),
    senha: decodificado.slice(posicaoDosDoisPontos + 1),
  };
}

// Cria o verificador da área do barbeiro.
//   senha:          a senha configurada (ou undefined, se não houver)
//   obterAgoraEmMs: função que devolve a hora atual em milissegundos
//                   (existe para os testes poderem controlar o relógio)
function criarAutenticador(senha, obterAgoraEmMs = Date.now) {
  const ativo = senhaEhAceitavel(senha);
  let falhasRecentes = []; // horário (em ms) de cada tentativa errada recente

  // Confere uma requisição. Retorna { permitido: true } ou
  // { permitido: false, status, mensagem, cabecalhos }.
  function verificar(req) {
    if (!ativo) {
      return {
        permitido: false,
        status: 503,
        mensagem:
          "Área do barbeiro desativada: a senha ainda não foi configurada no servidor.",
      };
    }

    const agora = obterAgoraEmMs();
    falhasRecentes = falhasRecentes.filter((momento) => agora - momento < JANELA_DE_FALHAS_MS);

    if (falhasRecentes.length >= LIMITE_DE_FALHAS) {
      const segundos = Math.ceil(
        (falhasRecentes[0] + JANELA_DE_FALHAS_MS - agora) / 1000
      );
      return {
        permitido: false,
        status: 429,
        mensagem: "Muitas tentativas incorretas. Aguarde alguns minutos e tente de novo.",
        cabecalhos: { "Retry-After": String(segundos) },
      };
    }

    const credenciais = lerCredenciais(req);

    // Sem credenciais não é erro de senha: é o navegador pedindo o login
    if (credenciais === null) {
      return {
        permitido: false,
        status: 401,
        mensagem: "Autenticação necessária.",
        cabecalhos: CABECALHO_DE_DESAFIO,
      };
    }

    // As duas comparações sempre acontecem (sem "atalho"), para o tempo de
    // resposta não indicar se foi o usuário ou a senha que errou.
    const usuarioCorreto = textosIguais(credenciais.usuario, USUARIO_BARBEIRO);
    const senhaCorreta = textosIguais(credenciais.senha, senha);

    if (usuarioCorreto && senhaCorreta) {
      return { permitido: true };
    }

    falhasRecentes.push(agora);
    return {
      permitido: false,
      status: 401,
      mensagem: "Usuário ou senha incorretos.",
      cabecalhos: CABECALHO_DE_DESAFIO,
    };
  }

  return { ativo, verificar };
}

module.exports = {
  USUARIO_BARBEIRO,
  TAMANHO_MINIMO_DA_SENHA,
  LIMITE_DE_FALHAS,
  JANELA_DE_FALHAS_MS,
  criarAutenticador,
};