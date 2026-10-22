param([string]$Target = 'src/features/operations/compute')
$ErrorActionPreference = 'Stop'
if (-not $env:npm_execpath) { throw 'Run through npm run verify:memory.' }
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskRunner = Join-Path $PSScriptRoot 'resource-safe-validation.mjs'
$taskRepo = Split-Path $PSScriptRoot -Parent
$taskReportDirectory = Join-Path $taskRepo '.codex-tmp/memory'
$taskStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Path $taskReportDirectory -Force | Out-Null
$taskStdout = Join-Path $taskReportDirectory "$taskStamp-stdout.log"
$taskStderr = Join-Path $taskReportDirectory "$taskStamp-stderr.log"
$taskSamples = [System.Collections.Generic.List[object]]::new()
$taskBaseline = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes
if ($taskBaseline -lt 3072) { throw "Only $taskBaseline MB available. No test started." }
# No command string is evaluated by a shell. Reject quotes in this local target argument.
if ($Target.Contains('"')) { throw 'Target may not contain double quotes.' }
$taskArguments = '"{0}" unit "{1}"' -f $taskRunner, $Target
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList $taskArguments -WorkingDirectory $taskRepo -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
$null = $taskProcess.Handle # Keep the handle so ExitCode remains available after exit.
$taskKnown = [System.Collections.Generic.HashSet[int]]::new()
[void]$taskKnown.Add($taskProcess.Id)
do {
  $taskRecords = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
  do {
    $taskAdded = $false
    foreach ($taskRecord in $taskRecords) {
      if ($taskKnown.Contains([int]$taskRecord.ParentProcessId) -and $taskKnown.Add([int]$taskRecord.ProcessId)) { $taskAdded = $true }
    }
  } while ($taskAdded)
  $taskMembers = @(foreach ($taskRecord in $taskRecords) {
    if ($taskKnown.Contains([int]$taskRecord.ProcessId)) { Get-Process -Id $taskRecord.ProcessId -ErrorAction SilentlyContinue }
  })
  $taskAvailable = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes
  $taskSamples.Add([pscustomobject]@{
    TimeUtc = (Get-Date).ToUniversalTime().ToString('o')
    AvailableMB = $taskAvailable
    CimReportedFreeMB = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
    TreeWorkingSetMB = [math]::Round(($taskMembers | Measure-Object WorkingSet64 -Sum).Sum / 1MB)
    TreePrivateMB = [math]::Round(($taskMembers | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB)
    ProcessCount = $taskMembers.Count
  })
  if ($taskAvailable -lt 2048) { Write-Warning 'Available RAM below 2 GB. Do not start additional work. The managed runner cancels its own stage below the sustained threshold.' }
  Start-Sleep -Seconds 2
  $taskProcess.Refresh()
} while (-not $taskProcess.HasExited)
$taskProcess.WaitForExit()
$taskReport = [pscustomobject]@{
  Target = $Target
  WorkerLimit = 2
  SampleIntervalSeconds = 2
  BaselineAvailableMB = $taskBaseline
  MinimumAvailableMB = ($taskSamples | Measure-Object AvailableMB -Minimum).Minimum
  PeakTreeWorkingSetMB = ($taskSamples | Measure-Object TreeWorkingSetMB -Maximum).Maximum
  PeakTreePrivateMB = ($taskSamples | Measure-Object TreePrivateMB -Maximum).Maximum
  PeakProcessCount = ($taskSamples | Measure-Object ProcessCount -Maximum).Maximum
  ExitCode = $taskProcess.ExitCode
  Notes = 'Sampled process-tree working sets can share pages; private bytes are committed memory, not physical RAM. This is not an exact instantaneous peak or a comparison against an uncapped baseline.'
}
$taskReportPath = Join-Path $taskReportDirectory "$taskStamp-summary.json"
$taskSamples | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskReportDirectory "$taskStamp-samples.json") -Encoding UTF8
$taskReport | ConvertTo-Json | Set-Content -LiteralPath $taskReportPath -Encoding UTF8
Get-Content -LiteralPath $taskStdout -Tail 16
if ((Get-Item -LiteralPath $taskStderr).Length -gt 0) { Get-Content -LiteralPath $taskStderr -Tail 12 }
$taskReport | ConvertTo-Json
Write-Output "Report: $taskReportPath"
exit $taskProcess.ExitCode
