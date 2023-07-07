import mysql from 'mysql2';
import config from '../config';

const pool = mysql.createPool({
  host: config.mysql_config.HOST,
  port: 3306,
  database: config.mysql_config.DB,
  user: config.mysql_config.USER,
  password: config.mysql_config.PASSWORD,
  ...config.mysql_config.pool,
});

const promisePool = pool.promise();

export default promisePool;
