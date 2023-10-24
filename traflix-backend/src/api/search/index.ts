import express, { Request, Response, Router } from 'express';
import promisePool from '../../db';
import {
  IGetUserAuthInfoRequest,
  authProtected,
  authUnprotected,
} from '../../middlewares/auth';
import HttpStatus from 'http-status-codes';
import Axios from 'axios';

import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { setupCache } from 'axios-cache-interceptor';
const router: Router = express.Router();

const axios = setupCache(Axios);

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
        `SELECT stop_time, station_name, train_type,train_number, station_longitude, station_latitude
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
        `https://apis.data.go.kr/B551011/KorService1/detailCommon1?MobileOS=WIN&MobileApp=Traflix&_type=json&contentId=${id}&defaultYN=Y&mapinfoYN=Y&firstImageYN=Y&addrinfoYN=Y&overviewYN=Y&serviceKey=${process.env.GOVDATA_API_KEY}`,
      );
      const content = info.data.response.body.items.item[0];
      const returnData = {
        travelType: content.contenttypeid,
        img:
          content.firstimage !== '' ? content.firstimage : content.firstimage2,

        title: content.title,
        subtitle: '',
        mapx: content.mapx,
        mapy: content.mapy,
        load: content.addr1 !== '' ? content.addr1 : content.addr2,
        moreInfo: id,
      };

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'content info query success',
        data: returnData,
      });
    } catch (err) {
      console.error(err);
    }

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to content info',
    });
  },
);

