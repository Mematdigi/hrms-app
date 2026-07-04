module.exports = {
  apps: [
    {
      name: 'hrms-backend',
      script: 'server.js',  // your entry file
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGO_URI: 'mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/YOUR_DB?retryWrites=true&w=majority',
        JWT_SECRET: 'your_jwt_secret',
      }
    }
  ]
}
