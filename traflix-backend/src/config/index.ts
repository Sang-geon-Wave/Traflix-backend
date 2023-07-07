import { config } from 'dotenv';
import path from 'path';

const env_dir = `../env/.env.${process.env.NODE_ENV || 'development'}`;
config({ path: path.join(__dirname, env_dir) });

export default {
  server_port: process.env.PORT!,
  logs: {
    level: process.env.LOG_LEVEL || ('silly' as string),
  },
  cors_whitelist: [process.env.ORIGIN],
  // api routers path
  api: {
    prefix: '/' as string,
  },
  // jwt secret
  jwt_secret: process.env.JWT_SECRET as string,
  pw_salt: process.env.PW_SALT as string,
  mysql_config: {
    HOST: process.env.MYSQL_HOST as string,
    USER: process.env.MYSQL_USER as string,
    PASSWORD: process.env.MYSQL_PASSWORD as string,
    dialect: 'mysql',
    DB: process.env.MYSQL_DATABASE as string,
    pool: {
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      idleTimeout: 10000,
    },
    logging: process.env.MYSQL_LOGGING,
  },
};
