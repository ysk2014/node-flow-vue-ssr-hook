const path = require("path");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const nodeExternals = require("webpack-node-externals");
let rules = require("./config/rules");
let plugin = require("./config/plugin");

module.exports = class VueSSRHook {
    /**
     *
     * @param {*} options
     */
    constructor(options = {}) {
        let defaults = {
            output: "server-bundle.js",
            serverBundle: "server-bundle.json",
            clientManifest: "vue-ssr-client-manifest.json"
        };

        this.options = Object.assign(
            {
                entry: true
            },
            defaults,
            options
        );
    }
    /**
     *
     * @param {*} builder
     */
    apply(builder) {
        if (this.options.entry) {
            builder.on("entry-option", builder => {
                builder.set("entry", {
                    client: path.resolve(
                        __dirname,
                        "./template/entry-client.js"
                    ),
                    server: path.resolve(
                        __dirname,
                        "./template/entry-server.js"
                    )
                });
            });
        }

        builder.on("base-config", base => {
            base.setConfig({
                fallback: "vue-style-loader",
                clientManifest: this.options.clientManifest,
                serverBundle: this.options.serverBundle
            });

            config.update("resolve.extensions", old => {
                old.push(".vue");
                return old;
            });

            config.update("resolve.alias", old => {
                return Object.assign({}, old, {
                    "@": path.resolve(builder.get("srcDir")),
                    vue$: "vue/dist/vue.esm.js"
                });
            });

            config.update("resolveLoader.modules", old => {
                old.push(path.join(__dirname, "./node_modules"));
                return old;
            });
        });

        builder.on("merge-plugin", base => {
            base.mergePlugin(plugin);
        });

        builder.on("merge-rule", base => {
            rules.vue.options = this.vueLoader(base.config);
            base.mergeRule(rules);
        });

        builder.on("client-config", client => {
            let entry = {
                app: builder.options.entry.client,
                vendor: ["vue", "vue-router", "vuex"]
                    .concat(builder.options.entry.vendor)
                    .filter(v => v)
            };

            if (client.env == "dev") {
                entry.app = [
                    "webpack-hot-middleware/client?name=client&reload=true&timeout=30000".replace(
                        /\/\//g,
                        "/"
                    ),
                    entry.app
                ];
            }

            config.set("entry", entry);

            config.update("output", old => {
                return Object.assign({}, old, {
                    devtoolModuleFilenameTemplate: "[absolute-resource-path]"
                });
            });
        });

        builder.on("server-config", config => {
            config.update("externals", old => {
                old.push(
                    nodeExternals({
                        whitelist: [
                            /es6-promise|\.(?!(?:js|json)$).{1,5}$/i,
                            /\.css$/
                        ]
                    })
                );
                return old;
            });

            config.update("output", old => {
                return Object.assign({}, old, {
                    filename: this.options.output
                });
            });
        });

        builder.on("ssr-done", (sharedFS, callback) => {
            let distPath = builder.options.build.outputPath;
            let bundlePath = path.resolve(distPath, this.options.serverBundle);
            let clientPath = path.resolve(
                distPath,
                this.options.clientManifest
            );

            if (
                sharedFS &&
                sharedFS.existsSync(bundlePath) &&
                sharedFS.existsSync(clientPath)
            ) {
                console.info("create or update ssr json");
                callback && callback(sharedFS);
            }
        });
    }
    /**
     *
     * @param {*} options
     */
    cssLoaders(options) {
        options = options || {};

        const cssLoader = {
            loader: "css-loader",
            options: Object.assign(
                {},
                {
                    sourceMap: options.sourceMap
                },
                options.loaderOptions.css
            )
        };

        var postcssLoader = {
            loader: "postcss-loader",
            options: Object.assign(
                {},
                {
                    useConfigFile: false
                },
                options.loaderOptions.postcss
            )
        };

        function generateLoaders(loader, loaderOptions) {
            const loaders = [cssLoader, postcssLoader];

            if (options.extract && options.imerge) {
                loaders.push({
                    loader: "imerge-loader"
                });
            }

            if (loader) {
                loaders.push({
                    loader: loader + "-loader",
                    options: Object.assign(
                        {},
                        loaderOptions,
                        {
                            sourceMap: options.sourceMap
                        },
                        options.loaderOptions[loader]
                    )
                });
            }

            if (options.extract) {
                return ExtractTextPlugin.extract({
                    use: loaders,
                    fallback: options.fallback
                });
            } else {
                return [options.fallback].concat(loaders);
            }
        }

        return {
            css: generateLoaders(),
            postcss: generateLoaders(),
            less: generateLoaders("less"),
            sass: generateLoaders("sass", { indentedSyntax: true }),
            scss: generateLoaders("sass"),
            stylus: generateLoaders("stylus"),
            styl: generateLoaders("stylus")
        };
    }
    /**
     *
     * @param {*} param0
     */
    vueLoader({ cssSourceMap, extract, fallback, imerge, loaderOptions }) {
        let cssLoaders = this.cssLoaders({
            sourceMap: cssSourceMap,
            extract: extract,
            fallback: fallback,
            imerge: imerge,
            loaderOptions: loaderOptions
        });

        let postcss = loaderOptions.postcss;

        if (typeof loaderOptions.postcss.plugins == "function") {
            postcss = Object.assign({}, loaderOptions.postcss, {
                useConfigFile: false,
                plugins: loaderOptions.postcss.plugins()
            });
        }

        return {
            loaders: Object.assign(
                {},
                {
                    js: {
                        loader: "babel-loader",
                        options: Object.assign({}, loaderOptions.babel)
                    }
                },
                cssLoaders
            ),
            cssSourceMap: cssSourceMap,
            postcss: postcss,
            preserveWhitespace: false,
            transformToRequire: {
                video: "src",
                source: "src",
                img: "src",
                image: "xlink:href"
            }
        };
    }
};
