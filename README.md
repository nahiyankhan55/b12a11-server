# PH-Assignment-11 Server (ScholarStream)

This is the backend server for **ScholarStream**, a scholarship management and application platform.
Built with **Node.js, Express, MongoDB, JWT authentication, and Stripe payment integration**.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB (Atlas)
- JSON Web Token (JWT)
- Stripe Payments
- Cookie-based Authentication
- dotenv

---

## Features

- JWT authentication with HTTP-only cookies
- Role-based access control (Admin, Moderator, Student)
- Scholarship CRUD operations
- Scholarship application management
- Review & rating system
- Stripe payment integration
- Admin & Moderator dashboards
- Analytics & statistics APIs
- Secure API with token verification

---

## Links:

- **Live Site:** []()
- **Client Repo:** [https://github.com/nahiyankhan55/b12a11-web](https://github.com/nahiyankhan55/b12a11-web)

---

## Authentication & Authorization

### JWT

- Token stored in **HTTP-only cookie**
- Token expiration: **1 hour**

### Middlewares

- `verifyToken` → checks JWT
- `verifyAdmin` → Admin-only access
- `verifyModerator` → Moderator & Admin access

---

## Environment Variables

Create a `.env` file in the root directory:

```
PORT=3030
DB_USER=yourMongoUser
DB_ACCESS=yourMongoPassword
DB_NAME=yourDatabaseName

ACCESS_TOKEN_SECRET=yourJwtSecret

STRIPE_SK=yourStripeSecretKey

NODE_ENV=production
```

---

## Install & Run Locally

```bash
git clone https://github.com/your-username/ph-assignment-11-server.git
cd ph-assignment-11-server
npm install
npm run dev
```

Server will run on:

```
http://localhost:3030
```

---

## API Endpoints Overview

### Auth

- POST `/jwt` – create JWT
- POST `/logout` – clear JWT

### Users (Admin)

- GET `/users`
- POST `/users`
- PUT `/users/:userId/role`
- PUT `/users/assign/:email`
- DELETE `/users/:id`

### Scholarships

- GET `/scholarships`
- GET `/home/scholarships`
- GET `/scholarships/:admin`
- POST `/scholarships`
- PUT `/scholarship/update/:id`
- DELETE `/scholarships/delete/:id`

### Applications

- POST `/applications`
- GET `/applications/user`
- GET `/applications/:email`
- PUT `/applications/:id/status`
- PUT `/applications/:id/feedback`
- DELETE `/applications/:id`
- GET `/applications/details/:id`

### Reviews

- GET `/reviews`
- POST `/reviews`
- PUT `/reviews/:id`
- DELETE `/reviews/:id`

### Payments

- POST `/create-payment-intent`
- POST `/payments`

### Analytics

- GET `/home/stats`
- GET `/analytics/stats`

---

## Database Collections

- `users`
- `scholarships`
- `applications`
- `reviews`
- `payments`
