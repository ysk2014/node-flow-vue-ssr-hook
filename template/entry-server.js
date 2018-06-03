import Vue from "vue";
import Meta from "vue-meta";
import root from "@/app";
import { stringify } from "querystring";
import { urlJoin, createRedirect, promisify } from "./utils";

const isDev = process.env.NODE_ENV !== "production";

const createNext = ssrContext => opts => {
    ssrContext._status.redirected = true;
    opts.query = stringify(opts.query);
    opts.path = opts.path + (opts.query ? "?" + opts.query : "");
    if (
        opts.path.indexOf("http") !== 0 &&
        ("/" !== "/" && opts.path.indexOf("/") !== 0)
    ) {
        opts.path = urlJoin("/", opts.path);
    }
    // Avoid loop redirect
    if (opts.path === ssrContext.req.url) {
        ssrContext._status.redirected = false;
        return;
    }
    ssrContext.res.redirect(opts.status, opts.path);
};

// vue-meta configuration
Vue.use(Meta, {
    keyName: "head", // the component option name that vue-meta looks for meta info on.
    attribute: "data-n-head", // the attribute name vue-meta adds to the tags it observes
    ssrAttribute: "data-n-head-ssr", // the attribute name that lets vue-meta know that meta info has already been server-rendered
    tagIDKeyName: "hid" // the property name that vue-meta uses to determine whether to overwrite or append a tag
});

export default context => {
    return new Promise((resolve, reject) => {
        if (!root.data || typeof root.data != "function") {
            return reject(
                new Error(
                    "The app.js file must have a data method, and the data must be a function"
                )
            );
        }

        const { app, router, store } = root.data(context);

        context._status = {
            redirected: false,
            error: null,
            serverRendered: true
        };
        context.next = createNext(context);
        context.redirect = createRedirect(context, router, true);
        context.isDev = isDev;
        context.meta = app.$meta();

        const { req } = context;
        const { fullPath, params, query } = router.resolve(req.url).route;

        context.params = params;
        context.query = query;

        if (fullPath !== req.url) {
            return reject({ url: fullPath });
        }

        router.push(req.url);

        // wait until router has resolved possible async hooks
        router.onReady(() => {
            const matchedComponents = router.getMatchedComponents();

            if (!matchedComponents.length) {
                if (req.url == "/404" || req.url.indexOf(".") >= 0) {
                    return reject({ code: 404 });
                } else {
                    return reject({ url: "/404" });
                }
            }

            let isValid = true;

            matchedComponents.forEach(component => {
                if (!isValid) return;
                if (typeof component.validate !== "function") return;
                isValid = component.validate({
                    params: params || {},
                    query: query || {}
                });
            });

            if (!isValid) {
                if (req.url == "/404" || req.url.indexOf(".") >= 0) {
                    return reject({ code: 404 });
                } else {
                    return reject({ url: "/404" });
                }
            }

            const asyncDataHooks = matchedComponents
                .map(c => c.asyncData)
                .filter(_ => _);
            Promise.all(
                asyncDataHooks.map(asyncData => {
                    if (typeof asyncData === "function") {
                        return promisify(asyncData, {
                            store,
                            route: router.currentRoute,
                            context
                        }).catch(err => {
                            context.redirect(err.url || "/404");
                            return Promise.resolve(err);
                        });
                    } else if (
                        Object.prototype.toString.call(asyncData) ===
                        "[object Object]"
                    ) {
                        if (typeof asyncData.type === "string") {
                            return store
                                .dispatch(asyncData.type, context)
                                .catch(err => {
                                    context.redirect(
                                        asyncData.redirect || "/404"
                                    );
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
                    if (context._status.redirected) return resolve(false);

                    context.state = store.state;
                    store.state.SSR_FETCHED = true;
                    return resolve(app);
                })
                .catch(reject);
        }, reject);
    });
};
