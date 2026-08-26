function buildAdminUrl(path) {
  return `/painel${path.star/tsWith("/") ? path : `/${path}`}`;
}

module.exports = {
  buildAdminUrl
};
