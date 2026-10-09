const { defineConfig } = require("cypress");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:8000",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",
    screenshotsFolder: "cypress/artifacts/screenshots",
    videosFolder: "cypress/artifacts/videos",
    downloadsFolder: "cypress/artifacts/downloads",
    setupNodeEvents(on, config) {
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
        removeDownloadedFiles({ fileNames = [] }) {
          fileNames.forEach((fileName) => {
            if (!fileName || path.basename(fileName) !== fileName) {
              throw new Error(`Nome de download inválido: ${fileName}`);
            }

            fs.rmSync(path.join(config.downloadsFolder, fileName), {
              force: true,
            });
          });

          return null;
        },
        readDownloadedFile({ fileNames = [] }) {
          const nomesDeArquivo = fileNames.filter((fileName) => {
            if (!fileName || path.basename(fileName) !== fileName) {
              throw new Error(`Nome de download inválido: ${fileName}`);
            }

            return true;
          });
          const deadline = Date.now() + 30000;

          return new Promise((resolve, reject) => {
            function lerArquivo() {
              const nomeArquivoEncontrado = nomesDeArquivo.find((nome) =>
                fs.existsSync(path.join(config.downloadsFolder, nome)),
              );

              if (nomeArquivoEncontrado) {
                const filePath = path.join(
                  config.downloadsFolder,
                  nomeArquivoEncontrado,
                );
                const tamanho = fs.statSync(filePath).size;

                if (tamanho > 0) {
                  resolve({
                    fileName: nomeArquivoEncontrado,
                    tamanho,
                    content: fs.readFileSync(filePath, "utf8"),
                  });
                  return;
                }
              }

              if (Date.now() >= deadline) {
                reject(
                  new Error(
                    `Arquivo não baixado: ${nomesDeArquivo.join(" ou ")}`,
                  ),
                );
                return;
              }

              setTimeout(lerArquivo, 100);
            }

            lerArquivo();
          });
        },
        assertDownloadedFileContains({
          fileName,
          fileNames = [],
          expectedFields = [],
          adaptador = "padrao",
          reportarCamposAusentes = false,
          timeoutMs = 300000,
        }) {
          const nomesDeArquivo = [fileName, ...fileNames].filter(Boolean);
          const margemDeRetornoMs = 1000;
          const deadline =
            Date.now() + Math.max(1000, timeoutMs - margemDeRetornoMs);
          const estabilidadeMinimaMs = 2000;
          let caminhoTemporarioAnterior = "";
          let tamanhoTemporarioAnterior = 0;
          let inicioDaEstabilidade = 0;

          function normalizarNumero(valor) {
            return String(valor).replace(/[^0-9-]/g, "");
          }

          function decodificarEntidadesHtml(valor) {
            return String(valor)
              .replace(/&amp;/gi, "&")
              .replace(/&lt;/gi, "<")
              .replace(/&gt;/gi, ">")
              .replace(/&quot;/gi, '"')
              .replace(/&#39;|&apos;/gi, "'")
              .replace(/&nbsp;/gi, " ");
          }

          function ehCampoMonetario(label) {
            return /valor|empenhad|liquid|pagament|pagamento|pago/i.test(label);
          }

          function normalizarTextoCompacto(valor) {
            return String(valor)
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "");
          }

          function removerCodigoInicial(valor) {
            return String(valor).replace(/^[\d.]+\s*[-.)]\s*/, "");
          }

          function valorProdataEncontrado(esperado, conteudoCompacto) {
            const esperadoCompacto = normalizarTextoCompacto(
              removerCodigoInicial(esperado),
            );

            return (
              esperadoCompacto.length >= 4 &&
              conteudoCompacto.includes(esperadoCompacto)
            );
          }

          return new Promise((resolve, reject) => {
            function verificarArquivo() {
              const nomeArquivoFinal = nomesDeArquivo.find((nome) =>
                fs.existsSync(path.join(config.downloadsFolder, nome)),
              );
              const nomeArquivoTemporario = nomesDeArquivo.find((nome) =>
                fs.existsSync(
                  path.join(config.downloadsFolder, `${nome}.crdownload`),
                ),
              );
              const nomeArquivoEncontrado =
                nomeArquivoFinal || nomeArquivoTemporario;
              const filePath = nomeArquivoFinal
                ? path.join(config.downloadsFolder, nomeArquivoFinal)
                : nomeArquivoTemporario
                  ? path.join(
                      config.downloadsFolder,
                      `${nomeArquivoTemporario}.crdownload`,
                    )
                  : "";

              if (filePath) {
                let tamanho = 0;

                try {
                  tamanho = fs.statSync(filePath).size;
                } catch {
                  setTimeout(verificarArquivo, 100);
                  return;
                }

                const arquivoFinalDisponivel = Boolean(nomeArquivoFinal) &&
                  tamanho > 0;
                const arquivoTemporarioEstavel =
                  !nomeArquivoFinal &&
                  Boolean(nomeArquivoTemporario) &&
                  tamanho > 0 &&
                  caminhoTemporarioAnterior === filePath &&
                  tamanhoTemporarioAnterior === tamanho &&
                  Date.now() - inicioDaEstabilidade >= estabilidadeMinimaMs;

                if (arquivoFinalDisponivel || arquivoTemporarioEstavel) {
                  let conteudoArquivo;

                  try {
                    conteudoArquivo = fs.readFileSync(filePath).toString("utf8");
                  } catch {
                    setTimeout(verificarArquivo, 100);
                    return;
                  }

                  const conteudo = decodificarEntidadesHtml(conteudoArquivo)
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, " ")
                    .toLowerCase();
                  const conteudoCompacto = normalizarTextoCompacto(conteudo);
                  let conteudoDocumentos;
                  let conteudoNumerico;
                  const camposParaComparar = expectedFields
                    .map(({ label, value }) => {
                      const valorNormalizado = String(value)
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "");
                      const ehDocumento = /cpf|cnpj/i.test(label);
                      const esperado = ehDocumento
                        ? valorNormalizado.replace(/[^0-9*]/g, "")
                        : valorNormalizado
                            .replace(/\s+/g, " ")
                            .trim()
                            .toLowerCase();

                      return {
                        label,
                        value,
                        esperado,
                        ehDocumento,
                        ehCampoMonetario:
                          ["centi", "prodata", "fiorilli"].includes(
                            adaptador,
                          ) && ehCampoMonetario(label),
                      };
                    })
                    .filter(({ esperado }) => esperado);
                  const camposAusentes = camposParaComparar
                    .filter(({ esperado, ehDocumento, ehCampoMonetario }) => {
                      let conteudoParaComparacao = conteudo;

                      if (ehDocumento) {
                        conteudoDocumentos ??= conteudo.replace(
                          /[^0-9*]/g,
                          "",
                        );
                        conteudoParaComparacao = conteudoDocumentos;
                      }

                      if (conteudoParaComparacao.includes(esperado)) {
                        return false;
                      }

                      if (
                        adaptador === "prodata" &&
                        valorProdataEncontrado(esperado, conteudoCompacto)
                      ) {
                        return false;
                      }

                      if (ehCampoMonetario) {
                        conteudoNumerico ??= conteudo.replace(/[^0-9-]/g, "");
                        return !conteudoNumerico.includes(
                          normalizarNumero(esperado),
                        );
                      }

                      return true;
                    })
                    .map(({ label }) => label);

                  const camposComparados = camposParaComparar.map(
                    ({ label, value, ehDocumento, ehCampoMonetario }) => ({
                      label,
                      value,
                      regra: ehDocumento
                        ? "documento com máscara normalizada"
                        : ehCampoMonetario
                          ? `valor ${adaptador} com pontuação monetária normalizada`
                          : "texto com acentuação e espaços normalizados",
                      encontrado: !camposAusentes.includes(label),
                    }),
                  );

                  if (camposAusentes.length === 0 || reportarCamposAusentes) {
                    resolve({
                      tamanho,
                      fileName: nomeArquivoFinal || nomeArquivoTemporario,
                      camposComparados,
                      camposAusentes,
                    });
                    return;
                  }

                  reject(
                    new Error(
                      `Dados ausentes em ${nomeArquivoEncontrado || fileName}: ${camposAusentes.join(
                        ", ",
                      )}`,
                    ),
                  );
                  return;
                }

                if (!nomeArquivoFinal) {
                  if (
                    caminhoTemporarioAnterior !== filePath ||
                    tamanhoTemporarioAnterior !== tamanho
                  ) {
                    caminhoTemporarioAnterior = filePath;
                    tamanhoTemporarioAnterior = tamanho;
                    inicioDaEstabilidade = Date.now();
                  }
                }
              }

              if (Date.now() >= deadline) {
                reject(
                  new Error(
                    `Arquivo não baixado: ${nomesDeArquivo.join(" ou ")}`,
                  ),
                );
                return;
              }

              setTimeout(verificarArquivo, 100);
            }

            verificarArquivo();
          });
        },
      });

      config.env.adminUser = process.env.CYPRESS_ADMIN_USER || "";
      config.env.adminPassword = process.env.CYPRESS_ADMIN_PASSWORD || "";
      config.env.portalHost = process.env.CYPRESS_PORTAL_HOST || "localhost";

      return config;
    },
  },
  viewportWidth: 1440,
  viewportHeight: 900,
  defaultCommandTimeout: 10000,
  requestTimeout: 15000,
  video: false,
  chromeWebSecurity: false,
});
