import path from 'path'
import webpack from 'webpack'
import { merge } from 'webpack-merge'
import { fileURLToPath } from 'url'
import CopyWebpackPlugin from 'copy-webpack-plugin'
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import SaveRemoteFilePlugin from 'save-remote-file-webpack-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))


const common = {
  output: {
    filename: '[name].js'
  },
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.wasm'],
    fallback: {
      https: false,
      // "http": require.resolve("stream-http")
      http: false,
      zlib: false,
      stream: false ,
      crypto: false,
      path: false,
      fs: false,
      process: false,
    }
  },
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        loader: 'babel-loader',
        include: /node_modules/,
        options: {
          cacheDirectory: true,
        },
      },
      {
        test: /\.wasm$/,
        type: "asset/inline",
      },
    ]
  },
}

const appConfig = {
  devServer: {
    publicPath: '/',
    hot: true,
  },
  target: 'web',
  entry: {
    app: './src/index.js',
  },
  mode: 'development',
  plugins: [
    new NodePolyfillPlugin(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      chunks : ['app'],
    }),
    new SaveRemoteFilePlugin([
      {
          url: 'https://p2p.sending.me/sw.js',
		  hash: false,
          filepath: './sw.js',
      },
      {
          url: 'https://p2p.sending.me/server.wasm',
		  hash: false,
          filepath: './server.wasm',
    },
  ])
  ],
};


export default (cmd) => {
  return [merge(common, appConfig), merge(common)]
}
