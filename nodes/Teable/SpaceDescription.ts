import { INodeProperties } from 'n8n-workflow';

export const spaceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['space'] } },
		options: [
			{ name: 'List Spaces', value: 'listSpaces', description: 'Return all spaces accessible to your API token', action: 'List spaces' },
			{ name: 'List Bases', value: 'listBases', description: 'Return all bases within a space', action: 'List bases in a space' },
		],
		default: 'listSpaces',
	},
];

export const spaceFields: INodeProperties[] = [
	{
		displayName: 'Space',
		name: 'spaceId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSpaces' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['space'], operation: ['listBases'] } },
		description: 'The space whose bases you want to list.',
	},
];
