/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 15:02:14
 * @LastEditTime: 2021-10-13 14:59:48
 */
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  // 输出配置。
  output: {
    // 输出文件的路径
    path: path.resolve(__dirname, 'dist'),
    // 输出后的文件名称
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(tsx|ts|jsx|js)$/,
        use: [
          'babel-loader'
        ],
        exclude: /node_modules|dist/,
      },
      {
        test: /\.(jpg|png|jpeg|svg|ttf|woff)$/,
        exclude: /node_modules/,
        type: 'asset'
      }
    ]
  },
  resolve: {
    // webpack将对引入的文件尝试按照下列后缀名来解析，从而可以让我们在引入文件时不指定后缀名。
    // 比如在文件中输入：import "./index"; ，并且同时存在 index.tsx 和 index.ts 文件，webpack 只会解析index.tsx
    extensions: [ 'tsx', 'ts', '.jsx', '.js', '.css']
  },
  plugins: [
    // 插件可以在打包后在 dist 文件夹中生成 html 文件，打包后的 js 文件会被自动引入
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, '../src/index.html'),
      filename: 'index.html',
      title: '打包后的页面'
    })
  ]
};