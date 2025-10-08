/// an example of Installer class just to create a new clear namespace and databases IRISAPP-DATA and IRISAPP-CODE
Class App.Installer
{

XData setup
{
<Manifest>
  <Namespace Name="INTEROP-APP" Code="INTEROP-APP-CODE" Data="INTEROP-APP-DATA" Create="yes" Ensemble="1">
    <Configuration>
      <Database Name="INTEROP-APP-DATA" Dir="${mgrdir}interop-app/data" Create="yes" Resource="%DB_INTEROP-APP-DATA"/>
      <Database Name="INTEROP-APP-CODE" Dir="${mgrdir}interop-app/code" Create="yes" Resource="%DB_INTEROP-APP-CODE"/>
    </Configuration>
  </Namespace>

  <Namespace Name="APP-REMOTE-A" Code="APP-CODE" Data="DS-A_APP-DATA" Create="yes" Ensemble="0">
    <Configuration>
      <Database Name="APP-CODE" Dir="${mgrdir}app/code" Create="yes" Resource="%DB_APP-CODE"/>
    </Configuration>
  </Namespace>
  <Namespace Name="APP-REMOTE-B" Code="APP-CODE" Data="DS-B_APP-DATA" Create="yes" Ensemble="0">
    <Configuration>
    </Configuration>
  </Namespace>

</Manifest>
}

ClassMethod setup(ByRef pVars, pLogLevel As %Integer = 3, pInstaller As %Installer.Installer, pLogger As %Installer.AbstractLogger) As %Status [ CodeMode = objectgenerator, Internal ]
{
  #; Let XGL document generate code for this method. 
  Quit ##class(%Installer.Manifest).%Generate(%compiledclass, %code, "setup")
}

}
