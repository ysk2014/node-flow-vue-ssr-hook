import root from '@/app'
import {stringify} from "querystring"
import { urlJoin, createRedirect, promisify } from "./utils"

const isDev = process.env.NODE_ENV !== 'production';

const noopApp = () => new Vue({ render: (h) => h('div') })

const createNext = ssrContext => opts => {
	ssrContext._status.redirected = true;
	opts.query = stringify(opts.query)
	opts.path = opts.path + (opts.query ? '?' + opts.query : '')
	if (opts.path.indexOf('http') !== 0 && ('/' !== '/' && opts.path.indexOf('/') !== 0)) {
	  	opts.path = urlJoin('/', opts.path)
	}
	// Avoid loop redirect
	if (opts.path === ssrContext.req.url) {
	  	ssrContext._status.redirected = false
	  	return
	}
	ssrContext.res.redirect(opts.status, opts.path);
}

export default (context) => {
	return new Promise((resolve, reject) => {

		if (!root.data || typeof root.data != "function") {
			return reject(new Error("The app.js file must have a data method, and the data must be a function"))
		}

		const { app, router, store } = root.data(context);

		context._status = {redirected: false, error: null, serverRendered: true};
		context.next = createNext(context);
		context.redirect = createRedirect(context, router, true);
		context.params = context.req.params;
		context.query = context.req.query;

		const { req } = context
		const { fullPath } = router.resolve(req.url).route

		if (fullPath !== req.url) {
			return reject({ url: fullPath })
		}

		router.push(req.url)

		// wait until router has resolved possible async hooks
		router.onReady(() => {
			const matchedComponents = router.getMatchedComponents()

			if (!matchedComponents.length) {
				if (req.url == '/404' || req.url.indexOf('.')>=0) {
					return reject({code: 404})
				} else {
					return reject({ url: '/404' })
				}
			}

			Promise.all(matchedComponents.map(({ asyncData }) => {
				if (asyncData && typeof asyncData === 'function') {
					return promisify(asyncData, {
						store,
						route: router.currentRoute,
						context
					});
				} else {
					return Promise.resolve(true);
				}
			})).then(() => {
				
				context.state = store.state;
				store.state.SSR_FETCHED = true;
				
				if (context._status.redirected) return resolve(noopApp());
				
				return resolve(app);

			}).catch(reject)

		}, reject)
	})
}
