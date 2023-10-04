import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';
import HttpStatus from 'http-status-codes';
import axios from 'axios';
import promisePool from '../db';

export interface IGetUserAuthInfoRequest extends Request {
  user?: {
    userId: string;
    email: string | null;
    nickname: string | null;
  };
}
export interface JwtPayload {
  user_id: string;
  email: string | null;
  nickname: string | null;
}

export const genAccessToken = (user: JwtPayload) => {
  return jwt.sign(user, config.jwt_secret, { expiresIn: '1m' });
};
export const genRefreshToken = () => {
  return uuidv4();
};
export const hashPassword = (passwd: string) => {
  return crypto
    .createHmac('sha256', config.pw_salt)
    .update(passwd)
    .digest('hex');
};

const authChecker = async (
  req: IGetUserAuthInfoRequest,
  res: Response,
  next: NextFunction,
) => {
  const accessToken = req.headers.authorization || 'noAccessToken';
  try {
    if (accessToken === 'noAccessToken') {
      return unauthorizedResponse(res, 'access token not found');
    }

    const user = jwt.verify(accessToken, config.jwt_secret);

    if (user) {
      const { user_id: userId, email, nickname } = user as JwtPayload;
      req.user = {
        userId,
        email,
        nickname,
      };
      return next();
    } else {
      return unauthorizedResponse(res, 'access token invalid');
    }
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return unauthorizedResponse(res, 'access token expired');
    } else if (err.name === 'JsonWebTokenError') {
      try {
        const kakaoUser = await axios.get('https://kapi.kakao.com/v2/user/me', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (kakaoUser.status === HttpStatus.OK) {
          const userEmail = kakaoUser.data.kakao_account.email;
          const [rows, _] = (await promisePool.execute(
            `SELECT bin_to_uuid(user_id, 1) AS userId, email, nickname from USER WHERE email='${userEmail}' AND is_kakao=TRUE`,
          )) as any[];

          if (!rows.length) {
            return unauthorizedResponse(res, 'access token invalid');
          }

          const { userId, email, nickname } = rows[0];
          req.user = {
            userId,
            email,
            nickname,
          };
          return next();
        } else {
          return unauthorizedResponse(res, 'access token invalid');
        }
      } catch (kakaoError) {
        return unauthorizedResponse(res, 'Kakao API error');
      }
    } else {
      return unauthorizedResponse(res, 'token auth failed');
    }
  }
};

function unauthorizedResponse(res: Response, message: string) {
  return res.status(HttpStatus.UNAUTHORIZED).json({
    status: HttpStatus.UNAUTHORIZED,
    message: message,
  });
}

export const authProtected = [authChecker];
export const authUnprotected: ((
  req: Request,
  res: Response,
  next: NextFunction,
) => void)[] = [];

export default {
  authProtected,
  authUnprotected,
};
