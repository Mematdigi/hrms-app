module.exports = {
  apps: [
    {
      name: 'hrms-backend',
      script: 'server.js',  // your entry file
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGO_URI: 'mongodb+srv://ordersmego_db_user:mematdigiuser2026@cluster0.nzmwtff.mongodb.net/hrms',
        JWT_SECRET: 'your_jwt_secret',
      }
    }
  ]
}
