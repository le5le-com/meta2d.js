/*
 * @Description: 
 * @Author: 高浩然
 * @Date: 2021-10-11 15:03:12
 * @LastEditTime: 2021-10-12 10:02:57
 */
const common = require('./webpack.common');
const { merge } = require('webpack-merge');

module.exports = merge(common, {
  mode: 'production',
});