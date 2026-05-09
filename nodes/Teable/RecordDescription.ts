import { INodeProperties } from 'n8n-workflow';

// ─────────────────────────────────────────────────────────────
// Shared sub-properties used across multiple operations
// ─────────────────────────────────────────────────────────────

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
					displayName: 'Field Name',
					name: 'fieldName',
					type: 'string',
					default: '',
					description: 'The name or ID of the field (depends on the Field Key Type setting).',
				},
				{
					displayName: 'Field Value',
					name: 'fieldValue',
					type: 'string',
					default: '',
					description:
						'The value to set. Use JSON for arrays/objects (e.g. ["tag1","tag2"] for multi-select).',
				},
			],
		},
	],
};

// ─────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────

export const recordOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['record'] } },
		options: [
			{
				name: 'Get All',
				value: 'getAll',
				description: 'List records in a table with optional filters, sorting, and pagination',
				action: 'Get all records',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a single record by its ID',
				action: 'Get a record',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Create a new record in a table',
				action: 'Create a record',
			},
			{
				name: 'Create Many',
				value: 'createMany',
				description: 'Create multiple records in a single request (batched at 1 000)',
				action: 'Create many records',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update fields on an existing record',
				action: 'Update a record',
			},
			{
				name: 'Update Many',
				value: 'updateMany',
				description: 'Update multiple records by their IDs in one request',
				action: 'Update many records',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete one or more records by ID',
				action: 'Delete records',
			},
			{
				name: 'Upsert',
				value: 'upsert',
				description: 'Create a record or update it if a matching value already exists in a field',
				action: 'Upsert a record',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Full-text search across all fields in a table',
				action: 'Search records',
			},
		],
		default: 'getAll',
	},
];

// ─────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────

export const recordFields: INodeProperties[] = [
	// ── Shared: tableId ──────────────────────────────────────
	{
		displayName: 'Table ID',
		name: 'tableId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'] } },
		description:
			'The ID of the Teable table (tblXXXXXXXX). Find it in your table URL or use the Table → Get All operation.',
	},

	// ── GET ALL ───────────────────────────────────────────────
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show: { resource: ['record'], operation: ['getAll', 'search'] } },
		default: false,
		description: 'Whether to return all results or only up to a given limit.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: {
			show: { resource: ['record'], operation: ['getAll', 'search'], returnAll: [false] },
		},
		default: 100,
		description: 'Max number of results to return.',
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
				displayName: 'View ID',
				name: 'viewId',
				type: 'string',
				default: '',
				description:
					'Filter by a specific view. Leave empty to return all records regardless of view.',
			},
			{
				displayName: 'Filter (JSON)',
				name: 'filter',
				type: 'json',
				default: '',
				description:
					'A Teable filter object as JSON. See https://help.teable.io/api-reference for the filter schema.',
			},
			{
				displayName: 'Order By (JSON)',
				name: 'orderBy',
				type: 'json',
				default: '',
				description:
					'Sort rules as a JSON array, e.g. [{"fieldId":"fldXXX","order":"asc"}].',
			},
			{
				displayName: 'Selected Field IDs',
				name: 'selectedFieldIds',
				type: 'string',
				default: '',
				description:
					'Comma-separated list of field IDs to include in the response. Leave empty to return all fields.',
			},
			fieldKeyTypeProperty,
			cellFormatProperty,
		],
	},

	// ── GET (single) ─────────────────────────────────────────
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

	// ── CREATE ────────────────────────────────────────────────
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

	// ── CREATE MANY ───────────────────────────────────────────
	{
		displayName: 'Records (JSON)',
		name: 'recordsJson',
		type: 'json',
		required: true,
		default: '[{"fields":{"Name":"Example"}}]',
		displayOptions: { show: { resource: ['record'], operation: ['createMany'] } },
		description:
			'Array of record objects to create, e.g. [{"fields":{"Name":"Alice","Status":"Active"}}]. Automatically batched into chunks of 1 000.',
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

	// ── UPDATE ────────────────────────────────────────────────
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

	// ── UPDATE MANY ───────────────────────────────────────────
	{
		displayName: 'Records (JSON)',
		name: 'recordsJson',
		type: 'json',
		required: true,
		default: '[{"id":"recXXX","fields":{"Status":"Done"}}]',
		displayOptions: { show: { resource: ['record'], operation: ['updateMany'] } },
		description:
			'Array of record objects to update. Each must include "id" and "fields", e.g. [{"id":"recXXX","fields":{"Status":"Done"}}].',
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

	// ── DELETE ────────────────────────────────────────────────
	// recordId already declared above for get/update/delete

	// ── UPSERT ────────────────────────────────────────────────
	{
		displayName: 'Unique Field Name',
		name: 'upsertFieldName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['upsert'] } },
		description:
			'The field used to check for an existing record. If a record with this field value exists it will be updated; otherwise a new record is created.',
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

	// ── SEARCH ────────────────────────────────────────────────
	{
		displayName: 'Search Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['search'] } },
		description: 'Text to search for across all fields in the table.',
	},
	{
		displayName: 'Search Field ID',
		name: 'searchFieldId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['record'], operation: ['search'] } },
		description:
			'Optionally restrict the search to a specific field ID. Leave empty to search all fields.',
	},
];
