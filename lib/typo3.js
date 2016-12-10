'use strict';

const execFileSync = require('child_process').execFileSync;
const path = require('path');

module.exports = {
	render: function (str, context, views) {
		return execFileSync('php', [
			path.resolve(context.typo3, 'typo3/cli_dispatch.phpsh'),
			'extbase',
			'component:render',
			context.component
		]).toString();
	}
};
