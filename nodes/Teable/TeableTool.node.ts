import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { teableApiRequest } from './GenericFunctions';

/**
 * Teable Tool — plugs into n8n's AI Agent node as a callable tool.
 *
 * User pre-configures: credentials + Space → Base → Table.
 * The AI Agent decides at runtime: which operation to run and what data to pass.
 *
 * Exposed operations:
 *   getRecords    — list records (optional JSON filter + limit)
 *   getRecord     — fetch one record by ID
 *   createRecord  — create a record from a JSON fields object
 *   updateRecord  — update a record by ID from a JSON fields object
 *   deleteRecord  — delete a record by ID
 *   searchRecords — search by a field value (tuple format Teable requires)
 *   upsertRecord  — create or update based on a matching field value
 */
export class TeableTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Teable',
		name: 'teableTool',
		icon: 'file:teable.png',
		group: ['transform'],
		version: 1,
		description:
			'Read and write Teable records from an AI Agent. Supports get, create, update, delete, search, and upsert.',
		subtitle: '={{ $parameter["operation"] }}',
		defaults: { name: 'Teable' },
		// ── Tool interface ────────────────────────────────────────────────────────
		usableAsTool: true,
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'teableApi', required: true }],

		properties: [
			// ── Pre-configured by the user ──────────────────────────────────────
			{
				displayName: 'Space',
				name: 'spaceId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getSpaces' },
				required: true,
				default: '',
				description: 'The Teable space that contains your table.',
			},
			{
				displayName: 'Base',
				name: 'baseId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getBases', loadOptionsDependsOn: ['spaceId'] },
				required: true,
				default: '',
				description: 'The base within the selected space.',
			},
			{
				displayName: 'Table',
				name: 'tableId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTables', loadOptionsDependsOn: ['baseId'] },
				required: true,
				default: '',
				description: 'The table the AI Agent will read and write.',
			},

			// ── Operation — chosen by the AI Agent at runtime ───────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Records',
						value: 'getRecords',
						description:
							'List records from the table. Pass an optional Teable filter object as JSON and a limit.',
						action: 'Get records from Teable',
					},
					{
						name: 'Get Record',
						value: 'getRecord',
						description: 'Fetch a single record by its record ID (recXXX).',
						action: 'Get a record from Teable',
					},
					{
						name: 'Create Record',
						value: 'createRecord',
						description:
							'Create a new record. Pass field name → value pairs as a JSON object e.g. {"Name":"Alice","Status":"Active"}.',
						action: 'Create a record in Teable',
					},
					{
						name: 'Update Record',
						value: 'updateRecord',
						description:
							'Update an existing record by ID. Pass the fields to change as a JSON object.',
						action: 'Update a record in Teable',
					},
					{
						name: 'Delete Record',
						value: 'deleteRecord',
						description: 'Permanently delete a record by its record ID.',
						action: 'Delete a record in Teable',
					},
					{
						name: 'Search Records',
						value: 'searchRecords',
						description:
							'Search for records matching a value. Optionally restrict to a specific field name.',
						action: 'Search records in Teable',
					},
					{
						name: 'Upsert Record',
						value: 'upsertRecord',
						description:
							'Find a record matching a field value and update it, or create a new one if no match is found.',
						action: 'Upsert a record in Teable',
					},
				],
				default: 'getRecords',
			},

			// ── getRecords ──────────────────────────────────────────────────────
			{
				displayName: 'Filter (JSON)',
				name: 'filterJson',
				type: 'json',
				default: '',
				displayOptions: { show: { operation: ['getRecords'] } },
				description:
					'Optional Teable filter object. Example: {"conjunction":"and","filterSet":[{"fieldId":"Status","operator":"is","value":"Active"}]}. Leave empty to return all records.',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 1000 },
				default: 50,
				displayOptions: { show: { operation: ['getRecords', 'searchRecords'] } },
				description: 'Maximum number of records to return.',
			},

			// ── getRecord / updateRecord / deleteRecord ─────────────────────────
			{
				displayName: 'Record ID',
				name: 'recordId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['getRecord', 'updateRecord', 'deleteRecord'] } },
				description: 'The record ID (starts with rec).',
			},

			// ── createRecord / updateRecord ─────────────────────────────────────
			{
				displayName: 'Fields (JSON)',
				name: 'fieldsJson',
				type: 'json',
				required: true,
				default: '{}',
				displayOptions: { show: { operation: ['createRecord', 'updateRecord'] } },
				description:
					'Field name → value pairs as a JSON object. Example: {"Name":"Alice","Category":"Travel","Amount":42.5}.',
			},

			// ── searchRecords ───────────────────────────────────────────────────
			{
				displayName: 'Search Value',
				name: 'searchValue',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['searchRecords'] } },
				description: 'The value to search for.',
			},
			{
				displayName: 'Search Field Name',
				name: 'searchField',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['searchRecords'] } },
				description:
					'Restrict the search to this field name. Leave empty to search across all fields.',
			},

			// ── upsertRecord ────────────────────────────────────────────────────
			{
				displayName: 'Match Field Name',
				name: 'matchField',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['upsertRecord'] } },
				description:
					'The field name used to find an existing record. If a record with that field value exists it will be updated; otherwise a new record is created.',
			},
			{
				displayName: 'Fields (JSON)',
				name: 'upsertFieldsJson',
				type: 'json',
				required: true,
				default: '{}',
				displayOptions: { show: { operation: ['upsertRecord'] } },
				description:
					'Field name → value pairs as a JSON object. The match field must be included so the upsert can read its value.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getSpaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await teableApiRequest.call(this, 'GET', '/space');
				const spaces = Array.isArray(response)
					? response
					: (response as IDataObject)?.spaces ?? [];
				return (spaces as IDataObject[]).map((s) => ({
					name: (s.name ?? s.id) as string,
					value: s.id as string,
				}));
			},

			async getBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const spaceId = this.getCurrentNodeParameter('spaceId') as string;
				if (!spaceId) return [];
				const response = await teableApiRequest.call(this, 'GET', `/space/${spaceId}/base`);
				const bases = (response as IDataObject)?.bases ?? response;
				return (bases as IDataObject[]).map((b) => ({
					name: b.name as string,
					value: b.id as string,
				}));
			},

			async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const baseId = this.getCurrentNodeParameter('baseId') as string;
				if (!baseId) return [];
				const response = await teableApiRequest.call(this, 'GET', `/base/${baseId}/table`);
				const tables = (response as IDataObject)?.tables ?? response;
				return (tables as IDataObject[]).map((t) => ({
					name: t.name as string,
					value: t.id as string,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const tableId = this.getNodeParameter('tableId', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			try {
				// ── getRecords ───────────────────────────────────────────────────
				if (operation === 'getRecords') {
					const filterJson = this.getNodeParameter('filterJson', i, '') as string | IDataObject;
					const limit = this.getNodeParameter('limit', i) as number;

					const qs: IDataObject = { take: limit };
					if (filterJson) {
						qs.filter =
							typeof filterJson === 'string' ? filterJson : JSON.stringify(filterJson);
					}

					const response = await teableApiRequest.call(
						this,
						'GET',
						`/table/${tableId}/record`,
						{},
						qs,
					);
					const records = (response as IDataObject)?.records as IDataObject[] ?? [];
					returnData.push(...records.map((r) => ({ json: r })));
				}

				// ── getRecord ────────────────────────────────────────────────────
				else if (operation === 'getRecord') {
					const recordId = this.getNodeParameter('recordId', i) as string;
					const response = await teableApiRequest.call(
						this,
						'GET',
						`/table/${tableId}/record/${recordId}`,
					);
					returnData.push({ json: response as IDataObject });
				}

				// ── createRecord ─────────────────────────────────────────────────
				else if (operation === 'createRecord') {
					const fieldsRaw = this.getNodeParameter('fieldsJson', i) as string | IDataObject;
					const fields: IDataObject =
						typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;

					const response = await teableApiRequest.call(
						this,
						'POST',
						`/table/${tableId}/record`,
						{ records: [{ fields }] },
					);
					const created = (response as IDataObject)?.records as IDataObject[];
					returnData.push({ json: created?.[0] ?? (response as IDataObject) });
				}

				// ── updateRecord ─────────────────────────────────────────────────
				else if (operation === 'updateRecord') {
					const recordId = this.getNodeParameter('recordId', i) as string;
					const fieldsRaw = this.getNodeParameter('fieldsJson', i) as string | IDataObject;
					const fields: IDataObject =
						typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;

					const response = await teableApiRequest.call(
						this,
						'PATCH',
						`/table/${tableId}/record`,
						{ records: [{ id: recordId, fields }] },
					);
					const updated = (response as IDataObject)?.records as IDataObject[];
					returnData.push({ json: updated?.[0] ?? (response as IDataObject) });
				}

				// ── deleteRecord ─────────────────────────────────────────────────
				else if (operation === 'deleteRecord') {
					const recordId = this.getNodeParameter('recordId', i) as string;
					await teableApiRequest.call(
						this,
						'DELETE',
						`/table/${tableId}/record`,
						{},
						{ recordIds: recordId },
					);
					returnData.push({ json: { success: true, deletedId: recordId } });
				}

				// ── searchRecords ────────────────────────────────────────────────
				else if (operation === 'searchRecords') {
					const searchValue = this.getNodeParameter('searchValue', i) as string;
					const searchField = this.getNodeParameter('searchField', i, '') as string;
					const limit = this.getNodeParameter('limit', i) as number;

					// Teable expects search as a JSON tuple: [value, fieldName|null, exactMatch]
					const searchTuple: (string | boolean | null)[] = [
						searchValue,
						searchField || null,
						false,
					];

					const response = await teableApiRequest.call(
						this,
						'GET',
						`/table/${tableId}/record`,
						{},
						{ search: JSON.stringify(searchTuple), take: limit },
					);
					const records = (response as IDataObject)?.records as IDataObject[] ?? [];
					returnData.push(...records.map((r) => ({ json: r })));
				}

				// ── upsertRecord ─────────────────────────────────────────────────
				else if (operation === 'upsertRecord') {
					const matchField = this.getNodeParameter('matchField', i) as string;
					const fieldsRaw = this.getNodeParameter('upsertFieldsJson', i) as string | IDataObject;
					const fields: IDataObject =
						typeof fieldsRaw === 'string' ? JSON.parse(fieldsRaw) : fieldsRaw;

					const matchValue = fields[matchField];
					if (matchValue === undefined) {
						throw new Error(
							`Upsert: field "${matchField}" not found in the supplied fields JSON. ` +
							`Make sure the match field is included in the fields object.`,
						);
					}

					// Look for an existing record with this field value
					const filter = {
						conjunction: 'and',
						filterSet: [{ fieldId: matchField, operator: 'is', value: String(matchValue) }],
					};
					const searchResponse = await teableApiRequest.call(
						this,
						'GET',
						`/table/${tableId}/record`,
						{},
						{ filter: JSON.stringify(filter), take: 1 },
					);
					const existing = ((searchResponse as IDataObject)?.records as IDataObject[]) ?? [];

					let result: IDataObject;
					if (existing.length > 0) {
						// Update
						const existingId = existing[0].id as string;
						const updateResponse = await teableApiRequest.call(
							this,
							'PATCH',
							`/table/${tableId}/record`,
							{ records: [{ id: existingId, fields }] },
						);
						const updated = (updateResponse as IDataObject)?.records as IDataObject[];
						result = { ...updated?.[0], __upsertAction: 'updated' };
					} else {
						// Create
						const createResponse = await teableApiRequest.call(
							this,
							'POST',
							`/table/${tableId}/record`,
							{ records: [{ fields }] },
						);
						const created = (createResponse as IDataObject)?.records as IDataObject[];
						result = { ...created?.[0], __upsertAction: 'created' };
					}

					returnData.push({ json: result });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
