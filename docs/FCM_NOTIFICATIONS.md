# FCM Notifications

Proptryx uses Firebase Cloud Messaging for browser push notifications and stores dashboard notifications in PostgreSQL.

## Firebase Setup

1. Open the Firebase console: https://console.firebase.google.com/
2. Create a project, or select the existing Proptryx production project.
3. Open **Project settings**.
4. In **General**, add a **Web app** if one does not exist.
5. Copy the web app config values for the frontend integration:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `messagingSenderId`
   - `appId`
6. Open **Cloud Messaging**.
7. Generate or copy the **Web Push certificates** VAPID public key. The browser uses this when calling `getToken`.
8. Open **Service accounts**.
9. Click **Generate new private key** and download the JSON file.
10. Store these split values in production secrets:
    - `FIREBASE_PROJECT_ID`
    - `FIREBASE_CLIENT_EMAIL`
    - `FIREBASE_PRIVATE_KEY`

For `.env` files, keep newlines escaped in `FIREBASE_PRIVATE_KEY`, for example `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`.

## Backend Environment

Add these values to `proptryx-server/env/.env` or deployment secrets:

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Use the split service-account values only. `FIREBASE_PRIVATE_KEY` should keep escaped newlines.

## Frontend Environment

Add the Firebase web app config to `proptryx/.env` or deployment secrets:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=proptryx-web.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=proptryx-web
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Find `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_APP_ID`, and the other web config
values in **Firebase Project settings > General > Your apps > Web app > SDK setup and
configuration**.

## Cloud Messaging Screen

Your screenshot already shows **Firebase Cloud Messaging API (V1) Enabled**, so the server-side API is ready.

For browser push, finish the **Web Push certificates** section:

1. Click **Generate key pair**.
2. Copy the generated public VAPID key.
3. Put only the public key in the frontend app env:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_web_push_public_key
```

4. Do not put the Web Push private key in the app or server env when using Firebase Web SDK + Firebase Admin SDK. Firebase keeps that private key for Web Push signing.
5. Do not put the Firebase service-account private key in the frontend. It belongs only in the backend kernel service.

## Backend Routes

Current-user dashboard and browser-token routes:

- `GET /api/notifications/me/list`
- `GET /api/notifications/me/unread-count`
- `PATCH /api/notifications/{id}/read`
- `PATCH /api/notifications/read-all`
- `POST /api/notifications/push-subscriptions`
- `POST /api/notifications/push-subscriptions/unregister`

Proptryx manual send routes:

- `GET /api/notifications/proptryx/templates`
- `POST /api/notifications/proptryx/send`
- `POST /api/notifications/proptryx/broadcast`

Manual send accepts either `custom` or `template` payloads. Use `deliveryChannel` as `DASHBOARD`, `PUSH`, or `BOTH`.

## Frontend Flow

The UI should:

1. Ask notification permission from a user action.
2. Register a service worker.
3. Use Firebase Web Messaging `getToken` with the VAPID public key.
4. Send the token to `useRegisterNotificationPushSubscriptionMutation`.
5. On logout or permission revocation, call `useUnregisterNotificationPushSubscriptionMutation`.

Dashboard menu UI can use:

- `useNotificationListQuery`
- `useNotificationUnreadCountQuery`
- `useMarkNotificationReadMutation`
- `useMarkAllNotificationsReadMutation`

Proptryx admin UI can use:

- `useProptryxNotificationTemplatesQuery`
- `useSendProptryxNotificationMutation`
- `useBroadcastProptryxNotificationMutation`

## Existing Event Trigger

Property publish now queues:

- dashboard notifications
- FCM push notifications
- existing email notifications

Use `queueNotificationForUsers` from the kernel notification router utilities for new CRUD/event triggers.
