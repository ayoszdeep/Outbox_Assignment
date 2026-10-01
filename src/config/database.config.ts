import { Sequelize } from 'sequelize';
import { serverConfig } from '.';

export const sequelize = new Sequelize({
    dialect: (serverConfig.DB_DIALECT as 'postgres') || 'postgres',
    host: serverConfig.DB_HOST,
    port: serverConfig.DB_PORT,
    database: serverConfig.DB_NAME,
    username: serverConfig.DB_USER,
    password: serverConfig.DB_PASSWORD,
    logging: false,
    dialectOptions: serverConfig.DB_SSL
        ? {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
        }
        : undefined,
});

export const connectDatabase = async () => {
    await sequelize.authenticate();
    return sequelize;
};
