const path = require("path");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const extractLess = new ExtractTextPlugin({
    filename: 'mopad.css'
});

module.exports = {
    devtool: 'inline-source-map',
    entry: [
        path.join(__dirname, "./src/index.tsx"),
        path.join(__dirname, "./src/style/main.less")
    ],
    output: {
        path: path.join(__dirname, "public"),
        filename: "index.js"
    },
    resolve: {
        // Add `.ts` and `.tsx` as a resolvable extension.
        extensions: ['.ts', '.tsx', '.js']
    },
    module: {
        rules: [
            // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
            { test: /\.tsx?$/, loader: 'ts-loader' },
            {
                test: /\.less$/,
                use: extractLess.extract([ 'css-loader','less-loader' ])
            }
        ]
    },
    plugins: [
        extractLess,
        new UglifyJsPlugin()
    ],
    devServer: {
        contentBase: path.join(__dirname, "public"),
        compress: true,
        port: 3010
    }
};
