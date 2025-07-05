const mysql = require('mysql2');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'chores_user',
  password: process.env.DB_PASSWORD || 'ChoresPass123!',
  database: process.env.DB_NAME || 'family_chores',
  charset: 'utf8mb4',
  timezone: 'Z',
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: false
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Promisify for async/await usage
const promisePool = pool.promise();

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  
  console.log('Database connected successfully');
  connection.release();
});

// Handle connection errors
pool.on('connection', (connection) => {
  console.log('New connection established as id ' + connection.threadId);
});

pool.on('error', (err) => {
  console.error('Database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.log('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
    console.log('Database connection was refused.');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing database connection pool...');
  pool.end(() => {
    console.log('Database connection pool closed.');
    process.exit(0);
  });
});

module.exports = {
  pool,
  promisePool,
  query: (sql, params) => {
    return new Promise((resolve, reject) => {
      pool.execute(sql, params, (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });
  },
  ping: (callback) => {
    pool.getConnection((err, connection) => {
      if (err) {
        return callback(err);
      }
      connection.ping((pingErr) => {
        connection.release();
        callback(pingErr);
      });
    });
  },
  end: () => {
    return new Promise((resolve) => {
      pool.end(() => {
        resolve();
      });
    });
  }
};
