import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import { authProtected, authUnprotected } from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';
import { UUID } from 'crypto';

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
router.post(
  '/myJourney',
  authUnprotected,
  async (req: Request, res: Response) => {
    const { email: email } = req.body;
    const [journeys] = await promisePool.execute(
      `SELECT journey_id FROM JOURNEY JOIN USER USING(user_id) WHERE email = \'${email}\'`,
    );
    const promises = (journeys as any[]).map(async (journey) => {
      const [events] = await promisePool.execute(
        `SELECT * FROM JOURNEY JOIN EVENT USING(journey_id) WHERE journey_id = \'${journey.journey_id}\'`,
      );
      console.log(journey.journey_id);
      console.log(events);

      return events;
    });
    const returnData = await Promise.all(promises);

    return res.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: 'whole schedule query success',
      data: journeys,
    });
  },
);

module.exports = router;
