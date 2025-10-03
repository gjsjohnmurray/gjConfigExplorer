/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import * as irisNative from '@intersystems/intersystems-iris-native';
import * as cp from 'child_process';
import { IRISConnection } from './iris';
import { containerName, hasDocker, setupStructurizrLiteCommand } from './structurizrLite';
import { monkeyWorkspace } from './monkeyWorkspace';
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

	const json = JSON.stringify(monkeyWorkspace.toDto());
	await vscode.workspace.fs.writeFile(jsonUri, new TextEncoder().encode(json));

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
	
	setupStructurizrLiteCommand(context);

	context.subscriptions.push(
		vscode.commands.registerCommand(`${extensionId}.explore`, async () => {
			logChannel.info('Explore command invoked');
			const scope: vscode.ConfigurationScope | undefined= undefined;
			const serverName = await serverManagerApi.pickServer();
			if (!serverName) {
				return;
			}
			
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

			const irisConnection = new IRISConnection(serverSpec);
			if (!irisConnection.connection || !irisConnection.iris) {
				vscode.window.showErrorMessage(`Cannot connect to server '${serverName}'`);
			}
			else {
				logChannel.info(`Connected to server '${serverName}'`);
			}

			if (!irisConnection.connection || !irisConnection.iris) {
				vscode.window.showErrorMessage(`No usable IRIS connection for server '${serverName}'`);
				return;
			}

			let sc: irisNative.IRISReturnType | null;
			let oResultSet: irisNative.IRISObject | null;
			logChannel.info(`Server version is ${irisConnection.iris.getServerVersion()}`);
			logChannel.info(`$system.GetUniqueInstanceName(0) = ${irisConnection.iris.classMethodString('%SYS.System', 'GetUniqueInstanceName', 0)}`);

			const list = irisConnection.iris.classMethodIRISList('Config.Startup', 'GetList');
			logChannel.debug('Config.Startup: sc=' + list.getString(1));
			const dataList = list.getIRISList(2);
			const output = [`Config.Startup (${dataList.count()} items):`];
			for (let index = 0; index < dataList.count(); index++) {
				const element = dataList.getIRISList(index + 1);
				output.push(` ${element.getString(1)}=${element.getString(2)}`);
			}
			logChannel.info(output.join('\n'));

			oResultSet = (irisConnection.iris.classMethodObject('%ResultSet', '%New', 'SYS.ECP:ServerList') as irisNative.IRISObject);
			if (oResultSet === null) {
				logChannel.warn('Error creating %ResultSet for SYS.ECP:ServerList');
			}
			else {
				sc = oResultSet.invoke('Execute');
				if (!sc) {
					logChannel.warn('Error executing query' + sc);
					irisConnection.connection.close();
					return;
				}
				logChannel.debug(`Query ${oResultSet.getString('QueryName')} executed successfully`);

				while (oResultSet.invokeBoolean('%Next')) {
					const sServerName = oResultSet.invokeString('Get', 'Server Name');
					const sStatus = oResultSet.invokeString('Get', 'Status');
					const sIPAddress = oResultSet.invokeString('Get', 'IP Address');
					const iIPPort = oResultSet.invokeString('Get', 'IP Port');
					logChannel.info('Server: ' + sServerName + ', Status: ' + sStatus + ', IP: ' + sIPAddress + ', Port: ' + iIPPort);
				}
			}
			irisConnection.dispose();
		})
	);
}

export function deactivate() {
	logChannel.debug('Extension deactivated');
	if (containerName) {
		logChannel.debug(`Remove Structurizr Lite container ${containerName}`);
		cp.execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
	}
}
