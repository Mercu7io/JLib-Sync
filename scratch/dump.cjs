const fs = require('fs');
const JSZip = require('jszip');
const sql = require('sql.js');

fs.readFile('example2.jwlibrary', (err, data) => {
  JSZip.loadAsync(data)
    .then(zip => zip.file('userData.db').async('uint8array'))
    .then(dbData => sql().then(SQL => {
      const db = new SQL.Database(dbData);
      const res = db.exec("SELECT sql FROM sqlite_master WHERE type='table'");
      if (res.length > 0) {
        console.log(res[0].values.map(v => v[0]).join('\n'));
      }
    }));
});
