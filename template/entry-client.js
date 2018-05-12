import Vue from 'vue'
import root from '@/app'
import { createRedirect, promisify } from "./utils"

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
			next: next
		};
	
		context.redirect = createRedirect(context, router, false);
	

		const {asyncData} = this.$options;
		if (asyncData && typeof asyncData === 'function') {
			promisify(asyncData, {
				store,
				route: to,
				context
			}).then(()=> {
				
				if (root.methods && typeof root.methods.asyncDataComplete === "function") {
					root.methods.asyncDataComplete();
				}

				if (context._status.redirected) {
					next(false);
				} else {
					next()
				}
			});
		} else {
			if (root.methods && typeof root.methods.asyncDataComplete === "function") {
				root.methods.asyncDataComplete();
			}
			next();
		}
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

	const asyncDataHooks = activated.map(c => c.asyncData).filter(_ => _)

	if (!asyncDataHooks.length) {
		return next()
	}

	if (root.methods && typeof root.methods.asyncDataBefore === "function") {
		root.methods.asyncDataBefore();
	}

	Promise.all(asyncDataHooks.map(asyncData => {
		if (asyncData && typeof asyncData === 'function') {
			return promisify(asyncData, {
				store,
				route: to,
				context
			});
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
