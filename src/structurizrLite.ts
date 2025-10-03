import * as cp from 'child_process';
import * as path from 'path';
import * as portfinder from 'portfinder';
import {
	ExtensionContext,
	Uri,
	commands,
	env,
} from 'vscode';
import { dslUri, extensionId, logChannel } from './extension';

export let containerName: string;
let litePort: number

/*
 * Provides dsl preview leveraging containerized Structurizr
 */
export function setupStructurizrLiteCommand(context: ExtensionContext) {
	context.subscriptions.push(
		commands.registerCommand(`${extensionId}.renderInStructurizrLite`, async () => {
            function openDiagramsUrl() {
                env.openExternal(Uri.parse(`http://localhost:${litePort}/workspace/diagrams`));
            }
            if (!containerName) {
                portfinder.getPort(function (_: any, port: any) {
                    litePort = port;
                    containerName = createRandomString();
                    const ws = path.dirname(dslUri.fsPath);
                    logChannel.info(`Starting Structurizr Lite container ${containerName} on port ${port} for workspace ${ws}/ ...`);
                    
                    cp.exec(`docker run -p 127.0.0.1:${port}:8080 --name ${containerName} -v "${ws}:/usr/local/structurizr" structurizr/lite:latest`,
                        function (error, stdout, stderr) {
                            if (error) {
                                logChannel.error(`Error starting Structurizr Lite container: ${error}`);
                                return;
                            }
                            logChannel.trace(`Docker stdout: ${stdout}`);
                            logChannel.trace(`Docker stderr: ${stderr}`);
                        });
                    openDiagramsUrl();
                });
            }
            else {
                openDiagramsUrl();
            }
		}
		));
}

export function hasDocker() {
	try {
		cp.execSync('docker --version', { stdio: 'ignore' });
		return true;
	} catch (e) {
		return false;
	}
}

function createRandomString() {
	var text = "gjConfigExplorer_";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < 5; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}