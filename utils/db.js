const mysql2 = require('mysql2');

const pool = mysql2.createPool({
    host: 'hopper.proxy.rlwy.net',
    port: 31869,
    user: 'root',
    password: 'SzsBncfJdxXilXdXErGbQrWshsuFaHfn',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
