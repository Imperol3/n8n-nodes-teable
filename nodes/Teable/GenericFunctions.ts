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

// Private/loopback CIDRs that must not be reachable via SSRF.
const BLOCKED_HOSTNAMES = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|0\.0\.0\.0)/i;

/**
 * Validate that a base URL is a safe, absolute HTTPS/HTTP URL pointing to a
 * public host. Throws if the URL would allow SSRF against internal services.
 */
export function validateBaseUrl(raw: string): string {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		throw new Error(`Invalid Base URL: "${raw}". Must be a full URL (e.g. https://app.teable.io).`);
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error(`Invalid Base URL protocol "${parsed.protocol}". Only https:// is allowed.`);
	}
	if (BLOCKED_HOSTNAMES.test(parsed.hostname)) {
		throw new Error(`Base URL hostname "${parsed.hostname}" is not allowed. Must be a public host.`);
	}
	return parsed.origin; // strip any path, credentials, or fragments
}

/**
 * Validate that an API path segment (tableId, recordId, etc.) contains only
 * safe characters. Prevents path traversal via user-supplied IDs.
 */
export function validatePathSegment(value: string, label: string): string {
	if (!/^[\w-]+$/.test(value)) {
		throw new Error(`Invalid ${label}: "${value}". Must contain only letters, digits, underscores, or hyphens.`);
	}
	return value;
}

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
	const baseUrl = validateBaseUrl((credentials.baseUrl as string) ?? 'https://app.teable.io');
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
			// Do not echo the raw value — it may contain sensitive content.
			throw new Error('Invalid JSON parameter: could not parse the provided string. Check for syntax errors.');
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
