import { AutomaticLayout, Component, Container, ElementStyle, Location, RankDirection, Shape, SoftwareSystem, Workspace } from "structurizr-typescript";
import { IRISConnection } from "./iris";
import * as irisNative from '@intersystems/intersystems-iris-native';
import { logChannel } from "./extension";
import { getPortalUrl } from "./getPortalUrl";

export function workspaceForConnectedServer(irisConnection: IRISConnection): Workspace | undefined {
    if (!irisConnection.connection || !irisConnection.iris) {
        return undefined;
    }
    const uniqueInstanceName = irisConnection.iris.classMethodString('%SYS.System', 'GetUniqueInstanceName', 0);
    const serverVersion = irisConnection.iris.getServerVersion();
    logChannel.debug(`$system.GetUniqueInstanceName(0) = ${uniqueInstanceName}`);
    logChannel.debug(`Server version is ${serverVersion}`);
    const workspace = new Workspace(`gj :: configExplorer diagrams for '${irisConnection.serverSpec?.name}'`, `Configuration of ${uniqueInstanceName} (${serverVersion})`);

    let style: ElementStyle;
    style = new ElementStyle('aDatabase');
    style.shape = Shape.Cylinder;
    style.stroke = '#000000';
    style.color = '#000000';
    workspace.views.configuration.styles.addElementStyle(style);

    style = new ElementStyle('aSystemDatabase');
    style.shape = Shape.Cylinder;
    style.color = '#000000';
    workspace.views.configuration.styles.addElementStyle(style);

    style = new ElementStyle('aRemoteDatabase');
    style.shape = Shape.Cylinder;
    style.stroke = '#000000';
    style.color = '#000000';
    style.background = '#ffffff';
    workspace.views.configuration.styles.addElementStyle(style);

    style = new ElementStyle('aNamespace');
    style.shape = Shape.Folder;
    style.stroke = '#000000';
    style.color = '#000000';
    style.background = '#fb9c05';
    workspace.views.configuration.styles.addElementStyle(style);

    style = new ElementStyle('aPseudoNamespace');
    style.shape = Shape.Folder;
    style.color = '#000000';
    style.background = '#b0b0b0';
    workspace.views.configuration.styles.addElementStyle(style);

    const user = workspace.model.addPerson('User', 'uses the server')!;
    const softwareSystem = workspace.model.addSoftwareSystem(
        `'${irisConnection.serverSpec?.name}'`,
        `Includes ECP data servers used by this server`,
        Location.Internal
    )!;
    user.uses(softwareSystem, 'uses applications');

    const focusedServer = softwareSystem.addContainer(
        `${irisConnection.serverSpec?.name}`,
        `Instance '${uniqueInstanceName}'`,
        'InterSystems server'
    )!;
    if (irisConnection.serverSpec) {
        focusedServer.url = getPortalUrl(irisConnection.serverSpec);
    }

    const autoLayout = new AutomaticLayout();
    autoLayout.rankDirection = RankDirection.TopBottom;
    autoLayout.edgeSeparation = 400;
    autoLayout.rankSeparation = 300;
    autoLayout.nodeSeparation = 300;
    
    const viewSystemContext = workspace.views.createSystemContextView(
        softwareSystem,
        'server-context',
        'The system context view for the focused server'
    );
    viewSystemContext.addNearestNeighbours(softwareSystem);
    viewSystemContext.automaticLayout = autoLayout;

    addECPServers(irisConnection, softwareSystem, focusedServer);
    const viewContainer = workspace.views.createContainerView(
        softwareSystem,
        'server-containers',
        'Container view for the focused server'
    );
    viewContainer.addNearestNeighbours(focusedServer);
    viewContainer.automaticLayout = autoLayout;

    const dbComponents = addDatabases(irisConnection, focusedServer, false);
    const nsComponents = addNamespaces(irisConnection, focusedServer, dbComponents);

    const viewComponents = workspace.views.createComponentView(
        focusedServer,
        'server-components',
        'Component view for the focused server'
    );
    viewComponents.addAllComponents();
    viewComponents.automaticLayout = autoLayout;

    // let sc: irisNative.IRISReturnType | null;
    // let oResultSet: irisNative.IRISObject | null;

    // const list = irisConnection.iris.classMethodIRISList('Config.Startup', 'GetList');
    // logChannel.debug('Config.Startup: sc=' + list.getString(1));
    // const dataList = list.getIRISList(2);
    // const output = [`Config.Startup (${dataList.count()} items):`];
    // for (let index = 0; index < dataList.count(); index++) {
    //     const element = dataList.getIRISList(index + 1);
    //     output.push(` ${element.getString(1)}=${element.getString(2)}`);
    // }
    // logChannel.info(output.join('\n'));

    irisConnection.dispose();

    return workspace;
}

