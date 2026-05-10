import { INodeProperties } from 'n8n-workflow';

export const tableOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['table'] } },
		options: [
			{ name: 'Get All', value: 'getAll', description: 'List all tables within a base', action: 'Get all tables' },
			{ name: 'Get Schema', value: 'getSchema', description: 'Return fields and their types for a table', action: 'Get table schema' },
			{ name: 'Get Views', value: 'getViews', description: 'List all views for a table', action: 'Get table views' },
		],
		default: 'getAll',
	},
];

export const tableFields: INodeProperties[] = [

	// ── Space → Base cascade (all table operations) ───────────────────────────
	{
		displayName: 'Space',
		name: 'spaceId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSpaces' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['table'] } },
		description: 'The Teable space.',
	},
	{
		displayName: 'Base',
		name: 'baseId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getBases', loadOptionsDependsOn: ['spaceId'] },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['table'] } },
		description: 'The base within the selected space.',
	},

	// ── Table (getSchema + getViews — getAll lists all tables in the base) ────
	{
		displayName: 'Table',
		name: 'tableId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTables', loadOptionsDependsOn: ['baseId'] },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['table'], operation: ['getSchema', 'getViews'] } },
		description: 'The table to inspect.',
	},
];
