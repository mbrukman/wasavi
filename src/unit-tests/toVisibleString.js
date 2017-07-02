'use strict';

const assert = require('assert');

require('../chrome/frontend/init.js');
require('../chrome/frontend/utils.js');

describe('function toVisibleString', function () {
	it('should return printable chars as it is', () => {
		assert.equal(toVisibleString('foo'), 'foo');
	});

	it('should return printable falsy chars as it is', () => {
		assert.equal(toVisibleString('0'), '0');
		assert.equal(toVisibleString('false'), 'false');
		assert.equal(toVisibleString('null'), 'null');
		assert.equal(toVisibleString('undefined'), 'undefined');
		assert.equal(toVisibleString('NaN'), 'NaN');
	});

	it('should return 0 as "0"', () => {
		assert.equal(toVisibleString(0), '0', '0');
	});

	it('should return falsy values as empty string', () => {
		assert.equal(toVisibleString(false), '', 'false');
		assert.equal(toVisibleString(null), '', 'null');
		assert.equal(toVisibleString(undefined), '', 'undefined');
		assert.equal(toVisibleString(NaN), '', 'NaN');
	});

	it('should return control chars as special form', () => {
		assert.equal(toVisibleString('\u001aabc'), '^Zabc', '^Z');
		assert.equal(toVisibleString('\u007fabc'), '^_abc', '^_');
	});
});
