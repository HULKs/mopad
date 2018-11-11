const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");

const extractLess = new ExtractTextPlugin({
    filename: "mopad.css",
    disable: process.env.NODE_ENV === "development"
});

module.exports = {
    mode: "development",
    entry: {
        bundle: "./src/index.tsx",
    },
    context: __dirname,
    module: {
        rules: [
            { test: /\.tsx?$/, loader: "ts-loader", exclude: /node_modules/ },
            {
                test: /\.less$/,
                use: extractLess.extract({
                    use: [
                        { loader: "css-loader" },
                        {
                            loader: "less-loader",
                            options: {
                                includePaths: ["./node_modules"]
                            }
                        }
                    ],
                    fallback: "style-loader"
                })
            }
        ]
    },
    resolve: {
        modules: ["node_modules"],
        extensions: [".ts", ".tsx", ".js"]
    },
    output: {
        path: path.join(__dirname, "./public"),
        filename: "[name].js"
    },
    devServer: {
        contentBase: './public',
        port: 3010
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./index.htm",
            filename: "index.htm"
        }),
        extractLess
    ]
};
