const path = require("path");

module.exports = {
    devtool: 'inline-source-map',
    entry: './src/index.tsx',
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
            { test: /\.tsx?$/, loader: 'ts-loader' }
        ]
    },
    devServer: {
        contentBase: path.join(__dirname, "public"),
        compress: true,
        port: 3010
    }
};
