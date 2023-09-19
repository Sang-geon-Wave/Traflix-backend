import express, { Request, Response, Router } from 'express';
import {
  genAccessToken,
  genRefreshToken,
  hashPassword,
} from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';
import mysql from 'mysql2';
import promisePool from '../../db';
import axios from 'axios';
//import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const restApiKey = process.env.REST_API_KEY;
    const uri = process.env.REDIRECT_URI;

    const { code: code, email: email, user_pw: userPw, autologin } = req.body;

    var accessToken;
    var refreshToken;

    if (code != null) {
      const data = {
        grant_type: 'authorization_code',
        client_id: restApiKey,
        redirect_uri: uri,
        code: code,
      };

      const kakaoToken = await axios.post(
        'https://kauth.kakao.com/oauth/token',
        data,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            Authorization: `Bearer `,
          },
        },
      );

      accessToken = kakaoToken.data.access_token;
      refreshToken = kakaoToken.data.refresh_token;

      const kakaoUser = await axios.get(`https://kapi.kakao.com/v2/user/me`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const kakaoEmail = kakaoUser.data.kakao_account.email;
      const kakaoNickname = kakaoUser.data.kakao_account.profile.nickname;

      const [rows, _] = (await promisePool.execute(
        `SELECT * from USER WHERE email='${kakaoEmail}' and is_kakao=TRUE`,
      )) as any[];

      if (!rows.length) {
        await promisePool.execute(
          `INSERT INTO USER (user_id, password, nickname, email, is_kakao, kakao_refresh_token) VALUES ('${kakaoEmail}', '${accessToken}', ${
            kakaoNickname ? `${mysql.escape(kakaoNickname)}` : 'NULL'
          }, ${
            kakaoEmail ? `'${kakaoEmail}'` : 'NULL'
          }, TRUE, '${refreshToken}');`,
        );
      } else {
        await promisePool.execute(
          `UPDATE USER SET kakao_refresh_token='${refreshToken}' WHERE email='${kakaoEmail}' and is_kakao=TRUE;`,
        );
      }
    } else {
      const userPwHashed = hashPassword(userPw);

      const [rows, _] = (await promisePool.execute(
        `SELECT * from USER WHERE email='${email}' and password='${userPwHashed}' and is_kakao=FALSE`,
      )) as any[];

      if (rows.length) {
        // Generate access token
        const { email, nickname } = rows[0];
        accessToken = genAccessToken({
          user_id: email,
          email: email,
          nickname: nickname,
        });

        // Generate refresh token & store it in DB and cookie
        refreshToken = genRefreshToken();
      }

      await promisePool.execute(
        `UPDATE USER SET refresh_token='${refreshToken}' WHERE email='${email}' and is_kakao=FALSE;`,
      );
    }

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
  } catch (err) {}

  return res.status(HttpStatus.UNAUTHORIZED).json({
    status: HttpStatus.UNAUTHORIZED,
    message: 'login fail',
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token: refreshToken } = req.cookies;
    const restApiKey = process.env.REST_API_KEY;

    // Check refresh token on DB
    const [rows, _] = (await promisePool.execute(
      `SELECT * from USER WHERE refresh_token='${refreshToken}'`,
    )) as any[];

    var accessToken;

    if (rows.length) {
      const { user_id: userId, email, nickname } = rows[0];

      accessToken = genAccessToken({
        user_id: userId,
        email: email,
        nickname: nickname,
      });
    } else {
      const [rows, _] = (await promisePool.execute(
        `SELECT * from USER WHERE kakao_refresh_token='${refreshToken}'`,
      )) as any[];

      if (rows.length) {
        const data = {
          grant_type: 'refresh_token',
          client_id: restApiKey,
          refresh_token: refreshToken,
        };

        const kakaoToken = await axios.post(
          'https://kauth.kakao.com/oauth/token',
          data,
          {
            headers: {
              'Content-Type': ' application/x-www-form-urlencoded',
            },
          },
        );

        accessToken = kakaoToken.data.access_token;
      }
    }

    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: 'refresh success',
      access_token: accessToken,
    });
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

    const [rows, _] = (await promisePool.execute(
      `SELECT * from USER WHERE kakao_refresh_token='${refreshToken}'`,
    )) as any[];
    if (rows.length) {
      await promisePool.execute(
        `UPDATE USER SET refresh_token=NULL WHERE refresh_token='${refreshToken}';`,
      );
    } else {
      await promisePool.execute(
        `UPDATE USER SET refresh_token=NULL WHERE kakao_refresh_token='${refreshToken}';`,
      );
    }
    res.clearCookie('refresh_token');
  } catch (err) {}

  return res.status(HttpStatus.OK).json({
    status: HttpStatus.OK,
    message: 'logout success',
  });
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, user_pw: userPw, nickname } = req.body;

    // Validate user id & password & email
    const passwordReg = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$]{8,16}$/;
    const nicknameReg = /.{1,30}/;
    const emailReg = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (
      emailReg.test(email) &&
      passwordReg.test(userPw) &&
      (!nickname || nicknameReg.test(nickname))
    ) {
      const userPwHashed = hashPassword(userPw);

      const [rows, _] = (await promisePool.execute(
        `SELECT * from USER WHERE email='${email}' and is_kakao=FALSE`,
      )) as any[];

      if (rows.length) {
        return res.status(HttpStatus.CONFLICT).json({
          status: HttpStatus.CONFLICT,
          message: 'Account already exists',
        });
      }

      await promisePool.execute(
        `INSERT INTO USER (user_id, password, nickname, email, is_kakao) VALUES ('${email}', '${userPwHashed}', ${
          nickname ? `${mysql.escape(nickname)}` : 'NULL'
        }, '${email}','FALSE');`,
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
