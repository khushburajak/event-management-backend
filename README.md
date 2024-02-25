# Evento (Event Management System) - Backend

## Introduction
Welcome to the backend of Evento, the Event Management System application for both Common Users and Organizers.

## Technologies Used
- Node.js
- Express.js
- MongoDB (or your preferred database)

## Project Setup

### Prerequisites
- Node.js installed
- MongoDB (or your preferred database) installed and running

### Installation
```bash
Clone the repository:

git clone https://github.com/khushburajak/event-management-backend.git
cd event-management-backend
```

### Install dependencies:

```
npm install
# or
yarn install
```
### Environment Setup
create .env in base folder then place and edit the details
```
APP_PORT = 5000
SENDGRID_API= 
APP_HOST_EMAIL=youremail@gmail.com
APP_DOMAIN=http://127.0.0.0:5000/
APP_SECRET= usenumber as secret
APP_DB = use MongoDb Atlas
```
### Running the App

```
npm run dev
```

The app will be running at http://localhost:5000.