function addECPServers(irisConnection: IRISConnection, softwareSystem: SoftwareSystem, focusedServer: Container) {
    if (!irisConnection.connection || !irisConnection.iris) {
        return;
    }

    const oResultSet = (irisConnection.iris.classMethodObject('%ResultSet', '%New', 'Config.ECPServers:List') as irisNative.IRISObject);
    if (oResultSet === null) {
        logChannel.warn('Error creating %ResultSet for Config.ECPServers:List');
        return;
    }

    const sc: irisNative.IRISReturnType | null = oResultSet.invoke('Execute');
    if (!sc) {
        logChannel.warn('Error executing query' + sc);
        irisConnection.connection.close();
        return;
    }
    logChannel.debug(`Query ${oResultSet.getString('QueryName')} executed successfully`);

    if (!oResultSet.invokeBoolean('%Next')) {
        logChannel.debug('No ECP servers found');
        return;
    }

    do {
        const sServerName = oResultSet.invokeString('Get', 'Name');
        const sAddress = oResultSet.invokeString('Get', 'Address');
        const iPort = oResultSet.invokeString('Get', 'Port');
        logChannel.debug('Server: ' + sServerName + ', Address: ' + sAddress + ', Port: ' + iPort);

        const ecpServer = softwareSystem.addContainer(
            `${sServerName}`,
            `At ${sAddress}:${iPort}`,
            'ECP data server'
        )!;
        ecpServer.url = getPortalUrl(irisConnection.serverSpec, '/csp/sys/mgr/%25CSP.UI.Portal.ECPDataServers.zen');
        focusedServer.uses(ecpServer, 'ECPs to');

    } while (oResultSet.invokeBoolean('%Next'));
}

function addDatabases(irisConnection: IRISConnection, focusedServer: Container, showSystemDBs: boolean): Map<string, Component> {
    const dbComponents = new Map<string, Component>();
    if (!irisConnection.connection || !irisConnection.iris) {
        return dbComponents;
    }

    const oResultSet = (irisConnection.iris.classMethodObject('%ResultSet', '%New', 'Config.Databases:List') as irisNative.IRISObject);
    if (oResultSet === null) {
        logChannel.warn('Error creating %ResultSet for Config.Databases:List');
        return dbComponents;
    }

    const sc: irisNative.IRISReturnType | null = oResultSet.invoke('Execute');
    if (!sc) {
        logChannel.warn('Error executing query' + sc);
        irisConnection.connection.close();
        return dbComponents;
    }
    logChannel.debug(`Query ${oResultSet.getString('QueryName')} executed successfully`);

    if (!oResultSet.invokeBoolean('%Next')) {
        logChannel.debug('No databases found');
        return dbComponents;
    }

    do {
        const sName = oResultSet.invokeString('Get', 'Name');
        const sDirectory = oResultSet.invokeString('Get', 'Directory');
        const sServer = oResultSet.invokeString('Get', 'Server');
        logChannel.debug('Database: ' + sName + ', Directory: ' + sDirectory + ', Server: ' + sServer);
        if (sName) {
            const isSystemDb = sServer ? false : irisConnection.iris.classMethodBoolean('SYS.Database', 'IsSystemDB', sDirectory) || false;
            if (isSystemDb && !showSystemDBs) {
                logChannel.debug(`Skipping system database ${sName}`);
                continue;
            }
            const database = focusedServer.addComponent(
                `${sName} database`,
                `${sServer ? `On ECP server ${sServer}` : 'Local'} at ${sDirectory}`,
                sServer ? 'rdb' : 'db',
                sServer ? 'Remote database' : 'Local database'
            )!;
            if (sServer) {
                database.url = getPortalUrl(irisConnection.serverSpec, '/csp/sys/mgr/%25CSP.UI.Portal.RemoteDatabases.zen');
            }
            else {
                // Determine if this is a system database
                database.url = getPortalUrl(irisConnection.serverSpec, '/csp/sys/op/%25CSP.UI.Portal.DatabaseDetails.zen', `$ID1=${sDirectory}&DBName=${sName}`);
            }
            dbComponents.set(sName, database);
            database.tags.add(sServer ? 'aRemoteDatabase' : isSystemDb ? 'aSystemDatabase' : 'aDatabase');
        }

    } while (oResultSet.invokeBoolean('%Next'));
    return dbComponents;
}

