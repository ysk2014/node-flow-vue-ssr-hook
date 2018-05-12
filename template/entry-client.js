import Vue from 'vue'
import root from '@/app'
import { createRedirect, promisify } from "./utils"

const isDev = process.env.NODE_ENV !== 'production';

if (!root.data || typeof root.data != "function") {
  	throw new Error("The app.js file must have a data method, and the data must be a function");
}

const { app, router, store } = root.data()

// a global mixin that calls `asyncData` when a route component's params change

Vue.mixin({
	beforeRouteUpdate (to, from, next) {

		if (root.methods && typeof root.methods.asyncDataBefore === "function") {
			root.methods.asyncDataBefore();
		}

		let context = {
			_status: {
				redirected: false,
			},
			params: to.params, 
			query: to.query,
			next: next,
			isDev: isDev
		};
	
		context.redirect = createRedirect(context, router, false);
	

		const {asyncData} = this.$options;
		let promise;
		if (asyncData && typeof asyncData === 'function') {
			promise = promisify(asyncData, {
				store,
				route: to,
				context
			});
		} else if (asyncData && Object.prototype.toString.call(asyncData) === "[object Object]") {
			if (typeof asyncData.type === 'string') {
				promise = store.dispatch(asyncData.type, context).catch((err)=> {
					if (asyncData.redirect) {
						context.redirect(asyncData.redirect);
					} else {
						return Promise.reject(err);
					}
				});
			} else {
				if (isDev) {
					throw new Error('The type field must be string type, if asyncData is an object');
				}
				promise = Promise.resolve(true);
			}
		} else {
			promise = Promise.resolve(true);
		}

		promise.then(() => {
			if (root.methods && typeof root.methods.asyncDataComplete === "function") {
				root.methods.asyncDataComplete();
			}

			if (context._status.redirected) {
				next(false);
			} else {
				next()
			}
		}).catch(next);
	},
	
	mounted() {
		if (this.$store) {
			this.$store.state.SSR_FETCHED = false
		}
	}
})


// prime the store with server-initialized state.
// the state is determined during SSR and inlined in the page markup.
if (window.__INITIAL_STATE__) {
  	store.replaceState(window.__INITIAL_STATE__)
}

function render(to, from, next) {

	let context = {
		_status: {
			redirected: false,
		},
		params: to.params, 
		query: to.query,
		next: next
	};

	context.redirect = createRedirect(context, router, false);


	if(store && store.state.SSR_FETCHED) {
		return next();
	}

	const matched = router.getMatchedComponents(to)
	const prevMatched = router.getMatchedComponents(from)
	let diffed = false
	const activated = matched.filter((c, i) => {
		return diffed || (diffed = (prevMatched[i] !== c))
	})

	if (!activated.length) {
		return next()
	}

	if (root.methods && typeof root.methods.asyncDataBefore === "function") {
		root.methods.asyncDataBefore();
	}

	Promise.all(activated.map(({ asyncData}) => {
		if (asyncData && typeof asyncData === 'function') {
			return promisify(asyncData, {
				store,
				route: to,
				context
			});
		} else if (asyncData && Object.prototype.toString.call(asyncData) === "[object Object]") {
			if (typeof asyncData.type === 'string') {
				return store.dispatch(asyncData.type, context).catch((err)=> {
					if (asyncData.redirect) {
						context.redirect(asyncData.redirect);
					} else {
						return Promise.reject(err);
					}
				});
			} else {
				if (isDev) {
					throw new Error('The type field must be string type, if asyncData is an object');
				}
				return Promise.resolve(true);
			}
		} else {
			return Promise.resolve(true);
		}
	})).then(() => {

		if (root.methods && typeof root.methods.asyncDataComplete === "function") {
			root.methods.asyncDataComplete();
		}
		if (context._status.redirected) {
			next(false);
		} else {
			next()
		}
	})
	.catch(next)
}

// wait until router has resolved all async before hooks
// and async components...
router.onReady(() => {

	router.beforeResolve(render)

	// actually mount to DOM
	app.$mount(root.el || "#app")
})