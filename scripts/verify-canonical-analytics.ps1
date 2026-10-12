$ErrorActionPreference = "Stop"

$productionRoot = Split-Path -Parent $PSScriptRoot
$backtestRoot = Join-Path (Split-Path -Parent $productionRoot) "GridPulse-Fullb"
if (-not (Test-Path -LiteralPath (Join-Path $backtestRoot "pyproject.toml"))) {
  throw "Expected sibling GridPulse-Fullb repository was not found."
}

function Invoke-Gate([string]$Name, [scriptblock]$Action) {
  Write-Host "[canonical-gate] $Name"
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
}

Push-Location $productionRoot
try {
  Invoke-Gate "Production TypeScript" { npm run typecheck }
  Invoke-Gate "Production contracts" { npx vitest run src/features/analytics/contracts.test.ts src/lib/analytics-api.test.ts src/components/product/product-navigation.test.ts src/config/product-mode.test.ts }
  Invoke-Gate "Production Python API" {
    $env:PYTHONPATH = (Resolve-Path "services/grid-data/src").Path
    python -m pytest services/grid-data/tests/test_api.py services/grid-data/tests/test_canonical_engine_integration.py services/grid-data/tests/test_architecture_boundaries.py -q
  }
  if ($env:GRIDPULSE_RUN_SLOW -eq "1") {
    Invoke-Gate "Production full unit suite" { npm test }
    Invoke-Gate "Production encoding" { npm run check:encoding }
    Invoke-Gate "Production client and SSR build" { npm run build }
    Invoke-Gate "Power Finder end-to-end" { npm run test:e2e:finder }
    if ($env:GRIDPULSE_RUN_EXTERNAL -eq "1") {
      Invoke-Gate "Deployed Public Finder security" { npm run security:public-finder }
    } else {
      Write-Host "[canonical-gate] Deployed security probe skipped; set GRIDPULSE_RUN_EXTERNAL=1 only against the release environment."
    }
  }
} finally {
  Pop-Location
}

Push-Location $backtestRoot
try {
  $python = Join-Path $backtestRoot ".venv/Scripts/python.exe"
  Invoke-Gate "Backtest fast suite" { & $python -m pytest -m "not slow" -q }
  Invoke-Gate "Backtest application typing" { & $python -m mypy src/capacity_backtest/application }
  Invoke-Gate "Backtest lint" { & $python -m ruff check src/capacity_backtest/application tests/test_application_*.py }
  if ($env:GRIDPULSE_RUN_SLOW -eq "1") {
    # Keep release-only suites isolated and ordered. A native-library or
    # process-level failure then identifies the owning subsystem instead of
    # making the entire release gate appear to stop without a result.
    Invoke-Gate "Backtest slow: public capacity data" { & $python -m pytest tests/test_capacity_real_public.py --run-slow -q }
    Invoke-Gate "Backtest slow: capacity pipeline" { & $python -m pytest tests/test_capacity_study_pipeline_integration.py --run-slow -q }
    Invoke-Gate "Backtest slow: network study" { & $python -m pytest tests/test_network_study.py --run-slow -q }
    Invoke-Gate "Backtest slow: research pipeline" { & $python -m pytest tests/test_research_pipeline.py --run-slow -q }
  } else {
    Write-Host "[canonical-gate] Slow suite skipped; set GRIDPULSE_RUN_SLOW=1 for release qualification."
  }
} finally {
  Pop-Location
}

Write-Host "[canonical-gate] All requested gates passed."