function addNamespaces(irisConnection: IRISConnection, focusedServer: Container, dbComponents: Map<string, Component>): Map<string, Component> {
    const nsComponents = new Map<string, Component>();
    if (!irisConnection.connection || !irisConnection.iris) {
        return nsComponents;
    }

    const oResultSet = (irisConnection.iris.classMethodObject('%ResultSet', '%New', 'Config.Namespaces:List') as irisNative.IRISObject);
    if (oResultSet === null) {
        logChannel.warn('Error creating %ResultSet for Config.Namespaces:List');
        return nsComponents;
    }

    const sc: irisNative.IRISReturnType | null = oResultSet.invoke('Execute');
    if (!sc) {
        logChannel.warn('Error executing query' + sc);
        irisConnection.connection.close();
        return nsComponents;
    }
    logChannel.debug(`Query ${oResultSet.getString('QueryName')} executed successfully`);

    if (!oResultSet.invokeBoolean('%Next')) {
        logChannel.debug('No namespaces found');
        return nsComponents;
    }

    do {
        const sName = oResultSet.invokeString('Get', 'Namespace');
        const sGlobalsDatabase = oResultSet.invokeString('Get', 'Globals') || '';
        const sRoutinesDatabase = oResultSet.invokeString('Get', 'Routines') || '';
        logChannel.debug('Namespace: ' + sName + ', Globals: ' + sGlobalsDatabase + ', Routines: ' + sRoutinesDatabase);
        if (sName) {
            const namespace = focusedServer.addComponent(
                `${sName} namespace`,
                `Globals in ${sGlobalsDatabase}, Routines in ${sRoutinesDatabase}`,
                'ns',
                'Namespace'
            )!;
            if (sName !== '%ALL') {
                namespace.url = getPortalUrl(irisConnection.serverSpec, '/csp/sys/exp/%25CSP.UI.Portal.GlobalList.zen', `$NAMESPACE=${sName}`);
            }
            nsComponents.set(sName, namespace);
            namespace.tags.add(sName === '%ALL' ? 'aPseudoNamespace' : 'aNamespace');
            const dbGlobals = dbComponents.get(sGlobalsDatabase);
            if (dbGlobals) {
                if (sGlobalsDatabase === sRoutinesDatabase) {
                    namespace.uses(dbGlobals, 'accesses', 'Globals and Routines');
                } else {
                    namespace.uses(dbGlobals, 'accesses', 'Globals');
                }
            }
            if (sGlobalsDatabase !== sRoutinesDatabase) {
                const dbRoutines = dbComponents.get(sRoutinesDatabase);
                if (dbRoutines) {
                    namespace.uses(dbRoutines, 'accesses', 'Routines');
                }
            }
        }

    } while (oResultSet.invokeBoolean('%Next'));
    return nsComponents;
}