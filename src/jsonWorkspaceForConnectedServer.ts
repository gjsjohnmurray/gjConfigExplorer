import { AutomaticLayout, Location, RankDirection, Workspace } from "structurizr-typescript";
import { IRISConnection } from "./iris";
import * as irisNative from '@intersystems/intersystems-iris-native';
import { logChannel } from "./extension";

export function workspaceForConnectedServer(irisConnection: IRISConnection): Workspace | undefined {
    if (!irisConnection.connection || !irisConnection.iris) {
        return undefined;
    }
    const uniqueInstanceName = irisConnection.iris.classMethodString('%SYS.System', 'GetUniqueInstanceName', 0);
    const serverVersion = irisConnection.iris.getServerVersion();
    logChannel.debug(`$system.GetUniqueInstanceName(0) = ${uniqueInstanceName}`);
    logChannel.debug(`Server version is ${serverVersion}`);
    const ws = new Workspace(`gj :: configExplorer diagrams for '${irisConnection.serverSpec?.name}'`, `Configuration of ${uniqueInstanceName} (${serverVersion})`);

    const user = ws.model.addPerson('User', 'uses the server')!;
    const server = ws.model.addSoftwareSystem(
        `Server '${irisConnection.serverSpec?.name}' (${uniqueInstanceName})`,
        `${serverVersion}`
    )!;
    server.location = Location.Internal;
    user.uses(server, 'use web applications');


    const autoLayout = new AutomaticLayout();
    autoLayout.rankDirection = RankDirection.TopBottom;
    autoLayout.edgeSeparation = 400;
    autoLayout.rankSeparation = 300;
    autoLayout.nodeSeparation = 300;
    
    const systemContext = ws.views.createSystemContextView(
        server,
        'server-context',
        'The system context view for the server'
    );
    systemContext.addNearestNeighbours(server);
    systemContext.automaticLayout = autoLayout;
    

    let sc: irisNative.IRISReturnType | null;
    let oResultSet: irisNative.IRISObject | null;

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

    return ws;
}