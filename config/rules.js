exports.vue = {
    enable: true,
    test: /\.vue/,
    loader: "vue-loader",
    options: {
        transformToRequire: {
            video: "src",
            source: "src",
            img: "src",
            image: "xlink:href"
        }
    }
};

exports.babel = {
    exclude: (js) => /node_modules/.test(js) && !/node_modules[\/\\]{1}flow\-vue\-ssr\-hook[\/\\]{1}template/.test(js)
};