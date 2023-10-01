import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import { authProtected, authUnprotected } from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';

const router: Router = express.Router();

router.get(
  '/stationName',
  authUnprotected,
  async (req: Request, res: Response) => {
    const [rows, _] = await promisePool.execute(
      'SELECT station_name, station_code FROM traflix.STATION ORDER BY station_name;',
    );

    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: 'station name query success',
      data: rows,
    });
  },
);
router.get(
  '/wholeSchedule',
  authUnprotected,
  async (req: Request, res: Response) => {
    const { email: email } = req.body;
    const [rows, _] = await promisePool.execute(
      `SELECT * FROM traflix.JOURNEY JOIN traflix.EVENT USING(journey_id)JOIN traflix.USER WHERE traflix.JOURNEY.user_id = traflix.USER.user_idAND email = ${email}GROUP BY journey_date;`,
    );

    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: 'station name query success',
      data: rows,
    });
  },
);

module.exports = router;
