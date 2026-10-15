// src/estaticos.js
// Entrega os arquivos da página (HTML, CSS e JavaScript) que ficam na pasta
// "public". É o que o navegador do cliente baixa ao abrir o endereço do site.
//
// Segurança: o servidor só pode entregar arquivos de DENTRO da pasta "public".
// Nada de src/, agenda.json ou outros arquivos do projeto.

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

// Entrega o arquivo pedido pelo navegador (ex: "/" ou "/estilo.css")
function servirArquivoEstatico(req, res, caminhoDaUrl) {
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

  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      // Inclui o caso de o caminho ser uma pasta (não listamos pastas)
      return responderTexto(res, 404, "Arquivo não encontrado.");
    }

    const extensao = path.extname(arquivo).toLowerCase();

    res.writeHead(200, {
      "Content-Type": TIPOS_DE_ARQUIVO[extensao] || "application/octet-stream",
      "Content-Length": conteudo.length,
      // Durante o desenvolvimento, o navegador sempre confere se há versão nova
      "Cache-Control": "no-cache",
      ...CABECALHOS_DE_SEGURANCA,
    });

    // Em requisições HEAD só os cabeçalhos são enviados
    res.end(req.method === "HEAD" ? undefined : conteudo);
  });
}

module.exports = { servirArquivoEstatico };