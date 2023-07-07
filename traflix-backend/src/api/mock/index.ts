import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import { authProtected, authUnprotected } from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';

const router: Router = express.Router();

router.get('/', authUnprotected, (req: Request, res: Response) => {
  return res.status(HttpStatus.OK).json({
    status: HttpStatus.OK,
    message: 'Mock message',
  });
});

router.get('/auth', authProtected, async (req: Request, res: Response) => {
  const [rows, fields] = await promisePool.execute('SELECT * from USER');

  console.log(rows, fields);

  return res.status(HttpStatus.OK).json({
    status: HttpStatus.OK,
    message: 'Mock message',
    users: rows,
  });
});

module.exports = router;
