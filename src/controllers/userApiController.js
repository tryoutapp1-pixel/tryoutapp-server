const service=require('../services/userApiService');
const wrap=(fn)=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const user=req=>req.user.id;
module.exports={
 offer:wrap(async(req,res)=>res.json({success:true,data:await service.offer()})),
 subscription:wrap(async(req,res)=>res.json({success:true,data:await service.getSubscription(user(req))})),
 createPayment:wrap(async(req,res)=>res.status(201).json({success:true,data:await service.createPayment(user(req))})),
 history:wrap(async(req,res)=>res.json({success:true,data:await service.transactionHistory(user(req),req.query)})),
 notification:wrap(async(req,res)=>res.json({success:true,data:await service.midtransNotification(req.body)})),
 materials:wrap(async(req,res)=>res.json({success:true,data:await service.listMaterials(user(req),req.query)})),
 material:wrap(async(req,res)=>res.json({success:true,data:await service.materialDetail(user(req),req.params.id)})),
 assessments: type=>wrap(async(req,res)=>res.json({success:true,data:await service.assessmentList(user(req),type,req.query)})),
 assessment:type=>wrap(async(req,res)=>res.json({success:true,data:await service.assessmentDetail(user(req),type,req.params.assessmentId)})),
 start:type=>wrap(async(req,res)=>res.status(201).json({success:true,data:await service.startAttempt(user(req),type,req.params.assessmentId)})),
 attempt:wrap(async(req,res)=>res.json({success:true,data:await service.getAttempt(user(req),req.params.attemptId)})),
 answer:wrap(async(req,res)=>res.json({success:true,data:await service.saveAnswer(user(req),req.params.attemptId,req.body.question_id,req.body.selected_option_id)})),
 submit:wrap(async(req,res)=>res.json({success:true,data:await service.submitAttempt(user(req),req.params.attemptId)})),
 result:type=>wrap(async(req,res)=>res.json({success:true,data:await service.result(user(req),type,req.params.attemptId)})),
 explanations:type=>wrap(async(req,res)=>res.json({success:true,data:await service.explanations(user(req),type,req.params.assessmentId)})),
 feedback:wrap(async(req,res)=>res.status(201).json({success:true,data:await service.createFeedback(user(req),req.params.assessmentId,req.body)})),
 statistics:wrap(async(req,res)=>res.json({success:true,data:await service.statistics(user(req))}))
};
