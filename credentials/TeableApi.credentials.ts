import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class TeableApi implements ICredentialType {
	name = 'teableApi';
	displayName = 'Teable API';
	documentationUrl = 'https://help.teable.ai/en/api-doc/overview';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'teable_accv...',
			description:
				'Your Teable personal access token. Generate one in your Teable account settings. Enter the token only — do NOT include the "Bearer " prefix.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.teable.ai',
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
}
