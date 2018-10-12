const path = require("path");
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
            base.mergeRule(rules);
        });

        builder.on("merge-optimization", (config) => {
            config.mergeOptimization({
                splitChunks: {
                    cacheGroups: {
                        vendor: {
                            test: function(module) {
                                // any required modules inside node_modules are extracted to vendor
                                return (
                                    module.resource &&
                                    /\.js$/.test(module.resource) &&
                                    module.resource.indexOf(
                                        path.join(process.cwd(), "./node_modules")
                                    ) === 0 &&
                                    !/node_modules[\/\\]{1}flow\-vue\-ssr\-hook[\/\\]{1}template[\/\\]{1}/.test(
                                        module.resource
                                    ) &&
                                    !/\.(css|less|scss|sass|styl|stylus|vue)$/.test(module.request)
                                );
                            }
                        }
                    }
                }
            });
        });

        builder.on("client-config", client => {
            let entry = {
                app: builder.options.entry.client
            };

            // if (client.env == "dev") {
            //     entry.app = [
            //         "webpack-hot-middleware/client?name=client&reload=true&timeout=30000".replace(
            //             /\/\//g,
            //             "/"
            //         ),
            //         entry.app
            //     ];
            // }

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
                            /\.css$/,
                            /\?vue&type=style/
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
};
