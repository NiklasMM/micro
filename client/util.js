/*
 * micro
 * Copyright (C) 2018 micro contributors
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU Lesser General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Various utilities.
 */

"use strict";

self.micro = self.micro || {};
micro.util = {};

/** Thrown if network communication failed. */
micro.NetworkError = class extends TypeError {};

/**
 * Thrown for HTTP JSON REST API errors.
 *
 * .. attribute:: error
 *
 *    The error object.
 *
 * .. attribute:: status
 *
 *    The associated HTTP status code.
 */
micro.APIError = class extends Error {
    constructor(error, status) {
        super(error.__type__);
        this.error = error;
        this.status = status;
    }
};

/**
 * Call a *method* on the HTTP JSON REST API endpoint at *url*.
 *
 * *method* is a HTTP method (e.g. ``GET`` or ``POST``). Arguments are passed as JSON object *args*.
 * A promise is returned that resolves to the result as JSON value, once the call is complete.
 *
 * If an error occurs, the promise rejects with an :class:`APIError`. For any IO related errors, it
 * rejects with a :class:`micro.NetworkError`.
 *
 * .. deprecated:: 0.19.0
 *
 *    :class:`TypeError` for IO related errors. Check for :class:`micro.NetworkError` instead.
 */
micro.call = async function(method, url, args) {
    console.log("PRE", url);
    console.trace();
    let options = {method, credentials: "same-origin"};
    if (args) {
        options.headers = {"Content-Type": "application/json"};
        options.body = JSON.stringify(args);
    }

    let response;
    let result;
    try {
        console.log("PREAWAIT", url);
        console.trace();
        response = await fetch(url, options);
        console.log("POSTAWAIT", url);
        console.trace();
        result = await response.json();
    } catch (e) {
        console.log("CATCH", url, e);
        console.trace();
        if (e instanceof TypeError || e instanceof SyntaxError) {
            // Consider invalid JSON an IO error as well
            throw new micro.NetworkError("LOL");
        }
        throw e;
    }
    if (!response.ok) {
        throw new micro.APIError(result, response.status);
    }
    return result;
};

/**
 * Promise that resolves when another given promise is done.
 *
 * .. method:: when(promise)
 *
 *    Resolve once *promise* is fulfilled.
 */
micro.util.PromiseWhen = function() {
    let when = null;
    let p = new Promise(resolve => {
        when = function(promise) {
            if (!resolve) {
                throw new Error("already-called-when");
            }
            resolve(promise);
            resolve = null;
        };
    });
    p.when = when;
    return p;
};

/**
 * Dispatch an *event* at the specified *target*.
 *
 * If defined, the related on-event handler is called.
 */
micro.util.dispatchEvent = function(target, event) {
    target.dispatchEvent(event);
    let on = target[`on${event.type}`];
    if (on) {
        on.call(target, event);
    }
};

/**
 * Create an on-event handler property for the given event *type*.
 *
 * The returned property can be assigned to an object, for example::
 *
 *    Object.defineProperty(elem, "onmeow", micro.util.makeOnEvent("meow"));
 */
micro.util.makeOnEvent = function(type) {
    let listener = null;
    return {
        get() {
            return listener;
        },

        set(value) {
            if (listener) {
                this.removeEventListener(type, listener);
            }
            listener = value;
            if (listener) {
                this.addEventListener(type, listener);
            }
        }
    };
};

/**
 * Truncate *str* at *length*.
 *
 * A truncated string ends with an ellipsis character.
 */
micro.util.truncate = function(str, length = 16) {
    return str.length > length ? `${str.slice(0, length - 1)}…` : str;
};

/**
 * Convert *str* to a slug, i.e. a human readable URL path segment.
 *
 * All characters are converted to lower case, non-ASCII characters are removed and all
 * non-alphanumeric symbols are replaced with a dash. The slug is limited to *max* characters and
 * prefixed with a single slash (not counting towards the limit). Note that the result is an empty
 * string if *str* does not contain any alphanumeric symbols.
 *
 * Optionally, the computed slug is checked against a list of *reserved* strings, resulting in an
 * empty string if there is a match.
 */
