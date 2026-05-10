import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { teableApiRequest } from './GenericFunctions';

export class TeableTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Teable Trigger',
		name: 'teableTrigger',
		icon: 'file:teable.png',
		group: ['trigger'],
		version: 1,
		description: 'Polls for new or updated records in a Teable table. Set the poll interval in the workflow schedule settings.',
		subtitle: '={{$parameter["event"]}}',
		defaults: { name: 'Teable Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'teableApi', required: true }],
		polling: true,
		properties: [
			{
				displayName: 'Space',
				name: 'spaceId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getSpaces' },
				required: true,
				default: '',
				description: 'The Teable space to monitor.',
			},
			{
				displayName: 'Base',
				name: 'baseId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getBases', loadOptionsDependsOn: ['spaceId'] },
				required: true,
				default: '',
				description: 'The base within the space.',
			},
			{
				displayName: 'Table',
				name: 'tableId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTables', loadOptionsDependsOn: ['baseId'] },
				required: true,
				default: '',
				description: 'The table to watch for changes.',
			},
			{
				displayName: 'Trigger On',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'New Record',
						value: 'created',
						description: 'Fires when a new record is added to the table',
					},
					{
						name: 'Record Updated',
						value: 'updated',
						description: 'Fires when an existing record is modified',
					},
					{
						name: 'New or Updated Record',
						value: 'createdOrUpdated',
						description: 'Fires on any change — new records or edits',
					},
				],
				required: true,
				default: 'created',
				description: 'Which type of record change should trigger this workflow.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Records Per Poll',
						name: 'limit',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 1000 },
						default: 100,
						description: 'Max records returned per poll cycle. Raise this if your table receives high-volume bursts.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getSpaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await teableApiRequest.call(this, 'GET', '/space');
				const spaces = Array.isArray(response) ? response : (response as IDataObject)?.spaces ?? [];
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const tableId = this.getNodeParameter('tableId') as string;
		const event = this.getNodeParameter('event') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const limit = (options.limit as number) ?? 100;

		const now = new Date().toISOString();
		const staticData = this.getWorkflowStaticData('node');
		const lastPollTime = staticData.lastPollTime as string | undefined;

		// First activation: bookmark current time and emit nothing.
		// This prevents flooding the workflow with all pre-existing records.
		if (!lastPollTime) {
			staticData.lastPollTime = now;
			return null;
		}

		let records: IDataObject[];
		try {
			records = await fetchNewRecords.call(this, { tableId, event, lastPollTime, limit });
		} catch (error: any) {
			const statusCode = error?.statusCode ?? error?.response?.statusCode;
			// Always advance the timestamp so the trigger never gets stuck on the same window.
			staticData.lastPollTime = now;
			if (statusCode && statusCode >= 500) {
				// Transient server error (e.g. 504 timeout) — skip this cycle silently.
				return null;
			}
			throw error;
		}

		staticData.lastPollTime = now;

		if (records.length === 0) return null;
		return [records.map((r) => ({ json: r }))];
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function fetchNewRecords(
	this: IPollFunctions,
	{ tableId, event, lastPollTime, limit }: {
		tableId: string;
		event: string;
		lastPollTime: string;
		limit: number;
	},
): Promise<IDataObject[]> {
	// Map event type to the Teable system field we filter on
	const createdField = 'createdTime';
	const modifiedField = 'lastModifiedTime';

	if (event === 'createdOrUpdated') {
		// Fetch both created and updated, deduplicate by record ID
		const [created, updated] = await Promise.all([
			queryByTimeField.call(this, tableId, createdField, lastPollTime, limit),
			queryByTimeField.call(this, tableId, modifiedField, lastPollTime, limit),
		]);
		const seen = new Set<string>();
		const merged: IDataObject[] = [];
		for (const r of [...created, ...updated]) {
			const id = r.id as string;
			if (!seen.has(id)) {
				seen.add(id);
				merged.push(r);
			}
		}
		return merged;
	}

	const field = event === 'updated' ? modifiedField : createdField;
	return queryByTimeField.call(this, tableId, field, lastPollTime, limit);
}

async function queryByTimeField(
	this: IPollFunctions,
	tableId: string,
	fieldId: string,
	since: string,
	limit: number,
): Promise<IDataObject[]> {
	// Fetch the most recent records and filter client-side.
	// Server-side date filters on system fields (createdTime / lastModifiedTime)
	// cause 504 timeouts on Teable, so we avoid them entirely.
	const response = await teableApiRequest.call(
		this,
		'GET',
		`/table/${tableId}/record`,
		{},
		{ take: limit },
	);
	const all = (response as IDataObject)?.records as IDataObject[] ?? [];
	return all.filter((r) => {
		const ts = (r[fieldId] as string | undefined) ?? (r.createdTime as string | undefined);
		return ts ? ts > since : false;
	});
}
