# User API manual testing and Midtrans setup

Configure `PREMIUM_PRICE=300000`, `PREMIUM_DURATION_DAYS=365`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_IS_PRODUCTION=false` using the Midtrans Sandbox keys. Never put the Server Key in frontend configuration. Apply `database/migrations/003_user_api_subscriptions.sql` once to the database. It aligns legacy subscription records to FREE/PREMIUM, makes dates nullable for FREE, enforces one subscription row per user, and enforces one feedback row per user and assessment, and stores the Snap token for pending-payment resume. Signup then creates a FREE subscription row.

In Midtrans Dashboard, set the notification URL to `POST https://<api-host>/api/payments/midtrans/notification`. Webhooks do not use user JWT. The backend validates SHA-512 signature and gross amount against the local transaction snapshot. Settlement or capture with fraud status `accept` activates Premium atomically. Repeated success notifications do not extend subscription twice. Renewal extends from the current expiry date.

## Endpoints

All `/api/users` endpoints require a Bearer JWT. List endpoints accept `page` and `limit`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/users/premium/offer` | Premium price and term |
| GET | `/api/users/subscription` | Effective status and dates |
| POST | `/api/users/premium/payment` | Create/resume Snap payment | BELUM | SUDAH
| GET | `/api/users/transactions` | Own transaction history |
| GET | `/api/users/materials` and `/api/users/materials/:id` | Released accessible material |
| GET | `/api/users/latihan` and `/api/users/latihan/:assessmentId` | Released latihan list/detail |
| POST | `/api/users/latihan/:assessmentId/attempts` | Start/resume latihan | 
| GET | `/api/users/tryout` and `/api/users/tryout/:assessmentId` | Released tryout list/detail |
| POST | `/api/users/tryout/:assessmentId/attempts` | Start/resume timed tryout | BELUM | SUDAH
| GET | `/api/users/attempts/:attemptId` | Questions, options, answers and server timer |
| POST | `/api/users/attempts/:attemptId/answers` | Save selected `question_id` and `selected_option_id` immediately |
| POST | `/api/users/attempts/:attemptId/submit` | Validate answers and finalize score |
| GET | `/api/users/latihan/attempts/:attemptId/result` and `/api/users/tryout/attempts/:attemptId/result` | Own result | 
| GET | `/api/users/latihan/:assessmentId/explanations` and `/api/users/tryout/:assessmentId/explanations` | Explanation after a finalized attempt | BELUM, TRYOUT JANGGAL | SUDAH
| POST | `/api/users/assessments/:assessmentId/feedback` | One feedback after a finalized attempt | BELUM | SUDAH
| GET | `/api/users/tryout/statistics` | All own finalized tryout scores over time | BELUM | SUDAH
| POST | `/api/payments/midtrans/notification` | Midtrans notification; no JWT | BELUM | SUDAH

## Postman flow

1. Login and set `Authorization: Bearer <accessToken>`.
2. Read Premium offer, then create payment. Use returned `snap_token` with Midtrans Snap Sandbox. A webhook updates the local transaction and subscription; check `/api/users/subscription` afterwards.
3. List and open a released latihan/tryout, start an attempt, get the attempt questions, and POST each answer as soon as it is selected.
4. Submit the attempt. Backend checks all questions, calculates section and total scores from option scores, persists a result, and returns `is_feedback`.
5. `is_feedback: false` means the UI can show the feedback form; create it at `/api/users/assessments/:assessmentId/feedback` with `rating`, `difficulty` (`EASY`, `MEDIUM`, `HARD`) and optional `comment`. A subsequent submit returns true.
6. Read result, tryout statistics, or explanations after completion. TRYOUT expiry is based on server time; expired attempts stop accepting answers and can be finalized using saved answers.

