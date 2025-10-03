import { Disposable } from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { logChannel } from './extension';
import * as irisNative from '@intersystems/intersystems-iris-native';

export class IRISConnection extends Disposable{
	public connection: any;
	public iris: any;
	constructor(serverSpec: serverManager.IServerSpec) {
		super(() => {
			logChannel.debug(`IRISConnection disposed`);
			this.connection?.close();
		});

		const connectionInfo: irisNative.ConnectionInfo = {
			host: serverSpec.superServer?.host ?? serverSpec.webServer.host,
			port: serverSpec.superServer?.port || 1972,
			ns: '%SYS',
			user: serverSpec.username || '',
			pwd: serverSpec.password || '',
			sharedmemory: false,
			timeout: 2000
		};

		try {
			logChannel.debug(`IRISConnection connecting to ${connectionInfo.host}:${connectionInfo.port} as ${connectionInfo.user}`);
			this.connection = irisNative.createConnection(connectionInfo);

			if (this.connection) {
				this.iris = this.connection.createIris();
			}

			if (this.iris) {
				try {
					const initObject = JSON.parse(this.iris.classMethodValue('PolyglotKernel.CodeExecutor', 'Init'));
					logChannel.debug(`IRISConnection Init: ${JSON.stringify(initObject)}`);
				} catch (error) {
					logChannel.debug(`IRISConnection Init failed: ${error}`);
				}
			}

		} catch (error) {
			logChannel.error(`IRISConnection error: ${error}`);
	}
	}
}
