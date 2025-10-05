/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import * as cp from 'child_process';
import { IRISConnection } from './iris';
import { hasDocker, StructurizrLite } from './structurizrLite';
import { monkeyWorkspace } from './monkeyWorkspace';
import { workspaceForConnectedServer } from './jsonWorkspaceForConnectedServer';
//import { makeRESTRequest } from './makeRESTRequest';

interface IHosts {
	[key: string]: { enabled: boolean };
}

export const extensionId = "georgejames.config-explorer";

export let extensionUri: vscode.Uri;
export let logChannel: vscode.LogOutputChannel;
export let jsonUri: vscode.Uri;

let serverManagerApi: serverManager.ServerManagerAPI;

export async function activate(context: vscode.ExtensionContext) {

	extensionUri = context.extensionUri;
	jsonUri = context.globalStorageUri;
	await vscode.workspace.fs.createDirectory(jsonUri);
	jsonUri = jsonUri.with({ path: jsonUri.path + '/workspace.json' });
	logChannel = vscode.window.createOutputChannel('gj :: configExplorer', { log: true});
	logChannel.info('Extension activated');
	logChannel.debug(`JSON file will be written at ${jsonUri.fsPath}`);

	const serverManagerExt = vscode.extensions.getExtension(serverManager.EXTENSION_ID);
	if (!serverManagerExt) {
		throw new Error('Server Manager extension not installed');
	}
	if (!serverManagerExt.isActive) {
	  await serverManagerExt.activate();
	}
    serverManagerApi = serverManagerExt.exports;


	if (!hasDocker()) {
		throw new Error(`The 'gj :: configExplorer' extension requires Docker Engine to be installed`);
	}
	
	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionId}.explore`, async (serverName?: string) => {
			logChannel.debug('Explore command invoked');
			const scope: vscode.ConfigurationScope | undefined= undefined;

			const structurizrLite = await StructurizrLite.getInstance();
			if (!serverName) {
				serverName = await serverManagerApi.pickServer();
				if (!serverName) {
					return;
				}
			}
			
			const serverSpec: serverManager.IServerSpec | undefined = await serverManagerApi.getServerSpec(serverName, scope);
			if (!serverSpec) {
				vscode.window.showErrorMessage(`Server '${serverName}' unknown`);
				return;
			}
			if (!serverSpec.superServer?.port) {
				vscode.window.showErrorMessage(`Server '${serverName}' does not have a SuperServer port configured`);
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

			const irisConnection = new IRISConnection(serverSpec);
			serverSpec.password = undefined; // Clear password from memory once used
			if (!irisConnection.connection || !irisConnection.iris) {
				vscode.window.showErrorMessage(`Cannot connect to server '${serverName}'`);
			}
			else {
				logChannel.debug(`Connected to server '${serverName}'`);
			}

			if (!irisConnection.connection || !irisConnection.iris) {
				vscode.window.showErrorMessage(`No usable IRIS connection for server '${serverName}'`);
				return;
			}

			const workspace = workspaceForConnectedServer(irisConnection);
			if (!workspace) {
				vscode.window.showErrorMessage(`Cannot create workspace for server '${serverName}'`);
				return;
			}

			const json = JSON.stringify(workspace.toDto());
			await vscode.workspace.fs.writeFile(jsonUri, new TextEncoder().encode(json));
			logChannel.debug(`Wrote workspace for server '${serverName}' to ${jsonUri.fsPath}`);

			if (!StructurizrLite.openUrl()) {
				vscode.window.showErrorMessage(`Structurizr Lite is not yet ready to view the workspace`);
			}
		})
	);
}

export function deactivate() {
	logChannel.debug('Extension deactivated');
	if (StructurizrLite.containerName) {
		logChannel.debug(`Remove Structurizr Lite container ${StructurizrLite.containerName}`);
		cp.execSync(`docker rm -f ${StructurizrLite.containerName}`, { stdio: 'ignore' });
	}
}
