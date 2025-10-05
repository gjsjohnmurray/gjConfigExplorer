import * as vscode from "vscode";
import { Uri } from "vscode";
import { IServerSpec } from "@intersystems-community/intersystems-servermanager";

export function getPortalUrl(
	spec: IServerSpec | null,
	page = "/csp/sys/UtilHome.csp",
	queryString: string = ""
): string {
	if (!spec) {
		return "";
	}

	const webServer = spec.webServer;
	return `${webServer.scheme}://${webServer.host}:${webServer.port}${webServer.pathPrefix}${page}?${queryString}`;
}
