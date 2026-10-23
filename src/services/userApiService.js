const crypto = require('node:crypto');
const pool = require('../config/database');
const { env } = require('../config/env');
const storage = require('./fileStorageService');
const ApiError = require('../utils/ApiError');

const midtrans = require('midtrans-client');
const snap = new midtrans.Snap({ isProduction: env.midtrans.isProduction, serverKey: env.midtrans.serverKey, clientKey: env.midtrans.clientKey });
const pages = ({ page = 1, limit = 20 }) => ({ page: Number(page), limit: Number(limit), offset: (Number(page) - 1) * Number(limit) });
const pageResult = (items, page, limit, total) => ({ items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });

async function subscription(executor, userId, lock = false) {
  const [[row]] = await executor.execute(`SELECT * FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [userId]);
  if (!row) throw new ApiError(409, 'Subscription record is missing');
  const premium = row.status === 'PREMIUM' && row.expired_at && new Date(row.expired_at) > new Date();
  return { ...row, effectiveStatus: premium ? 'PREMIUM' : 'FREE' };
}
async function checkAccess(executor, userId, accessType) {
  if (accessType === 'PREMIUM' && (await subscription(executor, userId)).effectiveStatus !== 'PREMIUM') throw new ApiError(403, 'Premium subscription is required');
}
async function offer() {
  return [
    {
      name: "Free",
      title: "Tryout App Free",
      price: 0,
      currency: "IDR",
      duration_days: 999,
      duration_description: "Selamanya",
    },
    
    {
      name: "Premium",
      title: "Tryout App Premium",
      price: env.premiumPrice,
      currency: "IDR",
      duration_days: env.premiumDurationDays,
      duration_description: `${env.premiumDurationDays} hari`,
    }
]; 
}
async function getSubscription(userId) { const s = await subscription(pool, userId); return { status: s.effectiveStatus, started_at: s.started_at, expired_at: s.expired_at }; }

async function createPayment(userId) {
  if (!env.midtrans.serverKey || !env.midtrans.clientKey) throw new ApiError(503, 'Midtrans is not configured');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await subscription(connection, userId, true); // Serialize concurrent payment creation per user.
    const [[existing]] = await connection.execute("SELECT * FROM transactions WHERE user_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [userId]);
    if (existing) {
      try {
        const remote = await snap.transaction.status(existing.order_id);
        if (remote.transaction_status === 'pending') {
          const token = existing.snap_token ? { token: existing.snap_token } : await snap.createTransaction({ transaction_details: { order_id: existing.order_id, gross_amount: Number(existing.amount) } });
          if (!existing.snap_token) await connection.execute('UPDATE transactions SET snap_token = ? WHERE id = ?', [token.token, existing.id]);
          await connection.commit();
          return { order_id: existing.order_id, transaction_id: existing.id, snap_token: token.token, amount: Number(existing.amount), currency: 'IDR', status: existing.status };
        }
        const terminal = { expire: 'EXPIRED', cancel: 'CANCELLED', deny: 'FAILED', failure: 'FAILED' }[remote.transaction_status];
        if (!terminal) throw new ApiError(409, 'Existing payment is awaiting Midtrans confirmation');
        await connection.execute('UPDATE transactions SET status = ?, midtrans_transaction_status = ? WHERE id = ? AND status = \'PENDING\'', [terminal, remote.transaction_status, existing.id]);
      } catch (error) {
        if (error.statusCode !== 404 && error.httpStatusCode !== 404) throw error;
        await connection.execute("UPDATE transactions SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'", [existing.id]);
      }
    }
    const orderId = `PREM-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const [result] = await connection.execute("INSERT INTO transactions (user_id, order_id, amount, status) VALUES (?, ?, ?, 'PENDING')", [userId, orderId, env.premiumPrice]);
    const token = await snap.createTransaction({ transaction_details: { order_id: orderId, gross_amount: env.premiumPrice }, credit_card: { secure: true } });
    await connection.execute('UPDATE transactions SET snap_token = ? WHERE id = ?', [token.token, result.insertId]);
    await connection.commit();
    return { order_id: orderId, transaction_id: result.insertId, snap_token: token.token, amount: env.premiumPrice, currency: 'IDR', status: 'PENDING' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function transactionHistory(userId, query) {
  const { page, limit, offset } = pages(query);
  const [items] = await pool.execute('SELECT order_id, amount, status, payment_method, created_at, updated_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [userId, limit, offset]);
  const [[{ total }]] = await pool.execute('SELECT COUNT(*) total FROM transactions WHERE user_id = ?', [userId]);
  return pageResult(items, page, limit, total);
}
async function midtransNotification(body) {
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature, transaction_status: remoteStatus, fraud_status: fraudStatus } = body || {};
  if (![orderId, statusCode, grossAmount, remoteStatus].every((v) => typeof v === 'string' && v.length)) throw new ApiError(400, 'Invalid Midtrans notification payload');
  if (!env.midtrans.serverKey) throw new ApiError(503, 'Midtrans is not configured');
  const expected = crypto.createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${env.midtrans.serverKey}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new ApiError(401, 'Invalid Midtrans signature');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[tx]] = await connection.execute('SELECT * FROM transactions WHERE order_id = ? FOR UPDATE', [orderId]);
    if (!tx) throw new ApiError(404, 'Transaction not found');
    if (Number(grossAmount) !== Number(tx.amount)) throw new ApiError(400, 'Notification amount does not match transaction');
    const success = remoteStatus === 'settlement' || (remoteStatus === 'capture' && fraudStatus === 'accept');
    let status = success ? 'PAID' : ({ pending: 'PENDING', deny: 'FAILED', cancel: 'CANCELLED', expire: 'EXPIRED', failure: 'FAILED', refund: 'PAID', partial_refund: 'PAID' }[remoteStatus] || 'PENDING');
    if (tx.status === 'PAID') status = 'PAID';
    const newlyPaid = success && tx.status !== 'PAID';
    await connection.execute('UPDATE transactions SET status = ?, payment_method = COALESCE(?, payment_method), midtrans_transaction_id = COALESCE(?, midtrans_transaction_id), midtrans_transaction_status = ?, paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, NOW()) ELSE paid_at END WHERE id = ?', [status, body.payment_type || null, body.transaction_id || null, remoteStatus, newlyPaid ? 1 : 0, tx.id]);
    if (newlyPaid) {
      const s = await subscription(connection, tx.user_id, true);
      const now = new Date();
      const activeUntil = s.effectiveStatus === 'PREMIUM' ? new Date(s.expired_at) : new Date(now.getTime());
      const start = s.effectiveStatus === 'PREMIUM' ? new Date(s.started_at) : new Date(now.getTime());
      activeUntil.setDate(activeUntil.getDate() + env.premiumDurationDays);
      await connection.execute("UPDATE subscriptions SET status = 'PREMIUM', started_at = ?, expired_at = ? WHERE id = ?", [start, activeUntil, s.id]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
  return { received: true };
}

async function listMaterials(userId, query) {
  const { page, limit, offset } = pages(query); const premium = (await subscription(pool, userId)).effectiveStatus === 'PREMIUM';
  const access = premium ? "m.access_type IN ('FREE','PREMIUM')" : "m.access_type = 'FREE'";
  const [items] = await pool.execute(`SELECT m.id,m.title,m.description,m.access_type,m.created_at,m.updated_at FROM materials m WHERE m.is_released = 1 AND ${access} ORDER BY m.created_at DESC,m.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) total FROM materials m WHERE m.is_released = 1 AND ${access}`);
  return pageResult(items, page, limit, total);
}
async function materialDetail(userId, id) {
  const [[row]] = await pool.execute('SELECT m.id,m.title,m.description,m.access_type,m.is_released,m.created_at,m.updated_at,a.id attachment_id,a.original_name,a.mime_type,a.file_size,a.object_key,a.created_at file_created_at FROM materials m JOIN attachments a ON a.id=m.attachment_id WHERE m.id=?', [id]);
  if (!row || !row.is_released) throw new ApiError(404, 'Material not found');
  await checkAccess(pool, userId, row.access_type);
  const file = { id: row.attachment_id, original_filename: row.original_name, mime_type: row.mime_type, size: row.file_size, created_at: row.file_created_at, url: row.object_key ? await storage.getSignedUrl(row.object_key, 60) : null };
  const { attachment_id, original_name, mime_type, file_size, object_key, file_created_at, ...material } = row;
  return { ...material, file };
}
async function assessmentList(userId, type, query) {
  const { page, limit, offset } = pages(query); const premium = (await subscription(pool, userId)).effectiveStatus === 'PREMIUM';
  const access = premium ? "a.access_type IN ('FREE','PREMIUM')" : "a.access_type='FREE'";
  const [items] = await pool.execute(`SELECT a.id,a.title,a.description,a.type,a.access_type,a.duration_minutes,COUNT(q.id) question_count FROM assessments a LEFT JOIN question_packages qp ON qp.assessment_id=a.id LEFT JOIN questions q ON q.question_package_id=qp.id WHERE a.type=? AND a.is_released=1 AND ${access} GROUP BY a.id ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`, [type,limit,offset]);
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) total FROM assessments a WHERE a.type=? AND a.is_released=1 AND ${access}`, [type]);
  return pageResult(items,page,limit,total);
}
async function assessmentDetail(userId,type,id) {
  const [[row]] = await pool.execute('SELECT a.id,a.title,a.description,a.type,a.access_type,a.duration_minutes,a.passing_score_twk,a.passing_score_tiu,a.passing_score_tkp,a.is_released,qp.id question_package_id,(SELECT COUNT(*) FROM questions q WHERE q.question_package_id=qp.id) question_count FROM assessments a JOIN question_packages qp ON qp.assessment_id=a.id WHERE a.id=? AND a.type=?', [id,type]);
  if (!row || !row.is_released) throw new ApiError(404,'Assessment not found');
  await checkAccess(pool,userId,row.access_type); delete row.is_released; delete row.question_package_id; return row;
}
async function loadAttempt(userId,id,lock=false,executor=pool) {
  const [[row]] = await executor.execute(`SELECT at.*,a.type,a.access_type,a.is_released,a.duration_minutes FROM attempts at JOIN assessments a ON a.id=at.assessment_id WHERE at.id=? AND at.user_id=?${lock?' FOR UPDATE':''}`, [id,userId]);
  if (!row) throw new ApiError(404,'Attempt not found');
  if (row.status === 'IN_PROGRESS') {
    if (!row.is_released) throw new ApiError(404,'Assessment not found');
  await checkAccess(executor,userId,row.access_type);
  }
  return row;
}
async function startAttempt(userId,type,id) {
  const connection=await pool.getConnection();
  try { await connection.beginTransaction();
    const [[a]] = await connection.execute('SELECT a.*,qp.id question_package_id FROM assessments a JOIN question_packages qp ON qp.assessment_id=a.id WHERE a.id=? AND a.type=? AND a.is_released=1 FOR UPDATE',[id,type]);
    if(!a) throw new ApiError(404,'Assessment not found'); await checkAccess(connection,userId,a.access_type);
    const [[current]] = await connection.execute("SELECT * FROM attempts WHERE user_id=? AND assessment_id=? AND status='IN_PROGRESS' ORDER BY id DESC LIMIT 1 FOR UPDATE",[userId,id]);
    if(current) { await connection.commit(); return attemptState(current); }
    const now=new Date(); const expires=type==='TRYOUT'?new Date(now.getTime()+Number(a.duration_minutes)*60000):null;
    const [res]=await connection.execute("INSERT INTO attempts (user_id,assessment_id,question_package_id,started_at,expired_at,status) VALUES (?,?,?,?,?,'IN_PROGRESS')",[userId,id,a.question_package_id,now,expires]);
    await connection.commit(); return attemptState({id:res.insertId,user_id:userId,assessment_id:id,question_package_id:a.question_package_id,started_at:now,expired_at:expires,status:'IN_PROGRESS',type});
  } catch(e){await connection.rollback();throw e;} finally{connection.release();}
}
function attemptState(a) { const now=new Date();return {attempt_id:a.id,assessment_id:a.assessment_id,status:a.status,started_at:a.started_at,expired_at:a.expired_at,server_time:now,remaining_seconds:a.expired_at?Math.max(0,Math.floor((new Date(a.expired_at)-now)/1000)):null}; }
async function getAttempt(userId,id) {
  const a=await loadAttempt(userId,id); if(a.status!=='IN_PROGRESS') throw new ApiError(409,'Attempt is already finalized');
  const [questions]=await pool.execute('SELECT q.id,q.question_number,q.question_type_id,qt.code question_type,q.question_text,q.image_attachment_id,qa.object_key question_object_key,qa.original_name question_original_name,qa.mime_type question_mime_type,ao.id option_id,ao.option_code,ao.option_text,ao.option_order,ao.image_attachment_id option_attachment_id,oa.object_key option_object_key,oa.original_name option_original_name,oa.mime_type option_mime_type,aa.selected_option_id FROM questions q JOIN question_types qt ON qt.id=q.question_type_id LEFT JOIN attachments qa ON qa.id=q.image_attachment_id LEFT JOIN answer_options ao ON ao.question_id=q.id LEFT JOIN attachments oa ON oa.id=ao.image_attachment_id LEFT JOIN attempt_answers aa ON aa.question_id=q.id AND aa.attempt_id=? WHERE q.question_package_id=? ORDER BY q.question_number,ao.option_order',[id,a.question_package_id]);
  const map=new Map(); for(const r of questions){ if(!map.has(r.id)) map.set(r.id,{id:r.id,number:r.question_number,type:r.question_type,text:r.question_text,answered:Boolean(r.selected_option_id),selected_option_id:r.selected_option_id,attachment:r.question_object_key?{filename:r.question_original_name,mime_type:r.question_mime_type,url:await storage.getSignedUrl(r.question_object_key,60)}:null,options:[]}); if(r.option_id) map.get(r.id).options.push({id:r.option_id,code:r.option_code,text:r.option_text,order:r.option_order,attachment:r.option_object_key?{filename:r.option_original_name,mime_type:r.option_mime_type,url:await storage.getSignedUrl(r.option_object_key,60)}:null}); }
  const result=attemptState(a); return {...result,questions:[...map.values()]};
}
async function saveAnswer(userId,attemptId,questionId,optionId) {
  const c=await pool.getConnection(); try { await c.beginTransaction(); const a=await loadAttempt(userId,attemptId,true,c); if(a.status!=='IN_PROGRESS')throw new ApiError(409,'Attempt is already finalized'); if(a.type==='TRYOUT'&&new Date(a.expired_at)<=new Date())throw new ApiError(409,'Tryout attempt has expired');
    const [[q]]=await c.execute('SELECT id FROM questions WHERE id=? AND question_package_id=?',[questionId,a.question_package_id]);if(!q)throw new ApiError(400,'Question does not belong to this assessment');
    const [[o]]=await c.execute('SELECT id FROM answer_options WHERE id=? AND question_id=?',[optionId,questionId]);if(!o)throw new ApiError(400,'Selected option does not belong to this question');
    await c.execute('INSERT INTO attempt_answers (attempt_id,question_id,selected_option_id,answered_at) VALUES (?,?,?,NOW()) ON DUPLICATE KEY UPDATE selected_option_id=VALUES(selected_option_id),answered_at=NOW()',[attemptId,questionId,optionId]); await c.commit();return {attempt_id:Number(attemptId),question_id:Number(questionId),selected_option_id:Number(optionId),answered:true};
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}
async function submitAttempt(userId,attemptId) {
  const c=await pool.getConnection(); try {await c.beginTransaction();const a=await loadAttempt(userId,attemptId,true,c);
    const [[prev]]=await c.execute('SELECT * FROM attempt_results WHERE attempt_id=?',[attemptId]);
    const [[feedback]]=await c.execute('SELECT id FROM feedbacks WHERE user_id=? AND assessment_id=? LIMIT 1',[userId,a.assessment_id]);
    if(a.status!=='IN_PROGRESS'&&prev){await c.commit();return {is_feedback:Boolean(feedback),result:formatResult(a,prev)};}
    if(a.status!=='IN_PROGRESS')throw new ApiError(409,'Attempt cannot be finalized');
    const expired=a.type==='TRYOUT'&&new Date(a.expired_at)<=new Date();
    const [[counts]]=await c.execute('SELECT COUNT(*) total_questions,COUNT(aa.selected_option_id) answered_questions FROM questions q LEFT JOIN attempt_answers aa ON aa.question_id=q.id AND aa.attempt_id=? WHERE q.question_package_id=?',[attemptId,a.question_package_id]);
    if(!expired&&Number(counts.total_questions)!==Number(counts.answered_questions))throw new ApiError(400,`All questions must be answered before submitting (${counts.answered_questions}/${counts.total_questions})`);
    const [rows]=await c.execute('SELECT qt.code,ao.score FROM questions q JOIN question_types qt ON qt.id=q.question_type_id JOIN attempt_answers aa ON aa.question_id=q.id AND aa.attempt_id=? JOIN answer_options ao ON ao.id=aa.selected_option_id AND ao.question_id=q.id WHERE q.question_package_id=?',[attemptId,a.question_package_id]);
    const scores={TWK:0,TIU:0,TKP:0}; for(const r of rows)scores[r.code]+=Number(r.score);
    const total=scores.TWK+scores.TIU+scores.TKP;
    const [[assessment]]=await c.execute('SELECT passing_score_twk,passing_score_tiu,passing_score_tkp FROM assessments WHERE id=?',[a.assessment_id]);
    const [res]=await c.execute('INSERT INTO attempt_results (attempt_id,total_score,twk_score,tiu_score,tkp_score,twk_passed,tiu_passed,tkp_passed,total_correct,total_wrong,total_unanswered) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[attemptId,total,scores.TWK,scores.TIU,scores.TKP,scores.TWK>=Number(assessment.passing_score_twk),scores.TIU>=Number(assessment.passing_score_tiu),scores.TKP>=Number(assessment.passing_score_tkp),rows.filter(x=>Number(x.score)>0).length,rows.filter(x=>Number(x.score)<=0).length,Number(counts.total_questions)-Number(counts.answered_questions)]);
    const status=expired?'EXPIRED':'COMPLETED'; await c.execute('UPDATE attempts SET status=?,ended_at=NOW() WHERE id=?',[status,attemptId]); const [[result]]=await c.execute('SELECT * FROM attempt_results WHERE id=?',[res.insertId]); const finalAttempt={...a,status,ended_at:new Date()}; await c.commit();return {is_feedback:Boolean(feedback),result:formatResult(finalAttempt,result)};
  }catch(e){await c.rollback();throw e;}finally{c.release();}
}
function formatResult(a,r){return {attempt_id:a.id,assessment_id:a.assessment_id,status:a.status,total_score:Number(r.total_score),twk_score:Number(r.twk_score),tiu_score:Number(r.tiu_score),tkp_score:Number(r.tkp_score),twk_passed:Boolean(r.twk_passed),tiu_passed:Boolean(r.tiu_passed),tkp_passed:Boolean(r.tkp_passed),total_correct:r.total_correct,total_wrong:r.total_wrong,total_unanswered:r.total_unanswered,completed_at:a.ended_at||a.updated_at};}
async function result(userId,type,id){const [[r]]=await pool.execute('SELECT at.id attempt_id,at.assessment_id,at.status,at.ended_at,at.updated_at,ar.total_score,ar.twk_score,ar.tiu_score,ar.tkp_score,ar.twk_passed,ar.tiu_passed,ar.tkp_passed,ar.total_correct,ar.total_wrong,ar.total_unanswered FROM attempts at JOIN assessments a ON a.id=at.assessment_id JOIN attempt_results ar ON ar.attempt_id=at.id WHERE at.id=? AND at.user_id=? AND a.type=?',[id,userId,type]);if(!r)throw new ApiError(404,'Finalized result not found');return {attempt_id:r.attempt_id,assessment_id:r.assessment_id,status:r.status,total_score:Number(r.total_score),twk_score:Number(r.twk_score),tiu_score:Number(r.tiu_score),tkp_score:Number(r.tkp_score),twk_passed:Boolean(r.twk_passed),tiu_passed:Boolean(r.tiu_passed),tkp_passed:Boolean(r.tkp_passed),total_correct:r.total_correct,total_wrong:r.total_wrong,total_unanswered:r.total_unanswered,completed_at:r.ended_at||r.updated_at};}
async function explanations(userId,type,id){const [[allowed]]=await pool.execute("SELECT a.id FROM assessments a JOIN attempts at ON at.assessment_id=a.id AND at.user_id=? AND at.status IN ('COMPLETED','EXPIRED') WHERE a.id=? AND a.type=? AND a.is_released=1 LIMIT 1",[userId,id,type]);if(!allowed)throw new ApiError(403,'Complete this assessment before viewing explanations');await checkAccess(pool,userId,(await pool.execute('SELECT access_type FROM assessments WHERE id=?',[id]))[0][0].access_type);
 const [rows]=await pool.execute('SELECT q.id,q.question_number,q.question_text,q.explanation,qt.code question_type,q.explanation_attachment_id,a.object_key,a.original_name,a.mime_type,ao.id option_id,ao.option_code,ao.option_text,ao.score,ao.option_order FROM questions q JOIN assessments x ON x.id=? JOIN question_types qt ON qt.id=q.question_type_id LEFT JOIN attachments a ON a.id=q.explanation_attachment_id LEFT JOIN answer_options ao ON ao.question_id=q.id WHERE q.question_package_id=(SELECT id FROM question_packages WHERE assessment_id=?) ORDER BY q.question_number,ao.option_order',[id,id]);const grouped=new Map();for(const r of rows){if(!grouped.has(r.id))grouped.set(r.id,{id:r.id,number:r.question_number,type:r.question_type,question:r.question_text,explanation:r.explanation,attachment:r.object_key?{filename:r.original_name,mime_type:r.mime_type,url:await storage.getSignedUrl(r.object_key,60)}:null,options:[]});if(r.option_id)grouped.get(r.id).options.push({id:r.option_id,code:r.option_code,text:r.option_text,score:Number(r.score)});}return [...grouped.values()];}
async function createFeedback(userId,id,data){const [[a]]=await pool.execute("SELECT id FROM assessments WHERE id=? AND is_released=1",[id]);if(!a)throw new ApiError(404,'Assessment not found');const [[done]]=await pool.execute("SELECT id FROM attempts WHERE user_id=? AND assessment_id=? AND status IN ('COMPLETED','EXPIRED') LIMIT 1",[userId,id]);if(!done)throw new ApiError(403,'Feedback can be submitted after completing an attempt');try{const [r]=await pool.execute('INSERT INTO feedbacks (user_id,assessment_id,rating,difficulty,comment) VALUES (?,?,?,?,?)',[userId,id,data.rating,data.difficulty,data.comment||null]);return{id:r.insertId,assessment_id:Number(id),rating:data.rating,difficulty:data.difficulty,comment:data.comment||null};}catch(e){if(e.code==='ER_DUP_ENTRY')throw new ApiError(409,'Feedback has already been submitted for this assessment');throw e;}}
async function statistics(userId){const [rows]=await pool.execute("SELECT at.id attempt_id,a.id assessment_id,a.title assessment_title,at.ended_at completed_at,ar.total_score,ar.twk_score,ar.tiu_score,ar.tkp_score FROM attempts at JOIN assessments a ON a.id=at.assessment_id JOIN attempt_results ar ON ar.attempt_id=at.id WHERE at.user_id=? AND a.type='TRYOUT' AND at.status IN ('COMPLETED','EXPIRED') ORDER BY at.ended_at,at.id",[userId]);return rows;}

module.exports={offer,getSubscription,createPayment,transactionHistory,midtransNotification,listMaterials,materialDetail,assessmentList,assessmentDetail,startAttempt,getAttempt,saveAnswer,submitAttempt,result,explanations,createFeedback,statistics};
