# ILYAS AI COMMERCE — первичная установка на Windows
# Запуск: двойной щелчок по setup-windows.bat (или: npm run setup:windows)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "`nОШИБКА: $text" -ForegroundColor Red; Read-Host "Нажмите Enter для выхода"; exit 1 }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Step "Проверяю установленные программы"
if (-not (Has "node")) { Fail "Не найден Node.js. Установите Node.js 22 LTS: https://nodejs.org и запустите скрипт снова." }
$nodeMajor = [int]((node -v).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) { Fail "Нужен Node.js 20 или новее (сейчас $(node -v))." }
Write-Host "Node.js $(node -v) — OK"
$useDocker = Has "docker"
if ($useDocker) {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Fail "Docker установлен, но не запущен. Откройте Docker Desktop, дождитесь запуска и повторите." }
  Write-Host "Docker — OK"
} else {
  Write-Host "Docker не найден. Будет использован уже установленный PostgreSQL (адрес укажите в .env)." -ForegroundColor Yellow
}

Step "Готовлю файл настроек .env"
if (Test-Path ".env") {
  Write-Host ".env уже существует — не меняю его"
} else {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  $email = Read-Host "E-mail для входа владельца (например owner@mail.kz)"
  if (-not $email) { Fail "E-mail не указан" }
  do {
    $sec = Read-Host "Пароль владельца (минимум 10 символов)" -AsSecureString
    $password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  } while ($password.Length -lt 10)
  $dbUrl = "postgresql://ilyas:ilyas_dev_password@localhost:5432/ilyas_commerce?schema=public"
  $content = (Get-Content ".env.example" -Raw -Encoding UTF8)
  $content = $content -replace 'DATABASE_URL=".*"', "DATABASE_URL=`"$dbUrl`""
  $content = $content -replace 'AUTH_SECRET=".*"', "AUTH_SECRET=`"$secret`""
  $content = $content -replace 'OWNER_EMAIL=".*"', "OWNER_EMAIL=`"$email`""
  $content = $content -replace 'OWNER_PASSWORD=".*"', "OWNER_PASSWORD=`"$($password -replace '\$','$$$$')`""
  # Пишем без BOM — иначе Prisma не прочитает первую строку
  [IO.File]::WriteAllText((Join-Path (Get-Location) ".env"), $content, (New-Object Text.UTF8Encoding($false)))
  Write-Host ".env создан (секретный ключ сгенерирован автоматически)"
}

if ($useDocker) {
  Step "Запускаю базу данных PostgreSQL в Docker"
  docker compose up -d db
  if ($LASTEXITCODE -ne 0) { Fail "Не удалось запустить базу в Docker" }
  Write-Host "Жду готовности базы..."
  for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T db pg_isready -U ilyas -d ilyas_commerce *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
  }
}

Step "Устанавливаю зависимости (npm install) — это может занять несколько минут"
npm install
if ($LASTEXITCODE -ne 0) { Fail "npm install завершился с ошибкой" }

Step "Создаю таблицы в базе"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Fail "Не удалось применить миграции. Проверьте DATABASE_URL в .env" }

Step "Создаю владельца и демо-данные"
npm run db:seed
if ($LASTEXITCODE -ne 0) { Fail "Ошибка при заполнении базы" }

Write-Host "`nГотово! Теперь запустите start-windows.bat и откройте http://localhost:3000" -ForegroundColor Green
Read-Host "Нажмите Enter для выхода"
