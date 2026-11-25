/* Carga google-apps-script/Code.gs con la hoja simulada. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createGoogle } = require('./fake-sheets');
const { ROOT } = require('./load-client');

function loadServer() {
  const g = createGoogle();
  const ctx = Object.assign({ console, JSON, Math, Date, Object, String, Number, Array, Set, Error }, g.globals);
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'google-apps-script', 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  const parse = out => JSON.parse(out.getContent());
  return {
    ctx, google: g, sheets: g.sheets,
    get: params => parse(ctx.doGet({ parameter: params })),
    post: body => parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } })),
    clave: vm.runInContext('CLAVE_PROFESOR', ctx)
  };
}

module.exports = { loadServer };
