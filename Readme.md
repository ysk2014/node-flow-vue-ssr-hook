# flow-vue-ssr-hook

> `flow-build` 针对vue服务端渲染的解决方案

## 安装

```js
$ npm install --save-dev flow-build flow-vue-ssr-hook
```

## 使用方法

```js
const { createBundleRenderer } = require('vue-server-renderer');
const fs = require('fs');
let renderer;

function createRenderer (_fs = fs) {
  const template = fs.readFileSync(templatePath, 'utf-8')
  let distPath = path.resolve(process.cwd(), 'dist')

  const bundle = JSON.parse(_fs.readFileSync(path.resolve(distPath, './server-bundle.json'), "utf-8"))
  const clientManifest = JSON.parse(_fs.readFileSync(path.resolve(distPath, './vue-ssr-client-manifest.json'), "utf-8"));

  renderer = createBundleRenderer(bundle, {
    cache: LRU({
      max: 1000,
      maxAge: 1000 * 60 * 15
    }),
    basedir: resolve('./dist'),
    runInNewContext: false,
    template,
    clientManifest
  });
}

let SSRBuilder = require("flow-build");
let builder = new SSRBuilder(require('./flow.config'));

async function createServer() {
    let { devMiddleware, hotMiddleware } = await builder.build(createRenderer);
    app.use(hotMiddleware);
    app.use(devMiddleware);

    app.use(render)

    const port = process.env.PORT || 3000
    app.listen(port, () => {
      console.log(`server started at localhost:${port}`)
    })
}

createServer();
```