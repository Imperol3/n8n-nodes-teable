import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TeableApi implements ICredentialType {
	name = 'teableApi';
	displayName = 'Teable API';
	documentationUrl = 'https://help.teable.io/api-reference';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Teable personal access token. Generate one in your Teable account settings.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.teable.io',
			description:
				'Leave as default for Teable Cloud. Override with your instance URL for self-hosted Teable (e.g. https://teable.mycompany.com).',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}/api',
			url: '/user/me',
		},
	};
}
