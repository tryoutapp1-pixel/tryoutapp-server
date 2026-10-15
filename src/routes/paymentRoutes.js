const router=require('express').Router();
const controller=require('../controllers/userApiController');
const {validateRequest}=require('../middlewares/errorHandler');
const validators=require('../validators/userApiValidators');
router.post('/midtrans/notification',validators.notification,validateRequest,controller.notification);
module.exports=router;
