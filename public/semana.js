// public/semana.js
// O resumo da semana do barbeiro: quantos agendamentos há em cada dia, com um
// toque para abrir a agenda do dia.
//
// Dados: usa só a rota GET /api/agendamentos (a lista de todos os agendamentos).
// A lista não vem em ordem de data, por isso este arquivo CONTA por data. Os
// nomes dos clientes não são guardados: o resumo só precisa dos números.
//
// Login: este arquivo NÃO sabe a senha. Quem pede usuário e senha é o próprio
// navegador (autenticação HTTP Basic), quando a página é aberta.
//
// Observação: algumas funções (datas, chamada da API, mensagens de falha) são
// iguais às de barbeiro.js. A repetição é proposital: cada página funciona
// sozinha. Se as páginas crescerem, o próximo passo é levar essas funções para
// um arquivo compartilhado.

"use strict";

// ---------------------------------------------------------------------------
// Configurações e textos
// ---------------------------------------------------------------------------

const INTERVALO_DE_ATUALIZACAO_MS = 60 * 1000; // atualização automática
const PRIMEIRO_DIA_DA_SEMANA = 1; // 0 = domingo, 1 = segunda-feira
const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2099;
const MAXIMO_DE_MARCAS = 12;

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_SEMANA_LONGO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MESES_LONGO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ---------------------------------------------------------------------------
// Elementos da página (buscados uma vez só)
// ---------------------------------------------------------------------------

const linkDia = document.getElementById("link-dia");
const botaoAtualizar = document.getElementById("botao-atualizar");
const botaoAnterior = document.getElementById("botao-anterior");
const botaoHoje = document.getElementById("botao-hoje");
const botaoProxima = document.getElementById("botao-proxima");
const textoSemana = document.getElementById("texto-semana");
const seloSemana = document.getElementById("selo-semana");
const resumoSemana = document.getElementById("resumo-semana");
const aviso = document.getElementById("aviso");
const avisoTexto = document.getElementById("aviso-texto");
const avisoAcao = document.getElementById("aviso-acao");
const listaDias = document.getElementById("lista-dias");

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const estado = {
  inicio: semanaInicial(), // primeiro dia da semana mostrada
  contagens: null, // Map "DD/MM/AAAA" -> quantidade (null enquanto não carregou)
  assinatura: "", // texto que resume a tela, para só redesenhar se mudou
  sequencia: 0, // número da última consulta (descarta respostas antigas)
  carregando: false,
  acaoDoAviso: "recarregar", // o que o botão do aviso faz
};

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

// Zera a hora: só importa o dia
function inicioDoDia(data) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

// Soma (ou subtrai) dias, cuidando da virada de mês e de ano
function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

