import { INodeProperties } from 'n8n-workflow';

export const tableOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['table'] } },
		options: [
			{
				name: 'Get All',
				value: 'getAll',
				description: 'List all tables within a base',
				action: 'Get all tables',
			},
			{
				name: 'Get Schema',
				value: 'getSchema',
				description: 'Return the fields (columns) and their types for a table',
				action: 'Get table schema',
			},
			{
				name: 'Get Views',
				value: 'getViews',
				description: 'List all views defined for a table',
				action: 'Get table views',
			},
		],
		default: 'getAll',
	},
];

export const tableFields: INodeProperties[] = [
	// ── GET ALL ───────────────────────────────────────────────
	{
		displayName: 'Base ID',
		name: 'baseId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['table'], operation: ['getAll'] } },
		description:
			'The ID of the base whose tables you want to list. Find it in the URL as the segment after /base/.',
	},

	// ── GET SCHEMA & GET VIEWS ────────────────────────────────
	{
		displayName: 'Table ID',
		name: 'tableId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['table'], operation: ['getSchema', 'getViews'] },
		},
		description: 'The ID of the table (tblXXXXXXXX).',
	},
];
