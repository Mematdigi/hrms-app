const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProduction ? 'production' : 'development',

  entry: './src/index.js',

  output: {
    path: path.resolve(__dirname, 'build'), // ✅ changed dist -> build (standard)
    filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
    publicPath: '/',
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
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    browsers: ['last 2 chrome versions', 'last 2 firefox versions', 'last 2 safari versions'],
                  },
                  // ✅ THIS FIXES your dynamic import() error
                  modules: isProduction ? false : 'auto',
                },
              ],
              '@babel/preset-react',
            ],
          },
        },
      },

      // Plain CSS
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },

      // SCSS / SASS
      {
        test: /\.s[ac]ss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },

      // Assets
      {
        test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf)$/i,
        type: 'asset',
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
  ],

  resolve: {
    extensions: ['.js', '.jsx', '.json'],
  },

  // ✅ Only in development
  ...(isProduction
    ? {}
    : {
        devServer: {
          port: 3000,
          hot: true,
          historyApiFallback: true,
          static: { directory: path.join(__dirname, 'public') },
          proxy: {
            '/api': { target: 'http://localhost:3000', changeOrigin: true },
          },
        },
      }),
};