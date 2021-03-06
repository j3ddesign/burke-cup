const path       = require('path');
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry : {
    main: './src/index.ts',
    vendor: "./src/vendor.ts"
  },
  output: {
    path    : 'dist',
    filename: '[name].[hash].bundle.js'
  },
  resolve: {
    extensions: ['', '.js', '.ts']
  },
  module: {
    loaders: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      {from: 'src/assets', to: 'assets'}
    ]),
    new HtmlWebpackPlugin({
      title: 'cup-overlay',
      template: 'src/index.ejs',
      chunksSortMode: 'dependency',
      inject: 'head'
    })
  ],
  devServer: {
    inline: true
  }
};
