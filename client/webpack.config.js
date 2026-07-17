const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  // ✅ FIX 3: mode must be set explicitly
  mode: isProduction ? 'production' : 'development',

  entry: './src/index.js',

  output: {
    path: path.resolve(__dirname, 'build'),
    filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
    publicPath: '/',
    clean: true,
  },

  // ✅ FIX 4: xlsx.mjs dynamic import() error — use 'var' type instead of 'module'
  externals: {
    'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs': 'var XLSX',
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
                    browsers: [
                      'last 2 chrome versions',
                      'last 2 firefox versions',
                      'last 2 safari versions',
                    ],
                  },
                  modules: isProduction ? false : 'auto',
                },
              ],
              '@babel/preset-react',
            ],
          },
        },
      },

      // ✅ FIX 1: CSS from BOTH src AND node_modules (bootstrap, bootstrap-icons, etc.)
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
        // NO exclude here — must process node_modules CSS too
      },

      // SCSS / SASS (only from src)
      {
        test: /\.s[ac]ss$/i,
        exclude: /node_modules/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                quietDeps: true,
                silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'],
              },
            },
          },
        ],
      },

      // ✅ FIX 2: Images (jpg, png, gif, svg)
      {
        test: /\.(png|jpe?g|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name].[hash][ext]',
        },
      },

      // ✅ FIX 2: Fonts (for bootstrap-icons @font-face)
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash][ext]',
        },
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

  // DevServer only in development
  ...(isProduction
    ? {}
    : {
        devServer: {
          port: 3000,
          hot: true,
          historyApiFallback: true,
          static: { directory: path.join(__dirname, 'public') },
          proxy: {
            '/api': { target: 'http://localhost:5000', changeOrigin: true },
          },
        },
      }),
};