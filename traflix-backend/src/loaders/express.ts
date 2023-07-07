import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import config from '../config';
import cors from 'cors';
import hpp from 'hpp';

export default (app: express.Application) => {
  type StaticOrigin = boolean | string | RegExp | (boolean | string | RegExp)[];
  // CORS setting
  const corsOptions = {
    origin(
      origin: string | undefined,
      callback: (err: Error | null, singleOrigin?: StaticOrigin) => void,
    ) {
      const isWhitelisted =
        origin && config.cors_whitelist.indexOf(origin) !== -1;
      callback(null, isWhitelisted);
    },
    credentials: true,
  };
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(path.resolve(), '..', 'public')));
  app.use(hpp());
  app.use(config.api.prefix, require('../api')); // API router
};
