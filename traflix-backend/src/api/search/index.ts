import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import { authProtected, authUnprotected } from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';
import axios from 'axios';
const router: Router = express.Router();

router.get(
  '/stationName',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const [rows, _] = await promisePool.execute(
        'SELECT station_name, station_code FROM traflix.STATION ORDER BY station_name;',
      );

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'station name query success',
        data: rows,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to station name',
    });
  },
);

router.post(
  '/trainSchedule',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { id: id } = req.body;
      const [rows] = await promisePool.execute(
        `SELECT stop_time, station_name, train_type ,train_number 
      FROM traflix.TRAIN_SCHEDULE 
      JOIN traflix.STATION USING(station_id)
      JOIN traflix.TRAIN USING(train_id)
      WHERE train_schedule_id = UUID_TO_BIN(\'${id}\',1)`,
      );

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'train schedule query success',
        data: rows,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to train schedule',
    });
  },
);
router.post(
  '/contentInfo',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { id: id } = req.body;
      const info = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/detailCommon1?MobileOS=WIN&MobileApp=Traflix&_type=json&contentId=${id}&defaultYN=Y&firstImageYN=Y&addrinfoYN=Y&overviewYN=Y&serviceKey=mRCjfx%2BzLMfb%2BHlosj2iGII4%2BCNjakj51fc6DJbyyruQdovWvNxP3se8%2B%2Bcqyc6cbPqwK%2B5q3xL0cAzwo%2BaO6A%3D%3D`,
      );
      const content = info.data.response.body.items.item[0];
      const returnData = {
        travelType: content.contenttypeid,
        img:
          content.firstimage !== '' ? content.firstimage : content.firstimage2,

        title: content.title,
        subtitle: '',
        load: content.addr1 !== '' ? content.addr1 : content.addr2,
        moreInfo: '',
      };

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'content info query success',
        data: returnData,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to content info',
    });
  },
);

router.post(
  '/myJourney',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { email: email } = req.body;
      const [journeys] = await promisePool.execute(
        `SELECT BIN_TO_UUID(journey_id,1) AS journey_id 
      FROM JOURNEY JOIN USER USING(user_id) 
      WHERE email = \'${email}\'`,
      );
      const promises = (journeys as any[]).map(async (journey) => {
        const [events] = await promisePool.execute(
          `SELECT DATE_FORMAT(journey_date,'%Y-%m-%d') AS journey_date, 
        schedule_order, is_train, content_id, 
        BIN_TO_UUID(train_schedule_id,1) AS train_schedule_id
        FROM JOURNEY JOIN EVENT USING (journey_id)
        WHERE journey_id = UUID_TO_BIN(\'${journey.journey_id}\',1) 
        ORDER BY schedule_order`,
        );

        return events;
      });
      const returnData = await Promise.all(promises);

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'whole schedule query success',
        data: returnData,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to journey',
    });
  },
);

module.exports = router;
