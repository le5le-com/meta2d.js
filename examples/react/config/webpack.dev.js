/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 15:02:25
 * @LastEditTime: 2021-10-13 14:53:13
 */
const path = require('path');
const common = require('./webpack.common');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'development',
  devServer: {
    open: true,
    port: 1019,
    compress: true
  }
});