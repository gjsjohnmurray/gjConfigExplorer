import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as portfinder from 'portfinder';
import * as http from 'http';
import {
	Uri,
	env,
} from 'vscode';
import { jsonUri, logChannel } from './extension';

export class StructurizrLite {
    static containerName: string | undefined;
    static port: number | undefined;
    static instance: StructurizrLite;
    public static async getInstance(): Promise<StructurizrLite> {
        if (!StructurizrLite.instance) {
            const jsonFilePath = jsonUri.fsPath;
            // Create a stub workspace file to prevent container from writing its own, which can cause permission issues when we want to replace it later
            await vscode.workspace.fs.writeFile(jsonUri, new TextEncoder().encode('{}\n'));
            logChannel.debug(`Wrote stub workspace file to ${jsonFilePath} before starting Structurizr Lite`);
            StructurizrLite.instance = new StructurizrLite();
            const port = await portfinder.getPort({});
            StructurizrLite.containerName = createRandomString();
            const ws = path.dirname(jsonFilePath);
            logChannel.debug(`Starting Structurizr Lite container ${StructurizrLite.containerName} on port ${port} to view ${jsonFilePath}`);

            cp.exec(
                `docker run -p 127.0.0.1:${port}:8080 --name ${StructurizrLite.containerName} -v "${ws}:/usr/local/structurizr" structurizr/lite:latest`,
                function (error, stdout, stderr) {
                    if (error) {
                        logChannel.error(`Error starting Structurizr Lite container: ${error}`);
                        return;
                    }
                    logChannel.trace(`Docker stdout: ${stdout}`);
                    logChannel.trace(`Docker stderr: ${stderr}`);
                },
            );
            await vscode.window.withProgress(
                {
                location: vscode.ProgressLocation.Notification,
                title: `Starting Structurizr Lite on port ${port}...`,
                cancellable: false,
                },
                async (progress) => {
					// Allow lots of time for the container to start up, as it may need to download the image
                    const SECS_TO_WAIT = 180;
                    const SECS_PER_STEP = 1;
                    const start = Date.now();
                    logChannel.debug(`Waiting ${SECS_TO_WAIT} seconds for Structurizr Lite to start...`);
                    progress.report({ increment: 0 });
                    while (true) {
                        if (Date.now() - start > (SECS_TO_WAIT * 1000)) {
                            logChannel.error('Timed out waiting for Structurizr Lite to start');
                            break;
                        }
                        try {
                            await new Promise((resolve, reject) => {
                                const req = http.get(`http://localhost:${port}/`, (res: any) => {
                                    res.on('data', () => { });
                                    res.on('end', () => resolve(true));
                                });
                                req.on('error', (err: any) => reject(err));
                                req.setTimeout(2000, () => {
                                    req.destroy(new Error('Timeout'));
                                });
                            });
                            logChannel.debug('Structurizr Lite is ready');
                            StructurizrLite.port = port;
                            break;
                        } catch (err) {
                            await new Promise(resolve => setTimeout(resolve, SECS_PER_STEP * 1000));
                        }
                        progress.report({ increment: SECS_PER_STEP / SECS_TO_WAIT * 100 });
                    }
                }
            );
        }
        return StructurizrLite.instance;
    }

    public static openUrl(): boolean {
        if (!StructurizrLite.port) {
            logChannel.error('Structurizr Lite port is not yet set');
            return false;
        }
        env.openExternal(Uri.parse(`http://localhost:${StructurizrLite.port}/workspace/diagrams`));
        return true;
    }
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
