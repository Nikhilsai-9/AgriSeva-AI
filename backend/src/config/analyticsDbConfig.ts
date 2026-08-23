import {env} from '#root/utils/env.js';
import {dbConfig} from './db.js';

export const analyticsDbConfig = {
  url: env('DB_URL_ANALYTICS') || dbConfig.url,
  dbName: env('DB_NAME_ANALYTICS') || 'agriai_analytics',
  annamUrl: env('ANNAM_URL_ANALYTICS') || env('DB_URL_ANALYTICS') || dbConfig.url,
  annamDbName: env('ANNAM_DB_ANALYTICS') || 'agriai_annam',
};