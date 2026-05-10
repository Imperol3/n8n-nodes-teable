import { INodeProperties } from 'n8n-workflow';

const fieldKeyTypeProperty: INodeProperties = {
	displayName: 'Field Key Type',
	name: 'fieldKeyType',
	type: 'options',
	options: [
		{ name: 'Field Name', value: 'name', description: 'Use the human-readable field name' },
		{ name: 'Field ID', value: 'id', description: 'Use the internal field ID (fldXXX)' },
	],
	default: 'name',
	description: 'How field keys are represented in the request and response.',
};

const cellFormatProperty: INodeProperties = {
	displayName: 'Cell Format',
	name: 'cellFormat',
	type: 'options',
	options: [
		{ name: 'JSON', value: 'json', description: 'Structured data (arrays, objects)' },
		{ name: 'Text', value: 'text', description: 'Plain text strings' },
	],
	default: 'json',
	description: 'Format of cell values in the response.',
};

const fieldsUiProperty: INodeProperties = {
	displayName: 'Fields',
	name: 'fieldsUi',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	description: 'Add each field you want to set. Values that look like JSON are auto-parsed.',
	options: [
		{
			name: 'fieldValues',
			displayName: 'Field',
			values: [
				{
					displayName: 'Field',
					name: 'fieldName',
					type: 'options',
					typeOptions: {
						loadOptionsMethod: 'getTableFieldNames',
						loadOptionsDependsOn: ['tableId'],
					},
					default: '',
					description: 'Select a field from the table. Switch to expression mode to type a field name manually.',
				},
				{
					displayName: 'Value',
					name: 'fieldValue',
					type: 'string',
					default: '',
					description: 'Value to set. JSON arrays/objects are auto-parsed (e.g. ["tag1","tag2"]).',
				},
			],
		},
	],
};

export const recordOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['record'] } },
		options: [
			{ name: 'Get All', value: 'getAll', description: 'List records with optional filters and sorting', action: 'Get all records' },
			{ name: 'Get', value: 'get', description: 'Retrieve a single record by its ID', action: 'Get a record' },
			{ name: 'Create', value: 'create', description: 'Create a new record', action: 'Create a record' },
			{ name: 'Create Many', value: 'createMany', description: 'Create multiple records (batched at 1,000)', action: 'Create many records' },
			{ name: 'Update', value: 'update', description: 'Update fields on an existing record', action: 'Update a record' },
			{ name: 'Update Many', value: 'updateMany', description: 'Update multiple records by ID', action: 'Update many records' },
			{ name: 'Delete', value: 'delete', description: 'Delete a record', action: 'Delete a record' },
			{ name: 'Upsert', value: 'upsert', description: 'Create or update a record based on a matching field', action: 'Upsert a record' },
			{ name: 'Search', value: 'search', description: 'Search records by field value', action: 'Search records' },
		],
		default: 'getAll',
	},
];