router.post(
  '/myJourney',
  authProtected,
  async (req: IGetUserAuthInfoRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      // const [journeys] = await promisePool.execute(
      //   `SELECT BIN_TO_UUID(journey_id,1) AS journey_id
      // FROM JOURNEY JOIN USER USING(user_id)
      // WHERE user_id = UUID_TO_BIN(\'${userId}\',1)`,
      // );
      const [journeys] = await promisePool.execute(
        `SELECT BIN_TO_UUID(journey_id, 1) AS journey_id 
      FROM JOURNEY JOIN USER USING(user_id)`,
      );

      const promises = (journeys as any[]).map(async (journey) => {
        const [events] = await promisePool.execute(
          `SELECT
          DATE_FORMAT(J.journey_date,'%Y-%m-%d') AS journey_date, 
          E.schedule_order,
          E.is_train,
          E.content_id,
          SD.station_name AS departure_station_name,
          SD.station_longitude AS departure_station_longitude,
          SD.station_latitude AS departure_station_latitude,
          TS.departure_time,
          SA.station_name AS arrival_station_name,
          SA.station_longitude AS arrival_station_longitude,
          SA.station_latitude AS arrival_station_latitude,
          TS.arrival_time,
          T.train_type,
          T.train_number
          FROM traflix.JOURNEY J
          JOIN traflix.EVENT E ON J.journey_id = E.journey_id
          LEFT OUTER JOIN traflix.TRAIN_SCHEDULE TS ON E.train_schedule_id = TS.train_schedule_id
          LEFT OUTER JOIN traflix.STATION SD ON SD.station_id = TS.departure_station_id
          LEFT OUTER JOIN traflix.STATION SA ON SA.station_id = TS.arrival_station_id
          LEFT OUTER JOIN traflix.TRAIN T ON T.train_id = TS.train_id
          WHERE J.journey_id = UUID_TO_BIN(\'${journey.journey_id}\',1)
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
    } catch (err) {
      console.error(err);
    }

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to journey',
    });
  },
);

router.post(
  '/contentDetail',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { content_id: ContentId, content_type_id: contentTypeId } =
        req.body;

      const message = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/detailCommon1?ContentId=${ContentId}&serviceKey=${process.env.GOVDATA_API_KEY}&MobileOS=WIN&MobileApp=Traflix&_type=json&firstImageYN=Y&defaultYN=Y&overviewYN=Y&addrinfoYN=Y&areacodeYN=Y&overviewYN=Y&mapinfoYN=Y`,
      );

      const message2 = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/detailIntro1?contentId=${ContentId}&contentTypeId=${contentTypeId}&serviceKey=${process.env.GOVDATA_API_KEY}&numOfRows=10&pageNo=1&MobileOS=WIN&MobileApp=Traflix&_type=json`,
      );

      const content = message.data.response.body.items.item[0];
      const { contentid, contenttypeid, ...intro } =
        message2.data.response.body.items.item[0];

      const urlRegex = /(https?:\/\/[^"]*)/gi;
      const input = content.homepage;
      const hompageUrl = input === '' ? '정보 없음' : input.match(urlRegex)[0];

      const overviewRep = content.overview.replace(/<[^>]*>?/g, '');

      const detail = {
        title: content.title === '' ? '정보 없음' : content.title,
        tel: content.tel === '' ? '정보 없음' : content.tel,
        zipcode: content.zipcode === '' ? '정보 없음' : content.zipcode,
        telname: content.telname === '' ? '정보 없음' : content.telname,
        homepage: hompageUrl, // 홈페이지
        img: content.firstimage === '' ? '정보 없음' : content.firstimage,
        addr: content.addr1 === '' ? '정보 없음' : content.addr1,
        overview: overviewRep === '' ? '정보 없음' : overviewRep,
        contentType: contenttypeid,
        intro: intro,
      };

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'content detail information',
        detail: detail,
      });
    } catch (err) {
      console.error(err);
    }

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to detail',
    });
  },
);

router.post(
  '/findPath',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      interface RequestBody {
        station_code_dep: string;
        station_code_arr: string;
        datetime_dep: string;
        taste: string[];
      }

      const {
        station_code_dep: stationCodeDep,
        station_code_arr: stationCodeArr,
        datetime_dep: datetimeDep,
        taste: tasteList,
      }: RequestBody = req.body;

      const date = new Date(datetimeDep);

      const convertTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const startdata = datetimeDep.substring(0, 10);

      // 요일을 추출 (0: 일요일, 1: 월요일, ..., 6: 토요일)
      const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayOfWeek = daysOfWeek[date.getDay()];
      const pathDataResponse = await axios.post(
        `https://delvlhfpab.execute-api.ap-northeast-2.amazonaws.com/default/Traflix-findPath`,
        {
          Dep: stationCodeDep,
          Arr: stationCodeArr,
          Time: convertTime,
          Day: dayOfWeek,
          Weight: {
            weight_type12: tasteList.includes('12') ? 1 : 0,
            weight_type14: tasteList.includes('14') ? 1 : 0,
            weight_type15: tasteList.includes('15') ? 1 : 0,
            weight_type28: tasteList.includes('28') ? 1 : 0,
            weight_type32: tasteList.includes('32') ? 1 : 0,
            weight_type38: tasteList.includes('38') ? 1 : 0,
            weight_type39: tasteList.includes('39') ? 1 : 0,
          },
        },
      );
      const content = pathDataResponse.data;

      let result = [];
      for (let i = 0; i < 5; i++) {
        const tourStationName = content.body[i].TourStation;
        let pathArr = content.body[i].Path;
        let train = [];
        for (let path of pathArr) {
          const [deptQ] = await promisePool.execute(
            `SELECT station_name, station_longitude, station_latitude
          FROM traflix.STATION
          WHERE station_name = \'${path.DeptStation}\'`,
          );
          const [arrQ] = await promisePool.execute(
            `SELECT station_name, station_longitude, station_latitude
          FROM traflix.STATION
          WHERE station_name = \'${path.ArrStation}\'`,
          );
          path.DeptLong = (deptQ as RowDataPacket[])[0].station_longitude;
          path.DeptLat = (deptQ as RowDataPacket[])[0].station_latitude;
          path.ArrLong = (arrQ as RowDataPacket[])[0].station_longitude;
          path.ArrLat = (arrQ as RowDataPacket[])[0].station_latitude;

          train.push(path);
        }

        const [tourSpotrows] = await promisePool.execute(
          `SELECT station_name, station_longitude, station_latitude
          FROM traflix.STATION
          WHERE station_name = \'${tourStationName}\'`,
        );
        const tourSpotTmp = (tourSpotrows as any[]).map((row) => row);

        const tourSpotmessage = await axios.get(
          `https://apis.data.go.kr/B551011/KorService1/locationBasedList1?serviceKey=${process.env.GOVDATA_API_KEY}&numOfRows=4000&pageNo=1&MobileOS=WIN&MobileApp=Traflix&_type=json&listYN=Y&arrange=O&mapX=${tourSpotTmp[0].station_longitude}&mapY=${tourSpotTmp[0].station_latitude}&radius=5000`,
        );

        const tourSpotcontent = tourSpotmessage.data.response.body.items.item;
        const tourSpotPlaces: { [key: string]: {}[] } = {
          '12': [],
          '14': [],
          '15': [],
          '28': [],
          '32': [],
          '38': [],
          '39': [],
        };

        (tourSpotcontent as any[]).map((info) => {
          const t: string = info.contenttypeid;

          if (t in tourSpotPlaces) {
            tourSpotPlaces[t].push({
              title: info.title,
              contentid: info.contentid,
              contenttypeid: info.contenttypeid,
              firstimage: info.firstimage,
              mapx: info.mapx,
              mapy: info.mapy,
              dist: info.dist,
              addr1: info.addr1,
            });
          }
        });

        const divideToureSpot: any[][] = [];
        if (tasteList.length !== 0) {
          if (tasteList.length > 3) {
            tasteList.map((taste: string) => {
              divideToureSpot.push(tourSpotPlaces[taste].slice(0, 1));
            });
          } else if (tasteList.length == 3) {
            tasteList.map((taste: string) => {
              divideToureSpot.push(tourSpotPlaces[taste].slice(0, 2));
            });
          } else {
            tasteList.map((taste: string) => {
              divideToureSpot.push(tourSpotPlaces[taste].slice(0, 3));
            });
          }
        } else {
          var tasteSelect: string[] = [
            '12',
            '14',
            '15',
            '28',
            '32',
            '38',
            '39',
          ];
          tasteSelect.map((taste: string) => {
            divideToureSpot.push(tourSpotPlaces[taste].slice(0, 1));
          });
        }

        var cnt = 0;
        const route = [];

        route.push({
          content_id: '',
          is_train: 1,
          journey_date: startdata,
          schedule_order: cnt,
          station_id: null,
          station_latitude: train[0].DeptLat,
          station_longitude: train[0].DeptLong,
          station_name: train[0].DeptStation,
          stop_time: train[0].DeptTime,
          train_id: null,
          train_number: train[0].TrainNumber,
          train_schedule_id: null,
          train_type: train[0].TrainType,
        });
        cnt++;
        route.push({
          content_id: '',
          is_train: 1,
          journey_date: startdata,
          schedule_order: cnt,
          station_id: null,
          station_latitude: train[0].ArrLat,
          station_longitude: train[0].ArrLong,
          station_name: train[0].ArrStation,
          stop_time: train[0].ArrTime,
          train_id: null,
          train_number: train[0].TrainNumber,
          train_schedule_id: null,
          train_type: train[0].TrainType,
        });
        cnt++;

        for (let j = 0; j < divideToureSpot.length; j++) {
          divideToureSpot[j].map((contents) => {
            route.push({
              content_id: contents.contentid,
              is_train: 0,
              journey_date: startdata,
              schedule_order: cnt,
              station_id: null,
              station_latitude: null,
              station_longitude: null,
              station_name: null,
              stop_time: null,
              train_id: null,
              train_number: null,
              train_schedule_id: null,
              train_type: null,
              content: contents,
            });
            cnt++;
          });
        }

        route.push({
          content_id: '',
          is_train: 1,
          journey_date: startdata,
          schedule_order: cnt,
          station_id: null,
          station_latitude: train[1].DeptLat,
          station_longitude: train[1].DeptLong,
          station_name: train[1].DeptStation,
          stop_time: train[1]['DeptTime'],
          train_id: null,
          train_number: train[1].TrainNumber,
          train_schedule_id: null,
          train_type: train[1].TrainType,
        });
        cnt++;
        route.push({
          content_id: '',
          is_train: 1,
          journey_date: startdata,
          schedule_order: cnt,
          station_id: null,
          station_latitude: train[1].ArrLat,
          station_longitude: train[1].ArrLong,
          station_name: train[1].ArrStation,
          stop_time: train[1].ArrTime,
          train_id: null,
          train_number: train[1].TrainNumber,
          train_schedule_id: null,
          train_type: train[0].TrainType,
        });
        cnt++;

        result.push(route);
      }

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'station info success',
        data: result,
      });
    } catch (err) {
      console.error(err);
    }

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to station info',
    });
  },
);

