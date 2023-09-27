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
  '/contentDetail',
  authUnprotected,
  async (req: Request, res: Response) => {
    try {
      const { content_id: ContentId } = req.body;

      const message = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/detailCommon1?ContentId=${ContentId}&serviceKey=mRCjfx%2BzLMfb%2BHlosj2iGII4%2BCNjakj51fc6DJbyyruQdovWvNxP3se8%2B%2Bcqyc6cbPqwK%2B5q3xL0cAzwo%2BaO6A%3D%3D&MobileOS=WIN&MobileApp=Traflix&_type=json&firstImageYN=Y&defaultYN=Y&overviewYN=Y&addrinfoYN=Y&areacodeYN=Y&overviewYN=Y&mapinfoYN=Y`,
      );

      const content = message.data.response.body.items.item[0];
      const contentType = content.contenttypeid;

      const message2 = await axios.get(
        `https://apis.data.go.kr/B551011/KorService1/detailIntro1?contentId=${ContentId}&contentTypeId=${contentType}&serviceKey=mRCjfx%2BzLMfb%2BHlosj2iGII4%2BCNjakj51fc6DJbyyruQdovWvNxP3se8%2B%2Bcqyc6cbPqwK%2B5q3xL0cAzwo%2BaO6A%3D%3D&numOfRows=10&pageNo=1&MobileOS=WIN&MobileApp=Traflix&_type=json`,
      );

      const { contentid, contenttypeid, ...intro } =
        message2.data.response.body.items.item[0];

      const urlRegex = /(https?:\/\/[^"]*)/gi;
      const input = content.homepage;
      const hompageUrl = input.match(urlRegex)[0];

      const detail = {
        title: content.title, // 제목
        tel: content.tel, // 전화번호
        zipcode: content.zipcode, // 우편번호
        telname: content.telname, // 전화명
        homepage: hompageUrl, // 홈페이지
        img:
          content.firstimage !== '' ? content.firstimage : content.firstimage2,
        addr: content.addr1 !== '' ? content.addr1 : content.addr2,
        overview: content.overview,
        contentType: contenttypeid,
        intro: intro,
      };

      return res.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'content detail information',
        detail: detail,
      });
    } catch (err) {}

    return res.status(HttpStatus.NOT_FOUND).json({
      status: HttpStatus.NOT_FOUND,
      message: 'fail load to detail',
    });
  },
);

module.exports = router;
