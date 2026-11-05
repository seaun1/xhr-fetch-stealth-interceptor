/**
 * XHR-Fetch-Stealth-Interceptor
 * A zero-dependency utility to silently intercept, modify, and monitor
 * XMLHttpRequest and Fetch API traffic in modern web applications.
 */
class NetworkStealthInterceptor {
    constructor() {
        this.capturedHeaders = {};
        this.responseCache = new Map();
    }

    /**
     * Initialize the interceptors for both XHR and Fetch.
     * Inject this before the main Single Page Application (SPA) loads.
     */
    init() {
        this._interceptXHR();
        this._interceptFetch();
        console.log('[Stealth Interceptor] Network hooks activated.');
    }

    _interceptXHR() {
        const origOpen = window.XMLHttpRequest.prototype.open;
        const origSetHeader = window.XMLHttpRequest.prototype.setRequestHeader;
        const origSend = window.XMLHttpRequest.prototype.send;
        const self = this;

        window.XMLHttpRequest.prototype.open = function(method, url) {
            this._requestUrl = url;
            return origOpen.apply(this, arguments);
        };

        // Intercept headers to steal dynamic auth tokens
        window.XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
            const lowKey = String(key).toLowerCase();
            // Target specific authorization headers
            if (['authorization', 'x-auth-token', 'appsystem', 'companycode'].includes(lowKey)) {
                self.capturedHeaders[lowKey] = value;
            }
            return origSetHeader.apply(this, arguments);
        };

        // Intercept responses for data caching
        window.XMLHttpRequest.prototype.send = function() {
            this.addEventListener('load', function() {
                if (this.status >= 200 && this.status < 300) {
                    try {
                        const data = JSON.parse(this.responseText);
                        self.responseCache.set(this._requestUrl, data);
                    } catch (e) {
                        // Silent fail for non-JSON responses
                    }
                }
            });
            return origSend.apply(this, arguments);
        };
    }

    _interceptFetch() {
        const origFetch = window.fetch;
        const self = this;

        window.fetch = async function(input, init) {
            let requestUrl = (typeof input === 'string') ? input : input?.url;

            // Intercept request headers
            if (init && init.headers) {
                const headers = (init.headers instanceof Headers) 
                    ? Array.from(init.headers.entries()) 
                    : Object.entries(init.headers);
                    
                for (let [key, value] of headers) {
                    const lowKey = String(key).toLowerCase();
                    if (['authorization', 'x-auth-token', 'appsystem', 'companycode'].includes(lowKey)) {
                        self.capturedHeaders[lowKey] = value;
                    }
                }
            }

            const response = await origFetch.apply(this, arguments);
            
            // Intercept response body by cloning the stream
            try {
                if (response.ok) {
                    const clone = response.clone();
                    clone.json().then(data => {
                        self.responseCache.set(requestUrl, data);
                    }).catch(() => {});
                }
            } catch (e) {}

            return response;
        };
    }
}

export default new NetworkStealthInterceptor();