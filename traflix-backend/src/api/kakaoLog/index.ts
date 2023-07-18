import express, { Request, Response, Router } from 'express';
import HttpStatus from 'http-status-codes';

const router: Router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
  } catch (err) {}

  return res.status(HttpStatus.UNAUTHORIZED).json({
    status: HttpStatus.UNAUTHORIZED,
    message: 'login fail',
  });
});

module.exports = router;
