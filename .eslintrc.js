module.exports = {
	root: true,
	env: { node: true },
	parser: '@typescript-eslint/parser',
	parserOptions: { project: ['./tsconfig.json'] },
	plugins: ['n8n-nodes-base'],
	extends: ['plugin:n8n-nodes-base/nodes'],
	ignorePatterns: ['dist/**', '.eslintrc.js'],
	rules: {
		'n8n-nodes-base/node-param-description-missing-final-period': 'warn',
	},
};
