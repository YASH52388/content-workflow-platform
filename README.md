# content-workflow-platform

A full-stack content management system designed to help social media Influencers manage clients, projects, tasks, and invoices efficiently 

---
<img width="960" alt="image" src="https://github.com/user-attachments/assets/4ffeb721-8db3-4daf-a228-219eaa545170" />

## 🚀 Features

- User authentication with JWT
- CRUD operations for:
  - Clients
  - Projects
  - Tasks
  - Invoices
- Dashboard with statistics
- Role-based access control
- Clean code structure with separate models, routes, and middleware

---

## 🛠 Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB
- JWT for authentication

### Frontend
- React.js

---

## 🗂 Project Structure
```
content-workflow-platform/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── server.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── assets/
│   │   └── components/
│   │       ├── layout/        # Header, Sidebar
│   │       └── ui/            # Reusable UI components (Button, Card, etc.)
│   ├── index.html
│   ├── package.json
│   └── eslint.config.js
```

## 🧪 Getting Started

### Prerequisites

- Node.js & npm
- MongoDB

### Backend Setup

bash
```
cd backend
npm install
cp .env.example .env # Add your MongoDB URI and JWT secret
npm start

```


### Frontend Setup
```
cd frontend
npm install
npm run dev

```
