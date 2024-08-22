const path = require('path');

module.exports = {
    mode: "production",
    entry: ["./src/index.ts"],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.vert$|\.frag$/,
                type: "asset/source"
            }
        ]
    },
    resolve: {
        extensions: [".ts"]
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "static")
    },
};