function mesmoDia(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dentroDoIntervalo(data) {
  return data.getFullYear() >= ANO_MINIMO && data.getFullYear() <= ANO_MAXIMO;
}

// "DD/MM/AAAA": o formato que a API usa
function formatarDataApi(data) {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getFullYear()}`;
}

// "AAAA-MM-DD": o formato usado nos endereços das páginas
function formatarDataEndereco(data) {
  const ano = String(data.getFullYear()).padStart(4, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Converte "AAAA-MM-DD" em data local. Devolve null se o texto estiver mal
// formado, se a data não existir ou se estiver fora do intervalo aceito.
function lerDataIso(texto) {
  const correspondencia = String(texto || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!correspondencia) {
    return null;
  }

  const [, ano, mes, dia] = correspondencia.map(Number);
  const data = new Date(ano, mes - 1, dia);

  // Descarta datas que não existem (o JavaScript "corrigiria" 31/02 para março)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }

  return dentroDoIntervalo(data) ? data : null;
}

// Qualquer data do endereço (?data=AAAA-MM-DD) escolhe a semana; sem ela, é hoje
function dataInicial() {
  const doEndereco = lerDataIso(new URLSearchParams(window.location.search).get("data"));
  return doEndereco || inicioDoDia(new Date());
}

// Primeiro dia (segunda-feira, por padrão) da semana que contém a data
function inicioDaSemana(data) {
  const atraso = (data.getDay() - PRIMEIRO_DIA_DA_SEMANA + 7) % 7;
  return somarDias(inicioDoDia(data), -atraso);
}

// A semana inteira precisa estar dentro do intervalo aceito
function semanaDentroDoIntervalo(inicio) {
  return dentroDoIntervalo(inicio) && dentroDoIntervalo(somarDias(inicio, 6));
}

// A semana que a página mostra ao abrir: a do endereço (se for válida) ou a atual
function semanaInicial() {
  const inicio = inicioDaSemana(dataInicial());
  return semanaDentroDoIntervalo(inicio) ? inicio : inicioDaSemana(new Date());
}

function semanaAtual() {
  return mesmoDia(inicioDaSemana(new Date()), estado.inicio);
}

// Ex: "quarta-feira, 14 de outubro de 2026"
function descreverData(data) {
  return `${DIAS_SEMANA_LONGO[data.getDay()]}, ${data.getDate()} de ${MESES_LONGO[data.getMonth()]} de ${data.getFullYear()}`;
}

// Ex: "12 a 18 de outubro de 2026", "28 de setembro a 4 de outubro de 2026"
// ou "28 de dezembro de 2026 a 3 de janeiro de 2027"
function descreverSemana(inicio) {
  const fim = somarDias(inicio, 6);
  const mesInicio = MESES_LONGO[inicio.getMonth()];
  const mesFim = MESES_LONGO[fim.getMonth()];

  if (inicio.getFullYear() !== fim.getFullYear()) {
    return `${inicio.getDate()} de ${mesInicio} de ${inicio.getFullYear()} a ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`;
  }

  if (inicio.getMonth() !== fim.getMonth()) {
    return `${inicio.getDate()} de ${mesInicio} a ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`;
  }

  return `${inicio.getDate()} a ${fim.getDate()} de ${mesInicio} de ${fim.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Conversa com a API
// ---------------------------------------------------------------------------

// Faz a requisição e devolve sempre { ok, status, dados, esperar }.
// status 0 significa que não foi possível falar com o servidor.
async function chamarApi(caminho, opcoes) {
  try {
    const resposta = await fetch(caminho, {
      credentials: "same-origin",
      cache: "no-store",
      ...opcoes,
    });

    let dados = null;
    try {
      dados = await resposta.json();
    } catch (erro) {
      dados = null;
    }

    return {
      ok: resposta.ok,
      status: resposta.status,
      dados,
      esperar: Number(resposta.headers.get("Retry-After")) || 0,
    };
  } catch (erro) {
    return { ok: false, status: 0, dados: null, esperar: 0 };
  }
}

// Transforma uma resposta com problema em um texto claro para o barbeiro
function descreverFalha(resultado) {
  if (resultado.status === 0) {
    return {
      tipo: "conexao",
      texto: "Não foi possível conectar ao servidor. Verifique a conexão e tente de novo.",
    };
  }

  if (resultado.status === 401) {
    return {
      tipo: "autenticacao",
      texto:
        "Não foi possível confirmar o seu acesso. Entre de novo com o usuário e a senha do barbeiro.",
    };
  }

  if (resultado.status === 429) {
    const minutos = Math.ceil(resultado.esperar / 60);
    const quando =
      minutos > 0
        ? `Aguarde cerca de ${minutos} ${minutos === 1 ? "minuto" : "minutos"} e tente de novo.`
        : "Aguarde alguns minutos e tente de novo.";
    return { tipo: "bloqueio", texto: `Muitas tentativas incorretas de login. ${quando}` };
  }

  if (resultado.status === 503) {
    return {
      tipo: "desativada",
      texto:
        "A área do barbeiro está desativada: a senha ainda não foi configurada no servidor.",
    };
  }

  if (resultado.dados && typeof resultado.dados.erro === "string" && resultado.dados.erro !== "") {
    return { tipo: "servidor", texto: resultado.dados.erro };
  }

  return {
    tipo: "servidor",
    texto: `O servidor respondeu com um erro inesperado (código ${resultado.status}).`,
  };
}

const FALHA_RESPOSTA_INESPERADA = {
  tipo: "inesperada",
  texto:
    "O servidor enviou uma resposta que a página não entendeu. Tente atualizar o resumo.",
};

// Confere o formato da lista e conta os agendamentos de cada data.
// Devolve um Map ("DD/MM/AAAA" -> quantidade) ou null se a resposta não tiver
// o formato esperado. A ordem da lista não importa. Os nomes são descartados.
function contarPorDia(dados) {
  if (!dados || !Array.isArray(dados.agendamentos)) {
    return null;
  }

  const contagens = new Map();

  for (const item of dados.agendamentos) {
    const valido =
      item &&
      typeof item.data === "string" &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(item.data) &&
      typeof item.horario === "string" &&
      /^\d{2}:\d{2}$/.test(item.horario) &&
      typeof item.cliente === "string";

    if (!valido) {
      return null;
    }

    contagens.set(item.data, (contagens.get(item.data) || 0) + 1);
  }

  return contagens;
}

// ---------------------------------------------------------------------------
// Desenho da tela
// ---------------------------------------------------------------------------

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) {
    elemento.className = classe;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}

function pluralizar(quantidade, singular, plural) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

// Quantidade de agendamentos de cada um dos 7 dias da semana mostrada
function contagensDaSemana() {
  const quantidades = [];

  for (let i = 0; i < 7; i++) {
    const chave = formatarDataApi(somarDias(estado.inicio, i));
    quantidades.push(estado.contagens ? estado.contagens.get(chave) || 0 : 0);
  }

  return quantidades;
}

// Desenha os 7 dias
function desenharDias(quantidades) {
  listaDias.replaceChildren();
  const hoje = new Date();

  quantidades.forEach((quantidade, i) => {
    const dia = somarDias(estado.inicio, i);
    const ehHoje = mesmoDia(dia, hoje);
    const textoQuantidade =
      quantidade === 0 ? "Sem agendamentos" : pluralizar(quantidade, "agendamento", "agendamentos");

    const item = criarElemento("li");
    const link = criarElemento("a", "dia-link");
    link.href = `/barbeiro?data=${formatarDataEndereco(dia)}`;
    link.dataset.movimento = quantidade > 0 ? "sim" : "nao";
    link.dataset.data = formatarDataApi(dia);
    link.setAttribute(
      "aria-label",
      `Abrir ${ehHoje ? "hoje, " : ""}${descreverData(dia)}: ${textoQuantidade}`
    );

    const data = criarElemento("span", "data-bloco");
    data.append(
      criarElemento("span", "data-semana", DIAS_SEMANA_CURTO[dia.getDay()]),
      criarElemento("span", "data-numero", String(dia.getDate())),
      criarElemento("span", "data-mes", MESES_CURTO[dia.getMonth()])
    );

    const topo = criarElemento("span", "linha-topo");
    topo.append(criarElemento("span", "quantidade", textoQuantidade));
    if (ehHoje) {
      topo.append(criarElemento("span", "selo", "Hoje"));
    }

    const conteudo = criarElemento("span", "conteudo");
    conteudo.append(topo);

    if (quantidade > 0) {
      const marcas = criarElemento("span", "marcas");
      marcas.setAttribute("aria-hidden", "true");

      for (let m = 0; m < Math.min(quantidade, MAXIMO_DE_MARCAS); m++) {
        marcas.append(criarElemento("span", "marca"));
      }

      if (quantidade > MAXIMO_DE_MARCAS) {
        marcas.append(criarElemento("span", "marcas-mais", `+${quantidade - MAXIMO_DE_MARCAS}`));
      }

      conteudo.append(marcas);
    }

    const seta = criarElemento("span", "seta", "›");
    seta.setAttribute("aria-hidden", "true");

    link.append(data, conteudo, seta);
    item.append(link);
    listaDias.append(item);
  });
}

// Desenha a semana a partir dos dados que já temos. Só redesenha se algo
// mudou, para não tirar o foco do teclado a cada atualização automática.
function renderizar() {
  if (estado.contagens === null) {
    return; // ainda não carregou: não há o que mostrar
  }

  const quantidades = contagensDaSemana();
  const assinatura = JSON.stringify([formatarDataApi(estado.inicio), quantidades]);

  if (assinatura === estado.assinatura) {
    return;
  }

  estado.assinatura = assinatura;
  desenharDias(quantidades);

  const total = quantidades.reduce((soma, quantidade) => soma + quantidade, 0);
  resumoSemana.textContent =
    total === 0
      ? "Nenhum agendamento na semana."
      : `${pluralizar(total, "agendamento", "agendamentos")} na semana`;
}

// Título, selo "Esta semana", link para a agenda do dia e endereço da página
function atualizarCabecalho() {
  const atual = semanaAtual();

  textoSemana.textContent = descreverSemana(estado.inicio);
  seloSemana.hidden = !atual;
  linkDia.href = atual ? "/barbeiro" : `/barbeiro?data=${formatarDataEndereco(estado.inicio)}`;

  // Mantém o dia no endereço, para o botão "voltar" e o recarregar da página
  // continuarem na mesma semana (na semana atual, o endereço fica limpo)
  const endereco = new URL(window.location.href);
  if (atual) {
    endereco.searchParams.delete("data");
  } else {
    endereco.searchParams.set("data", formatarDataEndereco(estado.inicio));
  }
  window.history.replaceState(null, "", endereco.pathname + endereco.search + endereco.hash);
}

function mostrarAviso(falha) {
  avisoTexto.textContent = falha.texto;

  if (falha.tipo === "autenticacao") {
    estado.acaoDoAviso = "entrar";
    avisoAcao.textContent = "Entrar de novo";
  } else {
    estado.acaoDoAviso = "recarregar";
    avisoAcao.textContent = "Tentar de novo";
  }

  aviso.hidden = false;
}

function esconderAviso() {
  aviso.hidden = true;
  avisoTexto.textContent = "";
}

// ---------------------------------------------------------------------------
// Carregar os agendamentos
// ---------------------------------------------------------------------------

// Busca todos os agendamentos. "silencioso" é a atualização automática: não
// apaga a lista nem mostra "carregando" (mas mostra erros).
async function carregarAgendamentos({ silencioso = false } = {}) {
  const sequencia = ++estado.sequencia;

  estado.carregando = true;

  if (!silencioso) {
    esconderAviso();
    estado.contagens = null;
    estado.assinatura = "";
    listaDias.replaceChildren();
    resumoSemana.textContent = "Carregando agendamentos…";
    listaDias.setAttribute("aria-busy", "true");
  }

  const resposta = await chamarApi("/api/agendamentos");

  // Se outra consulta começou enquanto esta esperava, ignora esta resposta
  if (sequencia !== estado.sequencia) {
    return;
  }

  estado.carregando = false;
  listaDias.removeAttribute("aria-busy");

  if (!resposta.ok) {
    if (!silencioso) {
      resumoSemana.textContent = "";
    }
    mostrarAviso(descreverFalha(resposta));
    return;
  }

  const contagens = contarPorDia(resposta.dados);

  if (contagens === null) {
    if (!silencioso) {
      resumoSemana.textContent = "";
    }
    mostrarAviso(FALHA_RESPOSTA_INESPERADA);
    return;
  }

  esconderAviso();
  estado.contagens = contagens;
  renderizar();
}

// Atualização automática: só quando a aba está visível e nada está acontecendo
function atualizarSozinho() {
  if (document.visibilityState === "visible" && !estado.carregando) {
    carregarAgendamentos({ silencioso: true });
  }
}

// ---------------------------------------------------------------------------
// Navegar entre as semanas
// ---------------------------------------------------------------------------

function irParaSemana(novoInicio) {
  const inicio = inicioDoDia(novoInicio);

  if (!semanaDentroDoIntervalo(inicio)) {
    return;
  }

  estado.inicio = inicio;
  atualizarCabecalho();
  renderizar();

  // Se ainda não temos os dados (a primeira consulta falhou), tenta de novo
  if (estado.contagens === null && !estado.carregando) {
    carregarAgendamentos();
  }
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

botaoAnterior.addEventListener("click", () => irParaSemana(somarDias(estado.inicio, -7)));
botaoProxima.addEventListener("click", () => irParaSemana(somarDias(estado.inicio, 7)));
botaoHoje.addEventListener("click", () => irParaSemana(inicioDaSemana(new Date())));
botaoAtualizar.addEventListener("click", () => carregarAgendamentos());

avisoAcao.addEventListener("click", () => {
  if (estado.acaoDoAviso === "entrar") {
    // Recarregar a página faz o navegador pedir usuário e senha de novo
    window.location.reload();
  } else {
    carregarAgendamentos();
  }
});

// Mantém o resumo em dia sem o barbeiro precisar apertar "Atualizar"
document.addEventListener("visibilitychange", atualizarSozinho);
setInterval(atualizarSozinho, INTERVALO_DE_ATUALIZACAO_MS);

atualizarCabecalho();
carregarAgendamentos();