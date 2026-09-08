/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "a0db713dc1a12ca63fa548d2e629b6d6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "dc921ef37fc7d3d1d10e0fea5b64f189"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a506a45eb7c507e67cd663dd4a32a242"
  }, {
    "url": "index.html",
    "revision": "4cee4524b6a340f0754e2740678bd6d5"
  }, {
    "url": "icon.svg",
    "revision": "9a9fb3f8d509f5559f6a5c208509d748"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "c06d2b6dcb87d801c8ffad8dfd561f46"
  }, {
    "url": "assets/index-DtaDesoF.css",
    "revision": null
  }, {
    "url": "assets/index-D0DdENmp.js",
    "revision": null
  }, {
    "url": "assets/index-BclHvy6y.js",
    "revision": null
  }, {
    "url": "__manus__/debug-collector.js",
    "revision": "45b1e83bacf2dc3d3b20bb18b465abe0"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "c06d2b6dcb87d801c8ffad8dfd561f46"
  }, {
    "url": "icon.svg",
    "revision": "9a9fb3f8d509f5559f6a5c208509d748"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a506a45eb7c507e67cd663dd4a32a242"
  }, {
    "url": "pwa-512x512.png",
    "revision": "dc921ef37fc7d3d1d10e0fea5b64f189"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "a0db713dc1a12ca63fa548d2e629b6d6"
  }, {
    "url": "manifest.webmanifest",
    "revision": "de9dccbc67b5d2643d1ad13003f8880e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
