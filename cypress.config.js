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
        assertDownloadedFileContains({
          fileName,
          fileNames = [],
          expectedFields = [],
          adaptador = "padrao",
        }) {
          const nomesDeArquivo = [fileName, ...fileNames].filter(Boolean);
          const deadline = Date.now() + 30000;

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

          function valorProdataEncontrado(esperado, conteudo) {
            const esperadoCompacto = normalizarTextoCompacto(
              removerCodigoInicial(esperado),
            );
            const conteudoCompacto = normalizarTextoCompacto(conteudo);

            return (
              esperadoCompacto.length >= 4 &&
              conteudoCompacto.includes(esperadoCompacto)
            );
          }

          return new Promise((resolve, reject) => {
            function verificarArquivo() {
              const nomeArquivoEncontrado = nomesDeArquivo.find((nome) =>
                fs.existsSync(path.join(config.downloadsFolder, nome)),
              );
              const filePath = nomeArquivoEncontrado
                ? path.join(config.downloadsFolder, nomeArquivoEncontrado)
                : "";

              if (filePath) {
                const tamanho = fs.statSync(filePath).size;

                if (tamanho > 0) {
                  const conteudo = decodificarEntidadesHtml(
                    fs.readFileSync(filePath).toString("utf8"),
                  )
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, " ")
                    .toLowerCase();
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
                          ["centi", "prodata"].includes(adaptador) &&
                          ehCampoMonetario(label),
                      };
                    })
                    .filter(({ esperado }) => esperado);
                  const camposAusentes = camposParaComparar
                    .filter(({ esperado, ehDocumento, ehCampoMonetario }) => {
                      const conteudoParaComparacao = ehDocumento
                        ? conteudo.replace(/[^0-9*]/g, "")
                        : conteudo;

                      if (conteudoParaComparacao.includes(esperado)) {
                        return false;
                      }

                      if (
                        adaptador === "prodata" &&
                        valorProdataEncontrado(esperado, conteudo)
                      ) {
                        return false;
                      }

                      if (ehCampoMonetario) {
                        return !conteudo
                          .replace(/[^0-9-]/g, "")
                          .includes(normalizarNumero(esperado));
                      }

                      return true;
                    })
                    .map(({ label }) => label);

                  if (camposAusentes.length === 0) {
                    resolve({
                      tamanho,
                      fileName: nomeArquivoEncontrado,
                      camposComparados: camposParaComparar.map(
                        ({ label, value, ehDocumento, ehCampoMonetario }) => ({
                          label,
                          value,
                          regra: ehDocumento
                            ? "documento com máscara normalizada"
                            : ehCampoMonetario
                              ? `valor ${adaptador} com pontuação monetária normalizada`
                              : "texto com acentuação e espaços normalizados",
                          encontrado: true,
                        }),
                      ),
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
