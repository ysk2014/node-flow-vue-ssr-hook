export function createRedirect(context, router, isServer) {
    return (status, path, query) => {
        if (!status) return;
        context._status.redirected = true;

        let pathType = typeof path;

        if (
            typeof status !== "number" &&
            (pathType === "undefined" || pathType === "object")
        ) {
            query = path || {};
            path = status;
            pathType = typeof path;
            status = 302;
        }

        if (pathType === "object") {
            path = router.resolve(context.req.url).href;
        }

        // "/absolute/route", "./relative/route" or "../relative/route"
        if (/(^[.]{1,2}\/)|(^\/(?!\/))/.test(path)) {
            context.next({
                path: path,
                query: query,
                status: status
            });
        } else {
            path = formatUrl(path, query);
            if (isServer) {
                context.next({
                    path: path,
                    status: status
                });
            } else {
                window.location.replace(path);
                throw new Error("ERR_REDIRECT");
            }
        }
    };
}

export function promisify(fn, context) {
    let promise;
    if (fn.length === 2) {
        // fn(context, callback)
        promise = new Promise(resolve => {
            fn(context, function(err, data) {
                if (err) {
                    context.error(err);
                }
                data = data || {};
                resolve(data);
            });
        });
    } else {
        promise = fn(context);
    }
    if (
        !promise ||
        (!(promise instanceof Promise) && typeof promise.then !== "function")
    ) {
        promise = Promise.resolve(promise);
    }
    return promise;
}

export function urlJoin() {
    return [].slice
        .call(arguments)
        .join("/")
        .replace(/\/+/g, "/");
}

/**
 * Format given url, append query to url query string
 *
 * @param  {string} url
 * @param  {string} query
 * @return {string}
 */
function formatUrl(url, query) {
    let protocol;
    let index = url.indexOf("://");
    if (index !== -1) {
        protocol = url.substring(0, index);
        url = url.substring(index + 3);
    } else if (url.indexOf("//") === 0) {
        url = url.substring(2);
    }

    let parts = url.split("/");
    let result = (protocol ? protocol + "://" : "//") + parts.shift();

    let path = parts.filter(Boolean).join("/");
    let hash;
    parts = path.split("#");
    if (parts.length === 2) {
        path = parts[0];
        hash = parts[1];
    }

    result += path ? "/" + path : "";

    if (query && JSON.stringify(query) !== "{}") {
        result +=
            (url.split("?").length === 2 ? "&" : "?") + formatQuery(query);
    }
    result += hash ? "#" + hash : "";

    return result;
}

/**
 * Transform data object to query string
 *
 * @param  {object} query
 * @return {string}
 */
function formatQuery(query) {
    return Object.keys(query)
        .sort()
        .map(key => {
            var val = query[key];
            if (val == null) {
                return "";
            }
            if (Array.isArray(val)) {
                return val
                    .slice()
                    .map(val2 => [key, "=", val2].join(""))
                    .join("&");
            }
            return key + "=" + val;
        })
        .filter(Boolean)
        .join("&");
}
