# User API manual testing and Midtrans setup

Configure `PREMIUM_PRICE=300000`, `PREMIUM_DURATION_DAYS=365`, `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, and `MIDTRANS_IS_PRODUCTION=false` using the Midtrans Sandbox keys. Never put the Server Key in frontend configuration. Apply `database/migrations/003_user_api_subscriptions.sql` once to the database. It aligns legacy subscription records to FREE/PREMIUM, makes dates nullable for FREE, enforces one subscription row per user, and enforces one feedback row per user and assessment, and stores the Snap token for pending-payment resume. Signup then creates a FREE subscription row.

Apply `database/migrations/005_material_type.sql` once. It adds the required `materials.type` column (`TWK`, `TIU`, `TKP`) and sets existing rows to `TWK`; correct them with `PATCH /api/admin/materials/:id`.

In Midtrans Dashboard, set the notification URL to `POST https://<api-host>/api/payments/midtrans/notification`. Webhooks do not use user JWT. The backend validates SHA-512 signature and gross amount against the local transaction snapshot. Settlement or capture with fraud status `accept` activates Premium atomically. Repeated success notifications do not extend subscription twice. Renewal extends from the current expiry date.

## Access rules

- List endpoints for materials, Latihan, and Try Out return every released item, FREE and PREMIUM, to every user. The client shows a Premium prompt for locked items.
- Opening a PREMIUM material or assessment, starting an attempt on it, or reading its explanations as a Free user returns `403 Premium subscription is required`.
- `GET /api/users/tryout/statistics` (My Progress) is Premium only and returns 403 for Free users.
- Attempt history and results are the user's own data and are available to Free and Premium users.

## Endpoints

All `/api/users` endpoints require a Bearer JWT. List endpoints accept `page` and `limit`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/users/premium/offer` | Premium price and term |
| GET | `/api/users/subscription` | Effective status and dates |
| POST | `/api/users/premium/payment` | Create/resume Snap payment | BELUM | SUDAH
| GET | `/api/users/transactions` | Own transaction history |
| GET | `/api/users/materials` and `/api/users/materials/:id` | All released materials (with `type`); detail enforces Premium |
| GET | `/api/users/latihan` and `/api/users/latihan/:assessmentId` | All released latihan; detail enforces Premium |
| POST | `/api/users/latihan/:assessmentId/attempts` | Start/resume latihan |
| GET | `/api/users/tryout` and `/api/users/tryout/:assessmentId` | All released tryout; detail enforces Premium |
| POST | `/api/users/tryout/:assessmentId/attempts` | Start/resume timed tryout | BELUM | SUDAH
| GET | `/api/users/latihan/:assessmentId/attempts` and `/api/users/tryout/:assessmentId/attempts` | Own finalized attempts of one assessment, newest first |
| GET | `/api/users/attempts/:attemptId` | Questions, options, answers and server timer |
| POST | `/api/users/attempts/:attemptId/answers` | Save selected `question_id` and `selected_option_id` immediately |
| POST | `/api/users/attempts/:attemptId/submit` | Finalize score; unanswered questions are allowed |
| GET | `/api/users/latihan/attempts/:attemptId/result` and `/api/users/tryout/attempts/:attemptId/result` | Own result |
| GET | `/api/users/latihan/:assessmentId/explanations` and `/api/users/tryout/:assessmentId/explanations` | Review after a finalized attempt; optional `?attempt_id=` | BELUM, TRYOUT JANGGAL | SUDAH
| POST | `/api/users/assessments/:assessmentId/feedback` | One feedback after a finalized attempt | BELUM | SUDAH
| GET | `/api/users/tryout/statistics` | All own finalized tryout scores over time; Premium only | BELUM | SUDAH
| POST | `/api/payments/midtrans/notification` | Midtrans notification; no JWT | BELUM | SUDAH

Admin endpoints added for these notes (Bearer JWT with role ADMIN):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/admin/feedback` | Feedback list, newest first. Filters: `assessment_id`, `assessment_type` (`LATIHAN`/`TRYOUT`), `rating` (1-5), `difficulty`. Returns `items`, `pagination`, and `summary { total, average_rating }` |
| POST | `/api/admin/materials` | Multipart upload; `type` (`TWK`/`TIU`/`TKP`) is now required |
| PATCH | `/api/admin/materials/:id` | Update `title`, `description`, `type`, `access_type` |

## Explanations response

Each question has `selected_option_id` (null when unanswered) and `options[]` with:

- `score`: the option's score, for every user
- `is_selected`: the user's answer in the reviewed attempt
- `is_correct`: the highest-scoring option for TWK and TIU; always `false` for TKP, where the score is what matters

`explanation` and `explanation_image_url` are included for Premium users only. Without `attempt_id`, the user's latest finalized attempt is reviewed.

## Postman flow

1. Login and set `Authorization: Bearer <accessToken>`.
2. Read Premium offer, then create payment. Use returned `snap_token` with Midtrans Snap Sandbox. A webhook updates the local transaction and subscription; check `/api/users/subscription` afterwards.
3. List and open a released latihan/tryout, start an attempt, get the attempt questions, and POST each answer as soon as it is selected.
4. Submit the attempt. Questions can be left unanswered; they score 0 and are counted in `total_unanswered`. The backend calculates section and total scores from option scores, persists a result, and returns `is_feedback`.
5. `is_feedback: false` means the UI must show the feedback form; create it at `/api/users/assessments/:assessmentId/feedback` with `rating`, `difficulty` (`EASY`, `MEDIUM`, `HARD`) and optional `comment`. A subsequent submit returns true.
6. Read result, attempt history, tryout statistics (Premium), or explanations after completion. TRYOUT expiry is based on server time; expired attempts stop accepting answers and can be finalized using saved answers.