micro.util.slugify = (str, {max = 32, reserved = []} = {}) => {
    let slug = str.replace(/[^\x00-\x7F]/ug, "").toLowerCase().replace(/[^a-z0-9]+/ug, "-")
        .slice(0, max).replace(/^-|-$/ug, "");
    return slug && !reserved.includes(slug) ? `/${slug}` : "";
};

/**
 * Format a string containing placeholders.
 *
 * *str* is a format string with placeholders of the form ``{key}``. *args* is an :class:`Object`
 * mapping keys to values to replace.
 */
micro.util.format = function(str, args) {
    return str.replace(/\{([^}\s]+)\}/ug, (match, key) => args[key]);
};

/**
 * Format a string containing placeholders, producing a :class:`DocumentFragment`.
 *
 * *str* is a format string containing placeholders of the form ``{key}``, where *key* may consist
 * of alpha-numeric characters plus underscores and dashes. *args* is an object mapping keys to
 * values to replace. If a value is a :class:`Node` it is inserted directly into the fragment,
 * otherwise it is converted to a text node first.
 */
micro.util.formatFragment = function(str, args) {
    let fragment = document.createDocumentFragment();
    let pattern = /\{([a-zA-Z0-9_-]+)\}/ug;
    let match = null;

    do {
        let start = pattern.lastIndex;
        match = pattern.exec(str);
        let stop = match ? match.index : str.length;
        if (stop > start) {
            fragment.appendChild(document.createTextNode(str.substring(start, stop)));
        }
        if (match) {
            let arg = args[match[1]];
            if (!(arg instanceof Node)) {
                arg = document.createTextNode(arg);
            }
            fragment.appendChild(arg);
        }
    } while (match);

    return fragment;
};

/**
 * Import the script located at *url*.
 *
 * *namespace* is the identifier of the namespace (i.e. global variable) created by the imported
 * script, if any. If given, the namespace is returned.
 */
micro.util.import = function(url, namespace = null) {
    return new Promise((resolve, reject) => {
        let script = document.head.querySelector(`script[src='${url}']`);
        if (script) {
            resolve(window[namespace]);
            return;
        }
        script = document.createElement("script");
        script.src = url;
        script.addEventListener("load", () => resolve(window[namespace]));
        script.addEventListener("error", reject);
        document.head.appendChild(script);
    });
};

/**
 * Import the stylesheet located at *url*.
 */
micro.util.importCSS = function(url) {
    return new Promise((resolve, reject) => {
        let link = document.head.querySelector(`link[rel='stylesheet'][src='${url}']`);
        if (link) {
            resolve();
            return;
        }
        link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        link.addEventListener("load", resolve);
        link.addEventListener("error", reject);
        document.head.appendChild(link);
    });
};

/**
 * Watch for unhandled exceptions and report them.
 */
micro.util.watchErrors = function() {
    async function report(e) {
        await micro.call("POST", "/log-client-error", {
            type: e.name,
            stack: e.stack,
            url: location.pathname,
            message: e.message
        });
    }
    addEventListener("error", event => {
        report(event.error ||
               {name: "Error", stack: `${event.filename}:${event.lineno}`, message: event.message});
    });

    /**
     * Catch unhandled rejections.
     *
     * Use it whenever an asynchronous function / :class:`Promise`
     *
     * - Is called without `await`
     * - Is passed to non-micro code
     */
    micro.util.catch = e => {
        report(e);
        throw e;
    };
    // NOTE: Once cross-browser support for unhandled rejection events exists, the above can be
    // replaced with:
    // addEventListener("unhandledrejection", event => {
    //     report(event.reason);
    // });
};
