import express, { Request, Response, Router } from 'express';
import HttpStatus from 'http-status-codes';
import promisePool from '../../db';
import axios from 'axios';

const router: Router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const restApiKey = process.env.REST_API_KEY;
    const uri = process.env.REDIRECT_URI;

    const data = {
      grant_type: 'authorization_code',
      client_id: restApiKey,
      redirect_uri: uri,
      code: code,
    };
    const header = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: 'Bearer ',
    };

    const kakaoToken = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      data,
      { headers: header },
    );

    const accessToken = kakaoToken.data.access_token;
    const refreshToken = kakaoToken.data.refresh_token;

    // await promisePool.execute(
    //   `UPDATE USER SET refresh_token='${refreshToken}' WHERE user_id='${userId}';`,
    // );

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      ...{
        maxAge: 2592000000, // remember for 30 days
      },
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

    const data = {
      grant_type: 'authorization_code',
      client_id: restApiKey,
      refresh_token: refreshToken,
    };
    const header = {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: 'Bearer ',
    };

    const kakaoToken = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      data,
      { headers: header },
    );

    const accessToken = kakaoToken.data.access_token;

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

module.exports = router;
