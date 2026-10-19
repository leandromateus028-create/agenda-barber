// src/estaticos.js
// Entrega os arquivos da página (HTML, CSS e JavaScript) que ficam na pasta
// "public". É o que o navegador do cliente baixa ao abrir o endereço do site.
//
// Segurança: o servidor só pode entregar arquivos de DENTRO da pasta "public".
// Nada de src/, agenda.json ou outros arquivos do projeto.
//
// Alguns arquivos (a página do barbeiro) exigem login. Quem decide quais são é
// quem chama esta função, por meio de "verificarAcesso" (veja mais abaixo).

const fs = require("fs");
const path = require("path");

const PASTA_PUBLICA = path.join(__dirname, "..", "public");

// Tipo de cada arquivo, para o navegador saber como interpretá-lo
const TIPOS_DE_ARQUIVO = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// Cabeçalhos de segurança enviados junto com os arquivos da página.
// A política de conteúdo (CSP) manda o navegador aceitar scripts, estilos e
// conexões apenas deste mesmo servidor, o que bloqueia código injetado.
const CABECALHOS_DE_SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; base-uri 'self'; " +
    "form-action 'self'; frame-ancestors 'none'",
};

// Envia uma resposta simples em texto (usada nos erros)
function responderTexto(res, status, texto, cabecalhosExtras = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...CABECALHOS_DE_SEGURANCA,
    ...cabecalhosExtras,
  });
  res.end(texto);
}

// Escapa os caracteres especiais do HTML antes de colocar um texto em uma página
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mostra uma página simples quando o acesso a um arquivo protegido é negado.
// O navegador só exibe esta página se o usuário cancelar a janela de login.
// O status (401, 429, 503) e os cabeçalhos (como WWW-Authenticate, que faz o
// navegador pedir usuário e senha) vêm do verificador.
function responderAcessoNegado(req, res, acesso, caminhoDoArquivo) {
  const corpo =
    '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="robots" content="noindex">\n' +
    "<title>Acesso restrito</title>\n" +
    '<link rel="icon" href="data:,">\n' +
    '<link rel="stylesheet" href="/barbeiro.css">\n' +
    "</head>\n" +
    '<body>\n<div class="faixa" aria-hidden="true"></div>\n' +
    '<main class="painel acesso-restrito">\n' +
    "<h1>Acesso restrito</h1>\n" +
    `<p>${escaparHtml(acesso.mensagem)}</p>\n` +
    `<p><a class="botao" href="/${escaparHtml(caminhoDoArquivo)}">Entrar de novo</a></p>\n` +
    "</main>\n</body>\n</html>\n";

  res.writeHead(acesso.status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(corpo),
    "Cache-Control": "no-store",
    ...CABECALHOS_DE_SEGURANCA,
    ...(acesso.cabecalhos || {}),
  });
  res.end(req.method === "HEAD" ? undefined : corpo);
}

// Entrega o arquivo pedido pelo navegador (ex: "/" ou "/estilo.css").
//
// "verificarAcesso" é facultativo. Se existir, é chamado com o caminho REAL do
// arquivo (relativo a "public", em minúsculas, ex: "barbeiro.html") e com a
// requisição, e deve devolver:
//   { permitido: true }                         -> arquivo público
//   { permitido: true, protegido: true }        -> arquivo protegido, login ok
//   { permitido: false, status, mensagem, cabecalhos }  -> acesso negado
// A conferência acontece depois de resolver o caminho (decodificar "%2f",
// juntar "//" etc.), por isso não dá para contorná-la mudando a forma do
// endereço.
function servirArquivoEstatico(req, res, caminhoDaUrl, verificarAcesso) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return responderTexto(res, 405, "Método não permitido.", {
      Allow: "GET, HEAD",
    });
  }

  let caminho;
  try {
    caminho = decodeURIComponent(caminhoDaUrl);
  } catch (erro) {
    return responderTexto(res, 400, "Endereço inválido.");
  }

  // O endereço principal entrega a página inicial
  if (caminho === "/") {
    caminho = "/index.html";
  }

  // Recusa caminhos suspeitos: com "..", arquivos ocultos (começam com "."),
  // barras invertidas e caracteres nulos. Evita sair da pasta "public".
  const partes = caminho.split("/");
  const suspeito =
    caminho.includes("\0") ||
    caminho.includes("\\") ||
    partes.some((parte) => parte.startsWith("."));

  const arquivo = path.join(PASTA_PUBLICA, caminho);

  // Segunda barreira: o arquivo final precisa estar dentro de "public"
  if (suspeito || !arquivo.startsWith(PASTA_PUBLICA + path.sep)) {
    return responderTexto(res, 404, "Arquivo não encontrado.");
  }

  // Pergunta se este arquivo exige login (usa o caminho já resolvido)
  const caminhoDoArquivo = path
    .relative(PASTA_PUBLICA, arquivo)
    .split(path.sep)
    .join("/")
    .toLowerCase();

  let protegido = false;

  if (verificarAcesso) {
    const acesso = verificarAcesso(caminhoDoArquivo, req);

    if (!acesso.permitido) {
      return responderAcessoNegado(req, res, acesso, caminhoDoArquivo);
    }

    protegido = acesso.protegido === true;
  }

  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      // Inclui o caso de o caminho ser uma pasta (não listamos pastas)
      return responderTexto(res, 404, "Arquivo não encontrado.");
    }

    const extensao = path.extname(arquivo).toLowerCase();

    res.writeHead(200, {
      "Content-Type": TIPOS_DE_ARQUIVO[extensao] || "application/octet-stream",
      "Content-Length": conteudo.length,
      // Durante o desenvolvimento, o navegador sempre confere se há versão nova.
      // Arquivos protegidos nunca são guardados em cache.
      "Cache-Control": protegido ? "no-store" : "no-cache",
      ...CABECALHOS_DE_SEGURANCA,
    });

    // Em requisições HEAD só os cabeçalhos são enviados
    res.end(req.method === "HEAD" ? undefined : conteudo);
  });
}

module.exports = { servirArquivoEstatico };