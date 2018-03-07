let path = require("path");
let VueSSRServerPlugin = require('vue-server-renderer/server-plugin');
let VueSSRClientPlugin = require('vue-server-renderer/client-plugin');

exports.vueSSRServer = {
    enable: true,
    type: 'server',
    name: VueSSRServerPlugin,
    args() {
        return { filename: this.config.serverBundle };
    }
};

exports.vueSSRClient = {
    enable: true,
    type: 'client',
    name: VueSSRClientPlugin,
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