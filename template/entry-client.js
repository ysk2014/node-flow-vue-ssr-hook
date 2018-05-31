import Vue from "vue";
import Meta from "vue-meta";
import root from "@/app";
import { createRedirect, promisify } from "./utils";

const isDev = process.env.NODE_ENV !== "production";

if (!root.data || typeof root.data != "function") {
    throw new Error(
        "The app.js file must have a data method, and the data must be a function"
    );
}

// vue-meta configuration
Vue.use(Meta, {
    keyName: "head", // the component option name that vue-meta looks for meta info on.
    attribute: "data-n-head", // the attribute name vue-meta adds to the tags it observes
    ssrAttribute: "data-n-head-ssr", // the attribute name that lets vue-meta know that meta info has already been server-rendered
    tagIDKeyName: "hid" // the property name that vue-meta uses to determine whether to overwrite or append a tag
});

const { app, router, store } = root.data();

// prime the store with server-initialized state.
// the state is determined during SSR and inlined in the page markup.
if (window.__INITIAL_STATE__) {
    store.replaceState(window.__INITIAL_STATE__);
}

function render(to, from, next) {
    let context = {
        _status: {
            redirected: false
        },
        params: to.params,
        query: to.query,
        next: next
    };

    context.redirect = createRedirect(context, router, false);

    if (store && store.state.SSR_FETCHED) {
        return next();
    }

    const matched = router.getMatchedComponents(to);

    const asyncDataHooks = matched.map(c => c.asyncData).filter(_ => _);

    if (!asyncDataHooks.length) {
        return next();
    }

    if (root.methods && typeof root.methods.asyncDataBefore === "function") {
        root.methods.asyncDataBefore();
    }

    Promise.all(
        asyncDataHooks.map(asyncData => {
            if (typeof asyncData === "function") {
                return promisify(asyncData, {
                    store,
                    route: to,
                    context
                }).catch(err => {
                    context.redirect(err.url || "/404");
                    return Promise.resolve(err);
                });
            } else if (
                Object.prototype.toString.call(asyncData) === "[object Object]"
            ) {
                if (typeof asyncData.type === "string") {
                    return store
                        .dispatch(asyncData.type, context)
                        .catch(err => {
                            context.redirect(asyncData.redirect || "/404");
                            return Promise.resolve(err);
                        });
                } else {
                    if (isDev) {
                        throw new Error(
                            "The type field must be string type, if asyncData is an object"
                        );
                    }
                    return Promise.resolve(false);
                }
            } else {
                return Promise.resolve(false);
            }
        })
    )
        .then(() => {
            if (
                root.methods &&
                typeof root.methods.asyncDataComplete === "function"
            ) {
                root.methods.asyncDataComplete();
            }
            if (context._status.redirected) {
                next(false);
            } else {
                next();
            }
        })
        .catch(next);
}

// wait until router has resolved all async before hooks
// and async components...
router.onReady(() => {
    router.beforeResolve(render);

    // actually mount to DOM
    app.$mount(root.el || "#app");

    Vue.nextTick(() => {
        store.state.SSR_FETCHED = false;
    });
});