export const recordFields: INodeProperties[] = [

	// ── Space → Base → Table cascade (all record operations) ─────────────────
	{
		displayName: 'Space',
		name: 'spaceId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getSpaces' },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'] } },
		description: 'The Teable space.',
	},
	{
		displayName: 'Base',
		name: 'baseId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getBases', loadOptionsDependsOn: ['spaceId'] },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'] } },
		description: 'The base within the selected space.',
	},
	{
		displayName: 'Table',
		name: 'tableId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTables', loadOptionsDependsOn: ['baseId'] },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'] } },
		description: 'The table to operate on.',
	},

	// ── GET ALL ───────────────────────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show: { resource: ['record'], operation: ['getAll'] } },
		default: false,
		description: 'Whether to return all results or only up to a given limit.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: { show: { resource: ['record'], operation: ['getAll'], returnAll: [false] } },
		default: 100,
		description: 'Max number of results to return.',
	},
	{
		displayName: 'Filter Conditions',
		name: 'filterConditions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		placeholder: 'Add Condition',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['getAll'] } },
		description: 'Filter records by field values. All conditions are combined with AND. Overridden by Filter (JSON) if both are set.',
		options: [
			{
				name: 'conditions',
				displayName: 'Condition',
				values: [
					{
						displayName: 'Field',
						name: 'fieldId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getTableFields', loadOptionsDependsOn: ['tableId'] },
						default: '',
						description: 'Field to filter on.',
					},
					{
						displayName: 'Operator',
						name: 'operator',
						type: 'options',
						options: [
							{ name: 'Is', value: '=' },
							{ name: 'Is Not', value: '!=' },
							{ name: 'Contains', value: 'contains' },
							{ name: 'Does Not Contain', value: 'doesNotContain' },
							{ name: 'Is Empty', value: 'isEmpty' },
							{ name: 'Is Not Empty', value: 'isNotEmpty' },
							{ name: 'Greater Than', value: '>' },
							{ name: 'Less Than', value: '<' },
							{ name: 'Greater Than or Equal', value: '>=' },
							{ name: 'Less Than or Equal', value: '<=' },
						],
						default: '=',
						description: 'Comparison operator.',
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value to compare against. Not used for isEmpty / isNotEmpty.',
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'View',
				name: 'viewId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getViews', loadOptionsDependsOn: ['tableId'] },
				default: '',
				description: 'Restrict results to a specific view.',
			},
			{
				displayName: 'Filter (JSON)',
				name: 'filter',
				type: 'json',
				default: '',
				description: 'Raw Teable filter object as JSON. Overrides Filter Conditions above when both are set.',
			},
			{
				displayName: 'Order By (JSON)',
				name: 'orderBy',
				type: 'json',
				default: '',
				description: 'Sort rules, e.g. [{"fieldId":"fldXXX","order":"asc"}].',
			},
			{
				displayName: 'Selected Field IDs',
				name: 'selectedFieldIds',
				type: 'string',
				default: '',
				description: 'Comma-separated field IDs to include. Leave empty for all fields.',
			},
			fieldKeyTypeProperty,
			cellFormatProperty,
		],
	},

	// ── GET (single) ─────────────────────────────────────────────────────────
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['get', 'update', 'delete'] } },
		description: 'The ID of the record (recXXXXXXXX).',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['get'] } },
		options: [fieldKeyTypeProperty, cellFormatProperty],
	},

	// ── CREATE ────────────────────────────────────────────────────────────────
	{
		...fieldsUiProperty,
		displayOptions: { show: { resource: ['record'], operation: ['create'] } },
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['create'] } },
		options: [fieldKeyTypeProperty],
	},

	// ── CREATE MANY ───────────────────────────────────────────────────────────
	{
		displayName: 'Records (JSON)',
		name: 'recordsJson',
		type: 'json',
		required: true,
		default: '[{"fields":{"Name":"Example"}}]',
		displayOptions: { show: { resource: ['record'], operation: ['createMany'] } },
		description: 'Array of record objects. Each must have a "fields" key. Batched at 1,000.',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['createMany'] } },
		options: [fieldKeyTypeProperty],
	},

	// ── UPDATE ────────────────────────────────────────────────────────────────
	{
		...fieldsUiProperty,
		displayOptions: { show: { resource: ['record'], operation: ['update'] } },
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['update'] } },
		options: [fieldKeyTypeProperty],
	},

	// ── UPDATE MANY ───────────────────────────────────────────────────────────
	{
		displayName: 'Records (JSON)',
		name: 'recordsJson',
		type: 'json',
		required: true,
		default: '[{"id":"recXXX","fields":{"Status":"Done"}}]',
		displayOptions: { show: { resource: ['record'], operation: ['updateMany'] } },
		description: 'Array of record objects. Each must have "id" and "fields".',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['updateMany'] } },
		options: [fieldKeyTypeProperty],
	},

	// ── UPSERT ────────────────────────────────────────────────────────────────
	{
		displayName: 'Match Field',
		name: 'upsertFieldName',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTableFieldNames', loadOptionsDependsOn: ['tableId'] },
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['upsert'] } },
		description: 'Field used to find an existing record by value. If a match is found it is updated; otherwise a new record is created.',
	},
	{
		...fieldsUiProperty,
		displayOptions: { show: { resource: ['record'], operation: ['upsert'] } },
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['record'], operation: ['upsert'] } },
		options: [fieldKeyTypeProperty],
	},

	// ── SEARCH ────────────────────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['search'] } },
		description: 'Value to search for.',
	},
	{
		displayName: 'Search Field',
		name: 'searchFieldId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getTableFields', loadOptionsDependsOn: ['tableId'] },
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['search'] } },
		description: 'Restrict the search to a specific field. Leave empty to search all fields.',
	},
	{
		displayName: 'Return All',
		name: 'returnAllSearch',
		type: 'boolean',
		displayOptions: { show: { resource: ['record'], operation: ['search'] } },
		default: false,
		description: 'Whether to return all matching results or only up to a limit.',
	},
	{
		displayName: 'Limit',
		name: 'limitSearch',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: { show: { resource: ['record'], operation: ['search'], returnAllSearch: [false] } },
		default: 100,
		description: 'Max number of results to return.',
	},
];
