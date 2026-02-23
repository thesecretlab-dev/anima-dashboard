param(
  [string]$RpcUrl = "http://127.0.0.1:9650/ext/bc/2L5JWLhXnDm8dPyBFMjBuqsbPSytL4bfbGJJj37jk5ri1KdXhd/rpc"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:ANIMA_VEIL_RPC)) {
  $env:ANIMA_VEIL_RPC = $RpcUrl
}

Write-Host "ANIMA_VEIL_RPC=$($env:ANIMA_VEIL_RPC)"
pnpm vitest run src/veil/chain.test.ts src/veil/markets.test.ts --maxWorkers=1 --reporter=dot
node --import tsx -e "import('./src/veil/tools.ts').then((m)=>{const n=m.getToolCount(); if(n<=0){throw new Error('tool count must be > 0')} console.log('VEIL tools:',n);})"
