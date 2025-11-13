const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  module: {
    rules: [
      // JS / JSX
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env', '@babel/preset-react'] },
        },
      },

      // ✅ plain CSS
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },

      // ✅ SCSS / SASS  << THE IMPORTANT BIT
      {
        test: /\.s[ac]ss$/i,
        use: [
          'style-loader',   // injects CSS into DOM
          'css-loader',     // resolves @import / url()
          'sass-loader',    // compiles SCSS -> CSS
        ],
      },

      // (optional) assets referenced from CSS/SCSS
      { test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf)$/i, type: 'asset' },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' })],
  resolve: { extensions: ['.js', '.jsx', '.json'] },
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    static: { directory: path.join(__dirname, 'public') },
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } },
  },
};
