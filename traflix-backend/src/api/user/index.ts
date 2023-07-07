import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import {
  authProtected,
  authUnprotected,
  IGetUserAuthInfoRequest,
} from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';

const router: Router = express.Router();

router.get(
  '/me',
  authProtected,
  (req: IGetUserAuthInfoRequest, res: Response) => {
    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      user_id: req.user?.userId,
      email: req.user?.email,
      nickname: req.user?.nickname,
    });
  },
);

module.exports = router;
