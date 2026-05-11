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
		throw new Error('Invalid Base URL. Must be a full URL (e.g. https://app.teable.ai).');
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

/** Extract a numeric HTTP status from whatever shape the error arrives in. */
function extractStatus(error: any): number | undefined {
	const raw = error?.statusCode ?? error?.response?.statusCode ?? error?.response?.status;
	if (raw !== undefined) return Number(raw);
	// NodeApiError stores status in httpCode as a string
	if (error?.httpCode !== undefined) return Number(error.httpCode);
	return undefined;
}

/**
 * Make an authenticated request to the Teable API.
 * Retries up to 3 times on 429 (rate limit) and 5xx (server error)
 * with exponential backoff (1 s → 2 s → 4 s). Respects Retry-After on 429.
 */
export async function teableApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IPollFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('teableApi');
	const baseUrl = validateBaseUrl((credentials.baseUrl as string) ?? 'https://app.teable.ai');
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

	const MAX_ATTEMPTS = 3;
	let lastError: any;

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			return await this.helpers.request(options);
		} catch (error: any) {
			lastError = error;
			const status = extractStatus(error);
			const retryable = status !== undefined && (status === 429 || status >= 500);

			if (!retryable || attempt === MAX_ATTEMPTS) break;

			// Respect Retry-After header on 429; otherwise exponential backoff
			let delayMs = Math.pow(2, attempt - 1) * 1000; // 1 s, 2 s, 4 s
			if (status === 429) {
				const retryAfter = error?.response?.headers?.['retry-after'];
				if (retryAfter) {
					const parsed = Number(retryAfter);
					if (!isNaN(parsed)) delayMs = parsed * 1000;
				}
			}
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	// All attempts exhausted — surface a clean error
	const status = extractStatus(lastError) ?? '';
	const rawBody = lastError?.response?.body;
	const bodyMsg =
		typeof rawBody === 'string'
			? rawBody.slice(0, 300)
			: rawBody?.message ?? (rawBody ? JSON.stringify(rawBody).slice(0, 300) : '');
	const message = bodyMsg || lastError?.message || `Request failed${status ? ` (HTTP ${status})` : ''}`;
	throw new NodeApiError(this.getNode(), lastError as any, { message: String(message) });
}

// Hard cap on Return All to prevent OOM on very large tables.
const MAX_RECORDS_RETURN_ALL = 100_000;

/**
 * Fetch ALL records by automatically paginating with skip/take.
 * Teable's max per page is 1000. Capped at MAX_RECORDS_RETURN_ALL.
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

		if (results.length >= MAX_RECORDS_RETURN_ALL) break;

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

// Keys that must never be used as field names — assigning to these pollutes the prototype chain.
const PROTOTYPE_POISON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Build a fields object from an n8n "fixedCollection" additionalFields value.
 */
export function buildFieldsObject(
	fieldsUi: IDataObject,
	fieldsKey = 'fieldValues',
): IDataObject {
	const items = fieldsUi[fieldsKey] as Array<{ fieldName: string; fieldValue: string }> | undefined;
	if (!items?.length) return {};

	const fields: IDataObject = Object.create(null);
	for (const { fieldName, fieldValue } of items) {
		if (PROTOTYPE_POISON_KEYS.has(fieldName)) {
			throw new Error(`Field name "${fieldName}" is reserved and cannot be used.`);
		}
		try {
			fields[fieldName] = JSON.parse(fieldValue);
		} catch {
			fields[fieldName] = fieldValue;
		}
	}
	return fields;
}
