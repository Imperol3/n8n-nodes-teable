import {
	IExecuteFunctions,
	IDataObject,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	NodeOperationError,
} from 'n8n-workflow';

import {
	teableApiRequest,
	teableApiRequestAllItems,
	parseJsonParameter,
	buildFieldsObject,
} from './GenericFunctions';

import { recordOperations, recordFields } from './RecordDescription';
import { tableOperations, tableFields } from './TableDescription';
import { spaceOperations, spaceFields } from './SpaceDescription';

const BATCH_SIZE = 1000;

export class Teable implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Teable',
		name: 'teable',
		// icon: 'file:teable.svg',   // uncomment once you add an SVG icon
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write records, tables, and spaces in Teable.io',
		defaults: { name: 'Teable' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'teableApi', required: true, testedBy: 'teableApiCredentialTest' }],
		properties: [
			// ── Resource selector ─────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Record', value: 'record' },
					{ name: 'Table', value: 'table' },
					{ name: 'Space / Base', value: 'space' },
				],
				default: 'record',
			},
			// ── Operations ─────────────────────────────────────────
			...recordOperations,
			...tableOperations,
			...spaceOperations,
			// ── Fields ─────────────────────────────────────────────
			...recordFields,
			...tableFields,
			...spaceFields,
		],
	};

	// ─────────────────────────────────────────────────────────────
	// loadOptions — power Space → Base → Table dropdowns elsewhere
	// ─────────────────────────────────────────────────────────────
	methods = {
		credentialTest: {
			async teableApiCredentialTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data as IDataObject;
				const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
				const apiToken = credentials.apiToken as string;

				try {
					await this.helpers.request({
						method: 'GET',
						url: `${baseUrl}/api/space`,
						headers: { Authorization: `Bearer ${apiToken}` },
						json: true,
					});
					return { status: 'OK', message: 'Connection successful' };
				} catch (error: any) {
					// 403 means the token is valid but scope-restricted — still authenticated
					if (error.statusCode === 403) {
						return { status: 'OK', message: 'Connection successful' };
					}
					return {
						status: 'Error',
						message: error.message ?? 'Could not connect. Check your API token and Base URL.',
					};
				}
			},
		},

		loadOptions: {
			async getSpaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const spaces = await teableApiRequest.call(this, 'GET', '/space');
				return (spaces as IDataObject[]).map((s) => ({
					name: s.name as string,
					value: s.id as string,
				}));
			},

			async getBases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const spaceId = this.getCurrentNodeParameter('spaceId') as string;
				const response = await teableApiRequest.call(
					this,
					'GET',
					`/space/${spaceId}/base`,
				);
				const bases = (response as IDataObject)?.bases ?? response;
				return (bases as IDataObject[]).map((b) => ({
					name: b.name as string,
					value: b.id as string,
				}));
			},

			async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const baseId = this.getCurrentNodeParameter('baseId') as string;
				const response = await teableApiRequest.call(
					this,
					'GET',
					`/base/${baseId}/table`,
				);
				const tables = (response as IDataObject)?.tables ?? response;
				return (tables as IDataObject[]).map((t) => ({
					name: t.name as string,
					value: t.id as string,
				}));
			},

			async getTableFields(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const tableId = this.getCurrentNodeParameter('tableId') as string;
				const fields = await teableApiRequest.call(this, 'GET', `/table/${tableId}/field`);
				return (fields as IDataObject[]).map((f) => ({
					name: `${f.name} (${f.type})`,
					value: f.id as string,
				}));
			},
		},
	};

	// ─────────────────────────────────────────────────────────────
	// execute
	// ─────────────────────────────────────────────────────────────
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				// ────────────────── RECORD ──────────────────────────
				if (resource === 'record') {
					const tableId = this.getNodeParameter('tableId', i) as string;

					// ── getAll ─────────────────────────────────────
					if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const opts = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;

						const qs: IDataObject = {};
						if (opts.viewId) qs.viewId = opts.viewId;
						if (opts.fieldKeyType) qs.fieldKeyType = opts.fieldKeyType;
						if (opts.cellFormat) qs.cellFormat = opts.cellFormat;
						if (opts.filter) qs.filter = JSON.stringify(parseJsonParameter(opts.filter as string));
						if (opts.orderBy) qs.orderBy = JSON.stringify(parseJsonParameter(opts.orderBy as string));
						if (opts.selectedFieldIds) {
							qs['selectedFieldIds[]'] = (opts.selectedFieldIds as string)
								.split(',')
								.map((s) => s.trim());
						}

						let records: IDataObject[];
						if (returnAll) {
							records = await teableApiRequestAllItems.call(
								this,
								'GET',
								`/table/${tableId}/record`,
								{},
								qs,
							);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							const response = await teableApiRequest.call(
								this,
								'GET',
								`/table/${tableId}/record`,
								{},
								{ ...qs, take: limit },
							);
							records = (response as IDataObject)?.records as IDataObject[] ?? [];
						}

						returnData.push(...records.map((r) => ({ json: r })));
					}

					// ── get ────────────────────────────────────────
					else if (operation === 'get') {
						const recordId = this.getNodeParameter('recordId', i) as string;
						const opts = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const qs: IDataObject = {};
						if (opts.fieldKeyType) qs.fieldKeyType = opts.fieldKeyType;
						if (opts.cellFormat) qs.cellFormat = opts.cellFormat;

						const record = await teableApiRequest.call(
							this,
							'GET',
							`/table/${tableId}/record/${recordId}`,
							{},
							qs,
						);
						returnData.push({ json: record as IDataObject });
					}

					// ── create ─────────────────────────────────────
					else if (operation === 'create') {
						const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const fields = buildFieldsObject(
							this.getNodeParameter('fieldsUi', i, {}) as IDataObject,
							'fieldValues',
						);
						const body: IDataObject = {
							records: [{ fields }],
						};
						if (additionalOptions.fieldKeyType) body.fieldKeyType = additionalOptions.fieldKeyType;

						const response = await teableApiRequest.call(
							this,
							'POST',
							`/table/${tableId}/record`,
							body,
						);
						const created = (response as IDataObject)?.records as IDataObject[];
						returnData.push(...(created ?? [{ json: response as IDataObject }]).map((r) => ({ json: r })));
					}

					// ── createMany ─────────────────────────────────
					else if (operation === 'createMany') {
						const recordsRaw = this.getNodeParameter('recordsJson', i) as string | IDataObject[];
						const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const records = (
							typeof recordsRaw === 'string' ? JSON.parse(recordsRaw) : recordsRaw
						) as IDataObject[];

						const allCreated: IDataObject[] = [];
						for (let b = 0; b < records.length; b += BATCH_SIZE) {
							const chunk = records.slice(b, b + BATCH_SIZE);
							const body: IDataObject = { records: chunk };
							if (additionalOptions.fieldKeyType) body.fieldKeyType = additionalOptions.fieldKeyType;
							const response = await teableApiRequest.call(
								this,
								'POST',
								`/table/${tableId}/record`,
								body,
							);
							const created = (response as IDataObject)?.records as IDataObject[] ?? [];
							allCreated.push(...created);
						}
						returnData.push(...allCreated.map((r) => ({ json: r })));
					}

					// ── update ─────────────────────────────────────
					else if (operation === 'update') {
						const recordId = this.getNodeParameter('recordId', i) as string;
						const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const fields = buildFieldsObject(
							this.getNodeParameter('fieldsUi', i, {}) as IDataObject,
							'fieldValues',
						);
						const body: IDataObject = {
							records: [{ id: recordId, fields }],
						};
						if (additionalOptions.fieldKeyType) body.fieldKeyType = additionalOptions.fieldKeyType;

						const response = await teableApiRequest.call(
							this,
							'PATCH',
							`/table/${tableId}/record`,
							body,
						);
						const updated = (response as IDataObject)?.records as IDataObject[];
						returnData.push(...(updated ?? [{ json: response as IDataObject }]).map((r) => ({ json: r })));
					}

					// ── updateMany ─────────────────────────────────
					else if (operation === 'updateMany') {
						const recordsRaw = this.getNodeParameter('recordsJson', i) as string | IDataObject[];
						const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const records = (
							typeof recordsRaw === 'string' ? JSON.parse(recordsRaw) : recordsRaw
						) as IDataObject[];

						const allUpdated: IDataObject[] = [];
						for (let b = 0; b < records.length; b += BATCH_SIZE) {
							const chunk = records.slice(b, b + BATCH_SIZE);
							const body: IDataObject = { records: chunk };
							if (additionalOptions.fieldKeyType) body.fieldKeyType = additionalOptions.fieldKeyType;
							const response = await teableApiRequest.call(
								this,
								'PATCH',
								`/table/${tableId}/record`,
								body,
							);
							const updated = (response as IDataObject)?.records as IDataObject[] ?? [];
							allUpdated.push(...updated);
						}
						returnData.push(...allUpdated.map((r) => ({ json: r })));
					}

					// ── delete ─────────────────────────────────────
					else if (operation === 'delete') {
						const recordId = this.getNodeParameter('recordId', i) as string;
						await teableApiRequest.call(
							this,
							'DELETE',
							`/table/${tableId}/record`,
							{},
							{ 'recordIds[]': [recordId] },
						);
						returnData.push({ json: { success: true, recordId } });
					}

					// ── upsert ─────────────────────────────────────
					else if (operation === 'upsert') {
						const upsertFieldName = this.getNodeParameter('upsertFieldName', i) as string;
						const additionalOptions = this.getNodeParameter('additionalOptions', i, {}) as IDataObject;
						const fields = buildFieldsObject(
							this.getNodeParameter('fieldsUi', i, {}) as IDataObject,
							'fieldValues',
						);
						const body: IDataObject = {
							records: [{ fields }],
							fieldKeyType: additionalOptions.fieldKeyType ?? 'name',
							typecast: true,
						};

						// Search for an existing record with matching field value
						const fieldValue = fields[upsertFieldName];
						if (fieldValue === undefined) {
							throw new NodeOperationError(
								this.getNode(),
								`Upsert field "${upsertFieldName}" not found in the provided fields.`,
								{ itemIndex: i },
							);
						}

						const filter = {
							conjunction: 'and',
							filterSet: [
								{
									fieldId: upsertFieldName,
									operator: '=',
									value: fieldValue,
								},
							],
						};

						const searchResponse = await teableApiRequest.call(
							this,
							'GET',
							`/table/${tableId}/record`,
							{},
							{
								filter: JSON.stringify(filter),
								fieldKeyType: body.fieldKeyType,
								take: 1,
							},
						);
						const existing = ((searchResponse as IDataObject)?.records as IDataObject[]) ?? [];

						let result: IDataObject;
						if (existing.length > 0) {
							// Update existing record
							const existingId = existing[0].id as string;
							const updateBody: IDataObject = {
								records: [{ id: existingId, fields }],
								fieldKeyType: body.fieldKeyType,
							};
							const updateResponse = await teableApiRequest.call(
								this,
								'PATCH',
								`/table/${tableId}/record`,
								updateBody,
							);
							const updated = (updateResponse as IDataObject)?.records as IDataObject[];
							result = updated?.[0] ?? updateResponse as IDataObject;
						} else {
							// Create new record
							const createResponse = await teableApiRequest.call(
								this,
								'POST',
								`/table/${tableId}/record`,
								body,
							);
							const created = (createResponse as IDataObject)?.records as IDataObject[];
							result = created?.[0] ?? createResponse as IDataObject;
						}
						returnData.push({ json: result });
					}

					// ── search ─────────────────────────────────────
					else if (operation === 'search') {
						const searchQuery = this.getNodeParameter('searchQuery', i) as string;
						const searchFieldId = this.getNodeParameter('searchFieldId', i, '') as string;
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const limit = returnAll ? 1000 : (this.getNodeParameter('limit', i) as number);

						const qs: IDataObject = {
							search: searchQuery,
							take: limit,
						};
						if (searchFieldId) qs.searchFieldId = searchFieldId;

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
				}

				// ────────────────── TABLE ───────────────────────────
				else if (resource === 'table') {
					// ── getAll ─────────────────────────────────────
					if (operation === 'getAll') {
						const baseId = this.getNodeParameter('baseId', i) as string;
						const response = await teableApiRequest.call(
							this,
							'GET',
							`/base/${baseId}/table`,
						);
						const tables = (response as IDataObject)?.tables ?? response;
						returnData.push(
							...(tables as IDataObject[]).map((t) => ({ json: t })),
						);
					}

					// ── getSchema ──────────────────────────────────
					else if (operation === 'getSchema') {
						const tableId = this.getNodeParameter('tableId', i) as string;
						const fields = await teableApiRequest.call(
							this,
							'GET',
							`/table/${tableId}/field`,
						);
						returnData.push(
							...(fields as IDataObject[]).map((f) => ({ json: f })),
						);
					}

					// ── getViews ───────────────────────────────────
					else if (operation === 'getViews') {
						const tableId = this.getNodeParameter('tableId', i) as string;
						const views = await teableApiRequest.call(
							this,
							'GET',
							`/table/${tableId}/view`,
						);
						returnData.push(
							...(views as IDataObject[]).map((v) => ({ json: v })),
						);
					}
				}

				// ────────────────── SPACE ───────────────────────────
				else if (resource === 'space') {
					// ── listSpaces ─────────────────────────────────
					if (operation === 'listSpaces') {
						const spaces = await teableApiRequest.call(this, 'GET', '/space');
						returnData.push(
							...(spaces as IDataObject[]).map((s) => ({ json: s })),
						);
					}

					// ── listBases ──────────────────────────────────
					else if (operation === 'listBases') {
						const spaceId = this.getNodeParameter('spaceId', i) as string;
						const response = await teableApiRequest.call(
							this,
							'GET',
							`/space/${spaceId}/base`,
						);
						const bases = (response as IDataObject)?.bases ?? response;
						returnData.push(
							...(bases as IDataObject[]).map((b) => ({ json: b })),
						);
					}
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
