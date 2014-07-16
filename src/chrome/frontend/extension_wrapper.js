// ==UserScript==
// @include http://*/*
// @include https://*/*
// ==/UserScript==
//
/**
 * wasavi: vi clone implemented in javascript
 * =============================================================================
 *
 *
 * @author akahuku@gmail.com
 */
/**
 * Copyright 2012-2014 akahuku, akahuku@gmail.com
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

(function (global) {
	/* {{{1 consts */
	var EXTENSION_NAME = 'wasavi';
	var IS_GECKO =
		window.navigator.product == 'Gecko'
		&& window.navigator.userAgent.indexOf('Gecko/') != -1;
	var IS_FX_JETPACK =
		 typeof global.getInterface == 'function'
		 && /^\s*function\s+getInterface\s*\([^)]*\)\s*\{\s*\[native\s+code\]\s*\}\s*$/.test(
			global.getInterface.toString().replace(/[\s\r\n\t]+/g, ' '));
	var EXTERNAL_FRAME_URL = 'http://wasavi.appsweets.net/';
	var EXTERNAL_SECURE_FRAME_URL = 'https://ss1.xrea.com/wasavi.appsweets.net/';
	/* }}} */

	/**
	 * {{{1 url information class
	 * ----------------
	 */

	function UrlInfo (optionsUrl, internalUrl, canUseInternal, canUseExtensionContent) {
		this.externalUrl = EXTERNAL_FRAME_URL;
		this.externalSecureUrl = EXTERNAL_SECURE_FRAME_URL;

		this.optionsUrl = optionsUrl;
		this.internalUrl = internalUrl;
		this.canUseInternal = canUseInternal;
		this.canUseExtensionContent = canUseExtensionContent;
	}

	UrlInfo.prototype = {
		eq: function (u1, u2) {
			return u1.replace(/\?.*/, '') == u2.replace(/\?.*/, '');
		},
		get isInternal () {
			return this.eq(window.location.href, this.internalUrl)
				|| /^data:text\/html;charset=UTF-8;base64,/.test(window.location.href);
		},
		get isExternal () {
			return this.eq(window.location.href, this.externalUrl)
			    || this.eq(window.location.href, this.externalSecureUrl);
		},
		get isAny () {
			return this.isInternal || this.isExternal;
		},
		get frameSource () {
			if (this.canUseInternal) {
				return this.canUseExtensionContent ?
					this.internalUrl : false;
			}
			else {
				return window.location.protocol == 'https:' ?
					this.externalSecureUrl : this.externalUrl;
			}
		}
	};
	/* }}} */

	/**
	 * {{{1 extension wrapper base class
	 * ----------------
	 */

	function ExtensionWrapper () {
		this.internalId = this.getUniqueId();
		this.requestNumber = 0;
		this.clipboardData = '';
		this.preservedCallbacks = {};
	}
	ExtensionWrapper.prototype = {
		get name () {return EXTENSION_NAME},
		get isTopFrame () {return window.self == window.top},
		postMessage: function (data, callback, preserved) {
			var type;
			var requestNumber = this.getNewRequestNumber();

			data || (data = {});

			if ('type' in data) {
				type = data.type;
				delete data.type;
			}

			if (callback && preserved) {
				this.preservedCallbacks[requestNumber] = callback;
			}

			this.doPostMessage({
				type:type || 'unknown-command',
				tabId:this.tabId,
				internalId:this.internalId,
				requestNumber:requestNumber,
				data:data
			}, callback, preserved);

			return requestNumber;
		},
		doPostMessage: function (data, callback, preserved) {},
		connect: function (type, callback) {
			this.doConnect();
			this.doPostMessage({
				type:type || 'init',
				internalId:this.internalId,
				requestNumber:this.getNewRequestNumber(),
				data:{url:window.location.href}
			}, callback);
		},
		doConnect: function () {},
		disconnect: function () {
			this.doDisconnect();
		},
		doDisconnect: function () {},
		setMessageListener: function (handler) {},
		removeCallback: function (id) {
			delete this.preservedCallbacks[id];
		},
		interruptCallback: function (id, data) {
			if (!(id in this.preservedCallbacks)) return;
			this.preservedCallbacks[id](data);
			this.removeCallback(id);
		},
		getUniqueId: function () {
			return this.name
				+ '_' + Date.now()
				+ '_' + Math.floor(Math.random() * 0x10000);
		},
		getNewRequestNumber: function () {
			this.requestNumber = (this.requestNumber + 1) & 0xffff;
			return this.requestNumber;
		},
		getMessage: function (messageId) {},
		setClipboard: function (data) {
			this.postMessage({type:'set-clipboard', data:data});
		},
		getClipboard: function () {
			var self = this;
			var args = Array.prototype.slice.call(arguments);
			var callback = args.shift();
			this.postMessage({type:'get-clipboard'}, function (req) {
				self.clipboardData = (req && req.data || '').replace(/\r\n/g, '\n');
				if (callback) {
					args.unshift(self.clipboardData);
					callback.apply(null, args);
				}
			});
		},
		getKeyHookScriptSrc: function (path) {
			return '';
		},
		ensureRun: function () {
			var args = Array.prototype.slice.call(arguments);
			var callback = args.shift();

			if (document.readyState == 'interactive'
			||  document.readyState == 'complete') {
				callback.apply(null, args);
				callback = args = null;
			}
			else {
				document.addEventListener(
					'DOMContentLoaded',
					function handleDCL (e) {
						document.removeEventListener(e.type, handleDCL, false);
						callback.apply(null, args);
						e = callback = args = null;
					},
					false
				);
			}
		}
	};

	ExtensionWrapper.create = function () {
		if (window.chrome) return new ChromeExtensionWrapper;
		if (window.opera)  return new OperaExtensionWrapper;
		if (IS_FX_JETPACK) return new FirefoxJetpackExtensionWrapper;
		return new ExtensionWrapper;
	};
	ExtensionWrapper.IS_GECKO = IS_GECKO;
	ExtensionWrapper.IS_FX_JETPACK = IS_FX_JETPACK;
	ExtensionWrapper.CAN_COMMUNICATE_WITH_EXTENSION =
		window.chrome && chrome.extension
		|| global.opera && global.opera.extension
		|| IS_GECKO && IS_FX_JETPACK;
	ExtensionWrapper.HOTKEY_ENABLED = IS_GECKO && IS_FX_JETPACK;
	ExtensionWrapper.urlInfo = new UrlInfo;
	/* }}} */

	/**
	 * {{{1 extension wrapper class for chrome
	 * ----------------
	 */

	function ChromeExtensionWrapper () {
		ExtensionWrapper.apply(this, arguments);

		var that = this;
		var onMessageHandler;

		function handleMessage (req) {
			if ('requestNumber' in req
			&& req.requestNumber in that.preservedCallbacks) {
				that.preservedCallbacks[req.requestNumber](req);
			}
			else {
				onMessageHandler && onMessageHandler(req);
			}
		}

		this.constructor = ExtensionWrapper;
		this.runType = 'chrome-extension';
		this.doPostMessage = function (data, callback, preserved) {
			callback && !preserved ?
				chrome.runtime.sendMessage(data, callback) :
				chrome.runtime.sendMessage(data);
		};
		this.doConnect = function () {
			chrome.extension.onRequest.addListener(handleMessage);
		};
		this.doDisconnect = function () {
			onMessageHandler = null;
			chrome.extension.onRequest.removeListener(handleMessage);
		};
		this.setMessageListener = function (handler) {
			onMessageHandler = handler;
		};
		this.getMessage = function (messageId) {
			return chrome.i18n.getMessage(messageId);
		};
		this.getKeyHookScriptSrc = function () {
			return chrome.runtime.getURL('scripts/key_hook.js');
		};
		this.urlInfo = new function () {
			var extensionId = chrome.runtime.id;
			return new UrlInfo(
				'chrome-extension://' + extensionId + '/options.html',
				'chrome-extension://' + extensionId + '/wasavi_frame.html',
				true, true
			);
		};
	}
	ChromeExtensionWrapper.prototype = ExtensionWrapper.prototype;
	/* }}} */

	/**
	 * {{{1 extension wrapper class for opera
	 * ----------------
	 */

	function OperaExtensionWrapper () {
		ExtensionWrapper.apply(this, arguments);

		var that = this;
		var onMessageHandler;
		var port = null;

		function handleMessage (e) {
			var req = e.data;
			if (req.type == 'opera-notify-tab-id') {
				that.tabId = req.tabId;
				return;
			}
			if ('requestNumber' in req
			&& req.requestNumber in that.preservedCallbacks) {
				that.preservedCallbacks[req.requestNumber](req);
			}
			else {
				onMessageHandler && onMessageHandler(req);
			}
		};

		this.constructor = ExtensionWrapper;
		this.runType = 'opera-extension';
		this.doPostMessage = function (data, callback, preserved) {
			if (callback && !preserved) {
				var ch = new MessageChannel;
				ch.port1.onmessage = function (e) {
					callback && callback(e.data);
					if (port) {
						ch.port1.close();
					}
					else {
						port = ch.port1;
						port.onmessage = handleMessage;
						//opera.extension.onmessage = null;
					}
					ch = null;
				};
				ch.port1.start();
				opera.extension.postMessage(data, [ch.port2]);
			}
			else {
				if (port) {
					port.postMessage(data);
				}
				else {
					opera.extension.postMessage(data);
				}
			}
		};
		this.doConnect = function () {
			opera.extension.onmessage = handleMessage;
		};
		this.doDisconnect = function () {
			onMessageHandler = null;
			opera.extension.onmessage = null;
			if (this.port) {
				this.port.close();
				this.port = null;
			}
		};
		this.setMessageListener = function (handler) {
			onMessageHandler = handler;
		};
		this.getKeyHookScriptSrc = function () {
			return widget.preferences['keyHookScript'];
		};
		this.urlInfo = new function () {
			var extensionId = widget.preferences['widget-id'];
			return new UrlInfo(
				'widget://' + extensionId + '/options.html',
				'widget://' + extensionId + '/wasavi_frame.html',
				false, false
			);
		};
	}
	OperaExtensionWrapper.prototype = ExtensionWrapper.prototype;
	/* }}} */

	/**
	 * {{{1 extension wrapper class for firefox (Add-on SDK)
	 * ----------------
	 */

	function FirefoxJetpackExtensionWrapper () {
		ExtensionWrapper.apply(this, arguments);

		var CALLBACK_SWEEP_MSECS = 1000 * 60 * 2;
		var CALLBACK_TIMEOUT_MSECS = 1000 * 60;

		var that = this;
		var callbacks = {};
		var onMessageHandler;
		var sweepTimer;

		function MessageCallbackQueueItem (callback) {
			this.callback = callback;
			this.time = Date.now();
		}
		MessageCallbackQueueItem.prototype = {
			toString:function () {
				return '[object MessageCallbackQueueItem(' +
					this.time + ': ' +
					this.callback.toString().replace(/[\s\r\n\t]+/g, ' ').substring(0, 100) +
					')]';
			},
			run:function () {
				typeof this.callback == 'function' && this.callback.apply(null, arguments);
			}
		};

		function handleMessage (data) {
			var now = Date.now();
			var callbacksCurrent = callbacks;
			var callbacksNext = {};

			callbacks = {};

			for (var i in callbacksCurrent) {
				if (data && data.callbackNumber - i == 0) {
					callbacksCurrent[i].run(data.payload);
				}
				else if (now - callbacksCurrent[i].time < CALLBACK_TIMEOUT_MSECS) {
					callbacksNext[i] = callbacksCurrent[i];
				}
			}
			for (var i in callbacksNext) {
				callbacks[i] = callbacksNext[i];
			}
		}

		this.constructor = ExtensionWrapper;
		this.runType = 'firefox-jetpack-extension';
		this.doPostMessage = function (data, callback, preserved) {
			if (callback && !preserved) {
				var id = data.requestNumber;
				callbacks[id] = new MessageCallbackQueueItem(callback);
				data.callbackNumber = id;
			}

			self.postMessage(data);
		};
		this.doConnect = function () {
			self.on('message', function (data) {
				var payload = data.payload;

				if ('requestNumber' in payload
				&& payload.requestNumber in that.preservedCallbacks) {
					that.preservedCallbacks[payload.requestNumber](payload);
				}
				else if ('callbackNumber' in data) {
					handleMessage(data);
				}
				else {
					onMessageHandler && onMessageHandler(payload);
				}
			});
			sweepTimer = setInterval(handleMessage, CALLBACK_SWEEP_MSECS);
		};
		this.doDisconnect = function () {
			onMessageHandler = null;
			self.on('message', null);
			clearInterval(sweepTimer);
		};
		this.setMessageListener = function (handler) {
			onMessageHandler = handler;
		};
		this.getKeyHookScriptSrc = function () {
			return self.options.keyHookScript;
		};
		this.urlInfo = new function () {
			var extensionId = self.options.extensionId;
			var extensionHostname = extensionId
				.toLowerCase()
				.replace(/@/g, '-at-')
				.replace(/\./g, '-dot-');
			return new UrlInfo(
				'resource://' + extensionHostname + '/wasavi/data/options.html',
				'resource://' + extensionHostname + '/wasavi/data/wasavi_frame.html',
				true, false
			);
		};
		Object.defineProperty(this, 'isTopFrame', {
			get: function () {
				var result = false;
				try { result = !!!window.frameElement; } catch (e) {}
				return result;
			}
		});
	}
	FirefoxJetpackExtensionWrapper.prototype = ExtensionWrapper.prototype;
	/* }}} */

	/* {{{1 bootstrap */
	ExtensionWrapper.urlInfo.isExternal &&
		document.documentElement.setAttribute('data-wasavi-present', 1);
	global.WasaviExtensionWrapper = ExtensionWrapper;
	/* }}} */

})(this);

// vim:set ts=4 sw=4 fileencoding=UTF-8 fileformat=unix filetype=javascript fdm=marker :
