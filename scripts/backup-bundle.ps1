# backup-bundle.ps1 -- Gera snapshot completo do repo Capi Studio v2 em um
# unico arquivo .bundle, copiavel para Drive/OneDrive/HD externo.
#
# Uso (PowerShell, na raiz do projeto):
#   .\scripts\backup-bundle.ps1
#
# Opcional -- destino customizado:
#   .\scripts\backup-bundle.ps1 -DestDir "D:\Backups\CapiStudio"
#
# Default: salva em ..\..\ (uma pasta acima do projeto, ex: Desktop\Capi Studio 0.2\).
#
# O que o .bundle contem:
#   - Toda a historia de commits (main + branches + tags)
#   - Conteudo exato do HEAD atual
#   - Verificacao de integridade no fim (git bundle verify)
#
# Como restaurar (em qualquer maquina com git):
#   git clone <caminho-do-bundle> capi-studio-restored
#
# Recomendacao operacional:
#   1. Rodar dia 1 de cada mes
#   2. Copiar o .bundle gerado para Google Drive (ou OneDrive) NA HORA
#   3. Manter os 6 ultimos meses; deletar os mais antigos
#   4. Verificar 1x por trimestre que o bundle mais recente abre via git clone
#      (validacao de que nao corrompeu silenciosamente)

[CmdletBinding()]
param(
    [string]$DestDir
)

$ErrorActionPreference = 'Stop'

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not (Test-Path (Join-Path $projectRoot '.git'))) {
    Write-Error "Pasta $projectRoot nao e um repositorio git."
    exit 1
}

if (-not $DestDir) {
    $DestDir = (Resolve-Path (Join-Path $projectRoot '..')).Path
}
if (-not (Test-Path $DestDir)) {
    New-Item -ItemType Directory -Path $DestDir | Out-Null
}

$dateTag = Get-Date -Format 'yyyy-MM-dd_HHmm'
$bundleName = "capi-studio-v2-backup-$dateTag.bundle"
$bundlePath = Join-Path $DestDir $bundleName

Push-Location $projectRoot
try {
    Write-Host ""
    Write-Host "  Capi Studio v2 -- backup bundle"
    Write-Host "  -------------------------------"
    Write-Host ""
    Write-Host "  Origem:   $projectRoot"
    Write-Host "  Destino:  $bundlePath"
    Write-Host ""

    $status = git status --porcelain
    if ($status) {
        Write-Host "  AVISO: working tree nao esta limpo. Mudancas nao-commitadas:" -ForegroundColor Yellow
        Write-Host $status
        Write-Host "  Bundle vai capturar so o que ja foi commitado." -ForegroundColor Yellow
        Write-Host ""
    }

    Write-Host "  -> git bundle create --all ..."
    git bundle create $bundlePath --all
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao criar bundle."
        exit 1
    }

    Write-Host ""
    Write-Host "  -> git bundle verify ..."
    git bundle verify $bundlePath
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Bundle corrompido. NAO CONFIE NESSE ARQUIVO."
        exit 1
    }

    $sizeMb = [math]::Round((Get-Item $bundlePath).Length / 1MB, 2)
    Write-Host ""
    Write-Host "  Bundle pronto: $bundleName ($sizeMb MB)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Proximo passo MANUAL (nao automatizado por seguranca):"
    Write-Host "    1. Copiar este .bundle para Google Drive / OneDrive AGORA"
    Write-Host "    2. Verificar que o upload concluiu antes de fechar o terminal"
    Write-Host ""
}
finally {
    Pop-Location
}
