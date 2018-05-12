let path = require("path");

exports.vueSSRServer = {
    enable: true,
    type: 'server',
    name: 'vue-server-renderer/server-plugin',
    args() {
        return { filename: this.config.serverBundle };
    }
};

exports.vueSSRClient = {
    enable: true,
    type: 'client',
    name: 'vue-server-renderer/client-plugin',
    args() {
        return { filename: this.config.clientManifest };
    }
}

exports.html = {
    enable: true,
    type: 'client',
    name: 'html-webpack-plugin',
    withimg: false,
    args() {
        return { 
            filename: this.config.html.template.filename,
            template: path.resolve(this.baseDir, this.config.html.template.path),
            inject: false 
        };
    }
};

exports.vendor = {
    args: {
        name: 'vendor',
        minChunks: function (module) {
            // any required modules inside node_modules are extracted to vendor
            return (
                module.resource &&
                /\.js$/.test(module.resource) &&
                module.resource.indexOf(
                    path.join(process.cwd(), './node_modules')
                ) === 0
                && !/node_modules[\/\\]{1}flow\-vue\-ssr\-hook[\/\\]{1}template[\/\\]{1}/.test(module.resource)
                && !/\.(css|less|scss|sass|styl|stylus|vue)$/.test(module.request)
            )
        }
    }
};

exports.manifest = {
    env: ['dev', 'test', 'prod']
};