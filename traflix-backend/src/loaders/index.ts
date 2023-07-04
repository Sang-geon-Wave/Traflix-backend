import express from 'express';
import expressLoader from './express';

export default (app: express.Application) => {
  expressLoader(app);
};
