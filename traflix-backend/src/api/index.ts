import express, { Router } from 'express';

const router: Router = express.Router();

router.use('/mock', require('./mock'));
router.use('/auth', require('./auth'));
router.use('/user', require('./user'));
router.use('/kakao', require('./kakaoLog'));

module.exports = router;
