import express, { Request, Response, Router } from 'express';
import {
  genAccessToken,
  genRefreshToken,
  hashPassword,
} from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2';
import promisePool from '../../db';

const router: Router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { user_id: userId, user_pw: userPw, autologin } = req.body;

    const userPwHashed = hashPassword(userPw);

    const [rows, _] = (await promisePool.execute(
      `SELECT * from USER WHERE user_id='${userId}' and password_sha256='${userPwHashed}'`,
    )) as any[];

    if (rows.length) {
      // Generate access token
      const { email, nickname } = rows[0];
      const accessToken = genAccessToken({
        user_id: userId,
        email: email,
        nickname: nickname,
      });

      // Generate refresh token & store it in DB and cookie
      const refreshToken = genRefreshToken();
      await promisePool.execute(
        `UPDATE USER SET refresh_token='${refreshToken}' WHERE user_id='${userId}';`,
      );
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        ...(autologin
          ? {
              maxAge: 2592000000, // remember for 30 days
            }
          : {}),
      });

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'login success',
        access_token: accessToken,
      });
    }
  } catch (err) {}

  return res.status(HttpStatus.UNAUTHORIZED).json({
    status: HttpStatus.UNAUTHORIZED,
    message: 'login fail',
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token: refreshToken } = req.cookies;

    // Check refresh token on DB
    const [rows, _] = (await promisePool.execute(
      `SELECT * from USER WHERE refresh_token='${refreshToken}'`,
    )) as any[];

    if (rows.length) {
      const { user_id: userId, email, nickname } = rows[0];
      const accessToken = genAccessToken({
        user_id: userId,
        email: email,
        nickname: nickname,
      });

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'refresh success',
        access_token: accessToken,
      });
    }
  } catch (err) {}

  return res.status(HttpStatus.UNAUTHORIZED).json({
    status: HttpStatus.UNAUTHORIZED,
    message: 'invalid refresh token',
  });
});

router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refresh_token: refreshToken } = req.cookies;
    // Remove refresh_token on DB
    await promisePool.execute(
      `UPDATE USER SET refresh_token=NULL WHERE refresh_token='${refreshToken}';`,
    );
    res.clearCookie('refresh_token');
  } catch (err) {}

  return res.status(HttpStatus.OK).json({
    status: HttpStatus.OK,
    message: 'logout success',
  });
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { user_id: userId, user_pw: userPw, nickname, email } = req.body;

    // Validate user id & password & email
    const idReg = /^[a-z\d]{5,16}$/;
    const passwordReg = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$]{8,16}$/;
    const nicknameReg = /.{1,30}/;
    const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (
      idReg.test(userId) &&
      passwordReg.test(userPw) &&
      (!nickname || nicknameReg.test(nickname)) &&
      (!email || emailReg.test(email))
    ) {
      const userPwHashed = hashPassword(userPw);

      const [rows, _] = (await promisePool.execute(
        `SELECT * from USER WHERE user_id='${userId}'`,
      )) as any[];

      if (rows.length) {
        return res.status(HttpStatus.CONFLICT).json({
          status: HttpStatus.CONFLICT,
          message: 'Account already exists',
        });
      }

      await promisePool.execute(
        `INSERT INTO USER (id, user_id, password_sha256, nickname, email) VALUES ('${uuidv4()}', '${userId}', '${userPwHashed}', ${
          nickname ? `${mysql.escape(nickname)}` : 'NULL'
        }, ${email ? `'${email}'` : 'NULL'});`,
      );

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'signup success',
      });
    }
  } catch (err) {}

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'signup fail',
  });
});

module.exports = router;