router.post(
  '/stationTourSpotInfo',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { station_code: station_code } = req.body;

      const [rows] = await promisePool.execute(
        `SELECT station_longitude, station_latitude
        FROM traflix.STATION
        WHERE station_code = \'${station_code}\'`,
      );
      const tmp = (rows as any[]).map((row) => row);

      const message = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/locationBasedList1?
        serviceKey=${process.env.GOVDATA_API_KEY}&numOfRows=4000&pageNo=1&MobileOS=WIN&MobileApp=Traflix&_type=json&listYN=Y&arrange=O&mapX=${tmp[0].station_longitude}&mapY=${tmp[0].station_latitude}&radius=5000`,
      );

      const content = message.data.response.body.items.item;
      const places: { [key: string]: {}[] } = {
        '12': [],
        '14': [],
        '15': [],
        '28': [],
        '32': [],
        '38': [],
        '39': [],
      };

      (content as any[]).map((info) => {
        const t: string = info.contenttypeid;

        if (t in places) {
          places[t].push({
            title: info.title,
            contentid: info.contentid,
            contenttypeid: info.contenttypeid,
            firstimage: info.firstimage,
            mapx: info.mapx,
            mapy: info.mapy,
            dist: info.dist,
            addr1: info.addr1,
          });
        }
      });

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'station info success',
        data: places,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to station info',
    });
  },
);

router.post(
  '/saveJourney',
  authProtected,
  async (req: IGetUserAuthInfoRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { summaryData: summaryData, cardData: cardData } = req.body;
      const journeyDate = summaryData.journeyDate;

      // 데이터 미리보기
      // console.log(`summary`);
      // console.log(summaryData);
      // console.log(cardData);

      const connection = await promisePool.getConnection();

      // 출발역 uuid
      const [departureStationRows] = await connection.execute(
        `
      SELECT BIN_TO_UUID(station_id, 1) AS station_id
      FROM traflix.STATION
      WHERE station_name = ?
      `,
        [summaryData.summaryData.at(0).place],
      );
      const departureStationId = (departureStationRows as any)[0].station_id;
      console.log(departureStationId);

      // 경유역 uuid
      const [midStationRows] = await connection.execute(
        `
      SELECT BIN_TO_UUID(station_id, 1) AS station_id
      FROM traflix.STATION
      WHERE station_name = ?
      `,
        [summaryData.summaryData.at(1).place],
      );
      const midStationId = (midStationRows as any)[0].station_id;
      console.log(midStationId);

      // 도착역 uuid
      const [arrivalStationRows] = await connection.execute(
        `
      SELECT BIN_TO_UUID(station_id, 1) AS station_id
      FROM traflix.STATION
      WHERE station_name = ?
      `,
        [summaryData.summaryData.at(-1).place],
      );
      const arrivalStationId = (arrivalStationRows as any)[0].station_id;
      console.log(arrivalStationId);

      const journeyId = uuidv4();
      const [rows] = await connection.execute(
        `
        INSERT INTO traflix.JOURNEY
        (journey_id, user_id, journey_date, journey_theme, arrival_station_id, departure_station_id)
        VALUES (UUID_TO_BIN(?, 1), UUID_TO_BIN(?, 1), ?, ?, UUID_TO_BIN(?,1), UUID_TO_BIN(?,1))
      `,
        [
          journeyId,
          userId,
          journeyDate,
          {},
          arrivalStationId,
          departureStationId,
        ],
      );

      var flag = false;

      cardData.map(
        async (
          data: {
            isTrain: boolean;
            moreInfo: string;
            trainNumber: number;
            departureStation: string;
            arrivalStation: string;
            departureTime: string;
            arrivalTime: string;
          },
          index: number,
        ) => {
          if (data.isTrain) {
            const stationId = uuidv4();
            const trainNumber = data.trainNumber;
            const [trainRows] = await connection.execute(
              `SELECT BIN_TO_UUID(train_id, 1) AS train_id FROM traflix.TRAIN WHERE train_number = ${trainNumber}`,
            );
            const trainId = (trainRows as any)[0].train_id;

            if (flag) {
              await connection.execute(
                `INSERT INTO traflix.TRAIN_SCHEDULE (train_schedule_id, train_id, departure_station_id, arrival_station_id, departure_time, arrival_time) VALUES (UUID_TO_BIN("${stationId}", 1), UUID_TO_BIN("${trainId}", 1), UUID_TO_BIN("${midStationId}", 1), UUID_TO_BIN("${arrivalStationId}", 1), "${data.departureTime}", "${data.arrivalTime}")`,
              );
            } else {
              flag = true;
              await connection.execute(
                `INSERT INTO traflix.TRAIN_SCHEDULE (train_schedule_id, train_id, departure_station_id, arrival_station_id, departure_time, arrival_time) VALUES (UUID_TO_BIN("${stationId}", 1), UUID_TO_BIN("${trainId}", 1), UUID_TO_BIN("${departureStationId}", 1), UUID_TO_BIN("${midStationId}", 1), "${data.departureTime}", "${data.arrivalTime}")`,
              );
            }
            await connection.execute(
              `INSERT INTO traflix.EVENT (user_id, journey_id, schedule_order, is_train, content_id, train_schedule_id) VALUES (UUID_TO_BIN("${userId}", 1), UUID_TO_BIN("${journeyId}", 1), ${index}, 1, '${''}', UUID_TO_BIN("${stationId}", 1))`,
            );
          } else {
            const [rows] = await connection.execute(
              `INSERT INTO traflix.EVENT (user_id, journey_id, schedule_order, is_train, content_id, train_schedule_id) VALUES (UUID_TO_BIN("${userId}", 1), UUID_TO_BIN("${journeyId}", 1), ${index}, 0, "${
                data.moreInfo
              }", ${null})`,
            );
          }
        },
      );
      connection.release();

      return res.status(HttpStatus.CREATED).json({
        status: HttpStatus.CREATED,
        message: 'save journey query success',
      });
    } catch (err) {
      console.log(err);
      return res.status(HttpStatus.BAD_REQUEST).json({
        status: HttpStatus.BAD_REQUEST,
        message: 'fail post to save journey',
      });
    }
  },
);

module.exports = router;
