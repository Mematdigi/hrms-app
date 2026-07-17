module.exports = {
  apps: [
    {
      name: 'hrms-backend',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGO_URI: 'mongodb+srv://ordersmego_db_user:mematdigiuser2026@cluster0.nzmwtff.mongodb.net/hrms?retryWrites=true&w=majority',
        JWT_SECRET: 'your_jwt_secret',
      }
    }
  ]
}
