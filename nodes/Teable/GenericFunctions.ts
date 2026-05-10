import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IDataObject,
	NodeApiError,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';

/**
 * Make an authenticated request to the Teable API.
 */
export async function teableApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('teableApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/$/, '');
	const apiToken = (credentials.apiToken as string).replace(/^Bearer\s+/i, '');

	const options: IRequestOptions = {
		method,
		uri: `${baseUrl}/api${endpoint}`,
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
		qs,
		body,
		json: true,
	};

	// Remove empty body for GET/DELETE
	if (method === 'GET' || method === 'DELETE') {
		delete options.body;
	}

	try {
		return await this.helpers.request(options);
	} catch (error: any) {
		const status = error?.statusCode ?? error?.response?.statusCode ?? '';
		const body = error?.response?.body;
		const bodyMsg =
			typeof body === 'string'
				? body.slice(0, 300)
				: body?.message ?? (body ? JSON.stringify(body).slice(0, 300) : '');
		const message = bodyMsg || error?.message || `Request failed${status ? ` (HTTP ${status})` : ''}`;
		throw new NodeApiError(this.getNode(), error as any, { message: String(message) });
	}
}

/**
 * Fetch ALL records by automatically paginating with skip/take.
 * Teable's max per page is 1000.
 */
export async function teableApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any[]> {
	const PAGE_SIZE = 1000;
	const results: any[] = [];

	let skip = 0;
	let hasMore = true;

	while (hasMore) {
		const response = await teableApiRequest.call(this, method, endpoint, body, {
			...qs,
			take: PAGE_SIZE,
			skip,
		});

		const records: any[] = response?.records ?? response ?? [];
		results.push(...records);

		// Teable returns a `total` count — stop when we have everything
		const total: number = response?.total ?? records.length;
		skip += PAGE_SIZE;
		hasMore = skip < total;
	}

	return results;
}

/**
 * Parse a JSON string or pass through an object.
 * Used for filter/orderBy parameters that users can supply as raw JSON.
 */
export function parseJsonParameter(value: string | IDataObject): IDataObject {
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as IDataObject;
		} catch {
			throw new Error(`Invalid JSON: ${value}`);
		}
	}
	return value;
}

/**
 * Build a fields object from an n8n "fixedCollection" additionalFields value.
 */
export function buildFieldsObject(
	fieldsUi: IDataObject,
	fieldsKey = 'fieldValues',
): IDataObject {
	const items = fieldsUi[fieldsKey] as Array<{ fieldName: string; fieldValue: string }> | undefined;
	if (!items?.length) return {};

	const fields: IDataObject = {};
	for (const { fieldName, fieldValue } of items) {
		try {
			fields[fieldName] = JSON.parse(fieldValue);
		} catch {
			fields[fieldName] = fieldValue;
		}
	}
	return fields;
}
