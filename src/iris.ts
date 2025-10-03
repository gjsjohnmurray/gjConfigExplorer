import { Disposable } from 'vscode';
import * as serverManager from '@intersystems-community/intersystems-servermanager';
import { logChannel } from './extension';
import * as irisNative from '@intersystems/intersystems-iris-native';

export class IRISConnection extends Disposable{
	public connection: irisNative.Connection | null = null;
	public iris: irisNative.Iris | null = null;
	constructor(serverSpec: serverManager.IServerSpec) {
		super(() => {
			logChannel.debug(`IRISConnection disposed`);
			if (!this.connection) {
				logChannel.debug('No connection to close');
				return;
			}
			if (this.connection.isClosed()) {
				logChannel.debug('Connection already closed');
				return;
			}
			this.connection.close();
			if (!this.connection.isClosed()) {
				logChannel.debug('Connection failed to close');
				return;
			}
			logChannel.debug('Closed connection');
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
		} catch (error) {
			logChannel.error(`IRISConnection error: ${error}`);
			this.connection?.close();
			this.connection = null;
			this.iris = null;
		}
	}
}
