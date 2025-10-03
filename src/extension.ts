/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { IRISConnection } from './iris';
//import { makeRESTRequest } from './makeRESTRequest';

interface IHosts {
	[key: string]: { enabled: boolean };
}

export const extensionId = "georgejames.config-explorer";

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;

let serverManagerApi: serverManager.ServerManagerAPI;

export async function activate(context: vscode.ExtensionContext) {

	extensionUri = context.extensionUri;
	logChannel = vscode.window.createOutputChannel('gj :: configExplorer', { log: true});
	logChannel.info('Extension activated');

	const serverManagerExt = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
	if (!serverManagerExt) {
		throw new Error('Server Manager extension not installed');
	}
	if (!serverManagerExt.isActive) {
	  await serverManagerExt.activate();
	}
    serverManagerApi = serverManagerExt.exports;
	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionId}.explore`, async () => {
			logChannel.info('Explore command invoked');
			const scope: vscode.ConfigurationScope | undefined= undefined;
			const serverName = 'dem-deltanji';
			//const serverName = 'dem-dev-nocredentials';
			const serverSpec: serverManager.IServerSpec | undefined = await serverManagerApi.getServerSpec(serverName, scope);
			if (!serverSpec) {
				vscode.window.showErrorMessage(`Server '${serverName}' unknown`);
				return;
			}
			if (typeof serverSpec.password === 'undefined') {
				try {
					const scopes = [serverSpec.name, serverSpec.username || ''];
					const account = serverManagerApi.getAccount(serverSpec);
					let session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { silent: true, account });
					if (!session) {
						session = await vscode.authentication.getSession(serverManager.AUTHENTICATION_PROVIDER, scopes, { createIfNone: true, account });
					}
					if (session) {
						serverSpec.username = session.scopes[1];
						serverSpec.password = session.accessToken;
					}
				} catch (error) {
					logChannel.error(`Error getting authentication session for server '${serverName}': ${JSON.stringify(error)}`);
				}
				if (typeof serverSpec.password === 'undefined') {
					vscode.window.showErrorMessage(`No password obtained for server '${serverName}'`);
					return;
				}
			}

			logChannel.info(`Spec: ${JSON.stringify(serverSpec)}`);
			const irisConnection = new IRISConnection(serverSpec);
			logChannel.info(`irisConnection: ${JSON.stringify(!!irisConnection.iris)}`);

			if (!irisConnection.iris) {
				vscode.window.showErrorMessage(`No IRIS connection for server '${serverName}'`);
				return;
			}
		})
	);
}

export function deactivate() {}
